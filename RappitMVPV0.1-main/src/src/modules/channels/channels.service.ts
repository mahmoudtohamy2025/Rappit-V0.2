import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(private prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateChannelDto) {
    // Check for duplicate channel name
    const existing = await this.prisma.channel.findFirst({
      where: {
        organizationId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException('Channel name already exists');
    }

    const channel = await this.prisma.channel.create({
      data: {
        organizationId,
        name: dto.name,
        type: dto.type,
        config: dto.config,
        isActive: dto.isActive ?? true,
      },
    });

    this.logger.log(`Channel created: ${channel.name} (${channel.type})`);

    return channel;
  }

  async findAll(organizationId: string) {
    return this.prisma.channel.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });
  }

  async findOne(organizationId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: {
        id: channelId,
        organizationId,
      },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    return channel;
  }

  async update(organizationId: string, channelId: string, dto: UpdateChannelDto) {
    const channel = await this.prisma.channel.findFirst({
      where: {
        id: channelId,
        organizationId,
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const updated = await this.prisma.channel.update({
      where: { id: channelId },
      data: dto,
    });

    this.logger.log(`Channel updated: ${updated.name}`);

    return updated;
  }

  async delete(organizationId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: {
        id: channelId,
        organizationId,
      },
      include: {
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    if (channel._count.orders > 0) {
      throw new ConflictException('Cannot delete channel with existing orders');
    }

    await this.prisma.channel.delete({
      where: { id: channelId },
    });

    this.logger.log(`Channel deleted: ${channel.name}`);

    return { message: 'Channel deleted successfully' };
  }

  async testConnection(organizationId: string, channelId: string) {
    const channel = await this.findOne(organizationId, channelId);

    // This would integrate with the actual platform API
    // For now, return a mock response
    return {
      success: true,
      message: `Connection to ${channel.type} channel successful`,
      channelId: channel.id,
    };
  }
}
