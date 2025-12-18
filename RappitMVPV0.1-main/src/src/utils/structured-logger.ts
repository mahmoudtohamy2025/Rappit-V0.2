import { Logger } from '@nestjs/common';

/**
 * Structured Logger
 *
 * Wrapper around NestJS Logger that enforces structured logging format.
 * All logs are JSON objects for easy parsing in log aggregation tools.
 *
 * Features:
 * - Automatic correlation ID inclusion
 * - Organization scoping
 * - Consistent format
 * - Contextual metadata
 */

export interface LogContext {
  correlationId?: string;
  orgId?: string;
  userId?: string;
  orderId?: string;
  shipmentId?: string;
  channelId?: string;
  jobId?: string;
  [key: string]: any;
}

export class StructuredLogger {
  private logger: Logger;

  constructor(context: string) {
    this.logger = new Logger(context);
  }

  /**
   * Log informational message
   */
  log(message: string, context?: LogContext): void {
    this.logger.log(this.formatLog('info', message, context));
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error(
      this.formatLog('error', message, {
        ...context,
        errorName: error?.name,
        errorMessage: error?.message,
        errorStack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      }),
    );
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.logger.warn(this.formatLog('warn', message, context));
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(this.formatLog('debug', message, context));
    }
  }

  /**
   * Log integration call
   */
  logIntegration(
    operation: string,
    provider: string,
    success: boolean,
    durationMs: number,
    context?: LogContext,
  ): void {
    this.logger.log(
      this.formatLog('integration', operation, {
        ...context,
        provider,
        success,
        durationMs,
      }),
    );
  }

  /**
   * Log job processing
   */
  logJob(
    jobType: string,
    status: 'started' | 'completed' | 'failed',
    context?: LogContext,
  ): void {
    const level = status === 'failed' ? 'error' : 'info';
    this.logger[level === 'error' ? 'error' : 'log'](
      this.formatLog('job', `Job ${status}: ${jobType}`, {
        ...context,
        jobType,
        status,
      }),
    );
  }

  /**
   * Format log as structured JSON
   */
  private formatLog(
    level: string,
    message: string,
    context?: LogContext,
  ): any {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };
  }
}

/**
 * Create logger instance
 */
export function createLogger(context: string): StructuredLogger {
  return new StructuredLogger(context);
}
