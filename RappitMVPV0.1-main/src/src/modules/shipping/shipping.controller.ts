import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { OrganizationId } from '@common/decorators/organization.decorator';

@ApiTags('Shipping')
@Controller('shipments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ShippingController {
  constructor(private shippingService: ShippingService) {}

  @Post()
  @ApiOperation({ summary: 'Create shipment and generate label' })
  async create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateShipmentDto,
  ) {
    return this.shippingService.createShipment(organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all shipments' })
  async findAll(@OrganizationId() organizationId: string) {
    return this.shippingService.findAll(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get shipment details' })
  async findOne(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.shippingService.findOne(organizationId, id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update shipment status' })
  async updateStatus(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateShipmentStatusDto,
  ) {
    return this.shippingService.updateStatus(organizationId, id, dto);
  }

  @Get(':id/track')
  @ApiOperation({ summary: 'Track shipment' })
  async track(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.shippingService.trackShipment(organizationId, id);
  }

  @Get(':id/label')
  @ApiOperation({ summary: 'Get shipping label' })
  async getLabel(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.shippingService.getLabel(organizationId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel shipment' })
  async cancel(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.shippingService.cancelShipment(organizationId, id);
  }
}
