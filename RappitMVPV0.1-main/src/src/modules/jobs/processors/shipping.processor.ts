import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@common/database/prisma.service';

@Processor('shipping')
export class ShippingProcessor extends WorkerHost {
  private readonly logger = new Logger(ShippingProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case 'create-shipment':
        return this.createShipment(job);
      case 'update-tracking':
        return this.updateTracking(job);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async createShipment(job: Job) {
    const { orderId, provider, options } = job.data;

    this.logger.log(`Creating shipment for order ${orderId} with ${provider}`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { shipment: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.shipment) {
      this.logger.log(`Order ${orderId} already has a shipment`);
      return { skipped: true, shipmentId: order.shipment.id };
    }

    // In real implementation, call DHL/FedEx API to create shipment
    const trackingNumber = `${provider}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const shipment = await this.prisma.shipment.create({
      data: {
        orderId,
        organizationId: order.organizationId,
        provider,
        trackingNumber,
        status: 'LABEL_CREATED',
        labelUrl: `https://example.com/labels/${trackingNumber}.pdf`,
        shipmentData: options || {},
      },
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'LABEL_CREATED' },
    });

    this.logger.log(`Shipment created: ${trackingNumber}`);

    return {
      success: true,
      shipmentId: shipment.id,
      trackingNumber,
    };
  }

  private async updateTracking(job: Job) {
    const { shipmentId } = job.data;

    this.logger.log(`Updating tracking for shipment ${shipmentId}`);

    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new Error('Shipment not found');
    }

    if (['DELIVERED', 'RETURNED', 'FAILED'].includes(shipment.status)) {
      this.logger.log(`Shipment ${shipmentId} is in final state, skipping tracking update`);
      return { skipped: true };
    }

    // In real implementation, call carrier API to get tracking updates
    // For now, create a mock tracking event
    const mockStatuses = ['IN_TRANSIT', 'OUT_FOR_DELIVERY'];
    const randomStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)];

    await this.prisma.trackingEvent.create({
      data: {
        shipmentId,
        status: randomStatus,
        location: 'Riyadh, Saudi Arabia',
        description: 'Package in transit',
        timestamp: new Date(),
      },
    });

    this.logger.log(`Tracking updated for shipment ${shipmentId} (mock)`);

    return {
      success: true,
      shipmentId,
      status: randomStatus,
    };
  }
}
