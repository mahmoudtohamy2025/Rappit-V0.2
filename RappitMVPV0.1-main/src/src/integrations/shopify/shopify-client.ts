/**
 * Shopify HTTP Client
 *
 * Robust HTTP client for Shopify REST Admin API with:
 * - Rate limiting (2 requests/second)
 * - Automatic retry with exponential backoff
 * - Request/response logging
 * - Pagination support
 * - Error normalization
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationLoggingService } from '@services/integration-logging.service';
import { IntegrationType } from '@prisma/client';
import {
  SHOPIFY_CONFIG,
  SHOPIFY_RETRYABLE_STATUS_CODES,
  SHOPIFY_AUTH_ERROR_CODES,
  SHOPIFY_ERROR_MESSAGES,
} from './shopify.constants';
import {
  ShopifyErrorResponse,
  ShopifyPaginationInfo,
} from './shopify.types';

export interface ShopifyClientConfig {
  shopDomain: string;
  accessToken: string;
  organizationId: string;
  channelId?: string;
}

export interface ShopifyRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  params?: Record<string, string | number | boolean>;
  data?: any;
  organizationId: string;
  channelId?: string;
}

export interface ShopifyResponse<T = any> {
  data: T;
  pagination?: ShopifyPaginationInfo;
  statusCode: number;
  headers: Record<string, string>;
}

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: any,
    public isRetryable: boolean = false,
  ) {
    super(message);
    this.name = 'ShopifyApiError';
  }
}

@Injectable()
export class ShopifyClient {
  private readonly logger = new Logger(ShopifyClient.name);
  private lastRequestTime = 0;
  private readonly minRequestInterval: number;

  constructor(
    private configService: ConfigService,
    private integrationLoggingService: IntegrationLoggingService,
  ) {
    // Calculate minimum interval between requests (milliseconds)
    this.minRequestInterval = 1000 / SHOPIFY_CONFIG.RATE_LIMIT_PER_SECOND;
  }

  /**
   * Make a GET request to Shopify API
   */
  async get<T = any>(
    config: ShopifyClientConfig,
    path: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<ShopifyResponse<T>> {
    return this.request<T>({
      method: 'GET',
      path,
      params,
      organizationId: config.organizationId,
      channelId: config.channelId,
    }, config);
  }

  /**
   * Make a POST request to Shopify API
   */
  async post<T = any>(
    config: ShopifyClientConfig,
    path: string,
    data: any,
  ): Promise<ShopifyResponse<T>> {
    return this.request<T>({
      method: 'POST',
      path,
      data,
      organizationId: config.organizationId,
      channelId: config.channelId,
    }, config);
  }

  /**
   * Make a PUT request to Shopify API
   */
  async put<T = any>(
    config: ShopifyClientConfig,
    path: string,
    data: any,
  ): Promise<ShopifyResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      path,
      data,
      organizationId: config.organizationId,
      channelId: config.channelId,
    }, config);
  }

  /**
   * Make a DELETE request to Shopify API
   */
  async delete<T = any>(
    config: ShopifyClientConfig,
    path: string,
  ): Promise<ShopifyResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      path,
      organizationId: config.organizationId,
      channelId: config.channelId,
    }, config);
  }

  /**
   * Fetch all pages of a paginated resource
   *
   * Uses Shopify's Link header pagination
   */
  async fetchAllPages<T = any>(
    config: ShopifyClientConfig,
    path: string,
    params?: Record<string, string | number | boolean>,
  ): Promise<T[]> {
    const allResults: T[] = [];
    let currentPath = path;
    let currentParams = params;

    while (true) {
      const response = await this.get<any>(config, currentPath, currentParams);

      // Extract data - Shopify wraps responses in a key (products, orders, etc.)
      const dataKey = Object.keys(response.data)[0];
      const pageData = response.data[dataKey] || [];

      allResults.push(...pageData);

      // Check if there's a next page
      if (response.pagination?.hasNextPage && response.pagination.nextPageUrl) {
        // Parse next page URL
        const nextUrl = new URL(response.pagination.nextPageUrl);
        currentPath = nextUrl.pathname;
        currentParams = Object.fromEntries(nextUrl.searchParams.entries());
      } else {
        break;
      }
    }

    return allResults;
  }

  /**
   * Make HTTP request with rate limiting and retry logic
   */
  private async request<T>(
    options: ShopifyRequestOptions,
    config: ShopifyClientConfig,
    attempt = 1,
  ): Promise<ShopifyResponse<T>> {
    // Rate limiting - wait if needed
    await this.enforceRateLimit();

    const startTime = Date.now();
    const url = this.buildUrl(config.shopDomain, options.path, options.params);

    try {
      this.logger.debug(`${options.method} ${url} (attempt ${attempt})`);

      // Make HTTP request using fetch
      const response = await this.makeHttpRequest(url, {
        method: options.method,
        headers: this.buildHeaders(config.accessToken),
        body: options.data ? JSON.stringify(options.data) : undefined,
      });

      const duration = Date.now() - startTime;
      const responseData = await response.json();

      // Log successful request
      await this.integrationLoggingService.logIntegrationCall({
        organizationId: options.organizationId,
        channelId: options.channelId,
        integrationType: IntegrationType.SHOPIFY,
        direction: 'OUTBOUND',
        endpoint: url,
        method: options.method,
        statusCode: response.status,
        request: this.truncateForLogging(options.data),
        response: this.truncateForLogging(responseData),
        durationMs: duration,
      });

      // Check for errors
      if (!response.ok) {
        throw await this.handleErrorResponse(response, responseData);
      }

      // Parse pagination from Link header
      const pagination = this.parseLinkHeader(response.headers.get('Link'));

      return {
        data: responseData,
        pagination,
        statusCode: response.status,
        headers: this.headersToRecord(response.headers),
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      // Log failed request
      await this.integrationLoggingService.logIntegrationCall({
        organizationId: options.organizationId,
        channelId: options.channelId,
        integrationType: IntegrationType.SHOPIFY,
        direction: 'OUTBOUND',
        endpoint: url,
        method: options.method,
        statusCode: error instanceof ShopifyApiError ? error.statusCode : 0,
        request: this.truncateForLogging(options.data),
        errorMessage: error.message,
        durationMs: duration,
      });

      // Retry logic
      if (
        error instanceof ShopifyApiError &&
        error.isRetryable &&
        attempt < SHOPIFY_CONFIG.MAX_RETRY_ATTEMPTS
      ) {
        const backoffMs = this.calculateBackoff(attempt);
        this.logger.warn(
          `Retrying request to ${url} after ${backoffMs}ms (attempt ${attempt + 1}/${SHOPIFY_CONFIG.MAX_RETRY_ATTEMPTS})`,
        );
        await this.sleep(backoffMs);
        return this.request<T>(options, config, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Make HTTP request using native fetch
   */
  private async makeHttpRequest(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      SHOPIFY_CONFIG.REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ShopifyApiError(
          SHOPIFY_ERROR_MESSAGES.TIMEOUT,
          0,
          null,
          true, // retryable
        );
      }
      throw new ShopifyApiError(
        SHOPIFY_ERROR_MESSAGES.NETWORK_ERROR,
        0,
        null,
        true, // retryable
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Handle error responses from Shopify API
   */
  private async handleErrorResponse(
    response: Response,
    data: any,
  ): Promise<ShopifyApiError> {
    const statusCode = response.status;

    // Parse error message
    let errorMessage = SHOPIFY_ERROR_MESSAGES.API_ERROR;
    if (data && typeof data === 'object') {
      if (data.errors) {
        if (typeof data.errors === 'string') {
          errorMessage = data.errors;
        } else {
          errorMessage = JSON.stringify(data.errors);
        }
      } else if (data.error) {
        errorMessage = data.error;
      }
    }

    // Determine if retryable
    const isRetryable = (SHOPIFY_RETRYABLE_STATUS_CODES as readonly number[]).includes(statusCode);

    // Check for authentication errors
    if ((SHOPIFY_AUTH_ERROR_CODES as readonly number[]).includes(statusCode)) {
      errorMessage = SHOPIFY_ERROR_MESSAGES.AUTH_FAILED;
    }

    // Rate limit specific message
    if (statusCode === 429) {
      errorMessage = SHOPIFY_ERROR_MESSAGES.RATE_LIMITED;
    }

    return new ShopifyApiError(
      `${errorMessage} (HTTP ${statusCode})`,
      statusCode,
      data,
      isRetryable,
    );
  }

  /**
   * Build full URL with query parameters
   */
  private buildUrl(
    shopDomain: string,
    path: string,
    params?: Record<string, string | number | boolean>,
  ): string {
    // Ensure shopDomain has the correct format
    const domain = shopDomain.replace(/^https?:\/\//, '');

    // Build base URL
    let url = `https://${domain}${path}`;

    // Add query parameters
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      url += `?${searchParams.toString()}`;
    }

    return url;
  }

  /**
   * Build HTTP headers
   */
  private buildHeaders(accessToken: string): Record<string, string> {
    return {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Parse Link header for pagination
   */
  private parseLinkHeader(linkHeader: string | null): ShopifyPaginationInfo | undefined {
    if (!linkHeader) {
      return undefined;
    }

    const links: Record<string, string> = {};
    const parts = linkHeader.split(',');

    parts.forEach((part) => {
      const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
      if (match) {
        links[match[2]] = match[1];
      }
    });

    return {
      hasNextPage: !!links.next,
      hasPreviousPage: !!links.previous,
      nextPageUrl: links.next,
      previousPageUrl: links.previous,
    };
  }

  /**
   * Enforce rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Calculate exponential backoff
   */
  private calculateBackoff(attempt: number): number {
    return SHOPIFY_CONFIG.RETRY_BACKOFF_MS * Math.pow(2, attempt - 1);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Convert Headers to plain object
   */
  private headersToRecord(headers: Headers): Record<string, string> {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }

  /**
   * Truncate large objects for logging
   */
  private truncateForLogging(data: any): any {
    if (!data) return data;

    const stringified = JSON.stringify(data);
    if (stringified.length <= 10000) {
      return data;
    }

    return {
      _truncated: true,
      _originalSize: stringified.length,
      _preview: stringified.substring(0, 1000) + '...',
    };
  }
}
