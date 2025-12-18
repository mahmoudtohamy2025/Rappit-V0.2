// lib/types/inventory.ts
export type InventorySku = {
  skuId: string;
  sku: string;
  name: string;
  quantityOnHand: number;
  reserved: number;
  lowStockThreshold?: number;
  location?: string;
  lastUpdated?: string;
};

export type InventoryListResponse = {
  data: InventorySku[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
  };
};

export type AdjustStockPayload = {
  delta: number;
  reason: string;
  userId: string;
};
