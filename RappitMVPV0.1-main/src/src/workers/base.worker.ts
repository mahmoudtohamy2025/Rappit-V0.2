import { Worker, Job, WorkerOptions } from 'bullmq';
import { createRedisConnection } from '../queues/redis-connection';
import { Logger } from '@nestjs/common';

/**
 * Base Worker Class
 *
 * Provides common worker functionality including:
 * - Job lifecycle logging
 * - Error handling
 * - Graceful shutdown
 */
export abstract class BaseWorker<T = any> {
  protected worker: Worker;
  protected logger: Logger;
  protected isShuttingDown = false;

  constructor(
    queueName: string,
    workerName: string,
    options: Partial<WorkerOptions> = {},
  ) {
    this.logger = new Logger(workerName);

    const defaultOptions: WorkerOptions = {
      connection: createRedisConnection(),
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
      limiter: {
        max: parseInt(process.env.WORKER_RATE_LIMIT_MAX || '10', 10),
        duration: parseInt(process.env.WORKER_RATE_LIMIT_DURATION || '1000', 10),
      },
      ...options,
    };

    this.worker = new Worker(
      queueName,
      async (job: Job<T>) => this.processJob(job),
      defaultOptions,
    );

    this.setupEventListeners();
  }

  /**
   * Process job - to be implemented by child classes
   */
  protected abstract processJob(job: Job<T>): Promise<void>;

  /**
   * Setup worker event listeners
   */
  private setupEventListeners() {
    this.worker.on('completed', (job: Job) => {
      this.logger.log(
        `Job completed: ${job.name} (ID: ${job.id}, Attempts: ${job.attemptsMade})`,
      );
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      if (!job) {
        this.logger.error(`Job failed with no job info: ${error.message}`);
        return;
      }

      this.logger.error(
        `Job failed: ${job.name} (ID: ${job.id}, Attempt: ${job.attemptsMade}/${job.opts.attempts}) - ${error.message}`,
      );

      // Log stack trace for debugging
      if (error.stack) {
        this.logger.error(error.stack);
      }

      // Check if moving to dead letter queue
      if (job.attemptsMade >= (job.opts.attempts || 3)) {
        this.logger.error(
          `Job moved to dead letter queue: ${job.name} (ID: ${job.id})`,
        );
      }
    });

    this.worker.on('active', (job: Job) => {
      this.logger.debug(
        `Job started: ${job.name} (ID: ${job.id}, Attempt: ${job.attemptsMade + 1})`,
      );
    });

    this.worker.on('stalled', (jobId: string) => {
      this.logger.warn(`Job stalled: ${jobId}`);
    });

    this.worker.on('error', (error: Error) => {
      this.logger.error(`Worker error: ${error.message}`);
    });

    this.worker.on('closing', () => {
      this.logger.log('Worker closing...');
    });

    this.worker.on('closed', () => {
      this.logger.log('Worker closed');
    });

    this.worker.on('resumed', () => {
      this.logger.log('Worker resumed');
    });

    this.worker.on('paused', () => {
      this.logger.log('Worker paused');
    });
  }

  /**
   * Start worker
   */
  async start() {
    this.logger.log('Worker started and listening for jobs...');
  }

  /**
   * Stop worker gracefully
   */
  async stop() {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.log('Stopping worker...');

    await this.worker.close();

    this.logger.log('Worker stopped');
  }

  /**
   * Pause worker
   */
  async pause() {
    await this.worker.pause();
    this.logger.log('Worker paused');
  }

  /**
   * Resume worker
   */
  async resume() {
    await this.worker.resume();
    this.logger.log('Worker resumed');
  }

  /**
   * Get worker metrics
   */
  async getMetrics() {
    const queue = await this.worker.getQueue();
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      isRunning: await this.worker.isRunning(),
      isPaused: await this.worker.isPaused(),
    };
  }
}
