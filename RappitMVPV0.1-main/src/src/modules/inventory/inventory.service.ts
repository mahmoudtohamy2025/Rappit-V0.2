import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { Prisma } from '@prisma/client';

/**
 * InventoryService - Model C Implementation
 *
 * Model C: Auto-reserve on order import, release on cancel/return
 *
 * Key behaviors:
 * - When order moves to NEW -> auto-reserve inventory
 * - When order is CANCELLED -> release inventory
 * - When order is RETURNED -> release inventory
 * - When order is DELIVERED -> keep reservation (deduct from total)
 *
 * Guarantees:
 * - No negative inventory (quantityAvailable >= 0)
 * - Idempotent operations (safe to call multiple times)
 * - Atomic transactions (all-or-nothing)
 */
@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Reserve stock for an order (Model C - Auto-reserve on import)
   *
   * Called when order transitions to NEW or RESERVED status
   *
   * Algorithm:
   * 1. Get all order items
   * 2. For each item, find InventoryItem by SKU
   * 3. Check if reservation already exists (idempotency)
   * 4. Check if sufficient stock available
   * 5. Create reservation record
   * 6. Update quantityReserved and quantityAvailable
   *
   * @param orderId - Order ID to reserve stock for
   * @param organizationId - Organization ID (multi-tenant scoping)
   * @throws NotFoundException if order not found
   * @throws BadRequestException if insufficient stock
   * @returns Array of created reservations
   */
  async reserveStockForOrder(orderId: string, organizationId: string) {
    this.logger.log(`Reserving stock for order ${orderId}`);

    // Get order with items
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        organizationId,
      },
      include: {
        items: {
          include: {
            sku: true,
            reservations: {
              where: {
                releasedAt: null, // Only active reservations
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check for existing active reservations (idempotency)
    const hasActiveReservations = order.items.some(
      (item) => item.reservations.length > 0,
    );

    if (hasActiveReservations) {
      this.logger.warn(
        `Order ${orderId} already has active reservations. Skipping reserve.`,
      );
      return order.items.flatMap((item) => item.reservations);
    }

    // Use transaction to ensure atomicity
    const reservations = await this.prisma.$transaction(async (tx) => {
      const createdReservations = [];

      for (const orderItem of order.items) {
        // Find inventory item for this SKU
        const inventoryItem = await tx.inventoryItem.findFirst({
          where: {
            organizationId,
            skuId: orderItem.skuId,
          },
        });

        if (!inventoryItem) {
          throw new NotFoundException(
            `Inventory item not found for SKU: ${orderItem.sku.sku}`,
          );
        }

        // Check if sufficient stock available
        if (inventoryItem.quantityAvailable < orderItem.quantity) {
          throw new BadRequestException(
            `Insufficient stock for SKU ${orderItem.sku.sku}. ` +
            `Available: ${inventoryItem.quantityAvailable}, Required: ${orderItem.quantity}`,
          );
        }

        // Create reservation
        const reservation = await tx.inventoryReservation.create({
          data: {
            inventoryItemId: inventoryItem.id,
            orderId: order.id,
            orderItemId: orderItem.id,
            quantityReserved: orderItem.quantity,
          },
        });

        // Update inventory quantities
        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            quantityReserved: {
              increment: orderItem.quantity,
            },
            quantityAvailable: {
              decrement: orderItem.quantity,
            },
          },
        });

        // Log adjustment
        await tx.inventoryAdjustment.create({
          data: {
            organizationId,
            inventoryItemId: inventoryItem.id,
            userId: order.createdById || order.updatedById || 'system',
            type: 'SALE',
            quantityChange: -orderItem.quantity,
            reason: 'Reserved for order',
            referenceType: 'order',
            referenceId: order.id,
            notes: `Reserved ${orderItem.quantity} units for order ${order.orderNumber}`,
          },
        });

        createdReservations.push(reservation);

        this.logger.log(
          `Reserved ${orderItem.quantity} units of SKU ${orderItem.sku.sku} for order ${order.orderNumber}`,
        );
      }

      return createdReservations;
    });

    this.logger.log(
      `Successfully reserved stock for order ${order.orderNumber} (${reservations.length} items)`,
    );

    return reservations;
  }

  /**
   * Release stock for an order (Model C - Release on cancel/return)
   *
   * Called when order transitions to CANCELLED or RETURNED status
   *
   * Algorithm:
   * 1. Get all active reservations for order
   * 2. For each reservation, check if already released (idempotency)
   * 3. Mark reservation as released
   * 4. Update quantityReserved and quantityAvailable
   *
   * @param orderId - Order ID to release stock for
   * @param organizationId - Organization ID (multi-tenant scoping)
   * @param reason - Reason for release ('cancelled' or 'returned')
   * @throws NotFoundException if order not found
   * @returns Array of released reservations
   */
  async releaseStockForOrder(
    orderId: string,
    organizationId: string,
    reason: string,
  ) {
    this.logger.log(`Releasing stock for order ${orderId} (reason: ${reason})`);

    // Get order with active reservations
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        organizationId,
      },
      include: {
        items: {
          include: {
            sku: true,
            reservations: {
              where: {
                releasedAt: null, // Only active reservations
              },
              include: {
                inventoryItem: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Get all active reservations
    const activeReservations = order.items.flatMap((item) => item.reservations);

    if (activeReservations.length === 0) {
      this.logger.warn(
        `Order ${orderId} has no active reservations. Skipping release.`,
      );
      return [];
    }

    // Use transaction to ensure atomicity
    const releasedReservations = await this.prisma.$transaction(async (tx) => {
      const released = [];

      for (const reservation of activeReservations) {
        // Mark reservation as released
        const updatedReservation = await tx.inventoryReservation.update({
          where: { id: reservation.id },
          data: {
            releasedAt: new Date(),
            reason,
          },
        });

        // Update inventory quantities
        await tx.inventoryItem.update({
          where: { id: reservation.inventoryItemId },
          data: {
            quantityReserved: {
              decrement: reservation.quantityReserved,
            },
            quantityAvailable: {
              increment: reservation.quantityReserved,
            },
          },
        });

        // Log adjustment
        await tx.inventoryAdjustment.create({
          data: {
            organizationId,
            inventoryItemId: reservation.inventoryItemId,
            userId: order.updatedById || order.createdById || 'system',
            type: reason === 'returned' ? 'RETURN' : 'CORRECTION',
            quantityChange: reservation.quantityReserved,
            reason: `Released from ${reason} order`,
            referenceType: 'order',
            referenceId: order.id,
            notes: `Released ${reservation.quantityReserved} units from order ${order.orderNumber} (${reason})`,
          },
        });

        released.push(updatedReservation);

        this.logger.log(
          `Released ${reservation.quantityReserved} units for order ${order.orderNumber}`,
        );
      }

      return released;
    });

    this.logger.log(
      `Successfully released stock for order ${order.orderNumber} (${releasedReservations.length} items)`,
    );

    return releasedReservations;
  }

  /**
   * Adjust stock quantity for a SKU
   *
   * Used for manual adjustments, stock receipts, damage, loss, etc.
   *
   * Algorithm:
   * 1. Find InventoryItem by SKU ID
   * 2. Calculate new quantityTotal
   * 3. Ensure quantityTotal >= quantityReserved (cannot go below reserved)
   * 4. Update quantities
   * 5. Log adjustment
   *
   * @param skuId - SKU ID to adjust
   * @param delta - Quantity change (positive = increase, negative = decrease)
   * @param reason - Reason for adjustment
   * @param userId - User performing the adjustment
   * @param organizationId - Organization ID (multi-tenant scoping)
   * @param type - Type of adjustment (PURCHASE, DAMAGE, LOSS, CORRECTION, etc.)
   * @param referenceType - Optional reference type ('shipment', 'manual', etc.)
   * @param referenceId - Optional reference ID
   * @param notes - Optional additional notes
   * @throws NotFoundException if SKU not found
   * @throws BadRequestException if adjustment would result in negative inventory
   * @returns Updated inventory item
   */
  async adjustStock(
    skuId: string,
    delta: number,
    reason: string,
    userId: string,
    organizationId: string,
    type: Prisma.InventoryAdjustmentType = 'CORRECTION',
    referenceType?: string,
    referenceId?: string,
    notes?: string,
  ) {
    this.logger.log(
      `Adjusting stock for SKU ${skuId} by ${delta} (reason: ${reason})`,
    );

    // Use transaction to ensure atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      // Find inventory item
      const inventoryItem = await tx.inventoryItem.findFirst({
        where: {
          organizationId,
          skuId,
        },
        include: {
          sku: true,
        },
      });

      if (!inventoryItem) {
        throw new NotFoundException(`Inventory item not found for SKU ID: ${skuId}`);
      }

      // Calculate new quantities
      const newQuantityTotal = inventoryItem.quantityTotal + delta;
      const newQuantityAvailable = newQuantityTotal - inventoryItem.quantityReserved;

      // Validate: quantityTotal cannot go below quantityReserved
      if (newQuantityTotal < inventoryItem.quantityReserved) {
        throw new BadRequestException(
          `Cannot adjust stock below reserved quantity. ` +
          `Current total: ${inventoryItem.quantityTotal}, Reserved: ${inventoryItem.quantityReserved}, ` +
          `Attempted adjustment: ${delta}`,
        );
      }

      // Validate: quantityTotal cannot be negative
      if (newQuantityTotal < 0) {
        throw new BadRequestException(
          `Adjustment would result in negative inventory. ` +
          `Current: ${inventoryItem.quantityTotal}, Attempted: ${delta}`,
        );
      }

      // Validate: quantityAvailable cannot be negative
      if (newQuantityAvailable < 0) {
        throw new BadRequestException(
          `Adjustment would result in negative available quantity. ` +
          `Available: ${newQuantityAvailable}`,
        );
      }

      // Update inventory item
      const updatedItem = await tx.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          quantityTotal: newQuantityTotal,
          quantityAvailable: newQuantityAvailable,
        },
        include: {
          sku: true,
        },
      });

      // Log adjustment
      await tx.inventoryAdjustment.create({
        data: {
          organizationId,
          inventoryItemId: inventoryItem.id,
          userId,
          type,
          quantityChange: delta,
          reason,
          referenceType,
          referenceId,
          notes: notes || `Adjusted ${inventoryItem.sku.sku} by ${delta} units`,
        },
      });

      this.logger.log(
        `Stock adjusted for SKU ${inventoryItem.sku.sku}: ${inventoryItem.quantityTotal} -> ${newQuantityTotal}`,
      );

      return updatedItem;
    });

    return result;
  }

  /**
   * Get inventory item by SKU ID
   *
   * @param skuId - SKU ID
   * @param organizationId - Organization ID
   * @returns Inventory item with SKU details
   */
  async findBySkuId(skuId: string, organizationId: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        organizationId,
        skuId,
      },
      include: {
        sku: true,
        reservations: {
          where: {
            releasedAt: null, // Only active reservations
          },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
              },
            },
          },
        },
        adjustments: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Inventory item not found for SKU ID: ${skuId}`);
    }

    return item;
  }

  /**
   * Get all inventory items with low stock
   *
   * @param organizationId - Organization ID
   * @returns Array of low stock items
   */
  async getLowStockItems(organizationId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        organizationId,
        reorderPoint: { not: null },
      },
      include: {
        sku: true,
      },
    });

    return items.filter(
      (item) => item.quantityAvailable <= (item.reorderPoint || 0),
    );
  }

  /**
   * Get inventory summary for organization
   *
   * @param organizationId - Organization ID
   * @returns Inventory summary statistics
   */
  async getInventorySummary(organizationId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { organizationId },
      include: {
        sku: true,
      },
    });

    const totalItems = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantityTotal, 0);
    const totalReserved = items.reduce((sum, item) => sum + item.quantityReserved, 0);
    const totalAvailable = items.reduce(
      (sum, item) => sum + item.quantityAvailable,
      0,
    );
    const lowStockCount = items.filter(
      (item) =>
        item.reorderPoint && item.quantityAvailable <= item.reorderPoint,
    ).length;
    const outOfStockCount = items.filter(
      (item) => item.quantityAvailable === 0,
    ).length;

    return {
      totalItems,
      totalQuantity,
      totalReserved,
      totalAvailable,
      lowStockCount,
      outOfStockCount,
    };
  }

  /**
   * List all inventory items with pagination and filters
   *
   * @param organizationId - Organization ID
   * @param filters - Optional filters
   * @returns Paginated inventory items
   */
  async findAll(
    organizationId: string,
    filters?: {
      page?: number;
      limit?: number;
      search?: string;
      lowStock?: boolean;
      outOfStock?: boolean;
    },
  ) {
    const { page = 1, limit = 20, search, lowStock, outOfStock } = filters || {};

    const where: Prisma.InventoryItemWhereInput = {
      organizationId,
    };

    // Search filter
    if (search) {
      where.sku = {
        sku: {
          contains: search,
          mode: 'insensitive',
        },
      };
    }

    // Get all items for filtering
    const allItems = await this.prisma.inventoryItem.findMany({
      where,
      include: {
        sku: true,
      },
    });

    // Apply client-side filters
    let filteredItems = allItems;

    if (lowStock) {
      filteredItems = filteredItems.filter(
        (item) =>
          item.reorderPoint && item.quantityAvailable <= item.reorderPoint,
      );
    }

    if (outOfStock) {
      filteredItems = filteredItems.filter(
        (item) => item.quantityAvailable === 0,
      );
    }

    // Pagination
    const total = filteredItems.length;
    const skip = (page - 1) * limit;
    const items = filteredItems.slice(skip, skip + limit);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
