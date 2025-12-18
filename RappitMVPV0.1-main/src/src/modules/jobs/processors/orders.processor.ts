import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@common/database/prisma.service';

@Processor('orders')
export class OrdersProcessor extends WorkerHost {
  private readonly logger = new Logger(OrdersProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case 'import-order':
        return this.importOrder(job);
      case 'sync-orders':
        return this.syncOrders(job);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async importOrder(job: Job) {
    const { channelId, externalOrderId } = job.data;

    this.logger.log(`Importing order ${externalOrderId} from channel ${channelId}`);

    // Get channel configuration
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new Error('Channel not found');
    }

    // Check if order already exists
    const existing = await this.prisma.order.findFirst({
      where: {
        channelId,
        externalOrderId,
      },
    });

    if (existing) {
      this.logger.log(`Order ${externalOrderId} already exists, skipping`);
      return { skipped: true, orderId: existing.id };
    }

    // In real implementation, fetch order from Shopify/WooCommerce API
    // For now, return mock success
    this.logger.log(`Order ${externalOrderId} imported successfully`);

    return {
      success: true,
      orderId: externalOrderId,
      message: 'Order imported (mock)',
    };
  }

  private async syncOrders(job: Job) {
    const { channelId, startDate, endDate } = job.data;

    this.logger.log(`Syncing orders for channel ${channelId}`);

    // In real implementation, fetch orders from platform API and queue import jobs
    this.logger.log('Order sync completed (mock)');

    return {
      success: true,
      synced: 0,
      message: 'Orders synced (mock)',
    };
  }
}
