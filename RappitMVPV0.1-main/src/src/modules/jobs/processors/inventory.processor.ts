import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@common/database/prisma.service';

@Processor('inventory')
export class InventoryProcessor extends WorkerHost {
  private readonly logger = new Logger(InventoryProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case 'reserve-inventory':
        return this.reserveInventory(job);
      case 'release-reservation':
        return this.releaseReservation(job);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async reserveInventory(job: Job) {
    const { orderId } = job.data;

    this.logger.log(`Reserving inventory for order ${orderId}`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'NEW') {
      this.logger.log(`Order ${orderId} is not in NEW status, skipping reservation`);
      return { skipped: true };
    }

    const reservations = [];

    for (const item of order.items) {
      const inventoryItem = await this.prisma.inventoryItem.findUnique({
        where: {
          organizationId_sku: {
            organizationId: order.organizationId,
            sku: item.sku,
          },
        },
      });

      if (!inventoryItem) {
        this.logger.warn(`Inventory item not found for SKU: ${item.sku}`);
        continue;
      }

      if (inventoryItem.quantityAvailable < item.quantity) {
        this.logger.warn(
          `Insufficient inventory for SKU ${item.sku}: available=${inventoryItem.quantityAvailable}, required=${item.quantity}`,
        );
        continue;
      }

      // Create reservation
      const reservation = await this.prisma.inventoryReservation.create({
        data: {
          orderId,
          inventoryItemId: inventoryItem.id,
          quantity: item.quantity,
          status: 'RESERVED',
        },
      });

      // Update inventory quantities
      await this.prisma.inventoryItem.update({
        where: { id: inventoryItem.id },
        data: {
          quantityReserved: { increment: item.quantity },
          quantityAvailable: { decrement: item.quantity },
        },
      });

      reservations.push(reservation);
    }

    // Update order status
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'RESERVED' },
    });

    this.logger.log(`Reserved inventory for order ${orderId}: ${reservations.length} items`);

    return {
      success: true,
      orderId,
      reservations: reservations.length,
    };
  }

  private async releaseReservation(job: Job) {
    const { orderId } = job.data;

    this.logger.log(`Releasing inventory reservations for order ${orderId}`);

    const reservations = await this.prisma.inventoryReservation.findMany({
      where: {
        orderId,
        status: 'RESERVED',
      },
      include: { inventoryItem: true },
    });

    for (const reservation of reservations) {
      await this.prisma.inventoryItem.update({
        where: { id: reservation.inventoryItemId },
        data: {
          quantityReserved: { decrement: reservation.quantity },
          quantityAvailable: { increment: reservation.quantity },
        },
      });

      await this.prisma.inventoryReservation.update({
        where: { id: reservation.id },
        data: { status: 'RELEASED' },
      });
    }

    this.logger.log(`Released ${reservations.length} reservations for order ${orderId}`);

    return {
      success: true,
      orderId,
      released: reservations.length,
    };
  }
}
