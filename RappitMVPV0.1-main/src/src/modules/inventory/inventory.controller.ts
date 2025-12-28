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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { PaginationDto } from '@common/dto/pagination.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { OrganizationId } from '@common/decorators/organization.decorator';
import { CurrentUser, CurrentUserPayload } from '@common/decorators/current-user.decorator';

@ApiTags('Inventory')
@Controller('inventory')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Post()
  @ApiOperation({ summary: 'Create inventory item' })
  async create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateInventoryItemDto,
  ) {
    return this.inventoryService.create(organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all inventory items' })
  async findAll(
    @OrganizationId() organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.inventoryService.findAll(organizationId, pagination);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get low stock items' })
  async getLowStock(@OrganizationId() organizationId: string) {
    return this.inventoryService.getLowStockItems(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inventory item by ID' })
  async findOne(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.inventoryService.findOne(organizationId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update inventory item' })
  async update(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.update(organizationId, id, dto);
  }

  @Post(':id/adjust')
  @ApiOperation({ summary: 'Adjust inventory quantity' })
  async adjust(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: AdjustInventoryDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.inventoryService.adjust(organizationId, id, dto, user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete inventory item' })
  async delete(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.inventoryService.delete(organizationId, id);
  }
}
