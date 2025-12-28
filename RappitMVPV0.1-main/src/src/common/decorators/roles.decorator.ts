import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for an endpoint
 * Usage: @Roles('ADMIN', 'MANAGER')
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
