import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Request Logging Interceptor
 *
 * Logs all HTTP requests with:
 * - Path, method, status code
 * - Organization ID, user ID
 * - Correlation ID
 * - Request duration
 * - Error details (if any)
 *
 * Format: Structured JSON for easy parsing in log aggregation tools
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const { method, url, headers, body } = request;
    const correlationId = (request as any).correlationId;
    const user = (request as any).user; // From auth guard

    const startTime = Date.now();

    // Log incoming request
    this.logger.log({
      type: 'request_start',
      method,
      path: url,
      correlationId,
      orgId: user?.orgId,
      userId: user?.userId,
      userAgent: headers['user-agent'],
      ip: request.ip || request.connection.remoteAddress,
    });

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;

          // Log successful response
          this.logger.log({
            type: 'request_complete',
            method,
            path: url,
            statusCode: response.statusCode,
            duration,
            correlationId,
            orgId: user?.orgId,
            userId: user?.userId,
            success: true,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;

          // Log error response
          this.logger.error({
            type: 'request_error',
            method,
            path: url,
            statusCode: error.status || 500,
            duration,
            correlationId,
            orgId: user?.orgId,
            userId: user?.userId,
            success: false,
            errorName: error.name,
            errorMessage: error.message,
            errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          });
        },
      }),
    );
  }
}
