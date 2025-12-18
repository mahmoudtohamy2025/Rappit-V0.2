import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../queues/redis-connection';
import { QueueName } from '../queues/queues';
import { PrismaClient } from '@prisma/client';
import { ShippingService } from '../services/shipping.service';
import { DHLIntegrationService } from '../integrations/shipping/dhl-integration.service';
import { FedExIntegrationService } from '../integrations/shipping/fedex-integration.service';
import { LocalFsLabelStorage } from '../services/label-storage/local-fs-storage';
import { IntegrationLoggingService } from '../services/integration-logging.service';
import { createLogger } from '../utils/structured-logger';

const logger = createLogger('ShipmentTrackWorker');
const prisma = new PrismaClient();

// Initialize services with observability
const integrationLogging = new IntegrationLoggingService(prisma as any);
const dhlService = new DHLIntegrationService(integrationLogging);
const fedexService = new FedExIntegrationService(integrationLogging);
const labelStorage = new LocalFsLabelStorage();
const shippingService = new ShippingService(
  prisma as any,
  dhlService,
  fedexService,
  labelStorage,
);

/**
 * Shipment Track Worker
 *
 * Processes tracking update jobs with full observability.
 *
 * Features:
 * - Correlation ID propagation
 * - Structured logging
 * - Integration logging
 * - Idempotency
 */
const worker = new Worker(
  QueueName.SHIPMENT_TRACKING,
  async (job: Job) => {
    const {
      jobId,
      shipmentId,
      orgId,
      carrierType,
      trackingNumber,
      correlationId, // <-- Correlation ID
    } = job.data;

    logger.logJob('shipment-tracking', 'started', {
      jobId,
      shipmentId,
      trackingNumber,
      orgId,
      correlationId,
    });

    try {
      // 1. Check idempotency
      const existing = await prisma.processedShipmentJob.findUnique({
        where: { jobId },
      });

      if (existing) {
        logger.log('Job already processed', {
          jobId,
          correlationId,
          processedAt: existing.processedAt,
        });
        return { status: 'already_processed', jobId };
      }

      // 2. Get shipment and shipping account
      const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
        include: {
          shippingAccount: true,
        },
      });

      if (!shipment) {
        throw new Error(`Shipment not found: ${shipmentId}`);
      }

      // 3. Call carrier tracking API (with correlation ID)
      logger.log(`Fetching tracking for ${trackingNumber} from ${carrierType}`, {
        correlationId,
        trackingNumber,
        shipmentId,
      });

      const carrierTracking = await shippingService.callCarrierGetTracking(
        shipment.shippingAccount,
        carrierType,
        trackingNumber,
        correlationId, // <-- Pass correlation ID
      );

      logger.log('Tracking fetched', {
        correlationId,
        trackingNumber,
        status: carrierTracking.status,
        eventCount: carrierTracking.events.length,
      });

      // 4. Update shipment status from tracking
      await shippingService.updateShipmentStatusFromTracking(
        shipmentId,
        carrierTracking,
        orgId,
      );

      // 5. Mark job processed
      await prisma.processedShipmentJob.create({
        data: {
          jobId,
          orgId,
          jobType: 'shipment-tracking',
          processedAt: new Date(),
          result: {
            shipmentId,
            trackingNumber,
            status: carrierTracking.status,
            events: carrierTracking.events.length,
            correlationId,
          },
        },
      });

      logger.logJob('shipment-tracking', 'completed', {
        jobId,
        shipmentId,
        trackingNumber,
        correlationId,
        status: carrierTracking.status,
      });

      return {
        status: 'success',
        shipmentId,
        trackingNumber,
        carrierStatus: carrierTracking.status,
        correlationId,
      };
    } catch (error) {
      logger.error('Shipment tracking job failed', error, {
        jobId,
        shipmentId,
        trackingNumber,
        correlationId,
      });

      logger.logJob('shipment-tracking', 'failed', {
        jobId,
        shipmentId,
        correlationId,
        error: error.message,
      });

      throw error; // Will trigger retry/DLQ
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: parseInt(process.env.SHIPMENT_TRACK_CONCURRENCY || '5'),
  },
);

// Event handlers with logging
worker.on('completed', (job) => {
  logger.log('Job completed', {
    jobId: job.id,
    correlationId: job.data.correlationId,
  });
});

worker.on('failed', (job, error) => {
  logger.error('Job failed', error, {
    jobId: job.id,
    attempt: job.attemptsMade,
    maxAttempts: job.opts.attempts,
    correlationId: job.data.correlationId,
  });
});

worker.on('error', (error) => {
  logger.error('Worker error', error);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.log('SIGTERM received, closing worker...');
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

export default worker;
