import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Guard to ensure organization context exists on requests
 * This is automatically enforced by JwtAuthGuard since organizationId is in the JWT
 * This guard can be used for additional validation if needed
 */
@Injectable()
export class OrganizationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!user.organizationId) {
      throw new ForbiddenException('Organization context missing');
    }

    return true;
  }
}
