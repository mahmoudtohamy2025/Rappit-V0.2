import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { ShippingCarrier, ShipmentStatus, ActorType } from '@prisma/client';
import { DHLIntegrationService } from '@integrations/shipping/dhl-integration.service';
import { FedExIntegrationService } from '@integrations/shipping/fedex-integration.service';
import { ILabelStorage } from './label-storage/label-storage.interface';
import { mapCarrierStatusToInternal, isTerminalStatus } from '@helpers/shipment-status-mapping';
import { addJob, QueueName } from '../queues/queues';

/**
 * Shipping Service
 *
 * Main orchestrator for shipment operations.
 *
 * Features:
 * - Create shipments (with idempotency)
 * - Fetch and store labels
 * - Update shipment status from tracking
 * - Organization scoping
 * - Transactional consistency
 */

export interface CreateShipmentOptions {
  serviceCode?: string;
  packages: Array<{
    weightKg: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
  }>;
  options?: {
    insurance?: number;
    signature?: boolean;
    saturdayDelivery?: boolean;
  };
}

export interface CarrierTrackingResponse {
  trackingNumber: string;
  status: string;
  events: Array<{
    timestamp: Date;
    status: string;
    location?: string;
    description?: string;
  }>;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  raw: any;
}

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    private prisma: PrismaService,
    private dhlService: DHLIntegrationService,
    private fedexService: FedExIntegrationService,
    private labelStorage: ILabelStorage,
  ) {}

  /**
   * Create shipment for order
   *
   * Workflow:
   * 1. Validate order exists and belongs to org
   * 2. Get or auto-select shipping account
   * 3. Create Shipment record (status = CREATED)
   * 4. Enqueue job with deterministic jobId
   * 5. Return shipment ID
   *
   * Idempotent: Same order + carrier will reuse existing shipment
   *
   * @param orderId - Order ID
   * @param shippingAccountId - Shipping account (null = auto-select)
   * @param carrierType - DHL or FEDEX
   * @param options - Service options and packages
   * @param orgId - Organization ID
   * @param actorId - User ID (optional)
   * @param correlationId - Correlation ID for tracing
   */
  async createShipmentForOrder(
    orderId: string,
    shippingAccountId: string | null,
    carrierType: ShippingCarrier,
    options: CreateShipmentOptions,
    orgId: string,
    actorId?: string,
    correlationId?: string,
  ): Promise<any> {
    this.logger.log(`Creating shipment for order ${orderId} (carrier: ${carrierType})`, {
      correlationId,
      orderId,
      carrierType,
      orgId,
    });

    // Validate order
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        organizationId: orgId,
      },
      include: {
        items: true,
        shippingAddress: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    // Check if shipment already exists (idempotency)
    const existingShipment = await this.prisma.shipment.findFirst({
      where: {
        orderId,
        organizationId: orgId,
        carrierType,
      },
    });

    if (existingShipment) {
      this.logger.log(`Shipment already exists: ${existingShipment.id}`);
      return existingShipment;
    }

    // Get or auto-select shipping account
    const shippingAccount = await this.getShippingAccount(
      shippingAccountId,
      carrierType,
      orgId,
    );

    // Create shipment record within transaction
    const shipment = await this.prisma.$transaction(async (tx) => {
      // Lock order to prevent concurrent shipment creation
      await tx.$queryRaw`
        SELECT * FROM orders
        WHERE id = ${orderId} AND organization_id = ${orgId}
        FOR UPDATE
      `;

      // Create shipment
      const newShipment = await tx.shipment.create({
        data: {
          organizationId: orgId,
          orderId,
          carrierType,
          shippingAccountId: shippingAccount.id,
          status: ShipmentStatus.CREATED,
          serviceCode: options.serviceCode,
          serviceOptions: options as any,
        },
      });

      // Create shipment items (link to order items)
      await tx.shipmentItem.createMany({
        data: order.items.map((item) => ({
          shipmentId: newShipment.id,
          orderItemId: item.id,
          quantity: item.quantity,
        })),
      });

      // Create initial shipment event
      await tx.shipmentEvent.create({
        data: {
          shipmentId: newShipment.id,
          organizationId: orgId,
          eventType: 'SHIPMENT_CREATED',
          status: ShipmentStatus.CREATED,
          description: 'Shipment created',
        },
      });

      return newShipment;
    });

    // Enqueue job with deterministic ID
    const jobId = `shipment:create:org:${orgId}:order:${orderId}:carrier:${carrierType}`;

    await addJob(
      QueueName.SHIPMENT_CREATE,
      'createShipment',
      {
        jobId,
        shipmentId: shipment.id,
        orderId,
        orgId,
        carrierType,
        shippingAccountId: shippingAccount.id,
        options,
      },
      jobId,
    );

    this.logger.log(`Shipment created and job enqueued: ${shipment.id}`);

    return shipment;
  }

  /**
   * Fetch and store label
   *
   * Called by worker after carrier shipment created.
   *
   * @param shipmentId - Shipment ID
   * @param orgId - Organization ID
   * @param labelData - Label from carrier (if available)
   */
  async fetchAndStoreLabel(
    shipmentId: string,
    orgId: string,
    labelData?: { content: Buffer; contentType: string },
  ): Promise<any> {
    this.logger.log(`Fetching and storing label for shipment: ${shipmentId}`);

    // Get shipment
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        organizationId: orgId,
      },
      include: {
        shippingAccount: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment not found: ${shipmentId}`);
    }

    let label = labelData;

    // If label not provided, fetch from carrier
    if (!label && shipment.carrierShipmentId) {
      label = await this.fetchLabelFromCarrier(
        shipment.shippingAccount,
        shipment.carrierType,
        shipment.carrierShipmentId,
      );
    }

    if (!label) {
      throw new Error('Label not available');
    }

    // Store label using adapter
    const labelMeta = await this.labelStorage.storeLabel(
      orgId,
      shipmentId,
      label.content,
      label.contentType,
    );

    // Update shipment with label metadata
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        labelMeta: labelMeta as any,
        status: ShipmentStatus.LABEL_CREATED,
      },
    });

    // Create event
    await this.prisma.shipmentEvent.create({
      data: {
        shipmentId,
        organizationId: orgId,
        eventType: 'LABEL_CREATED',
        status: ShipmentStatus.LABEL_CREATED,
        description: 'Shipping label created',
      },
    });

    this.logger.log(`Label stored for shipment: ${shipmentId}`);

    return labelMeta;
  }

  /**
   * Update shipment status from tracking
   *
   * Called by worker when processing tracking updates.
   *
   * @param shipmentId - Shipment ID
   * @param carrierTracking - Tracking response from carrier
   * @param orgId - Organization ID
   */
  async updateShipmentStatusFromTracking(
    shipmentId: string,
    carrierTracking: CarrierTrackingResponse,
    orgId: string,
  ): Promise<void> {
    this.logger.log(`Updating shipment ${shipmentId} from tracking`);

    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        organizationId: orgId,
      },
      include: {
        order: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment not found: ${shipmentId}`);
    }

    // Map carrier status to internal
    const newStatus = mapCarrierStatusToInternal(
      shipment.carrierType,
      carrierTracking.status,
    );

    // Check if status changed
    if (newStatus === shipment.status) {
      this.logger.debug(`Shipment ${shipmentId} status unchanged: ${newStatus}`);
      return;
    }

    // Update within transaction
    await this.prisma.$transaction(async (tx) => {
      // Update shipment status
      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: newStatus,
          actualDelivery: carrierTracking.actualDelivery,
          estimatedDelivery: carrierTracking.estimatedDelivery,
        },
      });

      // Create shipment event
      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          organizationId: orgId,
          eventType: 'STATUS_UPDATED',
          status: newStatus,
          description: `Status updated to ${newStatus}`,
          raw: carrierTracking.raw,
        },
      });

      // Create tracking records
      for (const event of carrierTracking.events) {
        await tx.shipmentTracking.create({
          data: {
            shipmentId,
            carrierStatus: event.status,
            mappedStatus: mapCarrierStatusToInternal(shipment.carrierType, event.status),
            location: event.location,
            description: event.description,
            eventTime: event.timestamp,
            raw: event as any,
          },
        });
      }

      // If delivered, optionally update order status
      if (newStatus === ShipmentStatus.DELIVERED) {
        // TODO: Make this configurable
        const shouldUpdateOrder = process.env.UPDATE_ORDER_ON_DELIVERY === 'true';

        if (shouldUpdateOrder) {
          await tx.order.update({
            where: { id: shipment.orderId },
            data: {
              status: 'DELIVERED',
            },
          });

          // Create order timeline event
          await tx.orderTimelineEvent.create({
            data: {
              organizationId: orgId,
              orderId: shipment.orderId,
              event: 'ORDER_DELIVERED',
              fromStatus: shipment.order.status,
              toStatus: 'DELIVERED',
              actorType: ActorType.CARRIER,
              metadata: {
                shipmentId,
                trackingNumber: carrierTracking.trackingNumber,
              },
            },
          });
        }
      }
    });

    this.logger.log(`Shipment ${shipmentId} status updated: ${shipment.status} → ${newStatus}`);
  }

  /**
   * Get shipment by ID
   */
  async getShipment(shipmentId: string, orgId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        organizationId: orgId,
      },
      include: {
        shippingAccount: {
          select: {
            id: true,
            name: true,
            carrierType: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
          },
        },
        items: {
          include: {
            orderItem: {
              include: {
                sku: true,
              },
            },
          },
        },
        events: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        trackings: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment not found: ${shipmentId}`);
    }

    return shipment;
  }

  /**
   * Stream label to response
   */
  async streamLabel(shipmentId: string, orgId: string, res: any): Promise<void> {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        organizationId: orgId,
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment not found: ${shipmentId}`);
    }

    if (!shipment.labelMeta) {
      throw new BadRequestException('Label not available for this shipment');
    }

    await this.labelStorage.streamLabel(shipment.labelMeta as any, res);
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get or auto-select shipping account
   */
  private async getShippingAccount(
    shippingAccountId: string | null,
    carrierType: ShippingCarrier,
    orgId: string,
  ) {
    if (shippingAccountId) {
      const account = await this.prisma.shippingAccount.findFirst({
        where: {
          id: shippingAccountId,
          organizationId: orgId,
          isActive: true,
        },
      });

      if (!account) {
        throw new NotFoundException(`Shipping account not found: ${shippingAccountId}`);
      }

      return account;
    }

    // Auto-select first active account for carrier
    const account = await this.prisma.shippingAccount.findFirst({
      where: {
        organizationId: orgId,
        carrierType,
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!account) {
      throw new BadRequestException(
        `No active ${carrierType} shipping account configured`,
      );
    }

    return account;
  }

  /**
   * Fetch label from carrier
   */
  private async fetchLabelFromCarrier(
    shippingAccount: any,
    carrierType: ShippingCarrier,
    carrierShipmentId: string,
  ): Promise<{ content: Buffer; contentType: string }> {
    if (carrierType === 'DHL') {
      return this.dhlService.getLabel(shippingAccount, carrierShipmentId);
    } else if (carrierType === 'FEDEX') {
      return this.fedexService.getLabel(shippingAccount, carrierShipmentId);
    }

    throw new Error(`Unknown carrier: ${carrierType}`);
  }

  /**
   * Call carrier integration to create shipment
   *
   * Used by worker
   */
  async callCarrierCreateShipment(
    shippingAccount: any,
    carrierType: ShippingCarrier,
    order: any,
    options: CreateShipmentOptions,
  ): Promise<any> {
    const request = this.buildCarrierRequest(shippingAccount, order, options);

    if (carrierType === 'DHL') {
      return this.dhlService.createShipment(shippingAccount, request);
    } else if (carrierType === 'FEDEX') {
      return this.fedexService.createShipment(shippingAccount, request);
    }

    throw new Error(`Unknown carrier: ${carrierType}`);
  }

  /**
   * Call carrier integration to get tracking
   *
   * Used by worker
   */
  async callCarrierGetTracking(
    shippingAccount: any,
    carrierType: ShippingCarrier,
    trackingNumber: string,
  ): Promise<CarrierTrackingResponse> {
    if (carrierType === 'DHL') {
      return this.dhlService.getTracking(shippingAccount, trackingNumber);
    } else if (carrierType === 'FEDEX') {
      return this.fedexService.getTracking(shippingAccount, trackingNumber);
    }

    throw new Error(`Unknown carrier: ${carrierType}`);
  }

  /**
   * Build carrier-specific request
   */
  private buildCarrierRequest(
    shippingAccount: any,
    order: any,
    options: CreateShipmentOptions,
  ): any {
    const shippingAddress = order.shippingAddress;

    return {
      accountNumber: shippingAccount.credentials.accountNumber,
      testMode: shippingAccount.testMode,
      shipper: {
        // TODO: Get from organization settings
        name: 'Rappit',
        address: '123 Main St',
        city: 'Riyadh',
        postalCode: '12345',
        country: 'SA',
        phone: '+966501234567',
      },
      recipient: {
        name: `${shippingAddress.firstName} ${shippingAddress.lastName}`,
        company: shippingAddress.company,
        address: shippingAddress.street1,
        city: shippingAddress.city,
        postalCode: shippingAddress.postalCode,
        country: shippingAddress.country,
        phone: shippingAddress.phone,
      },
      packages: options.packages,
      serviceCode: options.serviceCode,
      options: options.options,
    };
  }
}