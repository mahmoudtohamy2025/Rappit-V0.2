// lib/types/channels.ts

export type ChannelProvider = 'SHOPIFY' | 'WOOCOMMERCE';
export type ChannelStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export interface Channel {
  id: string;
  provider: ChannelProvider;
  name: string;
  status: ChannelStatus;
  lastSyncAt: string | null;
  connectedAt: string | null;
  metadata?: Record<string, any>;
}

export interface ChannelsListResponse {
  data: Channel[];
}

export interface CreateShopifyOAuthResponse {
  redirectUrl: string;
  state: string;
}

export interface CreateWooCommercePayload {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  name?: string;
}

export interface SyncChannelResponse {
  jobId: string;
}
