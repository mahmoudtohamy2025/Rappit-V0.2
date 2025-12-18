/**
 * Shopify Integration Constants
 *
 * Constants, mappings, and configuration for Shopify integration
 */

import { OrderStatus, PaymentStatus } from '@prisma/client';
import { ShopifyFinancialStatus, ShopifyFulfillmentStatus } from './shopify.types';

/**
 * Shopify API Configuration
 */
export const SHOPIFY_CONFIG = {
  API_VERSION: '2024-01',
  RATE_LIMIT_PER_SECOND: 2,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_BACKOFF_MS: 1000,
  PAGINATION_LIMIT: 250,
  REQUEST_TIMEOUT_MS: 30000,
} as const;

/**
 * Map Shopify financial status to internal PaymentStatus
 */
export const SHOPIFY_PAYMENT_STATUS_MAP: Record<ShopifyFinancialStatus, PaymentStatus> = {
  pending: 'PENDING',
  authorized: 'AUTHORIZED',
  paid: 'PAID',
  partially_paid: 'PENDING',
  refunded: 'REFUNDED',
  voided: 'FAILED',
  partially_refunded: 'PARTIALLY_REFUNDED',
};

/**
 * Map Shopify order status to internal OrderStatus
 *
 * Business logic:
 * - pending/authorized → NEW (awaiting payment)
 * - paid + no fulfillment → RESERVED (payment confirmed, inventory reserved)
 * - paid + partial fulfillment → SHIPPED (some items shipped)
 * - paid + fulfilled → DELIVERED (all items fulfilled)
 * - refunded → RETURNED
 * - voided/cancelled → CANCELLED
 */
export function mapShopifyStatusToOrderStatus(
  financialStatus: ShopifyFinancialStatus,
  fulfillmentStatus: ShopifyFulfillmentStatus,
  cancelledAt?: string,
): OrderStatus {
  // Cancelled orders
  if (cancelledAt) {
    return 'CANCELLED';
  }

  // Refunded orders
  if (financialStatus === 'refunded') {
    return 'RETURNED';
  }

  // Voided orders
  if (financialStatus === 'voided') {
    return 'CANCELLED';
  }

  // Paid orders - check fulfillment status
  if (financialStatus === 'paid') {
    if (fulfillmentStatus === 'fulfilled') {
      return 'DELIVERED';
    } else if (fulfillmentStatus === 'partial') {
      return 'SHIPPED';
    } else {
      // paid but not fulfilled yet - reserved
      return 'RESERVED';
    }
  }

  // Authorized but not paid yet
  if (financialStatus === 'authorized') {
    return 'NEW';
  }

  // Pending or partially paid
  return 'NEW';
}

/**
 * Shopify webhook topics that we handle
 */
export const SHOPIFY_WEBHOOK_TOPICS = [
  'orders/create',
  'orders/updated',
  'orders/cancelled',
  'fulfillments/create',
  'fulfillments/update',
  'inventory_levels/update',
] as const;

export type ShopifyWebhookTopic = typeof SHOPIFY_WEBHOOK_TOPICS[number];

/**
 * HTTP status codes that should trigger a retry
 */
export const SHOPIFY_RETRYABLE_STATUS_CODES = [
  429, // Rate limited
  500, // Internal server error
  502, // Bad gateway
  503, // Service unavailable
  504, // Gateway timeout
] as const;

/**
 * HTTP status codes that indicate authentication issues
 */
export const SHOPIFY_AUTH_ERROR_CODES = [
  401, // Unauthorized
  403, // Forbidden
] as const;

/**
 * HTTP status codes that indicate client errors (don't retry)
 */
export const SHOPIFY_CLIENT_ERROR_CODES = [
  400, // Bad request
  404, // Not found
  422, // Unprocessable entity (validation error)
] as const;

/**
 * Shopify API error messages
 */
export const SHOPIFY_ERROR_MESSAGES = {
  RATE_LIMITED: 'Rate limit exceeded. Retrying with backoff.',
  AUTH_FAILED: 'Authentication failed. Check API credentials.',
  INVALID_CHANNEL: 'Channel not found or not a Shopify channel.',
  MISSING_CREDENTIALS: 'Missing Shopify credentials (shopDomain, accessToken).',
  API_ERROR: 'Shopify API error',
  NETWORK_ERROR: 'Network error connecting to Shopify',
  TIMEOUT: 'Request to Shopify timed out',
  INVALID_RESPONSE: 'Invalid response from Shopify API',
  SKU_NOT_FOUND: 'SKU not found for Shopify variant',
  ORDER_NOT_FOUND: 'Order not found',
} as const;

/**
 * Default metadata keys for Shopify entities
 */
export const SHOPIFY_METADATA_KEYS = {
  PRODUCT_ID: 'shopify_product_id',
  VARIANT_ID: 'shopify_variant_id',
  CUSTOMER_ID: 'shopify_customer_id',
  ORDER_ID: 'shopify_order_id',
  ORDER_NUMBER: 'shopify_order_number',
  FULFILLMENT_STATUS: 'shopify_fulfillment_status',
  FINANCIAL_STATUS: 'shopify_financial_status',
  INVENTORY_ITEM_ID: 'shopify_inventory_item_id',
  LOCATION_ID: 'shopify_location_id',
} as const;
