import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../queues/redis-connection';
import { QueueName } from '../queues/queues';
import { PrismaClient, ShipmentStatus, ActorType } from '@prisma/client';
import { ShippingService } from '../services/shipping.service';
import { DHLIntegrationService } from '../integrations/shipping/dhl-integration.service';
import { FedExIntegrationService } from '../integrations/shipping/fedex-integration.service';
import { LocalFsLabelStorage } from '../services/label-storage/local-fs-storage';
import { IntegrationLoggingService } from '../services/integration-logging.service';
import { createLogger } from '../utils/structured-logger';

const logger = createLogger('ShipmentCreateWorker');
const prisma = new PrismaClient();

// Initialize services
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
 * Shipment Create Worker
 *
 * Processes shipment creation jobs with full observability.
 *
 * Features:
 * - Correlation ID propagation
 * - Structured logging
 * - Integration logging
 * - Idempotency
 * - Transaction safety
 */
const worker = new Worker(
  QueueName.SHIPMENT_CREATE,
  async (job: Job) => {
    const {
      jobId,
      shipmentId,
      orderId,
      orgId,
      carrierType,
      shippingAccountId,
      options,
      correlationId, // <-- Correlation ID from HTTP request
    } = job.data;

    logger.logJob('shipment-create', 'started', {
      jobId,
      shipmentId,
      orderId,
      orgId,
      correlationId,
      carrierType,
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

      // 2. Lock shipment and order rows
      await prisma.$transaction(async (tx) => {
        // Lock shipment
        await tx.$queryRaw`
          SELECT * FROM shipments
          WHERE id = ${shipmentId} AND organization_id = ${orgId}
          FOR UPDATE
        `;

        // Lock order
        await tx.$queryRaw`
          SELECT * FROM orders
          WHERE id = ${orderId} AND organization_id = ${orgId}
          FOR UPDATE
        `;
      });

      // 3. Get shipment and shipping account
      const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
        include: {
          order: {
            include: {
              items: true,
            },
          },
          shippingAccount: true,
        },
      });

      if (!shipment) {
        throw new Error(`Shipment not found: ${shipmentId}`);
      }

      // 4. Call carrier integration (with correlation ID)
      logger.log(`Creating ${carrierType} shipment for order ${orderId}`, {
        correlationId,
        orderId,
        shipmentId,
        orgId,
      });

      const carrierResponse = await shippingService.callCarrierCreateShipment(
        shipment.shippingAccount,
        carrierType,
        shipment.order,
        options,
        correlationId, // <-- Pass correlation ID to integration
      );

      logger.log(`Carrier shipment created`, {
        correlationId,
        carrierShipmentId: carrierResponse.carrierShipmentId,
        trackingNumber: carrierResponse.trackingNumber,
      });

      // 5. Update shipment with carrier response
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: {
          carrierShipmentId: carrierResponse.carrierShipmentId,
          trackingNumber: carrierResponse.trackingNumber,
          cost: carrierResponse.cost,
          estimatedDelivery: carrierResponse.estimatedDelivery,
          status: ShipmentStatus.BOOKED,
          metadata: carrierResponse.raw,
        },
      });

      // 6. Fetch and store label
      if (carrierResponse.label) {
        logger.log('Storing label', {
          correlationId,
          shipmentId,
        });

        await shippingService.fetchAndStoreLabel(
          shipmentId,
          orgId,
          carrierResponse.label,
        );

        logger.log('Label stored', {
          correlationId,
          shipmentId,
        });
      }

      // 7. Create shipment event
      await prisma.shipmentEvent.create({
        data: {
          shipmentId,
          organizationId: orgId,
          eventType: 'SHIPMENT_BOOKED',
          status: ShipmentStatus.LABEL_CREATED,
          description: `Shipment booked with ${carrierType}`,
          raw: carrierResponse.raw,
        },
      });

      // 8. Update order status (optional)
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'SHIPPED',
        },
      });

      // 9. Create order timeline event
      await prisma.orderTimelineEvent.create({
        data: {
          organizationId: orgId,
          orderId,
          event: 'SHIPMENT_CREATED',
          toStatus: 'SHIPPED',
          actorType: ActorType.SYSTEM,
          metadata: {
            shipmentId,
            trackingNumber: carrierResponse.trackingNumber,
            carrier: carrierType,
            correlationId,
          },
        },
      });

      // 10. Mark job processed
      await prisma.processedShipmentJob.create({
        data: {
          jobId,
          orgId,
          jobType: 'shipment-create',
          processedAt: new Date(),
          result: {
            shipmentId,
            carrierShipmentId: carrierResponse.carrierShipmentId,
            trackingNumber: carrierResponse.trackingNumber,
            correlationId,
          },
        },
      });

      logger.logJob('shipment-create', 'completed', {
        jobId,
        shipmentId,
        correlationId,
        trackingNumber: carrierResponse.trackingNumber,
      });

      return {
        status: 'success',
        shipmentId,
        carrierShipmentId: carrierResponse.carrierShipmentId,
        trackingNumber: carrierResponse.trackingNumber,
        correlationId,
      };
    } catch (error) {
      logger.error('Shipment create job failed', error, {
        jobId,
        shipmentId,
        correlationId,
      });

      // Update shipment status to exception
      await prisma.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.EXCEPTION,
          metadata: {
            error: error.message,
            errorStack: error.stack,
            correlationId,
          },
        },
      });

      logger.logJob('shipment-create', 'failed', {
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
    concurrency: parseInt(process.env.SHIPMENT_CREATE_CONCURRENCY || '3'),
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
