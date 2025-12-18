import * as crypto from 'crypto';

/**
 * OAuth1 Helper for WooCommerce Authentication
 *
 * WooCommerce REST API uses OAuth1.0a for authentication.
 * This helper generates the required OAuth signature.
 *
 * Reference: https://woocommerce.github.io/woocommerce-rest-api-docs/#authentication
 */

/**
 * Generate OAuth1 signature for WooCommerce API
 *
 * @param method - HTTP method (GET, POST, PUT, DELETE)
 * @param url - Full API URL
 * @param consumerKey - WooCommerce consumer key
 * @param consumerSecret - WooCommerce consumer secret
 * @returns OAuth parameters including signature
 */
export function createOAuth1Signature(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
): Record<string, string> {
  // OAuth parameters
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA256',
    oauth_version: '1.0',
  };

  // Parse URL to separate base URL and query parameters
  const urlObj = new URL(url);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;

  // Collect all parameters (OAuth + query string)
  const allParams: Record<string, string> = { ...oauthParams };

  // Add existing query parameters
  urlObj.searchParams.forEach((value, key) => {
    allParams[key] = value;
  });

  // Create parameter string
  const parameterString = createParameterString(allParams);

  // Create signature base string
  const signatureBaseString = createSignatureBaseString(
    method.toUpperCase(),
    baseUrl,
    parameterString,
  );

  // Create signing key (consumer secret + '&' + token secret)
  // WooCommerce doesn't use token secret, so it's just consumer secret + '&'
  const signingKey = `${encodeURIComponent(consumerSecret)}&`;

  // Generate signature
  const signature = crypto
    .createHmac('sha256', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  // Add signature to OAuth parameters
  oauthParams.oauth_signature = signature;

  return oauthParams;
}

/**
 * Generate random nonce
 */
function generateNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Create parameter string
 *
 * Parameters must be:
 * 1. Percent encoded
 * 2. Sorted alphabetically
 * 3. Concatenated with '&'
 */
function createParameterString(params: Record<string, string>): string {
  // Sort parameters alphabetically by key
  const sortedKeys = Object.keys(params).sort();

  // Encode and join
  const encodedParams = sortedKeys.map((key) => {
    const encodedKey = encodeURIComponent(key);
    const encodedValue = encodeURIComponent(params[key]);
    return `${encodedKey}=${encodedValue}`;
  });

  return encodedParams.join('&');
}

/**
 * Create signature base string
 *
 * Format: METHOD&URL&PARAMETERS
 * All parts must be percent encoded
 */
function createSignatureBaseString(
  method: string,
  baseUrl: string,
  parameterString: string,
): string {
  return [
    method.toUpperCase(),
    encodeURIComponent(baseUrl),
    encodeURIComponent(parameterString),
  ].join('&');
}

/**
 * Verify WooCommerce webhook signature
 *
 * WooCommerce sends webhooks with X-WC-Webhook-Signature header.
 * The signature is a base64 encoded HMAC-SHA256 hash of the payload.
 *
 * @param payload - Raw webhook payload (string or Buffer)
 * @param signature - X-WC-Webhook-Signature header value
 * @param secret - Webhook secret from WooCommerce settings
 * @returns true if signature is valid
 */
export function verifyWooCommerceWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) {
    return false;
  }

  // Compute expected signature
  const computedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64');

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature),
    );
  } catch (error) {
    // Buffers have different lengths
    return false;
  }
}

/**
 * Example usage:
 *
 * ```typescript
 * // For API requests
 * const oauthParams = createOAuth1Signature(
 *   'GET',
 *   'https://example.com/wp-json/wc/v3/orders',
 *   'ck_123456',
 *   'cs_123456',
 * );
 *
 * // Add OAuth params to URL
 * const url = new URL('https://example.com/wp-json/wc/v3/orders');
 * Object.entries(oauthParams).forEach(([key, value]) => {
 *   url.searchParams.append(key, value);
 * });
 *
 * // Make request
 * const response = await fetch(url.toString());
 *
 * // For webhook verification
 * const isValid = verifyWooCommerceWebhookSignature(
 *   req.rawBody,
 *   req.headers['x-wc-webhook-signature'],
 *   'webhook-secret',
 * );
 * ```
 */
