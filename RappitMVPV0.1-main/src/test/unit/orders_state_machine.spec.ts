import { setupTestDB, teardownTestDB, clearTables, getTestDB } from '../helpers/testDb';
import { seedOrganizationAndUser, seedSku, seedOrder } from '../helpers/seedData';
import { OrdersService } from '../../src/services/orders.service';
import { InventoryService } from '../../src/services/inventory.service';
import { PrismaClient, OrderStatus, ActorType } from '@prisma/client';

describe('OrdersService - State Machine Unit Tests', () => {
  let prisma: PrismaClient;
  let ordersService: OrdersService;
  let inventoryService: InventoryService;

  beforeAll(async () => {
    prisma = await setupTestDB();
    inventoryService = new InventoryService(prisma);
    ordersService = new OrdersService(prisma, inventoryService);
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearTables();
  });

  describe('Valid state transitions', () => {
    it('should allow NEW → PROCESSING', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id);

      const channel = await prisma.channel.create({
        data: {
          organizationId: org.id,
          name: 'Test Channel',
          channelType: 'SHOPIFY',
          isActive: true,
        },
      });

      const { order } = await seedOrder(prisma, org.id, channel.id, sku.id, {
        status: 'NEW',
      });

      // Act
      await ordersService.updateOrderStatus(
        order.id,
        OrderStatus.PROCESSING,
        ActorType.USER,
        user.id,
        org.id,
      );

      // Assert
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });

      expect(updatedOrder!.status).toBe(OrderStatus.PROCESSING);

      // Check timeline event created
      const timelineEvent = await prisma.orderTimelineEvent.findFirst({
        where: { orderId: order.id },
      });

      expect(timelineEvent).toBeTruthy();
      expect(timelineEvent!.fromStatus).toBe('NEW');
      expect(timelineEvent!.toStatus).toBe('PROCESSING');
    });

    it('should allow PROCESSING → SHIPPED', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id);

      const channel = await prisma.channel.create({
        data: {
          organizationId: org.id,
          name: 'Test Channel',
          channelType: 'SHOPIFY',
          isActive: true,
        },
      });

      const { order } = await seedOrder(prisma, org.id, channel.id, sku.id, {
        status: 'PROCESSING',
      });

      // Act
      await ordersService.updateOrderStatus(
        order.id,
        OrderStatus.SHIPPED,
        ActorType.SYSTEM,
        user.id,
        org.id,
      );

      // Assert
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });

      expect(updatedOrder!.status).toBe(OrderStatus.SHIPPED);
    });

    it('should allow SHIPPED → DELIVERED', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id);

      const channel = await prisma.channel.create({
        data: {
          organizationId: org.id,
          name: 'Test Channel',
          channelType: 'SHOPIFY',
          isActive: true,
        },
      });

      const { order } = await seedOrder(prisma, org.id, channel.id, sku.id, {
        status: 'SHIPPED',
      });

      // Act
      await ordersService.updateOrderStatus(
        order.id,
        OrderStatus.DELIVERED,
        ActorType.CARRIER,
        null,
        org.id,
      );

      // Assert
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });

      expect(updatedOrder!.status).toBe(OrderStatus.DELIVERED);
    });

    it('should allow NEW → CANCELLED', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id);

      const channel = await prisma.channel.create({
        data: {
          organizationId: org.id,
          name: 'Test Channel',
          channelType: 'SHOPIFY',
          isActive: true,
        },
      });

      const { order } = await seedOrder(prisma, org.id, channel.id, sku.id, {
        status: 'NEW',
      });

      // Act
      await ordersService.updateOrderStatus(
        order.id,
        OrderStatus.CANCELLED,
        ActorType.USER,
        user.id,
        org.id,
      );

      // Assert
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });

      expect(updatedOrder!.status).toBe(OrderStatus.CANCELLED);
    });
  });

  describe('Invalid state transitions', () => {
    it('should reject SHIPPED → NEW', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id);

      const channel = await prisma.channel.create({
        data: {
          organizationId: org.id,
          name: 'Test Channel',
          channelType: 'SHOPIFY',
          isActive: true,
        },
      });

      const { order } = await seedOrder(prisma, org.id, channel.id, sku.id, {
        status: 'SHIPPED',
      });

      // Act & Assert
      await expect(
        ordersService.updateOrderStatus(
          order.id,
          OrderStatus.NEW,
          ActorType.USER,
          user.id,
          org.id,
        ),
      ).rejects.toThrow('Invalid state transition');

      // Verify status unchanged
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });

      expect(updatedOrder!.status).toBe(OrderStatus.SHIPPED);
    });

    it('should reject DELIVERED → PROCESSING', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id);

      const channel = await prisma.channel.create({
        data: {
          organizationId: org.id,
          name: 'Test Channel',
          channelType: 'SHOPIFY',
          isActive: true,
        },
      });

      const { order } = await seedOrder(prisma, org.id, channel.id, sku.id, {
        status: 'DELIVERED',
      });

      // Act & Assert
      await expect(
        ordersService.updateOrderStatus(
          order.id,
          OrderStatus.PROCESSING,
          ActorType.USER,
          user.id,
          org.id,
        ),
      ).rejects.toThrow('Invalid state transition');
    });

    it('should reject CANCELLED → SHIPPED', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id);

      const channel = await prisma.channel.create({
        data: {
          organizationId: org.id,
          name: 'Test Channel',
          channelType: 'SHOPIFY',
          isActive: true,
        },
      });

      const { order } = await seedOrder(prisma, org.id, channel.id, sku.id, {
        status: 'CANCELLED',
      });

      // Act & Assert
      await expect(
        ordersService.updateOrderStatus(
          order.id,
          OrderStatus.SHIPPED,
          ActorType.USER,
          user.id,
          org.id,
        ),
      ).rejects.toThrow('Invalid state transition');
    });
  });

  describe('Inventory side effects', () => {
    it('should reserve stock when transitioning to NEW (if paid)', async () => {
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

      // Create order in PENDING state
      const { order } = await seedOrder(prisma, org.id, channel.id, sku.id, {
        status: 'PENDING',
        financialStatus: 'paid',
        quantity: 2,
      });

      // Act - Transition to NEW (should auto-reserve)
      await ordersService.updateOrderStatus(
        order.id,
        OrderStatus.NEW,
        ActorType.SYSTEM,
        null,
        org.id,
      );

      // Assert - Reservation created
      const reservation = await prisma.inventoryReservation.findFirst({
        where: { orderId: order.id },
      });

      expect(reservation).toBeTruthy();
      expect(reservation!.quantity).toBe(2);

      // Assert - SKU reserved
      const updatedSku = await prisma.sku.findUnique({
        where: { id: sku.id },
      });

      expect(updatedSku!.reserved).toBe(2);
    });

    it('should release stock when transitioning to CANCELLED', async () => {
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

      const { order } = await seedOrder(prisma, org.id, channel.id, sku.id, {
        status: 'NEW',
        quantity: 2,
      });

      // Reserve stock first
      await inventoryService.reserveStockForOrder(order.id, org.id, user.id);

      // Act - Cancel order (should release)
      await ordersService.updateOrderStatus(
        order.id,
        OrderStatus.CANCELLED,
        ActorType.USER,
        user.id,
        org.id,
      );

      // Assert - Reservation released
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

    it('should adjust stock when transitioning to RETURNED', async () => {
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

      const { order } = await seedOrder(prisma, org.id, channel.id, sku.id, {
        status: 'DELIVERED',
        quantity: 2,
      });

      // Act - Return order
      await ordersService.updateOrderStatus(
        order.id,
        OrderStatus.RETURNED,
        ActorType.USER,
        user.id,
        org.id,
      );

      // Assert - Stock adjusted back
      const updatedSku = await prisma.sku.findUnique({
        where: { id: sku.id },
      });

      expect(updatedSku!.quantityOnHand).toBe(12); // 10 + 2 returned

      // Check adjustment record
      const adjustment = await prisma.inventoryAdjustment.findFirst({
        where: { skuId: sku.id },
      });

      expect(adjustment).toBeTruthy();
      expect(adjustment!.quantityDelta).toBe(2);
      expect(adjustment!.reason).toContain('returned');
    });
  });

  describe('Timeline events', () => {
    it('should create timeline event with correct metadata', async () => {
      // Arrange
      const { org, user } = await seedOrganizationAndUser(prisma);
      const sku = await seedSku(prisma, org.id);

      const channel = await prisma.channel.create({
        data: {
          organizationId: org.id,
          name: 'Test Channel',
          channelType: 'SHOPIFY',
          isActive: true,
        },
      });

      const { order } = await seedOrder(prisma, org.id, channel.id, sku.id, {
        status: 'NEW',
      });

      // Act
      await ordersService.updateOrderStatus(
        order.id,
        OrderStatus.PROCESSING,
        ActorType.USER,
        user.id,
        org.id,
        { notes: 'Manual processing' },
      );

      // Assert
      const timelineEvent = await prisma.orderTimelineEvent.findFirst({
        where: { orderId: order.id },
      });

      expect(timelineEvent).toBeTruthy();
      expect(timelineEvent!.fromStatus).toBe('NEW');
      expect(timelineEvent!.toStatus).toBe('PROCESSING');
      expect(timelineEvent!.actorType).toBe(ActorType.USER);
      expect(timelineEvent!.actorId).toBe(user.id);
      expect(timelineEvent!.metadata).toEqual({ notes: 'Manual processing' });
    });
  });
});
