import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Correlation ID Middleware
 *
 * Generates or extracts correlation ID from incoming requests.
 * Attaches it to the request object for use throughout the request lifecycle.
 *
 * Usage:
 * - Header: X-Correlation-ID (if provided by client)
 * - Generated: UUID v4 (if not provided)
 * - Response: X-Correlation-ID header echoed back
 * - Logging: Available in req.correlationId
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extract or generate correlation ID
    const correlationId =
      req.headers['x-correlation-id'] as string ||
      req.headers['x-request-id'] as string ||
      uuidv4();

    // Attach to request object
    (req as any).correlationId = correlationId;

    // Echo back in response header
    res.setHeader('X-Correlation-ID', correlationId);

    next();
  }
}
