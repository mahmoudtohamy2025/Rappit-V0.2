/**
 * Shopify Sync Scheduler
 *
 * Automated cron jobs for Shopify synchronization:
 * - Every 5 minutes: Sync orders (incremental)
 * - Every 30 minutes: Sync products (incremental)
 * - Every hour: Full inventory reconciliation
 *
 * Note: This uses setInterval instead of @nestjs/schedule to avoid adding dependencies
 * In production, consider using @nestjs/schedule or a proper cron solution
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { addJob, QueueName } from '../../queues/queues';

@Injectable()
export class ShopifySyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ShopifySyncScheduler.name);
  private orderSyncInterval: NodeJS.Timeout;
  private productSyncInterval: NodeJS.Timeout;
  private inventorySyncInterval: NodeJS.Timeout;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.logger.log('Starting Shopify sync scheduler');
    this.startScheduledJobs();
  }

  onModuleDestroy() {
    this.logger.log('Stopping Shopify sync scheduler');
    this.stopScheduledJobs();
  }

  private startScheduledJobs() {
    // Order sync every 5 minutes (300000ms)
    this.orderSyncInterval = setInterval(() => {
      this.syncOrders().catch((error) => {
        this.logger.error(`Order sync failed: ${error.message}`, error.stack);
      });
    }, 5 * 60 * 1000);

    // Product sync every 30 minutes (1800000ms)
    this.productSyncInterval = setInterval(() => {
      this.syncProducts().catch((error) => {
        this.logger.error(`Product sync failed: ${error.message}`, error.stack);
      });
    }, 30 * 60 * 1000);

    // Inventory sync every hour (3600000ms)
    this.inventorySyncInterval = setInterval(() => {
      this.syncInventory().catch((error) => {
        this.logger.error(`Inventory sync failed: ${error.message}`, error.stack);
      });
    }, 60 * 60 * 1000);

    // Run initial sync on startup (after 10 seconds)
    setTimeout(() => {
      this.syncOrders().catch((error) => {
        this.logger.error(`Initial order sync failed: ${error.message}`, error.stack);
      });
    }, 10000);
  }

  private stopScheduledJobs() {
    if (this.orderSyncInterval) clearInterval(this.orderSyncInterval);
    if (this.productSyncInterval) clearInterval(this.productSyncInterval);
    if (this.inventorySyncInterval) clearInterval(this.inventorySyncInterval);
  }

  /**
   * Sync orders every 5 minutes (incremental)
   *
   * Only syncs orders updated since last sync
   */
  async syncOrders() {
    this.logger.log('Starting scheduled order sync for all active Shopify channels');

    try {
      // Find all active Shopify channels
      const channels = await this.prisma.channel.findMany({
        where: {
          type: 'SHOPIFY',
          isActive: true,
        },
      });

      this.logger.log(`Found ${channels.length} active Shopify channels`);

      // Queue order sync job for each channel
      for (const channel of channels) {
        const sinceTimestamp = channel.lastSyncAt?.toISOString();

        await addJob(
          QueueName.SHOPIFY_SYNC,
          `shopify-order-sync-${channel.id}`,
          {
            type: 'order-sync',
            channelId: channel.id,
            organizationId: channel.organizationId,
            sinceTimestamp,
          },
          `order-sync-${channel.id}-${Date.now()}`,
        );

        this.logger.debug(
          `Queued order sync for channel ${channel.id} since ${sinceTimestamp || 'beginning'}`,
        );
      }

      this.logger.log('Order sync jobs queued successfully');
    } catch (error) {
      this.logger.error(
        `Failed to queue order sync jobs: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Sync products every 30 minutes (incremental)
   *
   * Only syncs products updated since last sync
   */
  async syncProducts() {
    this.logger.log('Starting scheduled product sync for all active Shopify channels');

    try {
      // Find all active Shopify channels
      const channels = await this.prisma.channel.findMany({
        where: {
          type: 'SHOPIFY',
          isActive: true,
        },
      });

      this.logger.log(`Found ${channels.length} active Shopify channels`);

      // Queue product sync job for each channel
      for (const channel of channels) {
        const sinceTimestamp = channel.lastSyncAt?.toISOString();

        await addJob(
          QueueName.SHOPIFY_SYNC,
          `shopify-product-sync-${channel.id}`,
          {
            type: 'product-sync',
            channelId: channel.id,
            organizationId: channel.organizationId,
            sinceTimestamp,
          },
          `product-sync-${channel.id}-${Date.now()}`,
        );

        this.logger.debug(
          `Queued product sync for channel ${channel.id} since ${sinceTimestamp || 'beginning'}`,
        );
      }

      this.logger.log('Product sync jobs queued successfully');
    } catch (error) {
      this.logger.error(
        `Failed to queue product sync jobs: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Full inventory reconciliation every hour
   *
   * Syncs all inventory levels from Shopify
   */
  async syncInventory() {
    this.logger.log('Starting scheduled inventory sync for all active Shopify channels');

    try {
      // Find all active Shopify channels
      const channels = await this.prisma.channel.findMany({
        where: {
          type: 'SHOPIFY',
          isActive: true,
        },
      });

      this.logger.log(`Found ${channels.length} active Shopify channels`);

      // Queue inventory sync job for each channel
      for (const channel of channels) {
        await addJob(
          QueueName.SHOPIFY_SYNC,
          `shopify-inventory-sync-${channel.id}`,
          {
            type: 'inventory-sync',
            channelId: channel.id,
            organizationId: channel.organizationId,
          },
          `inventory-sync-${channel.id}-${Date.now()}`,
        );

        this.logger.debug(`Queued inventory sync for channel ${channel.id}`);
      }

      this.logger.log('Inventory sync jobs queued successfully');
    } catch (error) {
      this.logger.error(
        `Failed to queue inventory sync jobs: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Trigger immediate sync for a specific channel
   *
   * Useful for manual sync or testing
   */
  async triggerSync(
    channelId: string,
    type: 'product-sync' | 'order-sync' | 'inventory-sync',
  ): Promise<void> {
    this.logger.log(`Triggering immediate ${type} for channel ${channelId}`);

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    if (channel.type !== 'SHOPIFY') {
      throw new Error(`Channel ${channelId} is not a Shopify channel`);
    }

    if (!channel.isActive) {
      throw new Error(`Channel ${channelId} is not active`);
    }

    // Queue sync job
    await addJob(
      QueueName.SHOPIFY_SYNC,
      `shopify-${type}-${channelId}`,
      {
        type,
        channelId: channel.id,
        organizationId: channel.organizationId,
        sinceTimestamp: type === 'inventory-sync' ? undefined : channel.lastSyncAt?.toISOString(),
      },
      `manual-${type}-${channelId}-${Date.now()}`,
    );

    this.logger.log(`${type} job queued for channel ${channelId}`);
  }
}
