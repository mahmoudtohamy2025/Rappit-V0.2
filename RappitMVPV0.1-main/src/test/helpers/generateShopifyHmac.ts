import * as crypto from 'crypto';

/**
 * Generate Shopify HMAC signature for webhook
 *
 * @param body - Raw webhook body (string or Buffer)
 * @param secret - Webhook secret
 * @returns Base64-encoded HMAC-SHA256
 */
export function generateShopifyHmac(
  body: string | Buffer,
  secret: string,
): string {
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(body, typeof body === 'string' ? 'utf8' : undefined)
    .digest('base64');

  return hmac;
}

/**
 * Verify Shopify HMAC signature
 */
export function verifyShopifyHmac(
  body: string | Buffer,
  secret: string,
  receivedHmac: string,
): boolean {
  const expectedHmac = generateShopifyHmac(body, secret);
  return crypto.timingSafeEqual(
    Buffer.from(expectedHmac),
    Buffer.from(receivedHmac),
  );
}

/**
 * Generate WooCommerce webhook signature
 *
 * Uses HMAC-SHA256 with base64 encoding
 */
export function generateWooCommerceSignature(
  body: string,
  secret: string,
): string {
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');

  return hmac;
}
