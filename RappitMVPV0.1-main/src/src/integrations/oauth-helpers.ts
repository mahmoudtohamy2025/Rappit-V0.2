import * as crypto from 'crypto';
import { Logger } from '@nestjs/common';

/**
 * OAuth Flow Helpers
 *
 * Helpers for OAuth flows (Shopify app installation, WooCommerce OAuth1).
 *
 * These are outline/skeleton implementations. Complete implementation
 * requires app credentials, redirect URLs, and actual HTTP handlers.
 */

const logger = new Logger('OAuthHelpers');

// ============================================================================
// SHOPIFY OAUTH FLOW
// ============================================================================

/**
 * Shopify OAuth Flow
 *
 * Steps:
 * 1. User clicks "Install App" → redirect to Shopify authorization URL
 * 2. User authorizes → Shopify redirects to callback URL with code
 * 3. Exchange code for access token
 * 4. Store access token securely
 *
 * Docs: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens
 */

export interface ShopifyOAuthConfig {
  clientId: string; // From Shopify app dashboard (API key)
  clientSecret: string; // From Shopify app dashboard (API secret)
  scopes: string[]; // e.g., ['read_products', 'write_orders']
  redirectUri: string; // e.g., 'https://app.rappit.io/auth/shopify/callback'
}

/**
 * Step 1: Generate Shopify authorization URL
 *
 * Redirect user to this URL to authorize the app.
 *
 * @param config - OAuth config
 * @param shopDomain - Shop domain (e.g., 'my-store.myshopify.com')
 * @param state - Random state parameter for CSRF protection
 * @returns Authorization URL
 */
export function generateShopifyAuthUrl(
  config: ShopifyOAuthConfig,
  shopDomain: string,
  state: string,
): string {
  const scopes = config.scopes.join(',');

  const url = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  url.searchParams.append('client_id', config.clientId);
  url.searchParams.append('scope', scopes);
  url.searchParams.append('redirect_uri', config.redirectUri);
  url.searchParams.append('state', state);

  logger.log(`Generated Shopify auth URL for shop: ${shopDomain}`);

  return url.toString();
}

/**
 * Step 2: Verify HMAC signature from Shopify callback
 *
 * Shopify includes HMAC signature in callback to verify authenticity.
 *
 * @param queryParams - Query parameters from callback URL
 * @param clientSecret - Shopify app client secret
 * @returns true if valid
 */
export function verifyShopifyHmac(
  queryParams: Record<string, string>,
  clientSecret: string,
): boolean {
  const { hmac, ...params } = queryParams;

  if (!hmac) {
    return false;
  }

  // Build message: sorted params joined by &
  const message = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  // Compute expected HMAC
  const expectedHmac = crypto
    .createHmac('sha256', clientSecret)
    .update(message)
    .digest('hex');

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmac),
      Buffer.from(expectedHmac),
    );
  } catch (error) {
    return false;
  }
}

/**
 * Step 3: Exchange authorization code for access token
 *
 * @param config - OAuth config
 * @param shopDomain - Shop domain
 * @param code - Authorization code from callback
 * @returns Access token response
 *
 * TODO: Implement actual HTTP POST to Shopify API
 */
export async function exchangeShopifyCode(
  config: ShopifyOAuthConfig,
  shopDomain: string,
  code: string,
): Promise<{ accessToken: string; scope: string }> {
  logger.log(`Exchanging code for access token: ${shopDomain}`);

  // TODO: Implement actual HTTP request
  // const response = await axios.post(
  //   `https://${shopDomain}/admin/oauth/access_token`,
  //   {
  //     client_id: config.clientId,
  //     client_secret: config.clientSecret,
  //     code,
  //   },
  // );
  //
  // return {
  //   accessToken: response.data.access_token,
  //   scope: response.data.scope,
  // };

  throw new Error('exchangeShopifyCode not implemented - use axios to POST to Shopify');
}

