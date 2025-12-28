import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@common/database/prisma.service';

@Injectable()
export class ShopifyService {
  private readonly logger = new Logger(ShopifyService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async fetchOrder(channelId: string, orderId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel || channel.type !== 'SHOPIFY') {
      throw new BadRequestException('Invalid Shopify channel');
    }

    const { shopUrl, accessToken } = channel.config as any;

    this.logger.log(`Fetching Shopify order ${orderId} from ${shopUrl}`);

    // In real implementation, make API call to Shopify
    // const response = await fetch(
    //   `https://${shopUrl}/admin/api/2024-01/orders/${orderId}.json`,
    //   {
    //     headers: {
    //       'X-Shopify-Access-Token': accessToken,
    //     },
    //   }
    // );

    // For now, return mock data
    return {
      id: orderId,
      order_number: `SHOP-${Date.now()}`,
      customer: {
        first_name: 'Ahmed',
        last_name: 'Al-Rashid',
        email: 'ahmed@example.com',
      },
      shipping_address: {
        address1: '123 King Fahd Road',
        city: 'Riyadh',
        province: 'Riyadh Province',
        country: 'Saudi Arabia',
        zip: '11564',
      },
      line_items: [
        {
          id: '1',
          sku: 'TEST-SKU-001',
          name: 'Test Product',
          quantity: 2,
          price: '100.00',
        },
      ],
      total_price: '200.00',
      currency: 'SAR',
    };
  }

  async fetchOrders(channelId: string, params: { since?: string; limit?: number }) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel || channel.type !== 'SHOPIFY') {
      throw new BadRequestException('Invalid Shopify channel');
    }

    const { shopUrl, accessToken } = channel.config as any;

    this.logger.log(`Fetching Shopify orders from ${shopUrl}`);

    // In real implementation, make API call to Shopify
    // const url = new URL(`https://${shopUrl}/admin/api/2024-01/orders.json`);
    // if (params.since) url.searchParams.append('created_at_min', params.since);
    // if (params.limit) url.searchParams.append('limit', params.limit.toString());

    // For now, return empty array
    return {
      orders: [],
      hasMore: false,
    };
  }

  async createWebhook(channelId: string, topic: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel || channel.type !== 'SHOPIFY') {
      throw new BadRequestException('Invalid Shopify channel');
    }

    const { shopUrl, accessToken } = channel.config as any;
    const webhookUrl = `${this.configService.get('appUrl')}/api/v1/webhooks/shopify/${channelId}`;

    this.logger.log(`Creating Shopify webhook for topic: ${topic}`);

    // In real implementation, make API call to create webhook
    // const response = await fetch(
    //   `https://${shopUrl}/admin/api/2024-01/webhooks.json`,
    //   {
    //     method: 'POST',
    //     headers: {
    //       'X-Shopify-Access-Token': accessToken,
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //       webhook: {
    //         topic,
    //         address: webhookUrl,
    //         format: 'json',
    //       },
    //     }),
    //   }
    // );

    return {
      success: true,
      topic,
      webhookUrl,
    };
  }

  async verifyWebhook(hmacHeader: string, body: string, secret: string): Promise<boolean> {
    // In real implementation, verify HMAC
    // const crypto = require('crypto');
    // const hash = crypto
    //   .createHmac('sha256', secret)
    //   .update(body, 'utf8')
    //   .digest('base64');
    // return hash === hmacHeader;

    return true; // Mock verification
  }

  async testConnection(channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel || channel.type !== 'SHOPIFY') {
      throw new BadRequestException('Invalid Shopify channel');
    }

    const { shopUrl, accessToken } = channel.config as any;

    this.logger.log(`Testing Shopify connection for ${shopUrl}`);

    // In real implementation, make test API call
    // const response = await fetch(
    //   `https://${shopUrl}/admin/api/2024-01/shop.json`,
    //   {
    //     headers: {
    //       'X-Shopify-Access-Token': accessToken,
    //     },
    //   }
    // );

    return {
      success: true,
      shopUrl,
      message: 'Connection successful',
    };
  }
}
