/**
 * Shopify API Type Definitions
 *
 * TypeScript interfaces for Shopify REST Admin API responses
 * Based on Shopify API version 2024-01
 */

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html?: string;
  vendor?: string;
  product_type?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  status: 'active' | 'archived' | 'draft';
  variants: ShopifyVariant[];
  options: ShopifyProductOption[];
  images: ShopifyImage[];
  tags?: string;
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  sku?: string;
  barcode?: string;
  price: string;
  compare_at_price?: string;
  inventory_item_id: number;
  inventory_quantity: number;
  weight?: number;
  weight_unit?: string;
  requires_shipping: boolean;
  taxable: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShopifyProductOption {
  id: number;
  product_id: number;
  name: string;
  position: number;
  values: string[];
}

export interface ShopifyImage {
  id: number;
  product_id: number;
  src: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ShopifyOrder {
  id: number;
  order_number: number;
  email?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
  cancelled_at?: string;
  closed_at?: string;
  financial_status: ShopifyFinancialStatus;
  fulfillment_status?: ShopifyFulfillmentStatus;
  currency: string;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_discounts: string;
  total_shipping_price_set?: ShopifyMoneySet;
  note?: string;
  tags?: string;
  customer?: ShopifyCustomer;
  billing_address?: ShopifyAddress;
  shipping_address?: ShopifyAddress;
  line_items: ShopifyLineItem[];
  fulfillments?: ShopifyFulfillment[];
  refunds?: ShopifyRefund[];
}

export type ShopifyFinancialStatus =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'partially_paid'
  | 'refunded'
  | 'voided'
  | 'partially_refunded';

export type ShopifyFulfillmentStatus =
  | 'fulfilled'
  | 'partial'
  | 'restocked'
  | null;

export interface ShopifyCustomer {
  id: number;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  verified_email?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShopifyAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  province_code?: string;
  country?: string;
  country_code?: string;
  zip?: string;
  phone?: string;
}

export interface ShopifyLineItem {
  id: number;
  product_id?: number;
  variant_id?: number;
  title: string;
  name: string;
  variant_title?: string;
  sku?: string;
  quantity: number;
  price: string;
  total_discount: string;
  fulfillment_status?: 'fulfilled' | 'partial' | null;
  tax_lines?: ShopifyTaxLine[];
}

export interface ShopifyTaxLine {
  title: string;
  price: string;
  rate: number;
}

export interface ShopifyMoneySet {
  shop_money: {
    amount: string;
    currency_code: string;
  };
  presentment_money: {
    amount: string;
    currency_code: string;
  };
}

export interface ShopifyFulfillment {
  id: number;
  order_id: number;
  status: 'pending' | 'open' | 'success' | 'cancelled' | 'error' | 'failure';
  created_at: string;
  updated_at: string;
  tracking_company?: string;
  tracking_number?: string;
  tracking_numbers?: string[];
  tracking_url?: string;
  tracking_urls?: string[];
  line_items: ShopifyLineItem[];
}

export interface ShopifyRefund {
  id: number;
  order_id: number;
  created_at: string;
  note?: string;
  refund_line_items: ShopifyRefundLineItem[];
  transactions: ShopifyTransaction[];
}

export interface ShopifyRefundLineItem {
  id: number;
  line_item_id: number;
  quantity: number;
  subtotal: string;
  total_tax: string;
}

export interface ShopifyTransaction {
  id: number;
  order_id: number;
  kind: 'sale' | 'refund' | 'void' | 'capture';
  status: 'pending' | 'success' | 'failure' | 'error';
  amount: string;
  currency: string;
  created_at: string;
}

export interface ShopifyInventoryLevel {
  inventory_item_id: number;
  location_id: number;
  available: number;
  updated_at: string;
}

export interface ShopifyLocation {
  id: number;
  name: string;
  address1?: string;
  city?: string;
  province?: string;
  country?: string;
  zip?: string;
  active: boolean;
}

// API Response wrappers
export interface ShopifyProductsResponse {
  products: ShopifyProduct[];
}

export interface ShopifyOrdersResponse {
  orders: ShopifyOrder[];
}

export interface ShopifyInventoryLevelsResponse {
  inventory_levels: ShopifyInventoryLevel[];
}

export interface ShopifyLocationsResponse {
  locations: ShopifyLocation[];
}

// Pagination
export interface ShopifyPaginationInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPageUrl?: string;
  previousPageUrl?: string;
}

// Error response
export interface ShopifyErrorResponse {
  errors: string | Record<string, string[]>;
}

// Fulfillment creation request
export interface CreateShopifyFulfillmentRequest {
  fulfillment: {
    line_items_by_fulfillment_order?: Array<{
      fulfillment_order_id: number;
      line_items?: Array<{
        id: number;
        quantity: number;
      }>;
    }>;
    tracking_info?: {
      number?: string;
      url?: string;
      company?: string;
    };
    notify_customer?: boolean;
  };
}

export interface CreateShopifyFulfillmentResponse {
  fulfillment: ShopifyFulfillment;
}
