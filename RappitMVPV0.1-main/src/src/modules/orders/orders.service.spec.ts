import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '@common/database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ActorType } from '@common/enums/actor-type.enum';

describe('OrdersService - State Machine & Integration', () => {
  let service: OrdersService;
  let prisma: PrismaService;
  let inventoryService: InventoryService;

  const mockOrgId = 'org-123';
  const mockChannelId = 'channel-123';
  const mockOrderId = 'order-123';
  const mockSkuId = 'sku-123';

  const mockChannel = {
    id: mockChannelId,
    name: 'Shopify Store',
    type: 'SHOPIFY',
  };

  const mockOrder = {
    id: mockOrderId,
    organizationId: mockOrgId,
    channelId: mockChannelId,
    orderNumber: 'ORD-202412-00001',
    status: 'NEW',
    externalOrderId: 'shopify-order-123',
    channel: mockChannel,
    items: [
      {
        id: 'item-123',
        skuId: mockSkuId,
        quantity: 5,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
            order: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              create: jest.fn(),
              upsert: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            orderTimelineEvent: {
              create: jest.fn(),
            },
            customer: {
              upsert: jest.fn(),
            },
            address: {
              create: jest.fn(),
            },
            sKU: {
              findUnique: jest.fn(),
            },
            orderItem: {
              upsert: jest.fn(),
            },
          },
        },
        {
          provide: InventoryService,
          useValue: {
            reserveStockForOrder: jest.fn(),
            releaseStockForOrder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get<PrismaService>(PrismaService);
    inventoryService = module.get<InventoryService>(InventoryService);
  });

  describe('updateOrderStatus - State Machine', () => {
    it('should allow valid transition from NEW to RESERVED', async () => {
      const order = { ...mockOrder, status: 'NEW' };

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          order: {
            update: jest.fn().mockResolvedValue({
              ...order,
              status: 'RESERVED',
            }),
          },
          orderTimelineEvent: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });
      jest.spyOn(inventoryService, 'reserveStockForOrder').mockResolvedValue([] as any);

      const result = await service.updateOrderStatus(
        mockOrderId,
        'RESERVED',
        ActorType.SYSTEM,
        null,
        mockOrgId,
      );

      expect(result.status).toBe('RESERVED');
      expect(inventoryService.reserveStockForOrder).toHaveBeenCalledWith(
        mockOrderId,
        mockOrgId,
      );
    });

    it('should allow valid transition from RESERVED to READY_TO_SHIP', async () => {
      const order = { ...mockOrder, status: 'RESERVED' };

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          order: {
            update: jest.fn().mockResolvedValue({
              ...order,
              status: 'READY_TO_SHIP',
            }),
          },
          orderTimelineEvent: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const result = await service.updateOrderStatus(
        mockOrderId,
        'READY_TO_SHIP',
        ActorType.USER,
        'user-123',
        mockOrgId,
      );

      expect(result.status).toBe('READY_TO_SHIP');
      expect(inventoryService.reserveStockForOrder).not.toHaveBeenCalled();
    });

    it('should reject invalid transition from NEW to DELIVERED', async () => {
      const order = { ...mockOrder, status: 'NEW' };

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);

      await expect(
        service.updateOrderStatus(
          mockOrderId,
          'DELIVERED',
          ActorType.USER,
          'user-123',
          mockOrgId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should reject invalid transition from DELIVERED to NEW', async () => {
      const order = { ...mockOrder, status: 'DELIVERED' };

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);

      await expect(
        service.updateOrderStatus(
          mockOrderId,
          'NEW',
          ActorType.USER,
          'user-123',
          mockOrgId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should release inventory when transitioning to CANCELLED', async () => {
      const order = { ...mockOrder, status: 'RESERVED' };

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          order: {
            update: jest.fn().mockResolvedValue({
              ...order,
              status: 'CANCELLED',
            }),
          },
          orderTimelineEvent: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });
      jest.spyOn(inventoryService, 'releaseStockForOrder').mockResolvedValue([] as any);

      const result = await service.updateOrderStatus(
        mockOrderId,
        'CANCELLED',
        ActorType.USER,
        'user-123',
        mockOrgId,
        'Customer requested cancellation',
      );

      expect(result.status).toBe('CANCELLED');
      expect(inventoryService.releaseStockForOrder).toHaveBeenCalledWith(
        mockOrderId,
        mockOrgId,
        'cancelled',
      );
    });

    it('should release inventory when transitioning to RETURNED', async () => {
      const order = { ...mockOrder, status: 'DELIVERED' };

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          order: {
            update: jest.fn().mockResolvedValue({
              ...order,
              status: 'RETURNED',
            }),
          },
          orderTimelineEvent: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });
      jest.spyOn(inventoryService, 'releaseStockForOrder').mockResolvedValue([] as any);

      const result = await service.updateOrderStatus(
        mockOrderId,
        'RETURNED',
        ActorType.CARRIER,
        'fedex',
        mockOrgId,
      );

      expect(result.status).toBe('RETURNED');
      expect(inventoryService.releaseStockForOrder).toHaveBeenCalledWith(
        mockOrderId,
        mockOrgId,
        'returned',
      );
    });

    it('should throw NotFoundException if order not found', async () => {
      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(null);

      await expect(
        service.updateOrderStatus(
          mockOrderId,
          'RESERVED',
          ActorType.SYSTEM,
          null,
          mockOrgId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create timeline event when status changes', async () => {
      const order = { ...mockOrder, status: 'NEW' };
      const timelineEventSpy = jest.fn().mockResolvedValue({});

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          order: {
            update: jest.fn().mockResolvedValue({
              ...order,
              status: 'RESERVED',
            }),
          },
          orderTimelineEvent: {
            create: timelineEventSpy,
          },
        };
        return callback(tx);
      });
      jest.spyOn(inventoryService, 'reserveStockForOrder').mockResolvedValue([] as any);

      await service.updateOrderStatus(
        mockOrderId,
        'RESERVED',
        ActorType.USER,
        'user-123',
        mockOrgId,
        'Manual status change',
      );

      expect(timelineEventSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: mockOrderId,
          eventType: 'status_changed',
          fromStatus: 'NEW',
          toStatus: 'RESERVED',
          actorType: ActorType.USER,
          actorId: 'user-123',
        }),
      });
    });
  });

  describe('appendOrderTimelineEvent', () => {
    it('should create timeline event for valid order', async () => {
      const order = mockOrder;

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);
      jest.spyOn(prisma.orderTimelineEvent, 'create').mockResolvedValue({
        id: 'event-123',
        eventType: 'note_added',
      } as any);

      const result = await service.appendOrderTimelineEvent(
        mockOrderId,
        'note_added',
        ActorType.USER,
        mockOrgId,
        'user-123',
        { note: 'Test note' },
        'Test note',
      );

      expect(result.eventType).toBe('note_added');
      expect(prisma.orderTimelineEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: mockOrderId,
          organizationId: mockOrgId,
          eventType: 'note_added',
          actorType: ActorType.USER,
          actorId: 'user-123',
          description: 'Test note',
          metadata: { note: 'Test note' },
        }),
      });
    });

    it('should throw NotFoundException if order not found', async () => {
      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(null);

      await expect(
        service.appendOrderTimelineEvent(
          mockOrderId,
          'note_added',
          ActorType.USER,
          mockOrgId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addNote', () => {
    it('should add note to order and create timeline event', async () => {
      const order = {
        ...mockOrder,
        internalNotes: 'Existing note',
      };

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);
      jest.spyOn(prisma.order, 'update').mockResolvedValue(order as any);
      jest.spyOn(prisma.orderTimelineEvent, 'create').mockResolvedValue({} as any);

      const dto = { note: 'New note' };
      await service.addNote(mockOrderId, dto, mockOrgId, 'user-123');

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: mockOrderId },
        data: expect.objectContaining({
          internalNotes: expect.stringContaining('New note'),
          updatedById: 'user-123',
        }),
      });

      expect(prisma.orderTimelineEvent.create).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return order with full details', async () => {
      const fullOrder = {
        ...mockOrder,
        items: [
          {
            id: 'item-123',
            sku: { id: mockSkuId, sku: 'LAPTOP-HP-15' },
          },
        ],
        timelineEvents: [],
      };

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(fullOrder as any);

      const result = await service.findOne(mockOrgId, mockOrderId);

      expect(result.id).toBe(mockOrderId);
      expect(result.timelineEvents).toBeDefined();
    });

    it('should throw NotFoundException if order not found', async () => {
      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(null);

      await expect(
        service.findOne(mockOrgId, mockOrderId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete order in NEW status', async () => {
      const order = { ...mockOrder, status: 'NEW' };

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);
      jest.spyOn(prisma.order, 'delete').mockResolvedValue(order as any);

      const result = await service.delete(mockOrgId, mockOrderId);

      expect(result.message).toBe('Order deleted successfully');
      expect(prisma.order.delete).toHaveBeenCalledWith({ where: { id: mockOrderId } });
    });

    it('should delete order in CANCELLED status', async () => {
      const order = { ...mockOrder, status: 'CANCELLED' };

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);
      jest.spyOn(prisma.order, 'delete').mockResolvedValue(order as any);

      await service.delete(mockOrgId, mockOrderId);

      expect(prisma.order.delete).toHaveBeenCalled();
    });

    it('should not delete order in RESERVED status', async () => {
      const order = { ...mockOrder, status: 'RESERVED' };

      jest.spyOn(prisma.order, 'findFirst').mockResolvedValue(order as any);

      await expect(
        service.delete(mockOrgId, mockOrderId),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.order.delete).not.toHaveBeenCalled();
    });
  });
});
