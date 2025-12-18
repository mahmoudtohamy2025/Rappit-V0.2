// lib/api/inventory.ts
import {
  InventorySku,
  InventoryListResponse,
  AdjustStockPayload
} from '../types/inventory';
import { config } from '../config';
import { mockFetchInventory, mockAdjustStock } from '../mockData';

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

export async function fetchInventory(params: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<InventoryListResponse> {
  // Use mock data if configured
  if (config.useMockData) {
    return mockFetchInventory(params);
  }

  const url = new URL(`${BACKEND_URL}/inventory`);

  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });

  return apiRequest<InventoryListResponse>(url.toString());
}

export async function adjustStock(
  skuId: string,
  payload: AdjustStockPayload
): Promise<InventorySku> {
  if (config.useMockData) {
    return mockAdjustStock(skuId, payload);
  }

  return apiRequest<InventorySku>(`${BACKEND_URL}/inventory/${skuId}/adjust`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}