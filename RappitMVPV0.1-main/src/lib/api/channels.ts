// lib/api/channels.ts
import { v4 as uuidv4 } from 'uuid';
import {
  Channel,
  ChannelsListResponse,
  CreateShopifyOAuthResponse,
  CreateWooCommercePayload,
  SyncChannelResponse,
} from '../types/channels';
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

export async function getChannels(): Promise<Channel[]> {
  if (config.useMockData) {
    return mockGetChannels();
  }
  const response = await apiRequest<ChannelsListResponse>(`${BACKEND_URL}/channels`);
  return response.data;
}

export async function createShopifyOAuthSession(returnTo?: string): Promise<CreateShopifyOAuthResponse> {
  if (config.useMockData) {
    return mockCreateShopifyOAuth(returnTo);
  }

  return apiRequest<CreateShopifyOAuthResponse>(`${BACKEND_URL}/channels/shopify/create-oauth`, {
    method: 'POST',
    body: JSON.stringify({ redirectTo: returnTo || `${window.location.origin}/channels` }),
  });
}

export async function createWooCommerceConnection(payload: CreateWooCommercePayload): Promise<Channel> {
  if (config.useMockData) {
    return mockCreateWooCommerce(payload);
  }

  const idempotencyKey = uuidv4();
  return apiRequest<Channel>(`${BACKEND_URL}/channels/woocommerce`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
}

export async function deleteChannel(id: string): Promise<void> {
  if (config.useMockData) {
    return mockDeleteChannel(id);
  }

  return apiRequest<void>(`${BACKEND_URL}/channels/${id}`, {
    method: 'DELETE',
  });
}

export async function syncChannel(id: string): Promise<SyncChannelResponse> {
  if (config.useMockData) {
    return mockSyncChannel(id);
  }

  return apiRequest<SyncChannelResponse>(`${BACKEND_URL}/channels/${id}/sync`, {
    method: 'POST',
  });
}

export async function getChannel(id: string): Promise<Channel> {
  if (config.useMockData) {
    return mockGetChannel(id);
  }

  return apiRequest<Channel>(`${BACKEND_URL}/channels/${id}`);
}

// Mock implementations
let mockChannels: Channel[] = [
  {
    id: 'ch_shopify_1',
    provider: 'SHOPIFY',
    name: 'متجر الإلكترونيات',
    status: 'CONNECTED',
    lastSyncAt: new Date(Date.now() - 3600000).toISOString(),
    connectedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    metadata: { shopDomain: 'electronics-store.myshopify.com' },
  },
];

async function mockGetChannels(): Promise<Channel[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return mockChannels;
}

async function mockCreateShopifyOAuth(returnTo?: string): Promise<CreateShopifyOAuthResponse> {
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Simulate OAuth - in real scenario this would redirect to Shopify
  // For demo, we'll simulate successful connection after delay
  setTimeout(() => {
    const newChannel: Channel = {
      id: `ch_shopify_${Date.now()}`,
      provider: 'SHOPIFY',
      name: 'متجر جديد',
      status: 'CONNECTED',
      lastSyncAt: null,
      connectedAt: new Date().toISOString(),
      metadata: { shopDomain: 'new-store.myshopify.com' },
    };
    mockChannels.push(newChannel);
  }, 2000);

  return {
    redirectUrl: `${window.location.origin}/channels?connected=shopify&mock=true`,
    state: 'mock_state_123',
  };
}

async function mockCreateWooCommerce(payload: CreateWooCommercePayload): Promise<Channel> {
  await new Promise((resolve) => setTimeout(resolve, 800));

  const newChannel: Channel = {
    id: `ch_woo_${Date.now()}`,
    provider: 'WOOCOMMERCE',
    name: payload.name || 'متجر WooCommerce',
    status: 'CONNECTED',
    lastSyncAt: null,
    connectedAt: new Date().toISOString(),
    metadata: { storeUrl: payload.storeUrl },
  };

  mockChannels.push(newChannel);
  return newChannel;
}

async function mockDeleteChannel(id: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  mockChannels = mockChannels.filter((ch) => ch.id !== id);
}

async function mockSyncChannel(id: string): Promise<SyncChannelResponse> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  const channel = mockChannels.find((ch) => ch.id === id);
  if (channel) {
    channel.lastSyncAt = new Date().toISOString();
  }

  return { jobId: `job_${Date.now()}` };
}

async function mockGetChannel(id: string): Promise<Channel> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const channel = mockChannels.find((ch) => ch.id === id);
  if (!channel) {
    throw new ApiError(404, 'Channel not found');
  }
  return channel;
}
