import { setupTestDB, teardownTestDB, clearTables, getTestDB } from '../helpers/testDb';
import { seedOrganizationAndUser, seedSku, seedOrder } from '../helpers/seedData';
import { InventoryService } from '../../src/services/inventory.service';
import { PrismaClient } from '@prisma/client';

describe('InventoryService - Unit Tests', () => {
  let prisma: PrismaClient;
  let inventoryService: InventoryService;

  beforeAll(async () => {
    prisma = await setupTestDB();
    inventoryService = new InventoryService(prisma);
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTables();
  });

  describe('reserveStockForOrder', () => {
    it('should reserve stock successfully', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id, { quantityOnHand: 10, reserved: 0 });

      const channel = await prisma.channel.create({
        data: {
          organizationId: org.id,
          name: 'Test Channel',
          channelType: 'SHOPIFY',
          isActive: true,
        },
      });

      const { order, orderItem } = await seedOrder(prisma, org.id, channel.id, sku.id, {
        quantity: 2,
      });

      // Act
      await inventoryService.reserveStockForOrder(order.id, org.id, user.id);

      // Assert - Check reservation created
      const reservation = await prisma.inventoryReservation.findFirst({
        where: { orderId: order.id, skuId: sku.id },
      });

      expect(reservation).toBeTruthy();
      expect(reservation!.quantity).toBe(2);
      expect(reservation!.released).toBe(false);

      // Assert - Check SKU reserved quantity updated
      const updatedSku = await prisma.sku.findUnique({
        where: { id: sku.id },
      });

      expect(updatedSku!.reserved).toBe(2);
      expect(updatedSku!.quantityOnHand).toBe(10); // Unchanged
    });

    it('should be idempotent (no duplicate reservations)', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id, { quantityOnHand: 10 });

      const channel = await prisma.channel.create({
        data: {
          organizationId: org.id,
          name: 'Test Channel',
          channelType: 'SHOPIFY',
          isActive: true,
        },
      });

      const { order } = await seedOrder(prisma, org.id, channel.id, sku.id, { quantity: 2 });

      // Act - Reserve twice
      await inventoryService.reserveStockForOrder(order.id, org.id, user.id);
      await inventoryService.reserveStockForOrder(order.id, org.id, user.id);

      // Assert - Only one reservation
      const reservationCount = await prisma.inventoryReservation.count({
        where: { orderId: order.id },
      });

      expect(reservationCount).toBe(1);

      // Assert - Reserved quantity correct
      const updatedSku = await prisma.sku.findUnique({
        where: { id: sku.id },
      });

      expect(updatedSku!.reserved).toBe(2);
    });

    it('should throw error if insufficient stock', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id, { quantityOnHand: 1, reserved: 0 });

      const channel = await prisma.channel.create({
        data: {
          organizationId: org.id,
          name: 'Test Channel',
          channelType: 'SHOPIFY',
          isActive: true,
        },
      });

      const { order } = await seedOrder(prisma, org.id, channel.id, sku.id, { quantity: 5 });

      // Act & Assert
      await expect(
        inventoryService.reserveStockForOrder(order.id, org.id, user.id),
      ).rejects.toThrow('Insufficient stock');
    });
  });

  describe('releaseStockForOrder', () => {
    it('should release stock successfully', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id, { quantityOnHand: 10 });

      const channel = await prisma.channel.create({
        data: {
          organizationId: org.id,
          name: 'Test Channel',
          channelType: 'SHOPIFY',
          isActive: true,
        },
      });

      const { order } = await seedOrder(prisma, org.id, channel.id, sku.id, { quantity: 2 });

      // Reserve first
      await inventoryService.reserveStockForOrder(order.id, org.id, user.id);

      // Act - Release
      await inventoryService.releaseStockForOrder(order.id, org.id, user.id);

      // Assert - Reservation marked as released
      const reservation = await prisma.inventoryReservation.findFirst({
        where: { orderId: order.id },
      });

      expect(reservation!.released).toBe(true);

      // Assert - SKU reserved decreased
      const updatedSku = await prisma.sku.findUnique({
        where: { id: sku.id },
      });

      expect(updatedSku!.reserved).toBe(0);
    });

    it('should be idempotent (release twice)', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id, { quantityOnHand: 10 });

      const channel = await prisma.channel.create({
        data: {
          organizationId: org.id,
          name: 'Test Channel',
          channelType: 'SHOPIFY',
          isActive: true,
        },
      });

      const { order } = await seedOrder(prisma, org.id, channel.id, sku.id, { quantity: 2 });

      // Reserve first
      await inventoryService.reserveStockForOrder(order.id, org.id, user.id);

      // Act - Release twice
      await inventoryService.releaseStockForOrder(order.id, org.id, user.id);
      await inventoryService.releaseStockForOrder(order.id, org.id, user.id);

      // Assert - Reserved still 0
      const updatedSku = await prisma.sku.findUnique({
        where: { id: sku.id },
      });

      expect(updatedSku!.reserved).toBe(0);
    });
  });

  describe('adjustStock', () => {
    it('should adjust stock positively', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id, { quantityOnHand: 10 });

      // Act
      await inventoryService.adjustStock(
        sku.id,
        5,
        'Test increase',
        user.id,
        org.id,
      );

      // Assert
      const updatedSku = await prisma.sku.findUnique({
        where: { id: sku.id },
      });

      expect(updatedSku!.quantityOnHand).toBe(15);

      // Check adjustment record created
      const adjustment = await prisma.inventoryAdjustment.findFirst({
        where: { skuId: sku.id },
      });

      expect(adjustment!.quantityDelta).toBe(5);
      expect(adjustment!.reason).toBe('Test increase');
    });

    it('should adjust stock negatively (if available)', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id, { quantityOnHand: 10 });

      // Act
      await inventoryService.adjustStock(
        sku.id,
        -3,
        'Test decrease',
        user.id,
        org.id,
      );

      // Assert
      const updatedSku = await prisma.sku.findUnique({
        where: { id: sku.id },
      });

      expect(updatedSku!.quantityOnHand).toBe(7);
    });

    it('should prevent negative inventory', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id, { quantityOnHand: 5 });

      // Act & Assert
      await expect(
        inventoryService.adjustStock(
          sku.id,
          -10,
          'Test decrease beyond zero',
          user.id,
          org.id,
        ),
      ).rejects.toThrow('would result in negative inventory');

      // Verify inventory unchanged
      const updatedSku = await prisma.sku.findUnique({
        where: { id: sku.id },
      });

      expect(updatedSku!.quantityOnHand).toBe(5);
    });
  });

  describe('Concurrency protection', () => {
    it('should handle concurrent reservations correctly', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id, { quantityOnHand: 3 });

      const channel = await prisma.channel.create({
        data: {
          organizationId: org.id,
          name: 'Test Channel',
          channelType: 'SHOPIFY',
          isActive: true,
        },
      });

      // Create two orders, each wanting 2 units (total 4, but only 3 available)
      const { order: order1 } = await seedOrder(prisma, org.id, channel.id, sku.id, {
        quantity: 2,
        orderNumber: 'ORDER-1',
      });

      const { order: order2 } = await seedOrder(prisma, org.id, channel.id, sku.id, {
        quantity: 2,
        orderNumber: 'ORDER-2',
      });

      // Act - Try to reserve both concurrently
      const results = await Promise.allSettled([
        inventoryService.reserveStockForOrder(order1.id, org.id, user.id),
        inventoryService.reserveStockForOrder(order2.id, org.id, user.id),
      ]);

      // Assert - One should succeed, one should fail
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      const failureCount = results.filter((r) => r.status === 'rejected').length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);

      // Assert - No negative inventory
      const updatedSku = await prisma.sku.findUnique({
        where: { id: sku.id },
      });

      expect(updatedSku!.reserved).toBeLessThanOrEqual(3);
      expect(updatedSku!.reserved).toBeGreaterThanOrEqual(0);
    });
  });
});
