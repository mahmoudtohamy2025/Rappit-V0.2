import { Job } from 'bullmq';
import { BaseWorker } from './base.worker';
import { QueueName } from '../queues/queues';
import { ShopifyIntegrationService } from '../integrations/shopify/shopify-integration.service';
import { PrismaService } from '@common/database/prisma.service';
import { ShopifyClient } from '../integrations/shopify/shopify-client';
import { ConfigService } from '@nestjs/config';
import { IntegrationLoggingService } from '@services/integration-logging.service';
import { OrdersService } from '@modules/orders/orders.service';

/**
 * Shopify Worker
 *
 * Processes Shopify sync jobs including:
 * - Product sync
 * - Order sync
 * - Inventory sync
 * - Fulfillment sync
 */

export interface ShopifySyncJobData {
  type: 'product-sync' | 'order-sync' | 'inventory-sync' | 'fulfillment-sync';
  channelId: string;
  organizationId: string;
  sinceTimestamp?: string;
  metadata?: any;
}

export class ShopifyWorker extends BaseWorker<ShopifySyncJobData> {
  private shopifyService: ShopifyIntegrationService;

  constructor(
    prisma: PrismaService,
    configService: ConfigService,
    integrationLoggingService: IntegrationLoggingService,
    ordersService: OrdersService,
  ) {
    super(QueueName.SHOPIFY_SYNC, 'ShopifyWorker', {
      concurrency: 3, // Process 3 Shopify jobs concurrently
    });

    // Initialize Shopify service
    const shopifyClient = new ShopifyClient(configService, integrationLoggingService);
    this.shopifyService = new ShopifyIntegrationService(
      prisma,
      shopifyClient,
      ordersService,
    );
  }

  protected async processJob(job: Job<ShopifySyncJobData>): Promise<void> {
    const { type, channelId, organizationId, sinceTimestamp, metadata } = job.data;

    this.logger.log(
      `Processing Shopify ${type} for channel ${channelId} (org: ${organizationId})`,
    );

    try {
      switch (type) {
        case 'product-sync':
          await this.syncProducts(channelId, organizationId, sinceTimestamp);
          break;

        case 'order-sync':
          await this.syncOrders(channelId, organizationId, sinceTimestamp);
          break;

        case 'inventory-sync':
          await this.syncInventory(channelId, organizationId);
          break;

        case 'fulfillment-sync':
          await this.syncFulfillments(channelId, organizationId, sinceTimestamp);
          break;

        default:
          throw new Error(`Unknown Shopify sync type: ${type}`);
      }

      this.logger.log(
        `Completed Shopify ${type} for channel ${channelId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing Shopify ${type} for channel ${channelId}: ${error.message}`,
      );
      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Sync products from Shopify
   */
  private async syncProducts(
    channelId: string,
    organizationId: string,
    sinceTimestamp?: string,
  ): Promise<void> {
    this.logger.log(`Syncing products for channel ${channelId}`);

    const result = await this.shopifyService.syncProductsForChannel(
      channelId,
      sinceTimestamp,
    );

    this.logger.log(
      `Products synced: ${result.productsProcessed} products, ${result.skusCreated} SKUs`,
    );
  }

  /**
   * Sync orders from Shopify
   */
  private async syncOrders(
    channelId: string,
    organizationId: string,
    sinceTimestamp?: string,
  ): Promise<void> {
    this.logger.log(
      `Syncing orders for channel ${channelId} since ${sinceTimestamp || 'beginning'}`,
    );

    const result = await this.shopifyService.syncOrdersForChannel(
      channelId,
      sinceTimestamp,
    );

    this.logger.log(
      `Orders synced: ${result.ordersProcessed} succeeded, ${result.ordersFailed} failed`,
    );
  }

  /**
   * Sync inventory from Shopify
   */
  private async syncInventory(
    channelId: string,
    organizationId: string,
  ): Promise<void> {
    this.logger.log(`Syncing inventory for channel ${channelId}`);

    await this.shopifyService.syncInventoryLevels(channelId);

    this.logger.log(`Inventory synced for channel ${channelId}`);
  }

  /**
   * Sync fulfillments from Shopify
   */
  private async syncFulfillments(
    channelId: string,
    organizationId: string,
    sinceTimestamp?: string,
  ): Promise<void> {
    this.logger.log(`Syncing fulfillments for channel ${channelId}`);

    // Note: Fulfillment sync is typically handled via webhooks
    // This is a placeholder for future implementation if needed
    this.logger.debug(`Fulfillments synced for channel ${channelId}`);
  }
}

/**
 * Start Shopify worker
 *
 * Note: This is called from the worker initialization system
 * Dependencies are injected via NestJS
 */
export async function startShopifyWorker(
  prisma: PrismaService,
  configService: ConfigService,
  integrationLoggingService: IntegrationLoggingService,
  ordersService: OrdersService,
): Promise<ShopifyWorker> {
  const worker = new ShopifyWorker(
    prisma,
    configService,
    integrationLoggingService,
    ordersService,
  );
  await worker.start();
  return worker;
}