/**
 * Complete Shopify OAuth flow example
 *
 * ```typescript
 * // Route: GET /auth/shopify
 * async initiateShopifyOAuth(shopDomain: string) {
 *   const state = generateRandomState();
 *
 *   // Store state in session for verification
 *   session.shopifyOAuthState = state;
 *
 *   const authUrl = generateShopifyAuthUrl(config, shopDomain, state);
 *
 *   // Redirect user to Shopify
 *   return redirect(authUrl);
 * }
 *
 * // Route: GET /auth/shopify/callback
 * async handleShopifyCallback(query: any, session: any) {
 *   // 1. Verify state parameter (CSRF protection)
 *   if (query.state !== session.shopifyOAuthState) {
 *     throw new Error('Invalid state parameter');
 *   }
 *
 *   // 2. Verify HMAC signature
 *   if (!verifyShopifyHmac(query, config.clientSecret)) {
 *     throw new Error('Invalid HMAC signature');
 *   }
 *
 *   // 3. Exchange code for access token
 *   const { accessToken, scope } = await exchangeShopifyCode(
 *     config,
 *     query.shop,
 *     query.code,
 *   );
 *
 *   // 4. Store access token securely
 *   await channelConnectionService.createConnection(organizationId, {
 *     name: query.shop,
 *     type: 'SHOPIFY',
 *     credentials: {
 *       shopDomain: query.shop,
 *       accessToken,
 *     },
 *   });
 *
 *   // 5. Redirect to success page
 *   return redirect('/channels?success=true');
 * }
 * ```
 */

/**
 * Generate random state parameter for CSRF protection
 */
