import { Redis, RedisOptions } from 'ioredis';
import { Logger } from '@nestjs/common';

/**
 * Redis Connection Manager
 *
 * Provides singleton Redis connections with connection pooling.
 * Used by BullMQ for job queues.
 */

const logger = new Logger('RedisConnection');

let redisConnection: Redis | null = null;

/**
 * Get Redis connection options from environment
 */
export function getRedisOptions(): RedisOptions {
  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD || undefined;
  const db = parseInt(process.env.REDIS_DB || '0', 10);

  return {
    host,
    port,
    password,
    db,
    // Connection pool settings
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    enableOfflineQueue: true,
    // Reconnection strategy
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      logger.warn(`Redis reconnection attempt ${times}, delay: ${delay}ms`);
      return delay;
    },
    // Connection timeouts
    connectTimeout: 10000,
    // Keepalive
    keepAlive: 30000,
    // Lazy connect (connect on first command)
    lazyConnect: false,
  };
}

/**
 * Get or create Redis connection (singleton)
 *
 * Returns a shared Redis connection for BullMQ queues.
 * Connection is created on first call and reused.
 *
 * @returns Redis connection instance
 */
export function getRedisConnection(): Redis {
  if (!redisConnection) {
    const options = getRedisOptions();

    logger.log(
      `Creating Redis connection to ${options.host}:${options.port}, DB: ${options.db}`,
    );

    redisConnection = new Redis(options);

    // Event listeners
    redisConnection.on('connect', () => {
      logger.log('Redis connection established');
    });

    redisConnection.on('ready', () => {
      logger.log('Redis connection ready');
    });

    redisConnection.on('error', (error) => {
      logger.error(`Redis connection error: ${error.message}`);
    });

    redisConnection.on('close', () => {
      logger.warn('Redis connection closed');
    });

    redisConnection.on('reconnecting', () => {
      logger.log('Redis reconnecting...');
    });

    redisConnection.on('end', () => {
      logger.warn('Redis connection ended');
      redisConnection = null;
    });
  }

  return redisConnection;
}

/**
 * Create a new Redis connection (for workers)
 *
 * BullMQ workers need their own connection separate from queues.
 *
 * @returns New Redis connection instance
 */
export function createRedisConnection(): Redis {
  const options = getRedisOptions();

  logger.log('Creating new Redis connection for worker');

  const connection = new Redis(options);

  connection.on('error', (error) => {
    logger.error(`Worker Redis connection error: ${error.message}`);
  });

  return connection;
}

/**
 * Close Redis connection gracefully
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    logger.log('Closing Redis connection...');
    await redisConnection.quit();
    redisConnection = null;
    logger.log('Redis connection closed');
  }
}

/**
 * Health check - verify Redis connection
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error(`Redis health check failed: ${error.message}`);
    return false;
  }
}
