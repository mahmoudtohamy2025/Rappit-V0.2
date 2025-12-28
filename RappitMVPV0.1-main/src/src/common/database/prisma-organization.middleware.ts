import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * List of models that should be automatically scoped by organizationId
 */
const TENANT_SCOPED_MODELS = [
  'Channel',
  'Product',
  'InventoryItem',
  'InventoryAdjustment',
  'Customer',
  'Order',
  'ShippingAccount',
  'Shipment',
  'WebhookEvent',
  'IntegrationLog',
];

/**
 * Prisma middleware for automatic organization scoping
 * This ensures all queries are automatically filtered by organizationId
 *
 * Note: This is a safety net. Controllers should explicitly pass organizationId
 * from the request context for clarity and control.
 */
@Injectable()
export class PrismaOrganizationMiddleware {
  private readonly logger = new Logger(PrismaOrganizationMiddleware.name);

  /**
   * Create middleware function that can be applied to Prisma client
   */
  createMiddleware(defaultOrganizationId?: string): Prisma.Middleware {
    return async (params, next) => {
      // Only apply to tenant-scoped models
      if (!TENANT_SCOPED_MODELS.includes(params.model || '')) {
        return next(params);
      }

      // Extract organizationId from params or use default
      const organizationId =
        params.args?.organizationId || defaultOrganizationId;

      if (!organizationId) {
        this.logger.warn(
          `No organizationId provided for ${params.model} ${params.action}`,
        );
        // Don't block the query, but log warning
        return next(params);
      }

      // Add organizationId to where clause for read operations
      if (
        params.action === 'findUnique' ||
        params.action === 'findFirst' ||
        params.action === 'findMany' ||
        params.action === 'count' ||
        params.action === 'aggregate'
      ) {
        params.args.where = {
          ...params.args.where,
          organizationId,
        };
      }

      // Add organizationId to data for create operations
      if (params.action === 'create') {
        params.args.data = {
          ...params.args.data,
          organizationId,
        };
      }

      // Add organizationId to where clause for update/delete operations
      if (
        params.action === 'update' ||
        params.action === 'updateMany' ||
        params.action === 'delete' ||
        params.action === 'deleteMany'
      ) {
        params.args.where = {
          ...params.args.where,
          organizationId,
        };
      }

      return next(params);
    };
  }
}
