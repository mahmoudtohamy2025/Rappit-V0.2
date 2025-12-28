// lib/mockData.ts
// Mock data for testing UI without backend

import { Order, OrdersListResponse } from './types/orders';
import { InventorySku, InventoryListResponse } from './types/inventory';

export const MOCK_ORDERS: Order[] = [
  {
    id: 'order_001',
    channelOrderId: 'SHOP-1234',
    customer: {
      name: 'محمد أحمد السعيد',
      email: 'mohammed@example.com',
      phone: '+966501234567',
    },
    shippingAddress: {
      street: 'شارع الملك فهد، حي العليا',
      city: 'الرياض',
      state: 'الرياض',
      postalCode: '12345',
      country: 'المملكة العربية السعودية',
    },
    billingAddress: {
      street: 'شارع الملك فهد، حي العليا',
      city: 'الرياض',
      state: 'الرياض',
      postalCode: '12345',
      country: 'المملكة العربية السعودية',
    },
    items: [
      {
        skuId: 'sku_001',
        name: 'سماعة لاسلكية بلوتوث',
        quantity: 2,
        price: 299.99,
        shippedQuantity: 0,
      },
      {
        skuId: 'sku_002',
        name: 'شاحن سريع USB-C',
        quantity: 1,
        price: 89.99,
        shippedQuantity: 0,
      },
    ],
    timeline: [
      {
        id: 'evt_001',
        event: 'ORDER_CREATED',
        actor: 'SHOPIFY',
        metadata: { source: 'web' },
        createdAt: new Date().toISOString(),
      },
      {
        id: 'evt_002',
        event: 'INVENTORY_RESERVED',
        actor: 'SYSTEM',
        metadata: { reserved: 3 },
        createdAt: new Date(Date.now() - 60000).toISOString(),
      },
    ],
    total: 689.97,
    currency: 'SAR',
    paymentMethod: 'بطاقة ائتمان',
    status: 'NEW',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'order_002',
    channelOrderId: 'WOO-5678',
    customer: {
      name: 'فاطمة علي محمود',
      email: 'fatima@example.com',
      phone: '+966509876543',
    },
    items: [
      {
        skuId: 'sku_003',
        name: 'قميص رجالي - أزرق',
        quantity: 3,
        price: 149.99,
        shippedQuantity: 0,
      },
    ],
    timeline: [
      {
        id: 'evt_003',
        event: 'ORDER_CREATED',
        actor: 'WOOCOMMERCE',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    total: 449.97,
    currency: 'SAR',
    paymentMethod: 'الدفع عند الاستلام',
    status: 'RESERVED',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'order_003',
    channelOrderId: 'SHOP-9999',
    customer: {
      name: 'خالد محمود عبدالله',
      email: 'khaled@example.com',
    },
    items: [
      {
        skuId: 'sku_004',
        name: 'طقم أواني مطبخ',
        quantity: 1,
        price: 799.99,
        shippedQuantity: 1,
      },
    ],
    timeline: [
      {
        id: 'evt_004',
        event: 'ORDER_CREATED',
        actor: 'SHOPIFY',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'evt_005',
        event: 'SHIPMENT_CREATED',
        actor: 'OPERATIONS',
        metadata: { trackingNumber: 'DHL123456789', carrier: 'DHL' },
        createdAt: new Date(Date.now() - 43200000).toISOString(),
      },
    ],
    total: 799.99,
    currency: 'SAR',
    paymentMethod: 'تحويل بنكي',
    status: 'SHIPPED',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const MOCK_INVENTORY: InventorySku[] = [
  {
    skuId: 'sku_001',
    sku: 'ELEC-001',
    name: 'سماعة لاسلكية بلوتوث',
    quantityOnHand: 45,
    reserved: 12,
    lowStockThreshold: 10,
    location: 'مستودع الرياض',
    lastUpdated: new Date().toISOString(),
  },
  {
    skuId: 'sku_002',
    sku: 'ELEC-045',
    name: 'شاحن سريع USB-C',
    quantityOnHand: 8,
    reserved: 5,
    lowStockThreshold: 15,
    location: 'مستودع جدة',
    lastUpdated: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    skuId: 'sku_003',
    sku: 'FASH-234',
    name: 'قميص رجالي - أزرق',
    quantityOnHand: 120,
    reserved: 23,
    lowStockThreshold: 20,
    location: 'مستودع الرياض',
    lastUpdated: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    skuId: 'sku_004',
    sku: 'HOME-890',
    name: 'طقم أواني مطبخ',
    quantityOnHand: 34,
    reserved: 8,
    lowStockThreshold: 10,
    location: 'مستودع الدمام',
    lastUpdated: new Date(Date.now() - 10800000).toISOString(),
  },
  {
    skuId: 'sku_005',
    sku: 'ACC-123',
    name: 'حقيبة يد جلدية',
    quantityOnHand: 3,
    reserved: 7,
    lowStockThreshold: 8,
    location: 'مستودع جدة',
    lastUpdated: new Date(Date.now() - 14400000).toISOString(),
  },
];

// Mock API functions
export const mockFetchOrders = async (params: any): Promise<OrdersListResponse> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  let filteredOrders = [...MOCK_ORDERS];

  // Apply status filter
  if (params.status) {
    filteredOrders = filteredOrders.filter((order) => order.status === params.status);
  }

  // Apply search filter
  if (params.search) {
    const searchLower = params.search.toLowerCase();
    filteredOrders = filteredOrders.filter(
      (order) =>
        order.id.toLowerCase().includes(searchLower) ||
        order.channelOrderId.toLowerCase().includes(searchLower) ||
        order.customer.name.toLowerCase().includes(searchLower) ||
        order.customer.email?.toLowerCase().includes(searchLower)
    );
  }

  // Apply pagination
  const page = params.page || 1;
  const pageSize = params.pageSize || 25;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedOrders = filteredOrders.slice(start, end);

  return {
    data: paginatedOrders,
    meta: {
      page,
      pageSize,
      total: filteredOrders.length,
    },
  };
};

export const mockFetchOrderById = async (id: string): Promise<Order> => {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const order = MOCK_ORDERS.find((o) => o.id === id);
  if (!order) {
    throw new Error('Order not found');
  }
  return order;
};

export const mockUpdateOrderStatus = async (id: string, payload: any): Promise<Order> => {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const order = MOCK_ORDERS.find((o) => o.id === id);
  if (!order) {
    throw new Error('Order not found');
  }

  // Update status
  order.status = payload.newStatus;

  // Add timeline event
  order.timeline.unshift({
    id: `evt_${Date.now()}`,
    event: `STATUS_CHANGED_TO_${payload.newStatus}`,
    actor: payload.actorType || 'OPERATIONS',
    metadata: { comment: payload.comment },
    createdAt: new Date().toISOString(),
  });

  return order;
};

export const mockCreateShipment = async (orderId: string, payload: any): Promise<any> => {
  await new Promise((resolve) => setTimeout(resolve, 800));

  const order = MOCK_ORDERS.find((o) => o.id === orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  const trackingNumber = `${payload.carrier.toUpperCase()}${Math.random().toString(36).substring(2, 11).toUpperCase()}`;

  // Add timeline event
  order.timeline.unshift({
    id: `evt_${Date.now()}`,
    event: 'SHIPMENT_CREATED',
    actor: 'OPERATIONS',
    metadata: {
      trackingNumber,
      carrier: payload.carrier,
      service: payload.service,
    },
    createdAt: new Date().toISOString(),
  });

  // Update shipped quantities
  payload.items.forEach((item: any) => {
    const orderItem = order.items.find((i) => i.skuId === item.skuId);
    if (orderItem) {
      orderItem.shippedQuantity = (orderItem.shippedQuantity || 0) + item.quantity;
    }
  });

  return {
    id: `shipment_${Date.now()}`,
    trackingNumber,
    carrier: payload.carrier,
    service: payload.service,
    status: 'CREATED',
    createdAt: new Date().toISOString(),
  };
};

export const mockFetchInventory = async (params: any): Promise<InventoryListResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 400));

  let filteredInventory = [...MOCK_INVENTORY];

  // Apply search filter
  if (params.search) {
    const searchLower = params.search.toLowerCase();
    filteredInventory = filteredInventory.filter(
      (item) =>
        item.sku.toLowerCase().includes(searchLower) ||
        item.name.toLowerCase().includes(searchLower)
    );
  }

  // Apply pagination
  const page = params.page || 1;
  const pageSize = params.pageSize || 25;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedInventory = filteredInventory.slice(start, end);

  return {
    data: paginatedInventory,
    meta: {
      page,
      pageSize,
      total: filteredInventory.length,
    },
  };
};

export const mockAdjustStock = async (skuId: string, payload: any): Promise<InventorySku> => {
  await new Promise((resolve) => setTimeout(resolve, 600));

  const item = MOCK_INVENTORY.find((i) => i.skuId === skuId);
  if (!item) {
    throw new Error('SKU not found');
  }

  // Update quantity
  item.quantityOnHand += payload.delta;
  item.lastUpdated = new Date().toISOString();

  return item;
};
