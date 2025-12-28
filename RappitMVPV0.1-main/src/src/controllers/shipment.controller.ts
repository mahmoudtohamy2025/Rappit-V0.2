import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Response,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response as ExpressResponse } from 'express';
import { AuthGuard } from '@guards/auth.guard';
import { RequireRole } from '@decorators/require-role.decorator';
import { UserRole, ShippingCarrier } from '@prisma/client';
import { ShippingService } from '@services/shipping.service';
import { PrismaService } from '@common/database/prisma.service';

/**
 * Shipment Controller
 *
 * Shipment operations:
 * - Create shipment for order
 * - Get shipment details
 * - Download shipping label
 * - List shipments
 *
 * Security:
 * - OPERATIONS+ required to create shipments
 * - All operations organization-scoped
 */
@ApiTags('Shipments')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthGuard)
export class ShipmentController {
  constructor(
    private shippingService: ShippingService,
    private prisma: PrismaService,
  ) {}

  /**
   * Create shipment for order
   *
   * POST /orders/:orderId/shipment
   */
  @Post('orders/:orderId/shipment')
  @RequireRole(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Create shipment for order' })
  async createShipment(
    @Request() req,
    @Param('orderId') orderId: string,
    @Body() body: CreateShipmentDto,
  ) {
    const { orgId, userId } = req.user;

    try {
      // Validate input
      this.validateCreateShipmentInput(body);

      // Create shipment (enqueues job)
      const shipment = await this.shippingService.createShipmentForOrder(
        orderId,
        body.shippingAccountId || null,
        body.carrierType,
        {
          serviceCode: body.serviceCode,
          packages: body.packages,
          options: body.options,
        },
        orgId,
        userId,
      );

      return {
        success: true,
        data: {
          shipmentId: shipment.id,
          status: shipment.status,
          carrierType: shipment.carrierType,
          createdAt: shipment.createdAt,
        },
        message: 'Shipment created and processing started',
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: error.name || 'CREATE_SHIPMENT_ERROR',
          message: error.message,
        },
      };
    }
  }

  /**
   * Get shipment details
   *
   * GET /shipments/:id
   */
  @Get('shipments/:id')
  @ApiOperation({ summary: 'Get shipment details' })
  async getShipment(@Request() req, @Param('id') id: string) {
    const { orgId } = req.user;

    try {
      const shipment = await this.shippingService.getShipment(id, orgId);

      return {
        success: true,
        data: shipment,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: error.name || 'GET_SHIPMENT_ERROR',
          message: error.message,
        },
      };
    }
  }

  /**
   * Download shipping label
   *
   * GET /shipments/:id/label?download=true
   */
  @Get('shipments/:id/label')
  @ApiOperation({ summary: 'Download shipping label' })
  @ApiQuery({ name: 'download', required: false, type: Boolean })
  async getLabel(
    @Request() req,
    @Param('id') id: string,
    @Query('download') download: string,
    @Response() res: ExpressResponse,
  ) {
    const { orgId } = req.user;

    try {
      // Get shipment to check label availability
      const shipment = await this.prisma.shipment.findFirst({
        where: {
          id,
          organizationId: orgId,
        },
      });

      if (!shipment) {
        return res.status(HttpStatus.NOT_FOUND).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Shipment not found',
          },
        });
      }

      if (!shipment.labelMeta) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          error: {
            code: 'LABEL_NOT_AVAILABLE',
            message: 'Label not available yet. Shipment may still be processing.',
          },
        });
      }

      // Set download header if requested
      if (download === 'true') {
        const labelMeta = shipment.labelMeta as any;
        const filename = `shipment-${id}-label.pdf`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }

      // Stream label
      await this.shippingService.streamLabel(id, orgId, res);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: {
          code: 'STREAM_LABEL_ERROR',
          message: error.message,
        },
      });
    }
  }

  /**
   * List shipments
   *
   * GET /shipments?status=IN_TRANSIT&orderId=xxx
   */
  @Get('shipments')
  @ApiOperation({ summary: 'List shipments' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'orderId', required: false })
  @ApiQuery({ name: 'carrierType', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listShipments(@Request() req, @Query() query: any) {
    const { orgId } = req.user;

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 50;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      organizationId: orgId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.orderId) {
      where.orderId = query.orderId;
    }

    if (query.carrierType) {
      where.carrierType = query.carrierType;
    }

    // Get shipments
    const [shipments, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
            },
          },
          shippingAccount: {
            select: {
              id: true,
              name: true,
              carrierType: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return {
      success: true,
      data: shipments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  private validateCreateShipmentInput(body: CreateShipmentDto): void {
    const required = ['carrierType', 'packages'];

    for (const field of required) {
      if (!body[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!['DHL', 'FEDEX'].includes(body.carrierType)) {
      throw new Error('Invalid carrierType. Must be DHL or FEDEX');
    }

    if (!Array.isArray(body.packages) || body.packages.length === 0) {
      throw new Error('At least one package is required');
    }

    // Validate packages
    for (const pkg of body.packages) {
      if (!pkg.weightKg || pkg.weightKg <= 0) {
        throw new Error('Package weightKg must be greater than 0');
      }
    }
  }
}

// ============================================================================
// DTOs
// ============================================================================

interface CreateShipmentDto {
  carrierType: ShippingCarrier;
  shippingAccountId?: string;
  serviceCode?: string;
  packages: Array<{
    weightKg: number;
    lengthCm?: number;
    widthCm?: number;
    heightCm?: number;
  }>;
  options?: {
    insurance?: number;
    signature?: boolean;
    saturdayDelivery?: boolean;
  };
}
