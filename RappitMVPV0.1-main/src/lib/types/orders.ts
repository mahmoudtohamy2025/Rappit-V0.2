// lib/types/orders.ts
export type Customer = {
  name: string;
  email?: string;
  phone?: string;
};

export type Address = {
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
};

export type OrderItem = {
  skuId: string;
  name: string;
  quantity: number;
  price: number;
  shippedQuantity?: number;
};

export type OrderTimelineEvent = {
  id: string;
  event: string;
  actor: string;
  metadata?: any;
  createdAt: string;
};

export type Order = {
  id: string;
  channelOrderId: string;
  customer: Customer;
  shippingAddress?: Address;
  billingAddress?: Address;
  items: OrderItem[];
  timeline: OrderTimelineEvent[];
  total: number;
  currency: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
};

export type OrdersListResponse = {
  data: Order[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export type OrderStatusUpdatePayload = {
  newStatus: string;
  comment?: string;
  actorType?: string;
};

export type CreateShipmentPayload = {
  carrier: string;
  service: string;
  items: { skuId: string; quantity: number }[];
  address?: Address;
  metadata?: any;
};

export type Shipment = {
  id: string;
  trackingNumber: string;
  carrier: string;
  service: string;
  status: string;
  createdAt: string;
};

export const ORDER_STATUSES = [
  'NEW',
  'PENDING_PAYMENT',
  'RESERVED',
  'READY_TO_SHIP',
  'SHIPPED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
  'FAILED',
  'ON_HOLD'
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];
