import { Controller, Post, Get, Body, Param, Headers, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { Public } from '@common/decorators/public.decorator';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Public()
  @Post('shopify/:channelId')
  @ApiOperation({ summary: 'Receive Shopify webhook' })
  async shopify(
    @Param('channelId') channelId: string,
    @Headers('x-shopify-topic') topic: string,
    @Body() payload: any,
  ) {
    await this.webhooksService.handleShopifyWebhook(channelId, topic, payload);
    return { received: true };
  }

  @Public()
  @Post('woocommerce/:channelId')
  @ApiOperation({ summary: 'Receive WooCommerce webhook' })
  async woocommerce(
    @Param('channelId') channelId: string,
    @Headers('x-wc-webhook-topic') topic: string,
    @Body() payload: any,
  ) {
    await this.webhooksService.handleWooCommerceWebhook(channelId, topic, payload);
    return { received: true };
  }

  @Public()
  @Post('dhl/:shipmentId')
  @ApiOperation({ summary: 'Receive DHL tracking webhook' })
  async dhl(
    @Param('shipmentId') shipmentId: string,
    @Body() payload: any,
  ) {
    await this.webhooksService.handleDHLWebhook(
      shipmentId,
      'tracking.update',
      payload,
    );
    return { received: true };
  }

  @Public()
  @Post('fedex/:shipmentId')
  @ApiOperation({ summary: 'Receive FedEx tracking webhook' })
  async fedex(
    @Param('shipmentId') shipmentId: string,
    @Body() payload: any,
  ) {
    await this.webhooksService.handleFedExWebhook(
      shipmentId,
      'tracking.update',
      payload,
    );
    return { received: true };
  }

  @Get('logs/:channelId')
  @ApiOperation({ summary: 'Get webhook logs for a channel' })
  async getLogs(
    @Param('channelId') channelId: string,
    @Query('limit') limit?: number,
  ) {
    return this.webhooksService.getWebhookLogs(channelId, limit);
  }
}
