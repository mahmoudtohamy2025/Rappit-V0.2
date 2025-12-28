// lib/types/shipping.ts

export type CarrierType = 'DHL' | 'FEDEX';
export type ShippingAccountStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING';

export interface ShippingAccount {
  id: string;
  carrier: CarrierType;
  accountNumber: string;
  name?: string;
  status: ShippingAccountStatus;
  lastTestAt: string | null;
  testMode: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface ShippingAccountsResponse {
  data: ShippingAccount[];
}

export interface CreateShippingAccountPayload {
  carrier: CarrierType;
  accountNumber: string;
  apiKey: string;
  apiSecret: string;
  name?: string;
  testMode?: boolean;
}

export interface UpdateShippingAccountPayload {
  accountNumber?: string;
  apiKey?: string;
  apiSecret?: string;
  name?: string;
  testMode?: boolean;
}

export interface TestConnectionPayload {
  type?: 'ping' | 'rate' | 'label';
  testPayload?: Record<string, any>;
}

export interface TestConnectionResult {
  ok: boolean;
  details: {
    latencyMs?: number;
    message: string;
    [key: string]: any;
  };
}
