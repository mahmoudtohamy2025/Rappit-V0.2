import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { IntegrationType, LogDirection } from '@prisma/client';

/**
 * Integration Logging Service
 *
 * Centralized service for logging all external integration calls.
 * Creates IntegrationLog records for observability and debugging.
 *
 * Features:
 * - Automatic request/response logging
 * - Error capture with truncated messages
 * - Duration tracking
 * - Correlation ID propagation
 * - Sensitive data masking
 */

export interface IntegrationLogData {
  organizationId: string;
  channelId?: string;
  integrationType: IntegrationType;
  direction: LogDirection;
  endpoint: string;
  method: string;
  correlationId?: string;
  request?: any;
  response?: any;
  statusCode?: number;
  errorMessage?: string;
  durationMs?: number;
}

@Injectable()
export class IntegrationLoggingService {
  private readonly logger = new Logger('IntegrationLogging');

  constructor(private prisma: PrismaService) {}

  /**
   * Log integration call
   *
   * Creates IntegrationLog record with request/response metadata.
   * Masks sensitive data automatically.
   */
  async logIntegrationCall(data: IntegrationLogData): Promise<void> {
    try {
      // Mask sensitive data
      const maskedRequest = this.maskSensitiveData(data.request);
      const maskedResponse = this.maskSensitiveData(data.response);

      // Truncate error message
      const truncatedError = data.errorMessage
        ? this.truncateString(data.errorMessage, 2000)
        : null;

      // Create log record
      await this.prisma.integrationLog.create({
        data: {
          organizationId: data.organizationId,
          channelId: data.channelId,
          integrationType: data.integrationType,
          direction: data.direction,
          endpoint: data.endpoint,
          method: data.method,
          statusCode: data.statusCode,
          request: maskedRequest ? JSON.parse(JSON.stringify(maskedRequest)) : null,
          response: maskedResponse ? JSON.parse(JSON.stringify(maskedResponse)) : null,
          errorMessage: truncatedError,
          durationMs: data.durationMs,
        },
      });

      // Also log to application logs
      const logData = {
        type: 'integration_call',
        integrationType: data.integrationType,
        direction: data.direction,
        endpoint: data.endpoint,
        method: data.method,
        statusCode: data.statusCode,
        durationMs: data.durationMs,
        correlationId: data.correlationId,
        orgId: data.organizationId,
        success: !data.errorMessage,
      };

      if (data.errorMessage) {
        this.logger.error({
          ...logData,
          errorMessage: truncatedError,
        });
      } else {
        this.logger.log(logData);
      }
    } catch (error) {
      // Don't let logging failures break the application
      this.logger.error(
        `Failed to create integration log: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Log successful integration call
   *
   * Helper method for successful calls.
   */
  async logSuccess(
    orgId: string,
    integrationType: IntegrationType,
    operation: string,
    endpoint: string,
    method: string,
    request: any,
    response: any,
    durationMs: number,
    correlationId?: string,
    channelId?: string,
  ): Promise<void> {
    await this.logIntegrationCall({
      organizationId: orgId,
      channelId,
      integrationType,
      direction: LogDirection.OUTBOUND,
      endpoint,
      method,
      request: { operation, ...request },
      response,
      statusCode: 200,
      durationMs,
      correlationId,
    });
  }

  /**
   * Log failed integration call
   *
   * Helper method for failed calls.
   */
  async logFailure(
    orgId: string,
    integrationType: IntegrationType,
    operation: string,
    endpoint: string,
    method: string,
    request: any,
    error: Error,
    statusCode: number,
    durationMs: number,
    correlationId?: string,
    channelId?: string,
  ): Promise<void> {
    await this.logIntegrationCall({
      organizationId: orgId,
      channelId,
      integrationType,
      direction: LogDirection.OUTBOUND,
      endpoint,
      method,
      request: { operation, ...request },
      statusCode,
      errorMessage: error.message,
      durationMs,
      correlationId,
    });
  }

  /**
   * Log inbound webhook
   *
   * For carrier webhooks (DHL/FedEx tracking updates).
   */
  async logInboundWebhook(
    orgId: string,
    integrationType: IntegrationType,
    endpoint: string,
    payload: any,
    statusCode: number,
    errorMessage?: string,
    channelId?: string,
  ): Promise<void> {
    await this.logIntegrationCall({
      organizationId: orgId,
      channelId,
      integrationType,
      direction: LogDirection.INBOUND,
      endpoint,
      method: 'POST',
      request: payload,
      statusCode,
      errorMessage,
    });
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Mask sensitive data in request/response
   *
   * Removes API keys, passwords, tokens, credit card numbers, etc.
   */
  private maskSensitiveData(data: any): any {
    if (!data) return data;

    const sensitiveKeys = [
      'password',
      'apiKey',
      'api_key',
      'apiSecret',
      'api_secret',
      'secret',
      'token',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'authorization',
      'cardNumber',
      'card_number',
      'cvv',
      'ssn',
      'credentials',
    ];

    const masked = JSON.parse(JSON.stringify(data));

    const maskObject = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const key in obj) {
        if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
          obj[key] = '***MASKED***';
        } else if (typeof obj[key] === 'object') {
          maskObject(obj[key]);
        }
      }
    };

    maskObject(masked);
    return masked;
  }

  /**
   * Truncate string to max length
   */
  private truncateString(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '... (truncated)';
  }

  /**
   * Create operation summary for metrics
   */
  getOperationSummary(
    integrationType: IntegrationType,
    operation: string,
  ): string {
    return `${integrationType}.${operation}`;
  }
}
