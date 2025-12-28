import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get current organization details
   */
  async findOne(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                isActive: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            channels: true,
            products: true,
            orders: true,
            customers: true,
            shipments: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return {
      id: organization.id,
      name: organization.name,
      settings: organization.settings,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
      members: organization.memberships.map((m) => ({
        ...m.user,
        role: m.role,
        joinedAt: m.createdAt,
      })),
      stats: organization._count,
    };
  }

  /**
   * Update organization details (ADMIN only)
   */
  async update(
    organizationId: string,
    updateOrganizationDto: UpdateOrganizationDto,
    userRole: UserRole,
  ) {
    if (userRole !== 'ADMIN') {
      throw new ForbiddenException('Only admins can update organization details');
    }

    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...updateOrganizationDto,
      },
    });

    this.logger.log(`Organization ${organizationId} updated`);

    return organization;
  }

  /**
   * Get organization statistics
   */
  async getStats(organizationId: string) {
    const [
      totalChannels,
      activeChannels,
      totalProducts,
      totalOrders,
      totalCustomers,
      pendingOrders,
      totalShipments,
      activeShipments,
    ] = await Promise.all([
      this.prisma.channel.count({
        where: { organizationId },
      }),
      this.prisma.channel.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.product.count({
        where: { organizationId },
      }),
      this.prisma.order.count({
        where: { organizationId },
      }),
      this.prisma.customer.count({
        where: { organizationId },
      }),
      this.prisma.order.count({
        where: {
          organizationId,
          status: { in: ['NEW', 'RESERVED', 'READY_TO_SHIP'] },
        },
      }),
      this.prisma.shipment.count({
        where: { organizationId },
      }),
      this.prisma.shipment.count({
        where: {
          organizationId,
          status: { in: ['IN_TRANSIT', 'OUT_FOR_DELIVERY'] },
        },
      }),
    ]);

    return {
      channels: {
        total: totalChannels,
        active: activeChannels,
      },
      products: {
        total: totalProducts,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
      },
      customers: {
        total: totalCustomers,
      },
      shipments: {
        total: totalShipments,
        active: activeShipments,
      },
    };
  }
}
