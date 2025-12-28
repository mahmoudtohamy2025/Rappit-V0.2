import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@common/database/prisma.service';

@Injectable()
export class WooCommerceService {
  private readonly logger = new Logger(WooCommerceService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async fetchOrder(channelId: string, orderId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel || channel.type !== 'WOOCOMMERCE') {
      throw new BadRequestException('Invalid WooCommerce channel');
    }

    const { siteUrl, consumerKey, consumerSecret } = channel.config as any;

    this.logger.log(`Fetching WooCommerce order ${orderId} from ${siteUrl}`);

    // In real implementation, make API call to WooCommerce
    // const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    // const response = await fetch(
    //   `${siteUrl}/wp-json/wc/v3/orders/${orderId}`,
    //   {
    //     headers: {
    //       'Authorization': `Basic ${auth}`,
    //     },
    //   }
    // );

    // For now, return mock data
    return {
      id: orderId,
      number: `WC-${Date.now()}`,
      billing: {
        first_name: 'Mohammed',
        last_name: 'Al-Saud',
        email: 'mohammed@example.com',
      },
      shipping: {
        address_1: '456 Al Olaya Street',
        city: 'Riyadh',
        state: 'Riyadh',
        country: 'SA',
        postcode: '11564',
      },
      line_items: [
        {
          id: 1,
          sku: 'TEST-SKU-002',
          name: 'Test Product WC',
          quantity: 1,
          price: 150,
        },
      ],
      total: '150.00',
      currency: 'SAR',
    };
  }

  async fetchOrders(channelId: string, params: { after?: string; per_page?: number }) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel || channel.type !== 'WOOCOMMERCE') {
      throw new BadRequestException('Invalid WooCommerce channel');
    }

    const { siteUrl, consumerKey, consumerSecret } = channel.config as any;

    this.logger.log(`Fetching WooCommerce orders from ${siteUrl}`);

    // In real implementation, make API call to WooCommerce
    // const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    // const url = new URL(`${siteUrl}/wp-json/wc/v3/orders`);
    // if (params.after) url.searchParams.append('after', params.after);
    // if (params.per_page) url.searchParams.append('per_page', params.per_page.toString());

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

    if (!channel || channel.type !== 'WOOCOMMERCE') {
      throw new BadRequestException('Invalid WooCommerce channel');
    }

    const { siteUrl, consumerKey, consumerSecret } = channel.config as any;
    const webhookUrl = `${this.configService.get('appUrl')}/api/v1/webhooks/woocommerce/${channelId}`;

    this.logger.log(`Creating WooCommerce webhook for topic: ${topic}`);

    // In real implementation, make API call to create webhook
    // const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    // const response = await fetch(
    //   `${siteUrl}/wp-json/wc/v3/webhooks`,
    //   {
    //     method: 'POST',
    //     headers: {
    //       'Authorization': `Basic ${auth}`,
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //       name: `Rappit ${topic}`,
    //       topic,
    //       delivery_url: webhookUrl,
    //     }),
    //   }
    // );

    return {
      success: true,
      topic,
      webhookUrl,
    };
  }

  async verifyWebhook(signature: string, body: string, secret: string): Promise<boolean> {
    // In real implementation, verify signature
    // const crypto = require('crypto');
    // const hash = crypto
    //   .createHmac('sha256', secret)
    //   .update(body)
    //   .digest('base64');
    // return hash === signature;

    return true; // Mock verification
  }

  async testConnection(channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel || channel.type !== 'WOOCOMMERCE') {
      throw new BadRequestException('Invalid WooCommerce channel');
    }

    const { siteUrl, consumerKey, consumerSecret } = channel.config as any;

    this.logger.log(`Testing WooCommerce connection for ${siteUrl}`);

    // In real implementation, make test API call
    // const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    // const response = await fetch(
    //   `${siteUrl}/wp-json/wc/v3/system_status`,
    //   {
    //     headers: {
    //       'Authorization': `Basic ${auth}`,
    //     },
    //   }
    // );

    return {
      success: true,
      siteUrl,
      message: 'Connection successful',
    };
  }
}
