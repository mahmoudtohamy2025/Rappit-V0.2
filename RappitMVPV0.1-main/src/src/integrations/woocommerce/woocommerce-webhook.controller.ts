import {
  Controller,
  Post,
  Body,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { PrismaService } from '@common/database/prisma.service';
import { addJob, QueueName } from '../../queues/queues';
import { verifyWooCommerceWebhookSignature } from './oauth1-helper';

/**
 * WooCommerce Webhook Controller
 *
 * Handles incoming webhooks from WooCommerce:
 * - order.created
 * - order.updated
 * - order.deleted
 * - product.created
 * - product.updated
 * - product.deleted
 *
 * Implements:
 * - HMAC-SHA256 signature verification
 * - Webhook deduplication
 * - Job enqueueing with deterministic IDs
 *
 * WooCommerce Webhook Docs: https://woocommerce.com/document/webhooks/
 */
@ApiTags('Webhooks - WooCommerce')
@Controller('webhooks/woocommerce')
export class WooCommerceWebhookController {
  private readonly logger = new Logger(WooCommerceWebhookController.name);

  constructor(private prisma: PrismaService) {}

  /**
   * POST /webhooks/woocommerce/orders/created
   *
   * Handles WooCommerce order creation webhook
   */
  @Post('orders/created')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WooCommerce order created webhook' })
  @ApiHeader({
    name: 'X-WC-Webhook-Signature',
    description: 'HMAC-SHA256 signature for verification',
  })
  @ApiHeader({
    name: 'X-WC-Webhook-Source',
    description: 'Site URL (e.g., https://example.com)',
  })
  @ApiHeader({
    name: 'X-WC-Webhook-Topic',
    description: 'Webhook topic (e.g., order.created)',
  })
  @ApiHeader({
    name: 'X-WC-Webhook-ID',
    description: 'Webhook ID',
  })
  async handleOrderCreated(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-wc-webhook-signature') signature: string,
    @Headers('x-wc-webhook-source') source: string,
    @Headers('x-wc-webhook-topic') topic: string,
    @Headers('x-wc-webhook-id') webhookId: string,
    @Body() payload: any,
  ) {
    return this.handleWebhook(
      req,
      signature,
      source,
      'order.created',
      webhookId,
      payload,
    );
  }

  /**
   * POST /webhooks/woocommerce/orders/updated
   *
   * Handles WooCommerce order update webhook
   */
  @Post('orders/updated')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WooCommerce order updated webhook' })
  @ApiHeader({
    name: 'X-WC-Webhook-Signature',
    description: 'HMAC-SHA256 signature for verification',
  })
  async handleOrderUpdated(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-wc-webhook-signature') signature: string,
    @Headers('x-wc-webhook-source') source: string,
    @Headers('x-wc-webhook-topic') topic: string,
    @Headers('x-wc-webhook-id') webhookId: string,
    @Body() payload: any,
  ) {
    return this.handleWebhook(
      req,
      signature,
      source,
      'order.updated',
      webhookId,
      payload,
    );
  }

  /**
   * POST /webhooks/woocommerce/orders/deleted
   *
   * Handles WooCommerce order deletion webhook
   */
  @Post('orders/deleted')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WooCommerce order deleted webhook' })
  async handleOrderDeleted(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-wc-webhook-signature') signature: string,
    @Headers('x-wc-webhook-source') source: string,
    @Headers('x-wc-webhook-topic') topic: string,
    @Headers('x-wc-webhook-id') webhookId: string,
    @Body() payload: any,
  ) {
    return this.handleWebhook(
      req,
      signature,
      source,
      'order.deleted',
      webhookId,
      payload,
    );
  }

  /**
   * POST /webhooks/woocommerce/products/created
   */
  @Post('products/created')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WooCommerce product created webhook' })
  async handleProductCreated(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-wc-webhook-signature') signature: string,
    @Headers('x-wc-webhook-source') source: string,
    @Headers('x-wc-webhook-topic') topic: string,
    @Headers('x-wc-webhook-id') webhookId: string,
    @Body() payload: any,
  ) {
    return this.handleWebhook(
      req,
      signature,
      source,
      'product.created',
      webhookId,
      payload,
    );
  }

  /**
   * POST /webhooks/woocommerce/products/updated
   */
  @Post('products/updated')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WooCommerce product updated webhook' })
  async handleProductUpdated(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-wc-webhook-signature') signature: string,
    @Headers('x-wc-webhook-source') source: string,
    @Headers('x-wc-webhook-topic') topic: string,
    @Headers('x-wc-webhook-id') webhookId: string,
    @Body() payload: any,
  ) {
    return this.handleWebhook(
      req,
      signature,
      source,
      'product.updated',
      webhookId,
      payload,
    );
  }

  /**
   * Generic webhook handler
   *
   * Workflow:
   * 1. Verify HMAC-SHA256 signature
   * 2. Find channel by site URL
   * 3. Extract external event ID
   * 4. Check if already processed (deduplication)
   * 5. Create ProcessedWebhookEvent record (status: ENQUEUED)
   * 6. Enqueue job with deterministic jobId
   * 7. Return 200 OK quickly
   */
  private async handleWebhook(
    req: RawBodyRequest<Request>,
    signature: string,
    source: string,
    eventType: string,
    webhookId: string,
    payload: any,
  ) {
    const startTime = Date.now();

    this.logger.log(
      `Received WooCommerce webhook: ${eventType} from ${source}`,
    );

    // 1. Verify HMAC signature
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new ForbiddenException('Raw body required for signature verification');
    }

    const isValid = await this.verifySignature(rawBody, signature, source);
    if (!isValid) {
      this.logger.error(
        `Signature verification failed for ${eventType} from ${source}`,
      );
      throw new ForbiddenException('Invalid webhook signature');
    }

    this.logger.debug(`Signature verified for ${eventType}`);

    // 2. Find channel by site URL
    const channel = await this.findChannelBySiteUrl(source);
    if (!channel) {
      this.logger.error(`Channel not found for site URL: ${source}`);
      throw new ForbiddenException('Channel not configured');
    }

    // 3. Extract external event ID
    const externalEventId = this.extractEventId(payload, eventType, webhookId);

    // 4. Check if already processed (deduplication)
    const existing = await this.prisma.processedWebhookEvent.findUnique({
      where: {
        source_externalEventId: {
          source: 'woocommerce',
          externalEventId,
        },
      },
    });

    if (existing) {
      this.logger.log(
        `Webhook already processed: ${eventType} (eventId: ${externalEventId}), returning 200`,
      );
      return { received: true, status: 'already_processed' };
    }

    // 5. Create ProcessedWebhookEvent record (status: ENQUEUED)
    const webhookEvent = await this.prisma.processedWebhookEvent.create({
      data: {
        organizationId: channel.organizationId,
        channelId: channel.id,
        source: 'woocommerce',
        eventType,
        externalEventId,
        status: 'ENQUEUED',
        payload,
      },
    });

    this.logger.log(
      `Created ProcessedWebhookEvent: ${webhookEvent.id} (eventId: ${externalEventId})`,
    );

    // 6. Enqueue job with deterministic jobId
    const jobId = `webhook-woocommerce-${externalEventId}`;

    await addJob(
      QueueName.WEBHOOK_PROCESSING,
      `woocommerce-${eventType}`,
      {
        source: 'woocommerce',
        event: eventType,
        channelId: channel.id,
        organizationId: channel.organizationId,
        externalEventId,
        payload,
        processedWebhookEventId: webhookEvent.id,
      },
      jobId,
    );

    const duration = Date.now() - startTime;
    this.logger.log(
      `Webhook ${eventType} enqueued successfully (eventId: ${externalEventId}, duration: ${duration}ms)`,
    );

    // 7. Return 200 OK quickly
    return { received: true, status: 'enqueued', eventId: externalEventId };
  }

  /**
   * Verify webhook signature
   *
   * WooCommerce signature verification:
   * 1. Get raw request body
   * 2. Get webhook secret from channel config
   * 3. Compute HMAC: crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
   * 4. Compare with X-WC-Webhook-Signature header
   *
   * @param rawBody - Raw request body (Buffer)
   * @param signature - X-WC-Webhook-Signature header value
   * @param source - Site URL
   * @returns true if valid, false otherwise
   */
  private async verifySignature(
    rawBody: Buffer,
    signature: string,
    source: string,
  ): Promise<boolean> {
    if (!signature) {
      return false;
    }

    // Get webhook secret from channel config
    const secret = await this.getWebhookSecret(source);
    if (!secret) {
      this.logger.error(`Webhook secret not found for site: ${source}`);
      return false;
    }

    // Verify signature
    return verifyWooCommerceWebhookSignature(rawBody, signature, secret);
  }

  /**
   * Get webhook secret from channel config
   */
  private async getWebhookSecret(siteUrl: string): Promise<string | null> {
    const channel = await this.findChannelBySiteUrl(siteUrl);

    if (!channel) {
      return null;
    }

    // Extract webhook secret from config
    const config = channel.config as any;
    return config.webhookSecret || config.webhook_secret || null;
  }

  /**
   * Find channel by WooCommerce site URL
   */
  private async findChannelBySiteUrl(siteUrl: string) {
    // Normalize URL (remove trailing slash, protocol)
    const normalizedUrl = siteUrl
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');

    const channel = await this.prisma.channel.findFirst({
      where: {
        type: 'WOOCOMMERCE',
        OR: [
          {
            config: {
              path: ['siteUrl'],
              string_contains: normalizedUrl,
            },
          },
          {
            config: {
              path: ['site_url'],
              string_contains: normalizedUrl,
            },
          },
        ],
      },
    });

    return channel;
  }

  /**
   * Extract event ID from payload
   *
   * For most events, the ID is in payload.id
   * Use webhookId as fallback with timestamp for uniqueness
   */
  private extractEventId(
    payload: any,
    eventType: string,
    webhookId: string,
  ): string {
    const resourceId = payload.id?.toString();

    if (resourceId) {
      // For updates, include timestamp to avoid deduplication
      // (same order can be updated multiple times)
      if (eventType.includes('updated')) {
        return `${resourceId}-${Date.now()}`;
      }
      return resourceId;
    }

    // Fallback to webhook ID + timestamp
    return `${webhookId}-${Date.now()}`;
  }
}
