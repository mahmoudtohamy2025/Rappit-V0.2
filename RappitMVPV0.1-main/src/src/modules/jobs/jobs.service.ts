import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '@common/database/prisma.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('orders') private ordersQueue: Queue,
    @InjectQueue('inventory') private inventoryQueue: Queue,
    @InjectQueue('shipping') private shippingQueue: Queue,
    private prisma: PrismaService,
  ) {}

  async queueOrderImport(channelId: string, externalOrderId: string) {
    const job = await this.ordersQueue.add(
      'import-order',
      {
        channelId,
        externalOrderId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    this.logger.log(`Queued order import job: ${job.id}`);
    return { jobId: job.id };
  }

  async queueInventoryReservation(orderId: string) {
    const job = await this.inventoryQueue.add(
      'reserve-inventory',
      {
        orderId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );

    this.logger.log(`Queued inventory reservation job: ${job.id}`);
    return { jobId: job.id };
  }

  async queueShipmentCreation(orderId: string, provider: string, options: any) {
    const job = await this.shippingQueue.add(
      'create-shipment',
      {
        orderId,
        provider,
        options,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );

    this.logger.log(`Queued shipment creation job: ${job.id}`);
    return { jobId: job.id };
  }

  async queueTrackingUpdate(shipmentId: string) {
    const job = await this.shippingQueue.add(
      'update-tracking',
      {
        shipmentId,
      },
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    this.logger.log(`Queued tracking update job: ${job.id}`);
    return { jobId: job.id };
  }

  async getJobStatus(queueName: string, jobId: string) {
    let queue: Queue;
    switch (queueName) {
      case 'orders':
        queue = this.ordersQueue;
        break;
      case 'inventory':
        queue = this.inventoryQueue;
        break;
      case 'shipping':
        queue = this.shippingQueue;
        break;
      default:
        throw new Error('Invalid queue name');
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    return {
      id: job.id,
      name: job.name,
      state,
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    };
  }

  async getQueueStats(queueName: string) {
    let queue: Queue;
    switch (queueName) {
      case 'orders':
        queue = this.ordersQueue;
        break;
      case 'inventory':
        queue = this.inventoryQueue;
        break;
      case 'shipping':
        queue = this.shippingQueue;
        break;
      default:
        throw new Error('Invalid queue name');
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      queueName,
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  async getAllQueueStats() {
    const [orders, inventory, shipping] = await Promise.all([
      this.getQueueStats('orders'),
      this.getQueueStats('inventory'),
      this.getQueueStats('shipping'),
    ]);

    return { orders, inventory, shipping };
  }
}
