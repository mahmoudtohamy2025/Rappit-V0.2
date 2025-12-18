import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateOrderFromChannelDto } from './dto/create-order-from-channel.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { AddOrderNoteDto } from './dto/add-order-note.dto';
import { ActorType } from '@common/enums/actor-type.enum';
import {
  canTransition,
  shouldReserveInventory,
  shouldReleaseInventory,
  getTimestampFieldForStatus,
} from '@common/helpers/order-state-machine';
import { OrderStatus, Prisma } from '@prisma/client';
import { createPaginatedResponse } from '@common/dto/pagination.dto';

/**
 * OrdersService - Order Lifecycle & State Machine
 *
 * Implements the 11-state order lifecycle with state machine validation,
 * timeline events, and integration with InventoryService (Model C).
 */
@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private inventoryService: InventoryService,
  ) {}

  /**
   * Create or update an order from channel payload (Upsert semantics)
   *
   * Implements idempotent order import from sales channels (Shopify, WooCommerce).
   *
   * Algorithm:
   * 1. Find or create customer
   * 2. Find or create shipping/billing addresses
   * 3. Upsert order based on (organizationId, channelId, externalOrderId)
   * 4. Reconcile order items (upsert based on externalItemId)
   * 5. If new order or status changed to NEW/RESERVED → reserve inventory
   * 6. Create timeline event
   *
   * @param payload - Order data from channel
   * @param organizationId - Organization ID (multi-tenant scoping)
   * @param actorType - Who triggered this (CHANNEL, SYSTEM, etc.)
   * @param actorId - Actor ID (channel ID, user ID, etc.)
   * @returns Created or updated order
   */
  async createOrUpdateOrderFromChannelPayload(
    payload: CreateOrderFromChannelDto,
    organizationId: string,
    actorType: ActorType = ActorType.CHANNEL,
    actorId?: string,
  ) {
    this.logger.log(
      `Creating/updating order from channel. externalOrderId: ${payload.externalOrderId}`,
    );

    return this.prisma.$transaction(async (tx) => {
      // 1. Find or create customer
      const customer = await tx.customer.upsert({
        where: {
          organizationId_externalId: {
            organizationId,
            externalId: payload.customer.externalId || payload.externalOrderId,
          },
        },
        create: {
          organizationId,
          externalId: payload.customer.externalId || payload.externalOrderId,
          firstName: payload.customer.firstName,
          lastName: payload.customer.lastName,
          email: payload.customer.email,
          phone: payload.customer.phone,
          metadata: payload.customer.metadata || {},
        },
        update: {
          firstName: payload.customer.firstName,
          lastName: payload.customer.lastName,
          email: payload.customer.email || undefined,
          phone: payload.customer.phone || undefined,
          metadata: payload.customer.metadata || {},
        },
      });

      // 2. Create shipping address
      const shippingAddress = await tx.address.create({
        data: {
          customerId: customer.id,
          type: 'SHIPPING',
          firstName: payload.shippingAddress.firstName,
          lastName: payload.shippingAddress.lastName,
          company: payload.shippingAddress.company,
          street1: payload.shippingAddress.street1,
          street2: payload.shippingAddress.street2,
          city: payload.shippingAddress.city,
          state: payload.shippingAddress.state,
          postalCode: payload.shippingAddress.postalCode,
          country: payload.shippingAddress.country,
          phone: payload.shippingAddress.phone,
        },
      });

      // 3. Create billing address (or use shipping)
      const billingAddress = payload.billingAddress
        ? await tx.address.create({
            data: {
              customerId: customer.id,
              type: 'BILLING',
              firstName: payload.billingAddress.firstName,
              lastName: payload.billingAddress.lastName,
              company: payload.billingAddress.company,
              street1: payload.billingAddress.street1,
              street2: payload.billingAddress.street2,
              city: payload.billingAddress.city,
              state: payload.billingAddress.state,
              postalCode: payload.billingAddress.postalCode,
              country: payload.billingAddress.country,
              phone: payload.billingAddress.phone,
            },
          })
        : shippingAddress;

      // 4. Check if order already exists
      const existingOrder = await tx.order.findUnique({
        where: {
          organizationId_channelId_externalOrderId: {
            organizationId,
            channelId: payload.channelId,
            externalOrderId: payload.externalOrderId,
          },
        },
        include: {
          items: true,
        },
      });

      const isNewOrder = !existingOrder;
      const orderNumber =
        existingOrder?.orderNumber ||
        payload.orderNumber ||
        await this.generateOrderNumber(organizationId);

      // 5. Resolve SKU IDs for order items
      const itemsWithSkuIds = await Promise.all(
        payload.items.map(async (item) => {
          const sku = await tx.sKU.findUnique({
            where: { sku: item.sku },
          });

          if (!sku) {
            throw new BadRequestException(
              `SKU not found: ${item.sku}. Please ensure all SKUs exist before importing orders.`,
            );
          }

          return {
            ...item,
            skuId: sku.id,
          };
        }),
      );

      // 6. Upsert order
      const order = await tx.order.upsert({
        where: {
          organizationId_channelId_externalOrderId: {
            organizationId,
            channelId: payload.channelId,
            externalOrderId: payload.externalOrderId,
          },
        },
        create: {
          organizationId,
          channelId: payload.channelId,
          customerId: customer.id,
          shippingAddressId: shippingAddress.id,
          billingAddressId: billingAddress.id,
          externalOrderId: payload.externalOrderId,
          orderNumber,
          status: 'NEW',
          paymentStatus: payload.paymentStatus || 'PENDING',
          subtotal: payload.subtotal,
          shippingCost: payload.shippingCost || 0,
          taxAmount: payload.taxAmount || 0,
          discountAmount: payload.discountAmount || 0,
          totalAmount: payload.totalAmount,
          currency: payload.currency || 'SAR',
          customerNote: payload.customerNote,
          tags: payload.tags || [],
          metadata: payload.metadata || {},
          importedAt: payload.orderDate ? new Date(payload.orderDate) : new Date(),
        },
        update: {
          // Update financial details if changed
          subtotal: payload.subtotal,
          shippingCost: payload.shippingCost || 0,
          taxAmount: payload.taxAmount || 0,
          discountAmount: payload.discountAmount || 0,
          totalAmount: payload.totalAmount,
          paymentStatus: payload.paymentStatus || undefined,
          customerNote: payload.customerNote || undefined,
          tags: payload.tags || undefined,
          metadata: payload.metadata || {},
        },
        include: {
          items: true,
          channel: true,
        },
      });

      // 7. Reconcile order items (upsert based on externalItemId)
      for (const itemData of itemsWithSkuIds) {
        await tx.orderItem.upsert({
          where: {
            orderId_externalItemId: {
              orderId: order.id,
              externalItemId: itemData.externalItemId,
            },
          },
          create: {
            orderId: order.id,
            skuId: itemData.skuId,
            externalItemId: itemData.externalItemId,
            name: itemData.name,
            variantName: itemData.variantName,
            quantity: itemData.quantity,
            unitPrice: itemData.unitPrice,
            totalPrice: itemData.totalPrice,
            taxAmount: itemData.taxAmount || 0,
            discountAmount: itemData.discountAmount || 0,
            metadata: itemData.metadata || {},
          },
          update: {
            quantity: itemData.quantity,
            unitPrice: itemData.unitPrice,
            totalPrice: itemData.totalPrice,
            taxAmount: itemData.taxAmount || 0,
            discountAmount: itemData.discountAmount || 0,
          },
        });
      }

      // 8. Create timeline event
      await tx.orderTimelineEvent.create({
        data: {
          orderId: order.id,
          organizationId,
          eventType: isNewOrder ? 'order_created' : 'order_updated',
          actorType,
          actorId,
          description: isNewOrder
            ? `Order imported from ${order.channel.name}`
            : `Order updated from ${order.channel.name}`,
          metadata: {
            externalOrderId: payload.externalOrderId,
            channelName: order.channel.name,
          },
        },
      });

      this.logger.log(
        `Order ${isNewOrder ? 'created' : 'updated'}: ${order.orderNumber}`,
      );

      return order;
    }).then(async (order) => {
      // 9. Reserve inventory AFTER transaction commits (separate transaction for safety)
      // Only reserve if new order or status is NEW/RESERVED
      if (order.status === 'NEW' || order.status === 'RESERVED') {
        try {
          await this.inventoryService.reserveStockForOrder(
            order.id,
            organizationId,
          );

          // Update order status to RESERVED and create timeline event
          await this.updateOrderStatus(
            order.id,
            'RESERVED',
            ActorType.SYSTEM,
            null,
            organizationId,
          );
        } catch (error) {
          this.logger.error(
            `Failed to reserve inventory for order ${order.orderNumber}: ${error.message}`,
          );
          // Order stays in NEW status - manual intervention required
        }
      }

      return order;
    });
  }

  /**
   * Update order status with state machine validation
   *
   * Enforces valid state transitions, updates timestamps, creates timeline events,
   * and triggers inventory actions.
   *
   * @param orderId - Order ID
   * @param newStatus - New status to transition to
   * @param actorType - Who triggered this change
   * @param actorId - Actor ID (user ID, system ID, etc.)
   * @param organizationId - Organization ID (multi-tenant scoping)
   * @param comment - Optional comment for the status change
   * @returns Updated order
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    actorType: ActorType,
    actorId: string | null,
    organizationId: string,
    comment?: string,
  ) {
    this.logger.log(`Updating order ${orderId} status to ${newStatus}`);

    // Get current order
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        organizationId,
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate state transition
    if (!canTransition(order.status, newStatus)) {
      throw new BadRequestException(
        `Invalid state transition from ${order.status} to ${newStatus}`,
      );
    }

    // Prepare timestamp update
    const timestampField = getTimestampFieldForStatus(newStatus);
    const timestampUpdate: any = {};
    if (timestampField) {
      timestampUpdate[timestampField] = new Date();
    }

    // Update order status within transaction
    return this.prisma.$transaction(async (tx) => {
      // Update order
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: newStatus,
          ...timestampUpdate,
          updatedById: actorId,
        },
        include: {
          items: true,
          channel: true,
          customer: true,
        },
      });

      // Create timeline event
      await tx.orderTimelineEvent.create({
        data: {
          orderId: order.id,
          organizationId,
          eventType: 'status_changed',
          actorType,
          actorId,
          fromStatus: order.status,
          toStatus: newStatus,
          description: comment || `Status changed from ${order.status} to ${newStatus}`,
          metadata: {
            comment,
          },
        },
      });

      this.logger.log(
        `Order ${order.orderNumber} status updated: ${order.status} → ${newStatus}`,
      );

      return updatedOrder;
    }).then(async (updatedOrder) => {
      // Trigger inventory actions AFTER transaction commits

      // Reserve inventory if transitioning to NEW or RESERVED
      if (shouldReserveInventory(newStatus)) {
        try {
          await this.inventoryService.reserveStockForOrder(
            orderId,
            organizationId,
          );

          await this.appendOrderTimelineEvent(
            orderId,
            'inventory_reserved',
            ActorType.SYSTEM,
            organizationId,
            null,
            { itemCount: order.items.length },
          );
        } catch (error) {
          this.logger.error(
            `Failed to reserve inventory for order ${order.orderNumber}: ${error.message}`,
          );
          throw new BadRequestException(
            `Status updated but inventory reservation failed: ${error.message}`,
          );
        }
      }

      // Release inventory if transitioning to CANCELLED or RETURNED
      if (shouldReleaseInventory(newStatus)) {
        try {
          const reason = newStatus === 'CANCELLED' ? 'cancelled' : 'returned';
          await this.inventoryService.releaseStockForOrder(
            orderId,
            organizationId,
            reason,
          );

          await this.appendOrderTimelineEvent(
            orderId,
            'inventory_released',
            ActorType.SYSTEM,
            organizationId,
            null,
            { reason, itemCount: order.items.length },
          );
        } catch (error) {
          this.logger.error(
            `Failed to release inventory for order ${order.orderNumber}: ${error.message}`,
          );
          // Non-critical - can be retried manually
        }
      }

      return updatedOrder;
    });
  }

  /**
   * Append a timeline event to an order
   *
   * @param orderId - Order ID
   * @param eventType - Event type ('note_added', 'inventory_reserved', etc.)
   * @param actorType - Who triggered this event
   * @param organizationId - Organization ID
   * @param actorId - Actor ID (user ID, etc.)
   * @param metadata - Additional event metadata
   * @param description - Event description
   * @returns Created timeline event
   */
  async appendOrderTimelineEvent(
    orderId: string,
    eventType: string,
    actorType: ActorType,
    organizationId: string,
    actorId?: string | null,
    metadata?: any,
    description?: string,
  ) {
    // Verify order exists and belongs to organization
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        organizationId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const event = await this.prisma.orderTimelineEvent.create({
      data: {
        orderId,
        organizationId,
        eventType,
        actorType,
        actorId,
        description,
        metadata: metadata || {},
      },
    });

    this.logger.log(
      `Timeline event added to order ${order.orderNumber}: ${eventType}`,
    );

    return event;
  }

  /**
   * Add a note to an order
   *
   * @param orderId - Order ID
   * @param dto - Note DTO
   * @param organizationId - Organization ID
   * @param userId - User ID who added the note
   * @returns Created timeline event
   */
  async addNote(
    orderId: string,
    dto: AddOrderNoteDto,
    organizationId: string,
    userId: string,
  ) {
    // Also append to internal notes
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        organizationId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const currentNotes = order.internalNotes || '';
    const timestamp = new Date().toISOString();
    const newNotes = `${currentNotes}\n\n[${timestamp}] ${dto.note}`.trim();

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        internalNotes: newNotes,
        updatedById: userId,
      },
    });

    return this.appendOrderTimelineEvent(
      orderId,
      'note_added',
      ActorType.USER,
      organizationId,
      userId,
      { note: dto.note },
      dto.note,
    );
  }

  /**
   * Find all orders with filters and pagination
   *
   * @param organizationId - Organization ID
   * @param filters - Filter and pagination options
   * @returns Paginated orders
   */
  async findAll(organizationId: string, filters: FilterOrdersDto) {
    const { page = 1, limit = 20, status, channelId, search, startDate, endDate } = filters;

    const where: Prisma.OrderWhereInput = { organizationId };

    if (status) {
      where.status = status;
    }

    if (channelId) {
      where.channelId = channelId;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { externalOrderId: { contains: search, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    if (startDate || endDate) {
      where.importedAt = {};
      if (startDate) where.importedAt.gte = new Date(startDate);
      if (endDate) where.importedAt.lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              sku: true,
            },
          },
          channel: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          shipments: {
            select: {
              id: true,
              trackingNumber: true,
              status: true,
            },
          },
        },
        orderBy: { importedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return createPaginatedResponse(orders, total, page, limit);
  }

  /**
   * Find one order by ID with full details
   *
   * @param organizationId - Organization ID
   * @param orderId - Order ID
   * @returns Order with all relations
   */
  async findOne(organizationId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        organizationId,
      },
      include: {
        items: {
          include: {
            sku: {
              include: {
                product: true,
              },
            },
            reservations: {
              where: {
                releasedAt: null, // Only active reservations
              },
            },
          },
        },
        channel: true,
        customer: {
          include: {
            addresses: true,
          },
        },
        shippingAddress: true,
        billingAddress: true,
        shipments: {
          include: {
            trackingEvents: {
              orderBy: { eventTime: 'desc' },
              take: 10,
            },
          },
        },
        reservations: {
          include: {
            inventoryItem: {
              include: {
                sku: true,
              },
            },
          },
        },
        timelineEvents: {
          orderBy: { createdAt: 'desc' },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Generate unique order number for organization
   *
   * Format: ORD-{YEAR}{MONTH}-{SEQUENCE}
   * Example: ORD-202412-00001
   *
   * @param organizationId - Organization ID
   * @returns Generated order number
   */
  private async generateOrderNumber(organizationId: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `ORD-${year}${month}-`;

    // Get the count of orders for this organization this month
    const count = await this.prisma.order.count({
      where: {
        organizationId,
        orderNumber: {
          startsWith: prefix,
        },
      },
    });

    const sequence = String(count + 1).padStart(5, '0');
    return `${prefix}${sequence}`;
  }

  /**
   * Delete an order (only if in NEW or CANCELLED status)
   *
   * @param organizationId - Organization ID
   * @param orderId - Order ID
   * @returns Deletion result
   */
  async delete(organizationId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        organizationId,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!['NEW', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestException(
        `Cannot delete order in status ${order.status}. Only NEW or CANCELLED orders can be deleted.`,
      );
    }

    await this.prisma.order.delete({
      where: { id: orderId },
    });

    this.logger.log(`Order deleted: ${order.orderNumber}`);

    return { message: 'Order deleted successfully' };
  }
}
