// lib/api/shipping.ts
import { v4 as uuidv4 } from 'uuid';
import {
  ShippingAccount,
  ShippingAccountsResponse,
  CreateShippingAccountPayload,
  UpdateShippingAccountPayload,
  TestConnectionPayload,
  TestConnectionResult,
} from '../types/shipping';
import { config } from '../config';

const BACKEND_URL = config.backendUrl;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: any[]
  ) {
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
    const errorData = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new ApiError(res.status, errorData.message || `Request failed with status ${res.status}`, errorData.errors);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return await res.json();
}

export async function getShippingAccounts(): Promise<ShippingAccount[]> {
  if (config.useMockData) {
    return mockGetShippingAccounts();
  }

  const response = await apiRequest<ShippingAccountsResponse>(`${BACKEND_URL}/shipping/accounts`);
  return response.data;
}

export async function createShippingAccount(payload: CreateShippingAccountPayload): Promise<ShippingAccount> {
  if (config.useMockData) {
    return mockCreateShippingAccount(payload);
  }

  const idempotencyKey = uuidv4();
  return apiRequest<ShippingAccount>(`${BACKEND_URL}/shipping/accounts`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
}

export async function updateShippingAccount(id: string, payload: UpdateShippingAccountPayload): Promise<ShippingAccount> {
  if (config.useMockData) {
    return mockUpdateShippingAccount(id, payload);
  }

  return apiRequest<ShippingAccount>(`${BACKEND_URL}/shipping/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteShippingAccount(id: string): Promise<void> {
  if (config.useMockData) {
    return mockDeleteShippingAccount(id);
  }

  return apiRequest<void>(`${BACKEND_URL}/shipping/accounts/${id}`, {
    method: 'DELETE',
  });
}

export async function testShippingAccount(id: string, payload?: TestConnectionPayload): Promise<TestConnectionResult> {
  if (config.useMockData) {
    return mockTestConnection(id, payload);
  }

  return apiRequest<TestConnectionResult>(`${BACKEND_URL}/shipping/accounts/${id}/test`, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
}

// Mock implementations
let mockAccounts: ShippingAccount[] = [
  {
    id: 'sa_dhl_1',
    carrier: 'DHL',
    accountNumber: 'DHL123456',
    name: 'حساب DHL الرئيسي',
    status: 'CONNECTED',
    lastTestAt: new Date(Date.now() - 86400000).toISOString(),
    testMode: false,
    metadata: {},
    createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
  },
];

async function mockGetShippingAccounts(): Promise<ShippingAccount[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return mockAccounts;
}

async function mockCreateShippingAccount(payload: CreateShippingAccountPayload): Promise<ShippingAccount> {
  await new Promise((resolve) => setTimeout(resolve, 600));

  const newAccount: ShippingAccount = {
    id: `sa_${payload.carrier.toLowerCase()}_${Date.now()}`,
    carrier: payload.carrier,
    accountNumber: payload.accountNumber,
    name: payload.name || `${payload.carrier} Account`,
    status: 'CONNECTED',
    lastTestAt: null,
    testMode: payload.testMode || false,
    metadata: {},
    createdAt: new Date().toISOString(),
  };

  mockAccounts.push(newAccount);
  return newAccount;
}

async function mockUpdateShippingAccount(id: string, payload: UpdateShippingAccountPayload): Promise<ShippingAccount> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const account = mockAccounts.find((acc) => acc.id === id);
  if (!account) {
    throw new ApiError(404, 'Shipping account not found');
  }

  Object.assign(account, payload);
  return account;
}

async function mockDeleteShippingAccount(id: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  mockAccounts = mockAccounts.filter((acc) => acc.id !== id);
}

async function mockTestConnection(id: string, payload?: TestConnectionPayload): Promise<TestConnectionResult> {
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const account = mockAccounts.find((acc) => acc.id === id);
  if (!account) {
    throw new ApiError(404, 'Shipping account not found');
  }

  // Update lastTestAt
  account.lastTestAt = new Date().toISOString();

  // Simulate success
  return {
    ok: true,
    details: {
      latencyMs: 145 + Math.floor(Math.random() * 100),
      message: `Authentication successful for ${account.carrier}`,
      carrierStatus: 'active',
      testType: payload?.type || 'ping',
    },
  };
}
