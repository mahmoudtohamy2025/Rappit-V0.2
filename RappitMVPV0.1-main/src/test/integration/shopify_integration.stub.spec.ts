import nock from 'nock';
import { setupTestDB, teardownTestDB, clearTables, getTestDB } from '../helpers/testDb';
import { flushQueues, cleanupRedis, createTestQueue, createTestWorker, waitForJob } from '../helpers/testRedis';
import { seedOrganizationAndUser, seedShopifyChannel, seedSku, buildShopifyOrderPayload } from '../helpers/seedData';
import { waitForRecord } from '../helpers/waitForCondition';
import { PrismaClient } from '@prisma/client';

describe('Shopify Integration - Stub Tests', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = await setupTestDB();
  });

  afterAll(async () => {
    await cleanupRedis();
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTables();
    await flushQueues(['webhook-processing', 'shopify-sync']);
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Order sync from Shopify API', () => {
    it('should fetch orders from Shopify and create in database', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const { channel, connection } = await seedShopifyChannel(prisma, org.id);
      const sku = await seedSku(prisma, org.id, { sku: 'SKU-TEST-001' });

      const shopifyOrder = buildShopifyOrderPayload({
        id: 123456789,
        financial_status: 'paid',
        line_items: [
          {
            sku: 'SKU-TEST-001',
            quantity: 2,
            price: '44.99',
          },
        ],
      });

      // Mock Shopify API
      nock('https://test-store.myshopify.com')
        .get('/admin/api/2024-01/orders.json')
        .query(true)
        .reply(200, {
          orders: [shopifyOrder],
        });

      // Act - Simulate sync (would normally be triggered by worker)
      // For stub, we'll directly call the service method
      const ShopifyIntegrationService = require('../../src/integrations/shopify/shopify-integration.service').ShopifyIntegrationService;
      const service = new ShopifyIntegrationService(prisma, null);

      await service.syncOrdersForChannel(channel.id, org.id);

      // Assert - Order created in database
      const order = await waitForRecord(async () => {
        return prisma.order.findFirst({
          where: {
            channelId: channel.id,
            channelOrderId: '123456789',
          },
        });
      });

      expect(order).toBeTruthy();
      expect(order.financialStatus).toBe('paid');
      expect(order.totalAmount).toBe(99.99);

      // Assert - Order items created
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId: order.id },
      });

      expect(orderItems).toHaveLength(1);
      expect(orderItems[0].quantity).toBe(2);
      expect(orderItems[0].skuId).toBe(sku.id);

      // Assert - Inventory reserved (paid order)
      const reservation = await prisma.inventoryReservation.findFirst({
        where: { orderId: order.id },
      });

      expect(reservation).toBeTruthy();
      expect(reservation!.quantity).toBe(2);
    });

    it('should handle unmapped SKUs correctly', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const { channel, connection } = await seedShopifyChannel(prisma, org.id);

      const shopifyOrder = buildShopifyOrderPayload({
        id: 987654321,
        financial_status: 'paid',
        line_items: [
          {
            sku: 'UNMAPPED-SKU-999',
            quantity: 1,
            price: '29.99',
          },
        ],
      });

      // Mock Shopify API
      nock('https://test-store.myshopify.com')
        .get('/admin/api/2024-01/orders.json')
        .query(true)
        .reply(200, {
          orders: [shopifyOrder],
        });

      // Act
      const ShopifyIntegrationService = require('../../src/integrations/shopify/shopify-integration.service').ShopifyIntegrationService;
      const service = new ShopifyIntegrationService(prisma, null);

      await service.syncOrdersForChannel(channel.id, org.id);

      // Assert - Order created but on hold
      const order = await waitForRecord(async () => {
        return prisma.order.findFirst({
          where: {
            channelId: channel.id,
            channelOrderId: '987654321',
          },
        });
      });

      expect(order).toBeTruthy();
      expect(order.status).toBe('ON_HOLD');

      // Assert - UnmappedItem created
      const unmappedItem = await prisma.unmappedItem.findFirst({
        where: {
          organizationId: org.id,
          channelSku: 'UNMAPPED-SKU-999',
        },
      });

      expect(unmappedItem).toBeTruthy();
      expect(unmappedItem!.resolved).toBe(false);
    });
  });

  describe('Webhook processing', () => {
    it('should process order/create webhook', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const { channel, connection } = await seedShopifyChannel(prisma, org.id);
      const sku = await seedSku(prisma, org.id, { sku: 'SKU-TEST-001' });

      const shopifyOrder = buildShopifyOrderPayload({
        id: 111222333,
        financial_status: 'paid',
        line_items: [
          {
            sku: 'SKU-TEST-001',
            quantity: 3,
            price: '19.99',
          },
        ],
      });

      // Act - Simulate webhook processing
      const WebhookProcessorService = require('../../src/services/webhook-processor.service').WebhookProcessorService;
      const processor = new WebhookProcessorService(prisma, null, null);

      await processor.processShopifyWebhook(
        channel.id,
        'orders/create',
        shopifyOrder,
        'test-event-id-123',
        org.id,
      );

      // Assert - Order created
      const order = await waitForRecord(async () => {
        return prisma.order.findFirst({
          where: {
            channelId: channel.id,
            channelOrderId: '111222333',
          },
        });
      });

      expect(order).toBeTruthy();
      expect(order.status).toBe('NEW');

      // Assert - Webhook processed (idempotency check)
      const processedWebhook = await prisma.processedWebhookEvent.findUnique({
        where: {
          externalEventId: 'test-event-id-123',
        },
      });

      expect(processedWebhook).toBeTruthy();
    });

    it('should be idempotent (duplicate webhook)', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const { channel, connection } = await seedShopifyChannel(prisma, org.id);
      const sku = await seedSku(prisma, org.id, { sku: 'SKU-TEST-001' });

      const shopifyOrder = buildShopifyOrderPayload({
        id: 444555666,
        financial_status: 'paid',
        line_items: [
          {
            sku: 'SKU-TEST-001',
            quantity: 1,
            price: '99.99',
          },
        ],
      });

      const WebhookProcessorService = require('../../src/services/webhook-processor.service').WebhookProcessorService;
      const processor = new WebhookProcessorService(prisma, null, null);

      // Act - Process webhook twice
      await processor.processShopifyWebhook(
        channel.id,
        'orders/create',
        shopifyOrder,
        'duplicate-event-id',
        org.id,
      );

      await processor.processShopifyWebhook(
        channel.id,
        'orders/create',
        shopifyOrder,
        'duplicate-event-id',
        org.id,
      );

      // Assert - Only one order created
      const orderCount = await prisma.order.count({
        where: {
          channelId: channel.id,
          channelOrderId: '444555666',
        },
      });

      expect(orderCount).toBe(1);

      // Assert - Only one reservation
      const reservationCount = await prisma.inventoryReservation.count({
        where: {
          order: {
            channelOrderId: '444555666',
          },
        },
      });

      expect(reservationCount).toBe(1);
    });
  });

  describe('Product sync', () => {
    it('should sync products from Shopify', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const { channel, connection } = await seedShopifyChannel(prisma, org.id);

      const shopifyProduct = {
        id: 789456123,
        title: 'Test Product from Shopify',
        variants: [
          {
            id: 111222333,
            sku: 'SHOPIFY-SKU-001',
            price: '49.99',
            inventory_quantity: 50,
          },
        ],
      };

      // Mock Shopify API
      nock('https://test-store.myshopify.com')
        .get('/admin/api/2024-01/products.json')
        .query(true)
        .reply(200, {
          products: [shopifyProduct],
        });

      // Act
      const ShopifyIntegrationService = require('../../src/integrations/shopify/shopify-integration.service').ShopifyIntegrationService;
      const service = new ShopifyIntegrationService(prisma, null);

      await service.syncProductsForChannel(channel.id, org.id);

      // Assert - SKU created or updated
      const sku = await waitForRecord(async () => {
        return prisma.sku.findFirst({
          where: {
            organizationId: org.id,
            sku: 'SHOPIFY-SKU-001',
          },
        });
      });

      expect(sku).toBeTruthy();
      expect(sku.name).toBe('Test Product from Shopify');
      expect(sku.quantityOnHand).toBe(50);
    });
  });
});
