import {
  Controller,
  Get,
  Body,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@common/decorators/current-user.decorator';
import { CurrentOrganization } from '@common/decorators/organization.decorator';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
  ) {}

  /**
   * Get current organization
   * GET /organizations/current
   */
  @Get('current')
  findCurrent(@CurrentOrganization() organizationId: string) {
    return this.organizationsService.findOne(organizationId);
  }

  /**
   * Get organization statistics
   * GET /organizations/current/stats
   */
  @Get('current/stats')
  getStats(@CurrentOrganization() organizationId: string) {
    return this.organizationsService.getStats(organizationId);
  }

  /**
   * Update current organization (ADMIN only)
   * PATCH /organizations/current
   */
  @Patch('current')
  @Roles('ADMIN')
  update(
    @CurrentOrganization() organizationId: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.organizationsService.update(
      organizationId,
      updateOrganizationDto,
      user.role,
    );
  }
}
