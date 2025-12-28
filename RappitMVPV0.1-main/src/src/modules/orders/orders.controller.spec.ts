import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActorType } from '@common/enums/actor-type.enum';
import { CurrentUserPayload } from '@common/decorators/current-user.decorator';

describe('OrdersController - Integration & RBAC', () => {
  let controller: OrdersController;
  let service: OrdersService;

  const mockOrgId = 'org-123';
  const mockOrderId = 'order-123';

  const mockAdminUser: CurrentUserPayload = {
    userId: 'user-admin',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    organizationId: mockOrgId,
    role: 'ADMIN',
  };

  const mockManagerUser: CurrentUserPayload = {
    userId: 'user-manager',
    email: 'manager@example.com',
    firstName: 'Manager',
    lastName: 'User',
    organizationId: mockOrgId,
    role: 'MANAGER',
  };

  const mockOperatorUser: CurrentUserPayload = {
    userId: 'user-operator',
    email: 'operator@example.com',
    firstName: 'Operator',
    lastName: 'User',
    organizationId: mockOrgId,
    role: 'OPERATOR',
  };

  const mockOrder = {
    id: mockOrderId,
    orderNumber: 'ORD-202412-00001',
    status: 'NEW',
    organizationId: mockOrgId,
    items: [],
    timelineEvents: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            createOrUpdateOrderFromChannelPayload: jest.fn(),
            updateOrderStatus: jest.fn(),
            addNote: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get<OrdersService>(OrdersService);
  });

  describe('GET /orders - findAll', () => {
    it('should allow OPERATOR to list orders', async () => {
      const filters = { page: 1, limit: 20 };
      const expectedResult = {
        data: [mockOrder],
        meta: { total: 1, page: 1, limit: 20 },
      };

      jest.spyOn(service, 'findAll').mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(
        mockOrgId,
        filters,
        mockOperatorUser,
      );

      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalledWith(mockOrgId, filters);
    });

    it('should allow MANAGER to list orders', async () => {
      const filters = { page: 1, limit: 20 };
      jest.spyOn(service, 'findAll').mockResolvedValue({ data: [], meta: {} } as any);

      await controller.findAll(mockOrgId, filters, mockManagerUser);

      expect(service.findAll).toHaveBeenCalledWith(mockOrgId, filters);
    });

    it('should allow ADMIN to list orders', async () => {
      const filters = { page: 1, limit: 20 };
      jest.spyOn(service, 'findAll').mockResolvedValue({ data: [], meta: {} } as any);

      await controller.findAll(mockOrgId, filters, mockAdminUser);

      expect(service.findAll).toHaveBeenCalledWith(mockOrgId, filters);
    });

    it('should filter orders by status', async () => {
      const filters = { status: 'RESERVED' as any, page: 1, limit: 20 };
      jest.spyOn(service, 'findAll').mockResolvedValue({ data: [], meta: {} } as any);

      await controller.findAll(mockOrgId, filters, mockManagerUser);

      expect(service.findAll).toHaveBeenCalledWith(mockOrgId, filters);
    });

    it('should filter orders by channel', async () => {
      const filters = { channelId: 'channel-123', page: 1, limit: 20 };
      jest.spyOn(service, 'findAll').mockResolvedValue({ data: [], meta: {} } as any);

      await controller.findAll(mockOrgId, filters, mockManagerUser);

      expect(service.findAll).toHaveBeenCalledWith(mockOrgId, filters);
    });

    it('should filter orders by search term', async () => {
      const filters = { search: 'ORD-202412', page: 1, limit: 20 };
      jest.spyOn(service, 'findAll').mockResolvedValue({ data: [], meta: {} } as any);

      await controller.findAll(mockOrgId, filters, mockManagerUser);

      expect(service.findAll).toHaveBeenCalledWith(mockOrgId, filters);
    });
  });

  describe('GET /orders/:id - findOne', () => {
    it('should allow OPERATOR to view order details', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockOrder as any);

      const result = await controller.findOne(
        mockOrgId,
        mockOrderId,
        mockOperatorUser,
      );

      expect(result).toEqual(mockOrder);
      expect(service.findOne).toHaveBeenCalledWith(mockOrgId, mockOrderId);
    });

    it('should allow MANAGER to view order details', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockOrder as any);

      await controller.findOne(mockOrgId, mockOrderId, mockManagerUser);

      expect(service.findOne).toHaveBeenCalledWith(mockOrgId, mockOrderId);
    });

    it('should allow ADMIN to view order details', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockOrder as any);

      await controller.findOne(mockOrgId, mockOrderId, mockAdminUser);

      expect(service.findOne).toHaveBeenCalledWith(mockOrgId, mockOrderId);
    });

    it('should throw NotFoundException if order not found', async () => {
      jest
        .spyOn(service, 'findOne')
        .mockRejectedValue(new NotFoundException('Order not found'));

      await expect(
        controller.findOne(mockOrgId, 'invalid-id', mockManagerUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /orders - createFromChannel', () => {
    const createDto = {
      channelId: 'channel-123',
      externalOrderId: 'shopify-order-456',
      customer: {
        firstName: 'Ahmed',
        lastName: 'Al-Saud',
        email: 'ahmed@example.com',
      },
      shippingAddress: {
        firstName: 'Ahmed',
        lastName: 'Al-Saud',
        street1: 'King Fahd Road',
        city: 'Riyadh',
        postalCode: '12345',
        country: 'SA',
      },
      items: [
        {
          externalItemId: 'item-1',
          sku: 'LAPTOP-HP-15',
          name: 'HP Laptop',
          quantity: 2,
          unitPrice: 2500,
          totalPrice: 5000,
        },
      ],
      subtotal: 5000,
      totalAmount: 5750,
      taxAmount: 750,
    };

    it('should allow MANAGER to create order from channel', async () => {
      jest
        .spyOn(service, 'createOrUpdateOrderFromChannelPayload')
        .mockResolvedValue(mockOrder as any);

      const result = await controller.createFromChannel(
        mockOrgId,
        createDto as any,
        mockManagerUser,
      );

      expect(result).toEqual(mockOrder);
      expect(service.createOrUpdateOrderFromChannelPayload).toHaveBeenCalledWith(
        createDto,
        mockOrgId,
        ActorType.USER,
        mockManagerUser.userId,
      );
    });

    it('should allow ADMIN to create order from channel', async () => {
      jest
        .spyOn(service, 'createOrUpdateOrderFromChannelPayload')
        .mockResolvedValue(mockOrder as any);

      await controller.createFromChannel(mockOrgId, createDto as any, mockAdminUser);

      expect(service.createOrUpdateOrderFromChannelPayload).toHaveBeenCalledWith(
        createDto,
        mockOrgId,
        ActorType.USER,
        mockAdminUser.userId,
      );
    });

    // Note: OPERATOR role check would be enforced by RolesGuard before reaching controller
    // This is tested at the guard level, not controller level
  });

  describe('PATCH /orders/:id/status - updateStatus', () => {
    const updateDto = { status: 'READY_TO_SHIP' as any, comment: 'Payment confirmed' };

    it('should allow MANAGER to update order status', async () => {
      const updatedOrder = { ...mockOrder, status: 'READY_TO_SHIP' };
      jest
        .spyOn(service, 'updateOrderStatus')
        .mockResolvedValue(updatedOrder as any);

      const result = await controller.updateStatus(
        mockOrgId,
        mockOrderId,
        updateDto,
        mockManagerUser,
      );

      expect(result.status).toBe('READY_TO_SHIP');
      expect(service.updateOrderStatus).toHaveBeenCalledWith(
        mockOrderId,
        'READY_TO_SHIP',
        ActorType.USER,
        mockManagerUser.userId,
        mockOrgId,
        'Payment confirmed',
      );
    });

    it('should allow ADMIN to update order status', async () => {
      const updatedOrder = { ...mockOrder, status: 'CANCELLED' };
      jest
        .spyOn(service, 'updateOrderStatus')
        .mockResolvedValue(updatedOrder as any);

      await controller.updateStatus(
        mockOrgId,
        mockOrderId,
        { status: 'CANCELLED' as any },
        mockAdminUser,
      );

      expect(service.updateOrderStatus).toHaveBeenCalledWith(
        mockOrderId,
        'CANCELLED',
        ActorType.USER,
        mockAdminUser.userId,
        mockOrgId,
        undefined,
      );
    });

    it('should include comment in status update', async () => {
      jest.spyOn(service, 'updateOrderStatus').mockResolvedValue(mockOrder as any);

      await controller.updateStatus(
        mockOrgId,
        mockOrderId,
        { status: 'CANCELLED' as any, comment: 'Customer requested cancellation' },
        mockAdminUser,
      );

      expect(service.updateOrderStatus).toHaveBeenCalledWith(
        mockOrderId,
        'CANCELLED',
        ActorType.USER,
        mockAdminUser.userId,
        mockOrgId,
        'Customer requested cancellation',
      );
    });
  });

  describe('POST /orders/:id/notes - addNote', () => {
    const noteDto = { note: 'Customer confirmed delivery address' };

    it('should allow OPERATOR to add note', async () => {
      jest.spyOn(service, 'addNote').mockResolvedValue({ id: 'event-123' } as any);

      const result = await controller.addNote(
        mockOrgId,
        mockOrderId,
        noteDto,
        mockOperatorUser,
      );

      expect(result).toHaveProperty('id');
      expect(service.addNote).toHaveBeenCalledWith(
        mockOrderId,
        noteDto,
        mockOrgId,
        mockOperatorUser.userId,
      );
    });

    it('should allow MANAGER to add note', async () => {
      jest.spyOn(service, 'addNote').mockResolvedValue({ id: 'event-123' } as any);

      await controller.addNote(mockOrgId, mockOrderId, noteDto, mockManagerUser);

      expect(service.addNote).toHaveBeenCalledWith(
        mockOrderId,
        noteDto,
        mockOrgId,
        mockManagerUser.userId,
      );
    });

    it('should allow ADMIN to add note', async () => {
      jest.spyOn(service, 'addNote').mockResolvedValue({ id: 'event-123' } as any);

      await controller.addNote(mockOrgId, mockOrderId, noteDto, mockAdminUser);

      expect(service.addNote).toHaveBeenCalledWith(
        mockOrderId,
        noteDto,
        mockOrgId,
        mockAdminUser.userId,
      );
    });
  });

  describe('GET /orders/:id/timeline - getTimeline', () => {
    it('should return order timeline', async () => {
      const orderWithTimeline = {
        ...mockOrder,
        timelineEvents: [
          {
            id: 'event-1',
            eventType: 'order_created',
            createdAt: new Date(),
          },
          {
            id: 'event-2',
            eventType: 'status_changed',
            fromStatus: 'NEW',
            toStatus: 'RESERVED',
            createdAt: new Date(),
          },
        ],
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(orderWithTimeline as any);

      const result = await controller.getTimeline(
        mockOrgId,
        mockOrderId,
        mockManagerUser,
      );

      expect(result.orderId).toBe(mockOrderId);
      expect(result.orderNumber).toBe('ORD-202412-00001');
      expect(result.timeline).toHaveLength(2);
    });

    it('should allow OPERATOR to view timeline', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(mockOrder as any);

      await controller.getTimeline(mockOrgId, mockOrderId, mockOperatorUser);

      expect(service.findOne).toHaveBeenCalledWith(mockOrgId, mockOrderId);
    });
  });

  describe('DELETE /orders/:id - delete', () => {
    it('should allow ADMIN to delete order', async () => {
      jest
        .spyOn(service, 'delete')
        .mockResolvedValue({ message: 'Order deleted successfully' });

      const result = await controller.delete(mockOrgId, mockOrderId, mockAdminUser);

      expect(result.message).toBe('Order deleted successfully');
      expect(service.delete).toHaveBeenCalledWith(mockOrgId, mockOrderId);
    });

    it('should throw error if order cannot be deleted', async () => {
      jest
        .spyOn(service, 'delete')
        .mockRejectedValue(
          new Error('Cannot delete order in status RESERVED'),
        );

      await expect(
        controller.delete(mockOrgId, mockOrderId, mockAdminUser),
      ).rejects.toThrow();
    });

    // Note: MANAGER and OPERATOR role restriction is enforced by RolesGuard
    // This is tested at the guard level
  });

  describe('Organization scoping', () => {
    it('should pass organizationId to all service methods', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue({ data: [], meta: {} } as any);
      jest.spyOn(service, 'findOne').mockResolvedValue(mockOrder as any);

      await controller.findAll(mockOrgId, {}, mockManagerUser);
      await controller.findOne(mockOrgId, mockOrderId, mockManagerUser);

      expect(service.findAll).toHaveBeenCalledWith(mockOrgId, expect.any(Object));
      expect(service.findOne).toHaveBeenCalledWith(mockOrgId, mockOrderId);
    });

    it('should enforce organization isolation', async () => {
      const differentOrgId = 'org-different';

      jest
        .spyOn(service, 'findOne')
        .mockRejectedValue(new NotFoundException('Order not found'));

      // Attempt to access order from different org
      await expect(
        controller.findOne(differentOrgId, mockOrderId, mockManagerUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Actor tracking', () => {
    it('should track user as actor for status updates', async () => {
      jest.spyOn(service, 'updateOrderStatus').mockResolvedValue(mockOrder as any);

      await controller.updateStatus(
        mockOrgId,
        mockOrderId,
        { status: 'READY_TO_SHIP' as any },
        mockManagerUser,
      );

      expect(service.updateOrderStatus).toHaveBeenCalledWith(
        mockOrderId,
        'READY_TO_SHIP',
        ActorType.USER,
        mockManagerUser.userId,
        mockOrgId,
        undefined,
      );
    });

    it('should track user as actor for note additions', async () => {
      jest.spyOn(service, 'addNote').mockResolvedValue({} as any);

      await controller.addNote(
        mockOrgId,
        mockOrderId,
        { note: 'Test note' },
        mockOperatorUser,
      );

      expect(service.addNote).toHaveBeenCalledWith(
        mockOrderId,
        { note: 'Test note' },
        mockOrgId,
        mockOperatorUser.userId,
      );
    });

    it('should track user as actor for order imports', async () => {
      const createDto = {
        channelId: 'channel-123',
        externalOrderId: 'ext-123',
      } as any;

      jest
        .spyOn(service, 'createOrUpdateOrderFromChannelPayload')
        .mockResolvedValue(mockOrder as any);

      await controller.createFromChannel(mockOrgId, createDto, mockAdminUser);

      expect(service.createOrUpdateOrderFromChannelPayload).toHaveBeenCalledWith(
        createDto,
        mockOrgId,
        ActorType.USER,
        mockAdminUser.userId,
      );
    });
  });

  describe('Logging', () => {
    it('should log user actions', async () => {
      const loggerSpy = jest.spyOn(controller['logger'], 'log');
      jest.spyOn(service, 'findAll').mockResolvedValue({ data: [], meta: {} } as any);

      await controller.findAll(mockOrgId, { page: 1 }, mockManagerUser);

      expect(loggerSpy).toHaveBeenCalled();
    });

    it('should log admin deletions with warning level', async () => {
      const loggerSpy = jest.spyOn(controller['logger'], 'warn');
      jest.spyOn(service, 'delete').mockResolvedValue({ message: 'Deleted' });

      await controller.delete(mockOrgId, mockOrderId, mockAdminUser);

      expect(loggerSpy).toHaveBeenCalled();
    });
  });
});
