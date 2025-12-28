import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6380'),
  maxRetriesPerRequest: null,
};

let redisClient: Redis | null = null;
const queues: Queue[] = [];
const workers: Worker[] = [];

/**
 * Get Redis client for tests
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_CONFIG);
  }
  return redisClient;
}

/**
 * Flush all Redis data
 */
export async function flushRedis(): Promise<void> {
  const client = getRedisClient();
  await client.flushall();
}

/**
 * Flush specific queues
 */
export async function flushQueues(queueNames: string[]): Promise<void> {
  for (const queueName of queueNames) {
    const queue = new Queue(queueName, { connection: REDIS_CONFIG });

    // Drain queue (remove all jobs)
    await queue.drain();

    // Clean completed/failed jobs
    await queue.clean(0, 1000, 'completed');
    await queue.clean(0, 1000, 'failed');

    await queue.close();
  }
}

/**
 * Create queue for testing
 */
export function createTestQueue(name: string): Queue {
  const queue = new Queue(name, {
    connection: REDIS_CONFIG,
    defaultJobOptions: {
      attempts: 1, // No retries in tests
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

  queues.push(queue);
  return queue;
}

/**
 * Create worker for testing
 */
export function createTestWorker(
  queueName: string,
  processor: (job: any) => Promise<any>,
): Worker {
  const worker = new Worker(queueName, processor, {
    connection: REDIS_CONFIG,
    concurrency: 1,
  });

  workers.push(worker);
  return worker;
}

/**
 * Wait for job to complete
 */
export async function waitForJob(
  queue: Queue,
  jobId: string,
  timeoutMs: number = 5000,
): Promise<any> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const job = await queue.getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found in queue ${queue.name}`);
    }

    const state = await job.getState();

    if (state === 'completed') {
      return job.returnvalue;
    }

    if (state === 'failed') {
      throw new Error(`Job ${jobId} failed: ${job.failedReason}`);
    }

    // Wait 100ms before checking again
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
}

/**
 * Wait for any job matching condition
 */
export async function waitForJobCondition(
  queue: Queue,
  condition: (job: any) => boolean,
  timeoutMs: number = 5000,
): Promise<any> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const jobs = await queue.getJobs(['completed', 'failed', 'active', 'waiting']);

    for (const job of jobs) {
      if (condition(job)) {
        const state = await job.getState();
        if (state === 'completed') {
          return job;
        }
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`No job matching condition found within ${timeoutMs}ms`);
}

/**
 * Cleanup all test queues and workers
 */
export async function cleanupRedis(): Promise<void> {
  // Close all workers
  for (const worker of workers) {
    await worker.close();
  }
  workers.length = 0;

  // Close all queues
  for (const queue of queues) {
    await queue.close();
  }
  queues.length = 0;

  // Disconnect Redis client
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