export function generateRandomState(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ============================================================================
// WEBHOOK REGISTRATION HELPERS
// ============================================================================

/**
 * Register Shopify webhooks
 *
 * @param shopDomain - Shop domain
 * @param accessToken - Shopify access token
 * @param webhooks - Webhooks to register
 * @returns Registration results
 *
 * TODO: Implement actual HTTP POST to Shopify API
 */
export async function registerShopifyWebhooks(
  shopDomain: string,
  accessToken: string,
  webhooks: Array<{
    topic: string;
    address: string;
  }>,
): Promise<{ registered: number; failed: number }> {
  logger.log(`Registering ${webhooks.length} Shopify webhooks for ${shopDomain}`);

  let registered = 0;
  let failed = 0;

  for (const webhook of webhooks) {
    try {
      // TODO: Implement actual HTTP request
      // const response = await axios.post(
      //   `https://${shopDomain}/admin/api/2024-01/webhooks.json`,
      //   {
      //     webhook: {
      //       topic: webhook.topic,
      //       address: webhook.address,
      //       format: 'json',
      //     },
      //   },
      //   {
      //     headers: {
      //       'X-Shopify-Access-Token': accessToken,
      //       'Content-Type': 'application/json',
      //     },
      //   },
      // );
      //
      // if (response.status === 201) {
      //   registered++;
      //   logger.log(`Registered webhook: ${webhook.topic}`);
      // } else {
      //   failed++;
      // }

      logger.log(`[STUB] Would register webhook: ${webhook.topic} → ${webhook.address}`);
      registered++;
    } catch (error) {
      logger.error(`Failed to register webhook ${webhook.topic}: ${error.message}`);
      failed++;
    }
  }

  return { registered, failed };
}

/**
 * Get Shopify webhook registration payloads
 *
 * Returns the payloads that should be sent to Shopify API to register webhooks.
 *
 * @param baseUrl - Base URL for webhook endpoints
 * @returns Webhook registration payloads
 */
export function getShopifyWebhookPayloads(baseUrl: string) {
  return [
    {
      topic: 'orders/create',
      address: `${baseUrl}/webhooks/shopify/orders/create`,
      format: 'json',
    },
    {
      topic: 'orders/updated',
      address: `${baseUrl}/webhooks/shopify/orders/updated`,
      format: 'json',
    },
    {
      topic: 'orders/cancelled',
      address: `${baseUrl}/webhooks/shopify/orders/cancelled`,
      format: 'json',
    },
    {
      topic: 'fulfillments/create',
      address: `${baseUrl}/webhooks/shopify/fulfillments/create`,
      format: 'json',
    },
    {
      topic: 'fulfillments/update',
      address: `${baseUrl}/webhooks/shopify/fulfillments/update`,
      format: 'json',
    },
    {
      topic: 'inventory_levels/update',
      address: `${baseUrl}/webhooks/shopify/inventory_levels/update`,
      format: 'json',
    },
  ];
}

/**
 * Register WooCommerce webhooks
 *
 * @param siteUrl - WooCommerce site URL
 * @param consumerKey - Consumer key
 * @param consumerSecret - Consumer secret
 * @param webhooks - Webhooks to register
 * @returns Registration results
 *
 * TODO: Implement actual HTTP POST to WooCommerce API
 */
export async function registerWooCommerceWebhooks(
  siteUrl: string,
  consumerKey: string,
  consumerSecret: string,
  webhooks: Array<{
    topic: string;
    delivery_url: string;
    secret: string;
  }>,
): Promise<{ registered: number; failed: number }> {
  logger.log(`Registering ${webhooks.length} WooCommerce webhooks for ${siteUrl}`);

  let registered = 0;
  let failed = 0;

  for (const webhook of webhooks) {
    try {
      // TODO: Implement actual HTTP request with OAuth1 signature
      // const response = await axios.post(
      //   `${siteUrl}/wp-json/wc/v3/webhooks`,
      //   webhook,
      //   {
      //     auth: {
      //       username: consumerKey,
      //       password: consumerSecret,
      //     },
      //   },
      // );
      //
      // if (response.status === 201) {
      //   registered++;
      //   logger.log(`Registered webhook: ${webhook.topic}`);
      // } else {
      //   failed++;
      // }

      logger.log(`[STUB] Would register webhook: ${webhook.topic} → ${webhook.delivery_url}`);
      registered++;
    } catch (error) {
      logger.error(`Failed to register webhook ${webhook.topic}: ${error.message}`);
      failed++;
    }
  }

  return { registered, failed };
}

/**
 * Get WooCommerce webhook registration payloads
 *
 * @param baseUrl - Base URL for webhook endpoints
 * @param webhookSecret - Webhook secret for signature verification
 * @returns Webhook registration payloads
 */
export function getWooCommerceWebhookPayloads(baseUrl: string, webhookSecret: string) {
  return [
    {
      name: 'Order created',
      topic: 'order.created',
      delivery_url: `${baseUrl}/webhooks/woocommerce/orders/created`,
      secret: webhookSecret,
      status: 'active',
    },
    {
      name: 'Order updated',
      topic: 'order.updated',
      delivery_url: `${baseUrl}/webhooks/woocommerce/orders/updated`,
      secret: webhookSecret,
      status: 'active',
    },
    {
      name: 'Order deleted',
      topic: 'order.deleted',
      delivery_url: `${baseUrl}/webhooks/woocommerce/orders/deleted`,
      secret: webhookSecret,
      status: 'active',
    },
    {
      name: 'Product created',
      topic: 'product.created',
      delivery_url: `${baseUrl}/webhooks/woocommerce/products/created`,
      secret: webhookSecret,
      status: 'active',
    },
    {
      name: 'Product updated',
      topic: 'product.updated',
      delivery_url: `${baseUrl}/webhooks/woocommerce/products/updated`,
      secret: webhookSecret,
      status: 'active',
    },
  ];
}

/**
 * Example usage:
 *
 * ```typescript
 * // Register Shopify webhooks
 * const baseUrl = process.env.WEBHOOK_BASE_URL;
 * const webhooks = getShopifyWebhookPayloads(baseUrl);
 *
 * await registerShopifyWebhooks(
 *   'my-store.myshopify.com',
 *   'shpat_abc123...',
 *   webhooks,
 * );
 *
 * // Register WooCommerce webhooks
 * const webhooks = getWooCommerceWebhookPayloads(baseUrl, 'webhook-secret');
 *
 * await registerWooCommerceWebhooks(
 *   'https://example.com',
 *   'ck_123...',
 *   'cs_456...',
 *   webhooks,
 * );
 * ```
 */
