import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AddOrderNoteDto } from './dto/add-order-note.dto';
import { CreateOrderFromChannelDto } from './dto/create-order-from-channel.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { OrganizationId } from '@common/decorators/organization.decorator';
import {
  CurrentUser,
  CurrentUserPayload,
} from '@common/decorators/current-user.decorator';
import { ActorType } from '@common/enums/actor-type.enum';
import { UserRole } from '@prisma/client';

/**
 * OrdersController - REST API for Order Management
 *
 * Implements RBAC-protected endpoints for the 11-state order lifecycle.
 * All endpoints are organization-scoped and require JWT authentication.
 *
 * RBAC Permissions:
 * - View orders: OPERATOR, MANAGER, ADMIN
 * - Add notes: OPERATOR, MANAGER, ADMIN
 * - Update status (manual): MANAGER, ADMIN
 * - Delete orders: ADMIN only
 *
 * State Machine:
 * - Status transitions are validated by OrdersService
 * - Invalid transitions return 400 Bad Request
 */
@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private ordersService: OrdersService) {}

  /**
   * GET /orders
   *
   * List all orders with filters and pagination.
   *
   * Access: OPERATOR, MANAGER, ADMIN
   *
   * Query Parameters:
   * - status: Filter by order status (NEW, RESERVED, etc.)
   * - channelId: Filter by sales channel
   * - search: Search by order number, customer name/email
   * - startDate: Filter orders from this date (ISO 8601)
   * - endDate: Filter orders until this date (ISO 8601)
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 20)
   */
  @Get()
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({
    summary: 'Get all orders with filters',
    description:
      'List orders with optional filters for status, channel, date range, and search. Supports pagination.',
  })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async findAll(
    @OrganizationId() organizationId: string,
    @Query() filters: FilterOrdersDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `User ${user.email} (${user.role}) listing orders - filters: ${JSON.stringify(filters)}`,
    );

    return this.ordersService.findAll(organizationId, filters);
  }

  /**
   * GET /orders/:id
   *
   * Get a single order with full details (items, timeline, shipments, etc.)
   *
   * Access: OPERATOR, MANAGER, ADMIN
   */
  @Get(':id')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({
    summary: 'Get order by ID',
    description:
      'Retrieve a single order with complete details including items, customer, timeline events, shipments, and inventory reservations.',
  })
  @ApiParam({
    name: 'id',
    description: 'Order ID (UUID)',
    example: 'e7e6d456-6e5c-4e4a-8f5a-1234567890ab',
  })
  @ApiResponse({
    status: 200,
    description: 'Order retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async findOne(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `User ${user.email} (${user.role}) retrieving order ${id}`,
    );

    return this.ordersService.findOne(organizationId, id);
  }

  /**
   * POST /orders
   *
   * Create or update order from channel payload (webhook handler endpoint)
   *
   * Access: MANAGER, ADMIN (for manual imports) or SYSTEM (for webhooks)
   *
   * This endpoint is designed for:
   * 1. Shopify/WooCommerce webhook handlers
   * 2. Manual order imports by managers/admins
   * 3. Batch import jobs
   *
   * Idempotency: Safe to call multiple times with same externalOrderId
   */
  @Post()
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({
    summary: 'Create or update order from channel',
    description:
      'Import an order from a sales channel (Shopify, WooCommerce). ' +
      'Idempotent - safe to call multiple times. ' +
      'Automatically reserves inventory if order is NEW.',
  })
  @ApiResponse({
    status: 201,
    description: 'Order created/updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid data or SKU not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async createFromChannel(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateOrderFromChannelDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `User ${user.email} (${user.role}) importing order from channel ${dto.channelId}`,
    );

    return this.ordersService.createOrUpdateOrderFromChannelPayload(
      dto,
      organizationId,
      ActorType.USER,
      user.userId,
    );
  }

  /**
   * PATCH /orders/:id/status
   *
   * Update order status with state machine validation.
   *
   * Access: MANAGER, ADMIN (for manual status changes)
   *
   * State Transitions:
   * - Only valid transitions are allowed (enforced by state machine)
   * - Invalid transitions return 400 Bad Request
   * - Automatically triggers inventory actions:
   *   - Reserves inventory when moving to NEW/RESERVED
   *   - Releases inventory when moving to CANCELLED/RETURNED
   *
   * Timeline:
   * - Creates audit trail event for every status change
   * - Records actor (user who made the change)
   */
  @Patch(':id/status')
  @Roles('MANAGER', 'ADMIN')
  @ApiOperation({
    summary: 'Update order status',
    description:
      'Update order status with state machine validation. ' +
      'Only valid transitions are allowed. ' +
      'Automatically handles inventory reservation/release. ' +
      'Creates timeline event for audit trail.',
  })
  @ApiParam({
    name: 'id',
    description: 'Order ID (UUID)',
    example: 'e7e6d456-6e5c-4e4a-8f5a-1234567890ab',
  })
  @ApiResponse({
    status: 200,
    description: 'Order status updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid state transition',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async updateStatus(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `User ${user.email} (${user.role}) updating order ${id} status to ${dto.status}`,
    );

    return this.ordersService.updateOrderStatus(
      id,
      dto.status,
      ActorType.USER,
      user.userId,
      organizationId,
      dto.comment,
    );
  }

  /**
   * POST /orders/:id/notes
   *
   * Add an internal note to an order.
   *
   * Access: OPERATOR, MANAGER, ADMIN
   *
   * Notes:
   * - Appends to internalNotes field with timestamp
   * - Creates timeline event for audit trail
   * - Useful for communication between team members
   */
  @Post(':id/notes')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add internal note to order',
    description:
      'Add an internal note for team communication. ' +
      'Creates timeline event and appends to order notes.',
  })
  @ApiParam({
    name: 'id',
    description: 'Order ID (UUID)',
    example: 'e7e6d456-6e5c-4e4a-8f5a-1234567890ab',
  })
  @ApiResponse({
    status: 201,
    description: 'Note added successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async addNote(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: AddOrderNoteDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `User ${user.email} (${user.role}) adding note to order ${id}`,
    );

    return this.ordersService.addNote(id, dto, organizationId, user.userId);
  }

  /**
   * GET /orders/:id/timeline
   *
   * Get order timeline events (audit trail).
   *
   * Access: OPERATOR, MANAGER, ADMIN
   *
   * Returns chronological list of all events:
   * - Status changes
   * - Notes added
   * - Inventory actions
   * - Shipment events
   */
  @Get(':id/timeline')
  @Roles('OPERATOR', 'MANAGER', 'ADMIN')
  @ApiOperation({
    summary: 'Get order timeline',
    description:
      'Retrieve chronological audit trail of all order events including status changes, notes, and inventory actions.',
  })
  @ApiParam({
    name: 'id',
    description: 'Order ID (UUID)',
    example: 'e7e6d456-6e5c-4e4a-8f5a-1234567890ab',
  })
  @ApiResponse({
    status: 200,
    description: 'Timeline retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async getTimeline(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.log(
      `User ${user.email} (${user.role}) retrieving timeline for order ${id}`,
    );

    // Get order with timeline events
    const order = await this.ordersService.findOne(organizationId, id);
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      timeline: order.timelineEvents,
    };
  }

  /**
   * DELETE /orders/:id
   *
   * Delete an order (only allowed for NEW or CANCELLED orders).
   *
   * Access: ADMIN only
   *
   * Restrictions:
   * - Cannot delete orders with active reservations
   * - Cannot delete orders that have been shipped
   * - Only NEW or CANCELLED status allowed
   */
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete an order',
    description:
      'Delete an order. Only allowed for orders in NEW or CANCELLED status. ' +
      'ADMIN role required.',
  })
  @ApiParam({
    name: 'id',
    description: 'Order ID (UUID)',
    example: 'e7e6d456-6e5c-4e4a-8f5a-1234567890ab',
  })
  @ApiResponse({
    status: 200,
    description: 'Order deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Order cannot be deleted (wrong status)',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - ADMIN role required',
  })
  async delete(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    this.logger.warn(
      `User ${user.email} (${user.role}) deleting order ${id}`,
    );

    return this.ordersService.delete(organizationId, id);
  }
}
