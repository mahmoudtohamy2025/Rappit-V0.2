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
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { OrganizationId } from '@common/decorators/organization.decorator';

@ApiTags('Channels')
@Controller('channels')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new sales channel' })
  async create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreateChannelDto,
  ) {
    return this.channelsService.create(organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all channels' })
  async findAll(@OrganizationId() organizationId: string) {
    return this.channelsService.findAll(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get channel by ID' })
  async findOne(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.channelsService.findOne(organizationId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update channel' })
  async update(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.channelsService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete channel' })
  async delete(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.channelsService.delete(organizationId, id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test channel connection' })
  async testConnection(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.channelsService.testConnection(organizationId, id);
  }
}
