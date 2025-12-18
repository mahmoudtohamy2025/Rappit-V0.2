import { Logger } from '@nestjs/common';
import { ShopifyWorker, startShopifyWorker } from './shopify.worker';
import { WooCommerceWorker, startWooCommerceWorker } from './woocommerce.worker';
import { WebhookProcessorWorker, startWebhookProcessorWorker } from './webhook-processor.worker';
import { closeRedisConnection } from '../queues/redis-connection';
import { closeAllQueues } from '../queues/queues';

/**
 * Worker Manager
 *
 * Manages all workers lifecycle:
 * - Start all workers
 * - Stop all workers gracefully
 * - Handle shutdown signals
 */

const logger = new Logger('WorkerManager');

let shopifyWorker: ShopifyWorker | null = null;
let woocommerceWorker: WooCommerceWorker | null = null;
let webhookProcessorWorker: WebhookProcessorWorker | null = null;

/**
 * Start all workers
 */
export async function startAllWorkers(): Promise<void> {
  logger.log('Starting all workers...');

  try {
    // Start workers
    shopifyWorker = await startShopifyWorker();
    woocommerceWorker = await startWooCommerceWorker();
    webhookProcessorWorker = await startWebhookProcessorWorker();

    logger.log('All workers started successfully');
  } catch (error) {
    logger.error(`Failed to start workers: ${error.message}`);
    await stopAllWorkers();
    throw error;
  }
}

/**
 * Stop all workers gracefully
 */
export async function stopAllWorkers(): Promise<void> {
  logger.log('Stopping all workers...');

  try {
    // Stop workers in parallel
    await Promise.all([
      shopifyWorker?.stop(),
      woocommerceWorker?.stop(),
      webhookProcessorWorker?.stop(),
    ]);

    // Close queues
    await closeAllQueues();

    // Close Redis connection
    await closeRedisConnection();

    logger.log('All workers stopped successfully');
  } catch (error) {
    logger.error(`Error stopping workers: ${error.message}`);
    throw error;
  }
}

/**
 * Graceful shutdown handler
 */
export function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down gracefully...`);

    try {
      await stopAllWorkers();
      process.exit(0);
    } catch (error) {
      logger.error(`Error during shutdown: ${error.message}`);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.error(`Uncaught exception: ${error.message}`);
    logger.error(error.stack || '');
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
    shutdown('unhandledRejection');
  });
}

/**
 * Get all workers
 */
export function getAllWorkers() {
  return {
    shopify: shopifyWorker,
    woocommerce: woocommerceWorker,
    webhookProcessor: webhookProcessorWorker,
  };
}

/**
 * Get worker metrics
 */
export async function getAllWorkerMetrics() {
  const workers = getAllWorkers();

  const metrics = await Promise.all([
    workers.shopify?.getMetrics(),
    workers.woocommerce?.getMetrics(),
    workers.webhookProcessor?.getMetrics(),
  ]);

  return {
    shopify: metrics[0],
    woocommerce: metrics[1],
    webhookProcessor: metrics[2],
  };
}
