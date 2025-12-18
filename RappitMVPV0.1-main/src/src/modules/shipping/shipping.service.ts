import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(private prisma: PrismaService) {}

  async createShipment(organizationId: string, dto: CreateShipmentDto) {
    // Verify order exists and belongs to organization
    const order = await this.prisma.order.findFirst({
      where: {
        id: dto.orderId,
        organizationId,
      },
      include: {
        shipment: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.shipment) {
      throw new BadRequestException('Order already has a shipment');
    }

    if (order.status !== 'READY_TO_SHIP' && order.status !== 'RESERVED') {
      throw new BadRequestException(
        'Order must be in READY_TO_SHIP or RESERVED status',
      );
    }

    // Create shipment (in real implementation, this would call DHL/FedEx API)
    const trackingNumber = `${dto.provider}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const shipment = await this.prisma.shipment.create({
      data: {
        orderId: dto.orderId,
        organizationId,
        provider: dto.provider,
        trackingNumber,
        status: 'LABEL_CREATED',
        labelUrl: `https://example.com/labels/${trackingNumber}.pdf`,
        shipmentData: dto.shipmentOptions || {},
      },
    });

    // Update order status
    await this.prisma.order.update({
      where: { id: dto.orderId },
      data: { status: 'LABEL_CREATED' },
    });

    this.logger.log(
      `Shipment created for order ${order.orderNumber}: ${trackingNumber}`,
    );

    return shipment;
  }

  async findAll(organizationId: string) {
    return this.prisma.shipment.findMany({
      where: { organizationId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            totalAmount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        organizationId,
      },
      include: {
        order: {
          include: {
            items: true,
            channel: true,
          },
        },
        trackingEvents: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    return shipment;
  }

  async updateStatus(
    organizationId: string,
    shipmentId: string,
    dto: UpdateShipmentStatusDto,
  ) {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        organizationId,
      },
      include: { order: true },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: dto.status },
    });

    // Update corresponding order status
    const orderStatusMap: Record<string, string> = {
      LABEL_CREATED: 'LABEL_CREATED',
      PICKED_UP: 'PICKED_UP',
      IN_TRANSIT: 'IN_TRANSIT',
      OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
      DELIVERED: 'DELIVERED',
      FAILED: 'FAILED',
      RETURNED: 'RETURNED',
    };

    if (orderStatusMap[dto.status]) {
      await this.prisma.order.update({
        where: { id: shipment.orderId },
        data: { status: orderStatusMap[dto.status] },
      });
    }

    this.logger.log(
      `Shipment ${shipment.trackingNumber} status updated to ${dto.status}`,
    );

    return updated;
  }

  async trackShipment(organizationId: string, shipmentId: string) {
    const shipment = await this.findOne(organizationId, shipmentId);

    // In real implementation, this would call the carrier's tracking API
    // For now, return the existing tracking events
    return {
      trackingNumber: shipment.trackingNumber,
      provider: shipment.provider,
      status: shipment.status,
      events: shipment.trackingEvents,
    };
  }

  async cancelShipment(organizationId: string, shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        organizationId,
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    if (['DELIVERED', 'RETURNED'].includes(shipment.status)) {
      throw new BadRequestException('Cannot cancel completed shipment');
    }

    // In real implementation, this would call carrier API to cancel
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: 'FAILED' },
    });

    await this.prisma.order.update({
      where: { id: shipment.orderId },
      data: { status: 'CANCELLED' },
    });

    this.logger.log(`Shipment cancelled: ${shipment.trackingNumber}`);

    return { message: 'Shipment cancelled successfully' };
  }

  async getLabel(organizationId: string, shipmentId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        organizationId,
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    if (!shipment.labelUrl) {
      throw new NotFoundException('Label not available');
    }

    return {
      trackingNumber: shipment.trackingNumber,
      labelUrl: shipment.labelUrl,
    };
  }
}
