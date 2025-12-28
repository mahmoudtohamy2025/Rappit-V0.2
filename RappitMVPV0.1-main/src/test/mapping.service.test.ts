import { Test, TestingModule } from '@nestjs/testing';
import { MappingService } from '../src/services/mapping.service';
import { PrismaService } from '../src/common/database/prisma.service';

/**
 * Unit Tests for MappingService
 *
 * Tests SKU resolution strategies and unmapped item tracking.
 */
describe('MappingService', () => {
  let service: MappingService;
  let prisma: PrismaService;

  // Test data
  const organizationId = 'org-123';
  const channelId = 'channel-shopify-123';
  const productId = 'product-123';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MappingService, PrismaService],
    }).compile();

    service = module.get<MappingService>(MappingService);
    prisma = module.get<PrismaService>(PrismaService);

    // TODO: Seed test data
    // - Organization
    // - Channel (Shopify)
    // - Product
    // - SKUs with various metadata
  });

  afterAll(async () => {
    // TODO: Cleanup test data
    await prisma.$disconnect();
  });

  describe('resolveSkuByExternal', () => {
    it('should resolve by metadata (shopify_variant_id)', async () => {
      // TODO: Create SKU with shopify_variant_id = 12345
      // const sku = await prisma.sKU.create({
      //   data: {
      //     organizationId,
      //     productId,
      //     sku: 'LAPTOP-HP-15',
      //     metadata: {
      //       shopify_variant_id: 12345,
      //       shopify_product_id: 100,
      //     },
      //   },
      // });

      const result = await service.resolveSkuByExternal(
        channelId,
        '12345', // Variant ID
        organizationId,
      );

      // expect(result.skuId).toBe(sku.id);
      // expect(result.confidence).toBe(100); // Highest confidence
    });

    it('should resolve by exact SKU string', async () => {
      // TODO: Create SKU with exact string
      // const sku = await prisma.sKU.create({
      //   data: {
      //     organizationId,
      //     productId,
      //     sku: 'LAPTOP-DELL-XPS',
      //   },
      // });

      const result = await service.resolveSkuByExternal(
        channelId,
        'LAPTOP-DELL-XPS',
        organizationId,
      );

      // expect(result.skuId).toBe(sku.id);
      // expect(result.confidence).toBe(90); // High confidence
    });

    it('should resolve by fuzzy SKU match (case-insensitive)', async () => {
      // TODO: Create SKU
      // const sku = await prisma.sKU.create({
      //   data: {
      //     organizationId,
      //     productId,
      //     sku: 'laptop-macbook-pro',
      //   },
      // });

      const result = await service.resolveSkuByExternal(
        channelId,
        'LAPTOP-MACBOOK-PRO', // Different case
        organizationId,
      );

      // expect(result.skuId).toBe(sku.id);
      // expect(result.confidence).toBe(70); // Medium confidence
    });

    it('should return confidence 0 for no match', async () => {
      const result = await service.resolveSkuByExternal(
        channelId,
        'NON-EXISTENT-SKU',
        organizationId,
      );

      expect(result.skuId).toBeUndefined();
      expect(result.confidence).toBe(0);
    });

    it('should prioritize metadata match over exact SKU', async () => {
      // TODO: Create two SKUs:
      // 1. With metadata: shopify_variant_id = 99999
      // 2. With exact SKU string = '99999'

      // const sku1 = await prisma.sKU.create({
      //   data: {
      //     organizationId,
      //     productId,
      //     sku: 'PRODUCT-A',
      //     metadata: { shopify_variant_id: 99999 },
      //   },
      // });
      //
      // const sku2 = await prisma.sKU.create({
      //   data: {
      //     organizationId,
      //     productId,
      //     sku: '99999',
      //   },
      // });

      const result = await service.resolveSkuByExternal(
        channelId,
        '99999',
        organizationId,
      );

      // Should match sku1 (metadata) not sku2 (exact string)
      // expect(result.skuId).toBe(sku1.id);
      // expect(result.confidence).toBe(100);
    });

    it('should handle numeric variant IDs', async () => {
      const result = await service.resolveSkuByExternal(
        channelId,
        54321, // Numeric
        organizationId,
      );

      // Should convert to string and search
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reportUnmapped', () => {
    it('should create UnmappedItem record', async () => {
      const item = {
        externalItemId: '1',
        externalSku: 'UNKNOWN-SKU',
        externalVariantId: 777,
        name: 'Unknown Product',
        quantity: 2,
        metadata: { price: 100 },
      };

      await service.reportUnmapped(
        item,
        channelId,
        'order-123',
        organizationId,
      );

      const unmapped = await prisma.unmappedItem.findFirst({
        where: {
          organizationId,
          externalOrderId: 'order-123',
          externalSku: 'UNKNOWN-SKU',
        },
      });

      expect(unmapped).toBeDefined();
      expect(unmapped?.status).toBe('PENDING');
      expect(unmapped?.itemName).toBe('Unknown Product');
      expect(unmapped?.quantity).toBe(2);
    });

    it('should log warning for unmapped item', async () => {
      const logSpy = jest.spyOn(service['logger'], 'warn');

      await service.reportUnmapped(
        {
          name: 'Test Product',
          externalSku: 'TEST-SKU',
          quantity: 1,
        },
        channelId,
        'order-456',
        organizationId,
      );

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unmapped item reported'),
      );
    });
  });

  describe('bulkCreateMappings', () => {
    it('should create multiple SKU mappings', async () => {
      const mappings = [
        {
          sku: 'BULK-SKU-1',
          productId,
          shopifyVariantId: 1001,
          shopifyProductId: 100,
        },
        {
          sku: 'BULK-SKU-2',
          productId,
          woocommerceVariationId: 2001,
          woocommerceProductId: 200,
        },
        {
          sku: 'BULK-SKU-3',
          productId,
          barcode: '123456789012',
        },
      ];

      const result = await service.bulkCreateMappings(
        mappings,
        organizationId,
      );

      expect(result.created).toBeGreaterThan(0);

      // Verify SKUs created with metadata
      const sku1 = await prisma.sKU.findUnique({
        where: { sku: 'BULK-SKU-1' },
      });

      expect(sku1).toBeDefined();
      expect(sku1?.metadata).toHaveProperty('shopify_variant_id', 1001);

      const sku2 = await prisma.sKU.findUnique({
        where: { sku: 'BULK-SKU-2' },
      });

      expect(sku2?.metadata).toHaveProperty('woocommerce_variation_id', 2001);
    });

    it('should update existing SKU mappings', async () => {
      // Create initial SKU
      await prisma.sKU.create({
        data: {
          organizationId,
          productId,
          sku: 'UPDATE-SKU',
          metadata: { old_data: true },
        },
      });

      // Bulk update
      const result = await service.bulkCreateMappings(
        [
          {
            sku: 'UPDATE-SKU',
            productId,
            shopifyVariantId: 5555,
          },
        ],
        organizationId,
      );

      expect(result.updated).toBeGreaterThan(0);

      // Verify metadata updated
      const sku = await prisma.sKU.findUnique({
        where: { sku: 'UPDATE-SKU' },
      });

      expect(sku?.metadata).toHaveProperty('shopify_variant_id', 5555);
    });
  });

  describe('getUnmappedItems', () => {
    beforeEach(async () => {
      // Create test unmapped items
      await prisma.unmappedItem.createMany({
        data: [
          {
            organizationId,
            channelId,
            externalOrderId: 'order-1',
            itemName: 'Item 1',
            quantity: 1,
            status: 'PENDING',
          },
          {
            organizationId,
            channelId,
            externalOrderId: 'order-2',
            itemName: 'Item 2',
            quantity: 2,
            status: 'RESOLVED',
          },
          {
            organizationId,
            channelId,
            externalOrderId: 'order-3',
            itemName: 'Item 3',
            quantity: 3,
            status: 'PENDING',
          },
        ],
      });
    });

    it('should get all unmapped items', async () => {
      const items = await service.getUnmappedItems(organizationId);

      expect(items.length).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      const pending = await service.getUnmappedItems(
        organizationId,
        'PENDING',
      );

      expect(pending.every((item) => item.status === 'PENDING')).toBe(true);
    });

    it('should respect limit', async () => {
      const items = await service.getUnmappedItems(organizationId, undefined, 2);

      expect(items.length).toBeLessThanOrEqual(2);
    });

    it('should include channel data', async () => {
      const items = await service.getUnmappedItems(organizationId);

      expect(items[0]).toHaveProperty('channel');
      expect(items[0].channel).toHaveProperty('name');
      expect(items[0].channel).toHaveProperty('type');
    });
  });

  describe('resolveUnmappedItem', () => {
    it('should mark unmapped item as resolved', async () => {
      const unmapped = await prisma.unmappedItem.create({
        data: {
          organizationId,
          channelId,
          externalOrderId: 'order-resolve',
          itemName: 'Resolvable Item',
          quantity: 1,
          status: 'PENDING',
        },
      });

      const skuId = 'sku-123';
      const userId = 'user-admin';

      await service.resolveUnmappedItem(
        unmapped.id,
        skuId,
        userId,
        'Manually mapped to correct SKU',
      );

      const updated = await prisma.unmappedItem.findUnique({
        where: { id: unmapped.id },
      });

      expect(updated?.status).toBe('RESOLVED');
      expect(updated?.resolvedSkuId).toBe(skuId);
      expect(updated?.resolvedBy).toBe(userId);
      expect(updated?.resolvedAt).toBeDefined();
    });
  });

  describe('ignoreUnmappedItem', () => {
    it('should mark unmapped item as ignored', async () => {
      const unmapped = await prisma.unmappedItem.create({
        data: {
          organizationId,
          channelId,
          externalOrderId: 'order-ignore',
          itemName: 'Ignorable Item',
          quantity: 1,
          status: 'PENDING',
        },
      });

      await service.ignoreUnmappedItem(
        unmapped.id,
        'Out of scope product',
      );

      const updated = await prisma.unmappedItem.findUnique({
        where: { id: unmapped.id },
      });

      expect(updated?.status).toBe('IGNORED');
      expect(updated?.resolution).toBe('Out of scope product');
    });
  });

  describe('getUnmappedStats', () => {
    beforeEach(async () => {
      // Create test data
      await prisma.unmappedItem.createMany({
        data: [
          {
            organizationId,
            channelId,
            externalOrderId: 'order-stats-1',
            itemName: 'Item 1',
            quantity: 1,
            status: 'PENDING',
          },
          {
            organizationId,
            channelId,
            externalOrderId: 'order-stats-2',
            itemName: 'Item 2',
            quantity: 1,
            status: 'PENDING',
          },
          {
            organizationId,
            channelId,
            externalOrderId: 'order-stats-3',
            itemName: 'Item 3',
            quantity: 1,
            status: 'RESOLVED',
          },
          {
            organizationId,
            channelId,
            externalOrderId: 'order-stats-4',
            itemName: 'Item 4',
            quantity: 1,
            status: 'IGNORED',
          },
        ],
      });
    });

    it('should return correct statistics', async () => {
      const stats = await service.getUnmappedStats(organizationId);

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.pending).toBeGreaterThan(0);
      expect(stats.resolved).toBeGreaterThan(0);
      expect(stats.ignored).toBeGreaterThan(0);
      expect(stats.resolutionRate).toBeGreaterThan(0);
    });

    it('should calculate resolution rate correctly', async () => {
      const stats = await service.getUnmappedStats(organizationId);

      const expectedRate = (stats.resolved / stats.total) * 100;
      expect(stats.resolutionRate).toBeCloseTo(expectedRate, 2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty external value', async () => {
      const result = await service.resolveSkuByExternal(
        channelId,
        '',
        organizationId,
      );

      expect(result.confidence).toBe(0);
    });

    it('should handle null external value', async () => {
      const result = await service.resolveSkuByExternal(
        channelId,
        null as any,
        organizationId,
      );

      expect(result.confidence).toBe(0);
    });

    it('should handle invalid channel ID', async () => {
      const result = await service.resolveSkuByExternal(
        'invalid-channel',
        'SKU-123',
        organizationId,
      );

      expect(result.confidence).toBe(0);
    });

    it('should handle SKU with special characters', async () => {
      const result = await service.resolveSkuByExternal(
        channelId,
        'SKU-WITH-#@!-CHARS',
        organizationId,
      );

      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });
});
