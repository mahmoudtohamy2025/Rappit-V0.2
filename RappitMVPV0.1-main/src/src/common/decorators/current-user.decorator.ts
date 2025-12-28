import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Current user payload extracted from JWT
 */
export interface CurrentUserPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  role: UserRole;
}

/**
 * Decorator to get current authenticated user from request
 * Usage: @CurrentUser() user: CurrentUserPayload
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
