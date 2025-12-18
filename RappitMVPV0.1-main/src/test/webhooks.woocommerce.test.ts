import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/database/prisma.service';
import { WebhookProcessorWorker } from '../src/workers/webhook-processor.worker';

/**
 * End-to-End Tests for WooCommerce Webhook Integration
 *
 * Tests the complete webhook flow:
 * 1. Webhook signature verification
 * 2. Deduplication
 * 3. Worker processing
 * 4. Order creation
 * 5. Inventory reservation
 *
 * Prerequisites:
 * - Test database configured
 * - Redis running
 * - Test data seeded (organization, channel, SKUs)
 */
describe('WooCommerce Webhooks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let worker: WebhookProcessorWorker;

  // Test data
  const webhookSecret = 'woocommerce-test-secret';
  const siteUrl = 'https://test-store.example.com';
  let organizationId: string;
  let channelId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Start webhook processor worker
    worker = new WebhookProcessorWorker();
    await worker.start();

    // TODO: Seed test data
    // - Organization
    // - Channel (WooCommerce)
    // - SKUs
    organizationId = 'test-org-123';
    channelId = 'test-channel-woo-123';
  });

  afterAll(async () => {
    await worker.stop();
    await app.close();
  });

  describe('Webhook Signature Verification', () => {
    it('should verify valid X-WC-Webhook-Signature', async () => {
      const payload = {
        id: 123,
        number: '1001',
        status: 'processing',
        total: '150.00',
      };

      const payloadString = JSON.stringify(payload);

      // Compute signature
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('base64');

      const response = await request(app.getHttpServer())
        .post('/webhooks/woocommerce/orders/created')
        .set('X-WC-Webhook-Signature', signature)
        .set('X-WC-Webhook-Source', siteUrl)
        .set('X-WC-Webhook-Topic', 'order.created')
        .set('X-WC-Webhook-ID', '1')
        .set('Content-Type', 'application/json')
        .send(payloadString)
        .expect(200);

      expect(response.body.status).toBe('enqueued');
      expect(response.body.received).toBe(true);
    });

    it('should reject invalid signature', async () => {
      const payload = { id: 456, status: 'completed' };

      await request(app.getHttpServer())
        .post('/webhooks/woocommerce/orders/created')
        .set('X-WC-Webhook-Signature', 'invalid-signature')
        .set('X-WC-Webhook-Source', siteUrl)
        .set('X-WC-Webhook-Topic', 'order.created')
        .set('X-WC-Webhook-ID', '2')
        .send(payload)
        .expect(403);
    });

    it('should reject webhook without signature', async () => {
      const payload = { id: 789 };

      await request(app.getHttpServer())
        .post('/webhooks/woocommerce/orders/created')
        .set('X-WC-Webhook-Source', siteUrl)
        .send(payload)
        .expect(403);
    });
  });

  describe('Webhook Deduplication', () => {
    it('should not process duplicate webhooks', async () => {
      const payload = {
        id: 999,
        number: '1002',
        status: 'processing',
        customer: {
          id: 1,
          email: 'test@example.com',
        },
        billing: {
          first_name: 'Ahmed',
          last_name: 'Al-Saud',
          email: 'test@example.com',
        },
        line_items: [
          {
            id: 1,
            product_id: 100,
            quantity: 1,
            total: '100.00',
          },
        ],
        total: '100.00',
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('base64');

      // First webhook - should be enqueued
      const response1 = await request(app.getHttpServer())
        .post('/webhooks/woocommerce/orders/created')
        .set('X-WC-Webhook-Signature', signature)
        .set('X-WC-Webhook-Source', siteUrl)
        .set('X-WC-Webhook-Topic', 'order.created')
        .set('X-WC-Webhook-ID', '100')
        .send(payloadString)
        .expect(200);

      expect(response1.body.status).toBe('enqueued');

      // Second webhook (duplicate) - should be ignored
      const response2 = await request(app.getHttpServer())
        .post('/webhooks/woocommerce/orders/created')
        .set('X-WC-Webhook-Signature', signature)
        .set('X-WC-Webhook-Source', siteUrl)
        .set('X-WC-Webhook-Topic', 'order.created')
        .set('X-WC-Webhook-ID', '100')
        .send(payloadString)
        .expect(200);

      expect(response2.body.status).toBe('already_processed');

      // Check database - should have only one ProcessedWebhookEvent
      const webhookEvents = await prisma.processedWebhookEvent.findMany({
        where: {
          source: 'woocommerce',
          externalEventId: '999',
        },
      });

      expect(webhookEvents.length).toBe(1);
    });
  });

  describe('Order Webhooks', () => {
    it('should process order.created webhook', async () => {
      const payload = {
        id: 1001,
        number: '1003',
        status: 'processing', // Paid status
        date_created: '2024-12-12T10:00:00',
        currency: 'SAR',
        customer: {
          id: 10,
          email: 'customer@example.com',
        },
        billing: {
          first_name: 'Mohammed',
          last_name: 'Ali',
          email: 'customer@example.com',
          phone: '+966501234567',
          address_1: 'King Fahd Road',
          city: 'Riyadh',
          postcode: '12345',
          country: 'SA',
        },
        shipping: {
          first_name: 'Mohammed',
          last_name: 'Ali',
          address_1: 'King Fahd Road',
          city: 'Riyadh',
          postcode: '12345',
          country: 'SA',
        },
        line_items: [
          {
            id: 1,
            product_id: 100,
            variation_id: 0,
            quantity: 2,
            sku: 'LAPTOP-HP-15',
            name: 'HP Laptop 15-inch',
            price: '2500.00',
            total: '5000.00',
            total_tax: '750.00',
          },
        ],
        total: '5750.00',
        total_tax: '750.00',
        shipping_total: '0.00',
        discount_total: '0.00',
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('base64');

      await request(app.getHttpServer())
        .post('/webhooks/woocommerce/orders/created')
        .set('X-WC-Webhook-Signature', signature)
        .set('X-WC-Webhook-Source', siteUrl)
        .set('X-WC-Webhook-Topic', 'order.created')
        .set('X-WC-Webhook-ID', '200')
        .send(payloadString)
        .expect(200);

      // Wait for worker to process
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check ProcessedWebhookEvent status
      const webhookEvent = await prisma.processedWebhookEvent.findFirst({
        where: {
          source: 'woocommerce',
          externalEventId: '1001',
        },
      });

      expect(webhookEvent).toBeDefined();
      expect(webhookEvent?.status).toBe('COMPLETED');

      // TODO: Check order created in database
      // const order = await prisma.order.findFirst({
      //   where: {
      //     externalOrderId: '1001',
      //     channelId,
      //   },
      //   include: { reservations: true },
      // });
      //
      // expect(order).toBeDefined();
      // expect(order.status).toBe('RESERVED'); // Paid order auto-reserved
      // expect(order.reservations.length).toBeGreaterThan(0);
    }, 10000);

    it('should process order.updated webhook', async () => {
      const payload = {
        id: 1002,
        number: '1004',
        status: 'completed',
        // ... rest of order data
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('base64');

      await request(app.getHttpServer())
        .post('/webhooks/woocommerce/orders/updated')
        .set('X-WC-Webhook-Signature', signature)
        .set('X-WC-Webhook-Source', siteUrl)
        .set('X-WC-Webhook-Topic', 'order.updated')
        .set('X-WC-Webhook-ID', '201')
        .send(payloadString)
        .expect(200);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check webhook processed
      const webhookEvent = await prisma.processedWebhookEvent.findFirst({
        where: {
          source: 'woocommerce',
          eventType: 'order.updated',
          payload: {
            path: ['id'],
            equals: 1002,
          },
        },
      });

      expect(webhookEvent).toBeDefined();
    }, 10000);

    it('should handle pending orders without reserving inventory', async () => {
      const payload = {
        id: 1003,
        status: 'pending', // Not paid yet
        line_items: [
          {
            id: 1,
            product_id: 100,
            quantity: 5,
            sku: 'LAPTOP-HP-15',
          },
        ],
        // ... rest of order
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('base64');

      await request(app.getHttpServer())
        .post('/webhooks/woocommerce/orders/created')
        .set('X-WC-Webhook-Signature', signature)
        .set('X-WC-Webhook-Source', siteUrl)
        .send(payloadString)
        .expect(200);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // TODO: Verify order created but inventory NOT reserved
      // const order = await prisma.order.findFirst({
      //   where: { externalOrderId: '1003' },
      //   include: { reservations: true },
      // });
      //
      // expect(order.status).toBe('NEW'); // Pending = NEW
      // expect(order.reservations.length).toBe(0); // No reservations
    }, 10000);
  });

  describe('Product Webhooks', () => {
    it('should process product.created webhook', async () => {
      const payload = {
        id: 200,
        name: 'Test Product',
        sku: 'TEST-SKU-001',
        type: 'simple',
        price: '99.99',
        stock_quantity: 50,
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('base64');

      await request(app.getHttpServer())
        .post('/webhooks/woocommerce/products/created')
        .set('X-WC-Webhook-Signature', signature)
        .set('X-WC-Webhook-Source', siteUrl)
        .set('X-WC-Webhook-Topic', 'product.created')
        .set('X-WC-Webhook-ID', '300')
        .send(payloadString)
        .expect(200);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check webhook processed
      const webhookEvent = await prisma.processedWebhookEvent.findFirst({
        where: {
          source: 'woocommerce',
          eventType: 'product.created',
          externalEventId: '200',
        },
      });

      expect(webhookEvent).toBeDefined();
    }, 10000);

    it('should process product.updated webhook', async () => {
      const payload = {
        id: 201,
        name: 'Updated Product',
        stock_quantity: 100,
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('base64');

      await request(app.getHttpServer())
        .post('/webhooks/woocommerce/products/updated')
        .set('X-WC-Webhook-Signature', signature)
        .set('X-WC-Webhook-Source', siteUrl)
        .send(payloadString)
        .expect(200);
    });
  });

  describe('Order Mapping', () => {
    it('should map WooCommerce order to internal format', async () => {
      // This would test the mapping logic in WooCommerceIntegrationService
      // TODO: Import service and test mapExternalOrderToInternal()

      const wooOrder = {
        id: 5000,
        number: '5000',
        status: 'processing',
        date_created: '2024-12-12T10:00:00',
        currency: 'SAR',
        customer: {
          id: 50,
          email: 'mapped@example.com',
        },
        billing: {
          first_name: 'Test',
          last_name: 'User',
          email: 'mapped@example.com',
          address_1: 'Street 1',
          city: 'Riyadh',
          postcode: '12345',
          country: 'SA',
        },
        line_items: [
          {
            id: 1,
            product_id: 100,
            variation_id: 200,
            sku: 'LAPTOP-HP-15',
            quantity: 2,
            price: '2500.00',
            total: '5000.00',
            total_tax: '750.00',
          },
        ],
        total: '5750.00',
        total_tax: '750.00',
        shipping_total: '0.00',
      };

      // const service = app.get(WooCommerceIntegrationService);
      // const mapped = await service.mapExternalOrderToInternal(channelId, wooOrder);

      // expect(mapped.channelId).toBe(channelId);
      // expect(mapped.externalOrderId).toBe('5000');
      // expect(mapped.customer.email).toBe('mapped@example.com');
      // expect(mapped.items.length).toBe(1);
      // expect(mapped.items[0].sku).toBe('LAPTOP-HP-15');
      // expect(mapped.items[0].quantity).toBe(2);
      // expect(mapped.totalAmount).toBe(5750);
      // expect(mapped.paymentStatus).toBe('PAID'); // 'processing' = PAID
    });

    it('should handle product variations in order items', async () => {
      const wooOrder = {
        id: 5001,
        line_items: [
          {
            id: 1,
            product_id: 100,
            variation_id: 250, // Has variation
            sku: 'LAPTOP-HP-15-16GB',
            quantity: 1,
            meta_data: [
              { key: 'RAM', value: '16GB' },
              { key: 'Storage', value: '512GB' },
            ],
          },
        ],
        // ... rest of order
      };

      // Test that variation metadata is preserved
      // const mapped = await service.mapExternalOrderToInternal(channelId, wooOrder);
      // expect(mapped.items[0].metadata.woocommerce_variation_id).toBe(250);
      // expect(mapped.items[0].variantName).toContain('RAM: 16GB');
    });
  });

  describe('Error Handling', () => {
    it('should retry failed webhook processing', async () => {
      // Send webhook with invalid data to trigger error
      const payload = {
        id: 9999,
        // Missing required fields - will cause processing error
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('base64');

      await request(app.getHttpServer())
        .post('/webhooks/woocommerce/orders/created')
        .set('X-WC-Webhook-Signature', signature)
        .set('X-WC-Webhook-Source', siteUrl)
        .send(payloadString)
        .expect(200); // Still returns 200 (enqueued)

      // Wait for worker to attempt processing and fail
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Check webhook event status
      const webhookEvent = await prisma.processedWebhookEvent.findFirst({
        where: {
          source: 'woocommerce',
          externalEventId: '9999',
        },
      });

      expect(webhookEvent).toBeDefined();
      // After retries, should be FAILED
      expect(webhookEvent?.status).toMatch(/FAILED|PROCESSING/);
    }, 15000);

    it('should handle unknown channel gracefully', async () => {
      const payload = { id: 8888 };
      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('base64');

      await request(app.getHttpServer())
        .post('/webhooks/woocommerce/orders/created')
        .set('X-WC-Webhook-Signature', signature)
        .set('X-WC-Webhook-Source', 'https://unknown-store.example.com')
        .send(payloadString)
        .expect(403); // Channel not configured
    });
  });

  describe('Inventory Reservation', () => {
    it('should reserve inventory for paid orders', async () => {
      // TODO: This test requires full integration with OrdersService and InventoryService

      const payload = {
        id: 7000,
        status: 'processing', // Paid
        line_items: [
          {
            id: 1,
            product_id: 100,
            sku: 'LAPTOP-HP-15',
            quantity: 3,
            total: '7500.00',
          },
        ],
        // ... rest of order
      };

      // Send webhook
      // Wait for processing
      // Check inventory reservation created
      // Check available stock reduced
    });

    it('should not reserve inventory for pending orders', async () => {
      // TODO: Test that pending orders don't trigger reservation
    });

    it('should release inventory when order cancelled', async () => {
      // TODO: Test order.deleted webhook releases inventory
    });
  });
});
