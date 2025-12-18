import { getRedisConnection, checkRedisHealth, closeRedisConnection } from '../src/queues/redis-connection';
import { initializeQueues, addJob, getQueue, QueueName, getAllQueueStats, clearQueue, closeAllQueues } from '../src/queues/queues';
import { ShopifyWorker } from '../src/workers/shopify.worker';
import { WebhookProcessorWorker } from '../src/workers/webhook-processor.worker';

/**
 * System Tests for Queue Infrastructure
 *
 * Tests Redis connection, queue operations, and worker processing.
 *
 * Prerequisites:
 * - Redis running on localhost:6379 (via docker-compose)
 * - Run: docker-compose up -d redis
 */
describe('Queue Infrastructure - System Tests', () => {
  beforeAll(async () => {
    // Wait for Redis to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Cleanup
    await closeAllQueues();
    await closeRedisConnection();
  });

  describe('Redis Connection', () => {
    it('should connect to Redis', async () => {
      const redis = getRedisConnection();
      expect(redis).toBeDefined();

      const pingResult = await redis.ping();
      expect(pingResult).toBe('PONG');
    });

    it('should perform health check', async () => {
      const isHealthy = await checkRedisHealth();
      expect(isHealthy).toBe(true);
    });

    it('should reuse same connection (singleton)', () => {
      const redis1 = getRedisConnection();
      const redis2 = getRedisConnection();
      expect(redis1).toBe(redis2);
    });
  });

  describe('Queue Initialization', () => {
    it('should initialize all queues', async () => {
      await initializeQueues();

      const shopifyQueue = getQueue(QueueName.SHOPIFY_SYNC);
      expect(shopifyQueue).toBeDefined();
      expect(shopifyQueue.name).toBe(QueueName.SHOPIFY_SYNC);

      const webhookQueue = getQueue(QueueName.WEBHOOK_PROCESSING);
      expect(webhookQueue).toBeDefined();
      expect(webhookQueue.name).toBe(QueueName.WEBHOOK_PROCESSING);
    });

    it('should get queue stats', async () => {
      const stats = await getAllQueueStats();
      expect(stats).toBeInstanceOf(Array);
      expect(stats.length).toBeGreaterThan(0);

      stats.forEach(stat => {
        expect(stat).toHaveProperty('name');
        expect(stat).toHaveProperty('waiting');
        expect(stat).toHaveProperty('active');
        expect(stat).toHaveProperty('completed');
        expect(stat).toHaveProperty('failed');
      });
    });
  });

  describe('Job Enqueuing', () => {
    beforeEach(async () => {
      // Clear all queues before each test
      await Promise.all(
        Object.values(QueueName).map(name => clearQueue(name))
      );
    });

    it('should add job to queue with deterministic jobId', async () => {
      const jobData = {
        type: 'order-sync' as const,
        channelId: 'channel-123',
        organizationId: 'org-123',
      };

      const job = await addJob(
        QueueName.SHOPIFY_SYNC,
        'sync-orders',
        jobData,
        'shopify-orders-channel-123', // Deterministic ID
      );

      expect(job).toBeDefined();
      expect(job?.data).toEqual(jobData);
    });

    it('should not duplicate jobs with same jobId', async () => {
      const jobData = {
        type: 'order-sync' as const,
        channelId: 'channel-123',
        organizationId: 'org-123',
      };

      const jobId = 'shopify-orders-channel-123';

      // Add job first time
      const job1 = await addJob(
        QueueName.SHOPIFY_SYNC,
        'sync-orders',
        jobData,
        jobId,
      );
      expect(job1).toBeDefined();

      // Try to add same job again
      const job2 = await addJob(
        QueueName.SHOPIFY_SYNC,
        'sync-orders',
        jobData,
        jobId,
      );
      expect(job2).toBeNull(); // Should return null for duplicate
    });

    it('should add webhook job', async () => {
      const webhookData = {
        source: 'shopify' as const,
        event: 'orders/create',
        channelId: 'channel-123',
        organizationId: 'org-123',
        externalEventId: 'shopify-event-456',
        payload: { id: 123, name: 'Order' },
        processedWebhookEventId: 'webhook-event-789',
      };

      const job = await addJob(
        QueueName.WEBHOOK_PROCESSING,
        'shopify-webhook',
        webhookData,
        `webhook-shopify-${webhookData.externalEventId}`,
      );

      expect(job).toBeDefined();
      expect(job?.data.source).toBe('shopify');
      expect(job?.data.externalEventId).toBe('shopify-event-456');
    });
  });

  describe('Worker Processing', () => {
    let shopifyWorker: ShopifyWorker | null = null;
    let webhookWorker: WebhookProcessorWorker | null = null;

    afterEach(async () => {
      // Stop workers after each test
      if (shopifyWorker) {
        await shopifyWorker.stop();
        shopifyWorker = null;
      }
      if (webhookWorker) {
        await webhookWorker.stop();
        webhookWorker = null;
      }
    });

    it('should start Shopify worker', async () => {
      shopifyWorker = new ShopifyWorker();
      await shopifyWorker.start();

      const metrics = await shopifyWorker.getMetrics();
      expect(metrics.isRunning).toBe(true);
      expect(metrics.isPaused).toBe(false);
    });

    it('should process Shopify sync job', async () => {
      shopifyWorker = new ShopifyWorker();
      await shopifyWorker.start();

      // Add job
      const jobData = {
        type: 'product-sync' as const,
        channelId: 'channel-123',
        organizationId: 'org-123',
      };

      await addJob(
        QueueName.SHOPIFY_SYNC,
        'sync-products',
        jobData,
        `shopify-products-${Date.now()}`,
      );

      // Wait for job to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));

      const metrics = await shopifyWorker.getMetrics();
      expect(metrics.completed).toBeGreaterThan(0);
    }, 10000);

    it('should start webhook processor worker', async () => {
      webhookWorker = new WebhookProcessorWorker();
      await webhookWorker.start();

      const metrics = await webhookWorker.getMetrics();
      expect(metrics.isRunning).toBe(true);
    });

    it('should process webhook job', async () => {
      webhookWorker = new WebhookProcessorWorker();
      await webhookWorker.start();

      // Add webhook job
      const webhookData = {
        source: 'shopify' as const,
        event: 'orders/create',
        channelId: 'channel-123',
        organizationId: 'org-123',
        externalEventId: `shopify-event-${Date.now()}`,
        payload: { id: 123, name: 'Order' },
        processedWebhookEventId: 'webhook-event-789',
      };

      await addJob(
        QueueName.WEBHOOK_PROCESSING,
        'shopify-webhook',
        webhookData,
        `webhook-shopify-${webhookData.externalEventId}`,
      );

      // Wait for job to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));

      const metrics = await webhookWorker.getMetrics();
      expect(metrics.completed).toBeGreaterThan(0);
    }, 10000);

    it('should retry failed jobs', async () => {
      shopifyWorker = new ShopifyWorker();
      await shopifyWorker.start();

      // Add job that will fail (invalid channelId triggers error)
      const jobData = {
        type: 'invalid-type' as any, // This will cause an error
        channelId: 'channel-123',
        organizationId: 'org-123',
      };

      await addJob(
        QueueName.SHOPIFY_SYNC,
        'sync-invalid',
        jobData,
        `shopify-invalid-${Date.now()}`,
      );

      // Wait for job to fail and retry
      await new Promise(resolve => setTimeout(resolve, 5000));

      const metrics = await shopifyWorker.getMetrics();
      // Job should fail after retries
      expect(metrics.failed).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Queue Operations', () => {
    it('should pause and resume queue', async () => {
      const queue = getQueue(QueueName.SHOPIFY_SYNC);

      await queue.pause();
      const isPaused = await queue.isPaused();
      expect(isPaused).toBe(true);

      await queue.resume();
      const isResumed = !(await queue.isPaused());
      expect(isResumed).toBe(true);
    });

    it('should clear queue', async () => {
      // Add some jobs
      await addJob(
        QueueName.SHOPIFY_SYNC,
        'test-job-1',
        { test: 'data' },
        `test-job-1-${Date.now()}`,
      );
      await addJob(
        QueueName.SHOPIFY_SYNC,
        'test-job-2',
        { test: 'data' },
        `test-job-2-${Date.now()}`,
      );

      // Clear queue
      await clearQueue(QueueName.SHOPIFY_SYNC);

      // Check queue is empty
      const queue = getQueue(QueueName.SHOPIFY_SYNC);
      const waitingCount = await queue.getWaitingCount();
      expect(waitingCount).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle job with missing data gracefully', async () => {
      const worker = new ShopifyWorker();
      await worker.start();

      // Add job with incomplete data
      const job = await addJob(
        QueueName.SHOPIFY_SYNC,
        'incomplete-job',
        {} as any, // Missing required fields
        `incomplete-${Date.now()}`,
      );

      expect(job).toBeDefined();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Job should fail
      const metrics = await worker.getMetrics();
      expect(metrics.failed).toBeGreaterThan(0);

      await worker.stop();
    }, 10000);
  });
});
