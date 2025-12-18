import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '@common/database/prisma.service';
import { AuthGuard } from '@guards/auth.guard';
import { RequireRole } from '@decorators/require-role.decorator';
import { UserRole } from '@prisma/client';
import { encrypt, decrypt } from '@helpers/encryption';

/**
 * Shipping Account Controller
 *
 * CRUD operations for shipping accounts with encrypted credential storage.
 *
 * Security:
 * - OPERATIONS+ required for create/update/delete
 * - All operations organization-scoped
 * - Credentials encrypted at rest
 */
@ApiTags('Shipping Accounts')
@ApiBearerAuth()
@Controller('shipping-accounts')
@UseGuards(AuthGuard)
export class ShippingAccountController {
  constructor(private prisma: PrismaService) {}

  /**
   * Create shipping account
   *
   * POST /shipping-accounts
   */
  @Post()
  @RequireRole(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Create shipping account' })
  async create(@Request() req, @Body() body: any) {
    const { orgId } = req.user;

    // Validate input
    this.validateCreateInput(body);

    // Encrypt credentials
    const encryptedCredentials = encrypt(JSON.stringify(body.credentials));

    // Create account
    const account = await this.prisma.shippingAccount.create({
      data: {
        organizationId: orgId,
        carrierType: body.carrierType,
        name: body.name,
        credentials: encryptedCredentials as any,
        testMode: body.testMode ?? false,
        webhookSecret: body.webhookSecret,
        isActive: true,
      },
    });

    return {
      success: true,
      data: {
        id: account.id,
        name: account.name,
        carrierType: account.carrierType,
        testMode: account.testMode,
        isActive: account.isActive,
        createdAt: account.createdAt,
      },
    };
  }

  /**
   * List shipping accounts
   *
   * GET /shipping-accounts
   */
  @Get()
  @ApiOperation({ summary: 'List shipping accounts' })
  async list(@Request() req) {
    const { orgId } = req.user;

    const accounts = await this.prisma.shippingAccount.findMany({
      where: {
        organizationId: orgId,
      },
      select: {
        id: true,
        name: true,
        carrierType: true,
        testMode: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // DO NOT return credentials
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      data: accounts,
    };
  }

  /**
   * Get shipping account details
   *
   * GET /shipping-accounts/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get shipping account' })
  async get(@Request() req, @Param('id') id: string) {
    const { orgId } = req.user;

    const account = await this.prisma.shippingAccount.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
      select: {
        id: true,
        name: true,
        carrierType: true,
        testMode: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // DO NOT return credentials
      },
    });

    if (!account) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Shipping account not found',
        },
      };
    }

    return {
      success: true,
      data: account,
    };
  }

  /**
   * Update shipping account
   *
   * PUT /shipping-accounts/:id
   */
  @Put(':id')
  @RequireRole(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Update shipping account' })
  async update(@Request() req, @Param('id') id: string, @Body() body: any) {
    const { orgId } = req.user;

    // Verify account exists and belongs to org
    const existing = await this.prisma.shippingAccount.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
    });

    if (!existing) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Shipping account not found',
        },
      };
    }

    // Prepare update data
    const updateData: any = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.credentials !== undefined) {
      // Encrypt new credentials
      updateData.credentials = encrypt(JSON.stringify(body.credentials));
    }

    if (body.testMode !== undefined) {
      updateData.testMode = body.testMode;
    }

    if (body.webhookSecret !== undefined) {
      updateData.webhookSecret = body.webhookSecret;
    }

    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    // Update account
    const account = await this.prisma.shippingAccount.update({
      where: { id },
      data: updateData,
    });

    return {
      success: true,
      data: {
        id: account.id,
        name: account.name,
        carrierType: account.carrierType,
        testMode: account.testMode,
        isActive: account.isActive,
        updatedAt: account.updatedAt,
      },
    };
  }

  /**
   * Delete shipping account
   *
   * DELETE /shipping-accounts/:id
   */
  @Delete(':id')
  @RequireRole(UserRole.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete shipping account' })
  async delete(@Request() req, @Param('id') id: string) {
    const { orgId } = req.user;

    // Check if account has active shipments
    const activeShipments = await this.prisma.shipment.count({
      where: {
        shippingAccountId: id,
        status: {
          notIn: ['DELIVERED', 'CANCELLED', 'RETURNED'],
        },
      },
    });

    if (activeShipments > 0) {
      return {
        success: false,
        error: {
          code: 'HAS_ACTIVE_SHIPMENTS',
          message: 'Cannot delete account with active shipments',
        },
      };
    }

    // Delete account
    await this.prisma.shippingAccount.delete({
      where: {
        id,
        organizationId: orgId,
      },
    });

    return {
      success: true,
    };
  }

  /**
   * Test connection
   *
   * POST /shipping-accounts/:id/test-connection
   */
  @Post(':id/test-connection')
  @RequireRole(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Test shipping account connection' })
  async testConnection(@Request() req, @Param('id') id: string) {
    const { orgId } = req.user;

    const account = await this.prisma.shippingAccount.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
    });

    if (!account) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Shipping account not found',
        },
      };
    }

    // TODO: Implement actual connection test with carrier API
    // For MVP, return mock success
    return {
      success: true,
      data: {
        connected: true,
        message: 'Connection test successful (mock)',
        carrier: account.carrierType,
        testMode: account.testMode,
      },
    };
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  private validateCreateInput(body: any): void {
    const required = ['name', 'carrierType', 'credentials'];

    for (const field of required) {
      if (!body[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!['DHL', 'FEDEX'].includes(body.carrierType)) {
      throw new Error('Invalid carrierType. Must be DHL or FEDEX');
    }

    // Validate credentials structure based on carrier
    if (body.carrierType === 'DHL') {
      if (!body.credentials.apiKey || !body.credentials.apiSecret) {
        throw new Error('DHL credentials must include apiKey and apiSecret');
      }
    } else if (body.carrierType === 'FEDEX') {
      if (!body.credentials.apiKey || !body.credentials.apiSecret) {
        throw new Error('FedEx credentials must include apiKey and apiSecret');
      }
    }
  }
}
