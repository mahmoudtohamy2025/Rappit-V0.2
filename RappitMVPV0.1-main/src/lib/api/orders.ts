// lib/api/orders.ts
import {
  Order,
  OrdersListResponse,
  OrderStatusUpdatePayload,
  CreateShipmentPayload,
  Shipment
} from '../types/orders';
import { config } from '../config';
import {
  mockFetchOrders,
  mockFetchOrderById,
  mockUpdateOrderStatus,
  mockCreateShipment,
} from '../mockData';

const BACKEND_URL = config.backendUrl;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text || `Request failed with status ${res.status}`);
  }

  return await res.json();
}

export async function fetchOrders(params: {
  status?: string;
  channel?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<OrdersListResponse> {
  // Use mock data if configured
  if (config.useMockData) {
    return mockFetchOrders(params);
  }

  const url = new URL(`${BACKEND_URL}/orders`);

  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });

  return apiRequest<OrdersListResponse>(url.toString());
}

export async function fetchOrderById(id: string): Promise<Order> {
  if (config.useMockData) {
    return mockFetchOrderById(id);
  }

  return apiRequest<Order>(`${BACKEND_URL}/orders/${id}`);
}

export async function updateOrderStatus(
  id: string,
  payload: OrderStatusUpdatePayload
): Promise<Order> {
  if (config.useMockData) {
    return mockUpdateOrderStatus(id, payload);
  }

  return apiRequest<Order>(`${BACKEND_URL}/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function createShipment(
  orderId: string,
  body: CreateShipmentPayload,
  idempotencyKey?: string
): Promise<Shipment> {
  if (config.useMockData) {
    return mockCreateShipment(orderId, body);
  }

  return apiRequest<Shipment>(`${BACKEND_URL}/orders/${orderId}/shipments`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
  });
}