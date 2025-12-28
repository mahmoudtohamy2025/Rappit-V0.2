import { Queue, QueueOptions } from 'bullmq';
import { getRedisConnection } from './redis-connection';
import { Logger } from '@nestjs/common';

/**
 * BullMQ Queue Definitions
 *
 * Defines all job queues used by Rappit integrations.
 * Each queue handles specific types of async jobs.
 */

const logger = new Logger('Queues');

/**
 * Queue names
 */
export enum QueueName {
  SHOPIFY_SYNC = 'shopify-sync',
  WOOCOMMERCE_SYNC = 'woocommerce-sync',
  WEBHOOK_PROCESSING = 'webhook-processing',
  CHANNEL_SYNC = 'channel-sync',
  SHIPMENT_CREATE = 'shipment-create',
  SHIPMENT_TRACKING = 'shipment-tracking',
}

/**
 * Default queue options
 */
const defaultQueueOptions: QueueOptions = {
  connection: getRedisConnection(),
  defaultJobOptions: {
    // Retry configuration
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000, // Start with 1 second
    },
    // Remove completed jobs after 24 hours
    removeOnComplete: {
      age: 24 * 60 * 60, // 24 hours in seconds
      count: 1000, // Keep at most 1000 completed jobs
    },
    // Remove failed jobs after 7 days
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // 7 days
    },
  },
};

/**
 * Queue instances
 */
export const queues: Record<QueueName, Queue> = {
  [QueueName.SHOPIFY_SYNC]: new Queue(QueueName.SHOPIFY_SYNC, {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 5, // Shopify sync is critical
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  }),

  [QueueName.WOOCOMMERCE_SYNC]: new Queue(QueueName.WOOCOMMERCE_SYNC, {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  }),

  [QueueName.WEBHOOK_PROCESSING]: new Queue(QueueName.WEBHOOK_PROCESSING, {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      // High priority for webhooks
      priority: 10,
    },
  }),

  [QueueName.CHANNEL_SYNC]: new Queue(QueueName.CHANNEL_SYNC, {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 3,
    },
  }),

  [QueueName.SHIPMENT_CREATE]: new Queue(QueueName.SHIPMENT_CREATE, {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 5, // Shipment creation is critical
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
    },
  }),

  [QueueName.SHIPMENT_TRACKING]: new Queue(QueueName.SHIPMENT_TRACKING, {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      attempts: 3,
    },
  }),
};

/**
 * Get queue by name
 */
export function getQueue(name: QueueName): Queue {
  return queues[name];
}

/**
 * Add job to queue with deterministic jobId
 *
 * Uses deterministic jobId for idempotency.
 * If job with same ID already exists, it won't be added again.
 *
 * @param queueName - Queue to add job to
 * @param jobName - Job name (type)
 * @param data - Job data
 * @param jobId - Deterministic job ID
 * @param options - Additional job options
 */
export async function addJob<T = any>(
  queueName: QueueName,
  jobName: string,
  data: T,
  jobId: string,
  options: any = {},
) {
  const queue = getQueue(queueName);

  try {
    const job = await queue.add(jobName, data, {
      jobId, // Deterministic ID for idempotency
      ...options,
    });

    logger.log(
      `Job added to ${queueName}: ${jobName} (ID: ${jobId}, Queue ID: ${job.id})`,
    );

    return job;
  } catch (error) {
    if (error.message?.includes('already exists')) {
      logger.warn(
        `Job already exists in ${queueName}: ${jobName} (ID: ${jobId})`,
      );
      return null; // Job already enqueued
    }
    throw error;
  }
}

/**
 * Get job by ID
 */
export async function getJob(queueName: QueueName, jobId: string) {
  const queue = getQueue(queueName);
  return queue.getJob(jobId);
}

/**
 * Get queue stats
 */
export async function getQueueStats(queueName: QueueName) {
  const queue = getQueue(queueName);

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    name: queueName,
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Get stats for all queues
 */
export async function getAllQueueStats() {
  const stats = await Promise.all(
    Object.values(QueueName).map((name) => getQueueStats(name)),
  );

  return stats;
}

/**
 * Pause queue
 */
export async function pauseQueue(queueName: QueueName) {
  const queue = getQueue(queueName);
  await queue.pause();
  logger.log(`Queue paused: ${queueName}`);
}

/**
 * Resume queue
 */
export async function resumeQueue(queueName: QueueName) {
  const queue = getQueue(queueName);
  await queue.resume();
  logger.log(`Queue resumed: ${queueName}`);
}

/**
 * Clear queue (remove all jobs)
 */
export async function clearQueue(queueName: QueueName) {
  const queue = getQueue(queueName);
  await queue.drain();
  logger.log(`Queue cleared: ${queueName}`);
}

/**
 * Close all queues gracefully
 */
export async function closeAllQueues() {
  logger.log('Closing all queues...');

  await Promise.all(
    Object.values(queues).map((queue) => queue.close()),
  );

  logger.log('All queues closed');
}

/**
 * Initialize queues (call on app startup)
 */
export async function initializeQueues() {
  logger.log('Initializing queues...');

  // Verify Redis connection
  const redis = getRedisConnection();
  const pingResult = await redis.ping();

  if (pingResult !== 'PONG') {
    throw new Error('Failed to connect to Redis');
  }

  logger.log(`Initialized ${Object.keys(queues).length} queues`);

  // Log queue names
  Object.keys(queues).forEach((name) => {
    logger.log(`  - ${name}`);
  });
}
