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
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';
import { PrismaService } from '@common/database/prisma.service';
import { addJob, QueueName } from '../../queues/queues';

/**
 * Shopify Webhook Controller
 *
 * Handles incoming webhooks from Shopify:
 * - orders/create
 * - orders/updated
 * - orders/cancelled
 * - fulfillments/create
 * - fulfillments/update
 * - inventory_levels/update
 *
 * Implements:
 * - HMAC signature verification
 * - Webhook deduplication
 * - Job enqueueing with deterministic IDs
 */
@ApiTags('Webhooks - Shopify')
@Controller('webhooks/shopify')
export class ShopifyWebhookController {
  private readonly logger = new Logger(ShopifyWebhookController.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * POST /webhooks/shopify/orders/create
   *
   * Handles Shopify order creation webhook
   */
  @Post('orders/create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Shopify order created webhook' })
  @ApiHeader({
    name: 'X-Shopify-Hmac-Sha256',
    description: 'HMAC signature for verification',
  })
  @ApiHeader({
    name: 'X-Shopify-Shop-Domain',
    description: 'Shop domain (e.g., my-store.myshopify.com)',
  })
  async handleOrderCreate(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-shopify-hmac-sha256') hmacHeader: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
    @Body() payload: any,
  ) {
    return this.handleWebhook(
      req,
      hmacHeader,
      shopDomain,
      'orders/create',
      payload,
    );
  }

  /**
   * POST /webhooks/shopify/orders/updated
   *
   * Handles Shopify order update webhook
   */
  @Post('orders/updated')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Shopify order updated webhook' })
  @ApiHeader({
    name: 'X-Shopify-Hmac-Sha256',
    description: 'HMAC signature for verification',
  })
  async handleOrderUpdated(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-shopify-hmac-sha256') hmacHeader: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
    @Body() payload: any,
  ) {
    return this.handleWebhook(
      req,
      hmacHeader,
      shopDomain,
      'orders/updated',
      payload,
    );
  }

  /**
   * POST /webhooks/shopify/orders/cancelled
   *
   * Handles Shopify order cancellation webhook
   */
  @Post('orders/cancelled')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Shopify order cancelled webhook' })
  @ApiHeader({
    name: 'X-Shopify-Hmac-Sha256',
    description: 'HMAC signature for verification',
  })
  async handleOrderCancelled(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-shopify-hmac-sha256') hmacHeader: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
    @Body() payload: any,
  ) {
    return this.handleWebhook(
      req,
      hmacHeader,
      shopDomain,
      'orders/cancelled',
      payload,
    );
  }

  /**
   * POST /webhooks/shopify/fulfillments/create
   */
  @Post('fulfillments/create')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Shopify fulfillment created webhook' })
  async handleFulfillmentCreate(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-shopify-hmac-sha256') hmacHeader: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
    @Body() payload: any,
  ) {
    return this.handleWebhook(
      req,
      hmacHeader,
      shopDomain,
      'fulfillments/create',
      payload,
    );
  }

  /**
   * POST /webhooks/shopify/fulfillments/update
   */
  @Post('fulfillments/update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Shopify fulfillment updated webhook' })
  async handleFulfillmentUpdate(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-shopify-hmac-sha256') hmacHeader: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
    @Body() payload: any,
  ) {
    return this.handleWebhook(
      req,
      hmacHeader,
      shopDomain,
      'fulfillments/update',
      payload,
    );
  }

  /**
   * POST /webhooks/shopify/inventory_levels/update
   */
  @Post('inventory_levels/update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Shopify inventory level updated webhook' })
  async handleInventoryLevelUpdate(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-shopify-hmac-sha256') hmacHeader: string,
    @Headers('x-shopify-shop-domain') shopDomain: string,
    @Body() payload: any,
  ) {
    return this.handleWebhook(
      req,
      hmacHeader,
      shopDomain,
      'inventory_levels/update',
      payload,
    );
  }

  /**
   * Generic webhook handler
   *
   * Workflow:
   * 1. Verify HMAC signature
   * 2. Find channel by shop domain
   * 3. Extract external event ID
   * 4. Check if already processed (deduplication)
   * 5. Create ProcessedWebhookEvent record (status: ENQUEUED)
   * 6. Enqueue job with deterministic jobId
   * 7. Return 200 OK quickly
   */
  private async handleWebhook(
    req: RawBodyRequest<Request>,
    hmacHeader: string,
    shopDomain: string,
    eventType: string,
    payload: any,
  ) {
    const startTime = Date.now();

    this.logger.log(
      `Received Shopify webhook: ${eventType} from ${shopDomain}`,
    );

    // 1. Verify HMAC signature
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new ForbiddenException('Raw body required for HMAC verification');
    }

    const isValid = await this.verifyHmac(rawBody, hmacHeader, shopDomain);
    if (!isValid) {
      this.logger.error(
        `HMAC verification failed for ${eventType} from ${shopDomain}`,
      );
      throw new ForbiddenException('Invalid HMAC signature');
    }

    this.logger.debug(`HMAC verified for ${eventType}`);

    // 2. Find channel by shop domain
    const channel = await this.findChannelByShopDomain(shopDomain);
    if (!channel) {
      this.logger.error(`Channel not found for shop domain: ${shopDomain}`);
      throw new ForbiddenException('Channel not configured');
    }

    // 3. Extract external event ID
    const externalEventId = this.extractEventId(payload, eventType);

    // 4. Check if already processed (deduplication)
    const existing = await this.prisma.processedWebhookEvent.findUnique({
      where: {
        source_externalEventId: {
          source: 'shopify',
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
        source: 'shopify',
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
    const jobId = `webhook-shopify-${externalEventId}`;

    await addJob(
      QueueName.WEBHOOK_PROCESSING,
      `shopify-${eventType}`,
      {
        source: 'shopify',
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
   * Verify HMAC signature
   *
   * Shopify HMAC verification:
   * 1. Get raw request body
   * 2. Get webhook secret from channel config
   * 3. Compute HMAC: crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
   * 4. Compare with X-Shopify-Hmac-Sha256 header
   *
   * @param rawBody - Raw request body (Buffer)
   * @param hmacHeader - HMAC from X-Shopify-Hmac-Sha256 header
   * @param shopDomain - Shop domain
   * @returns true if valid, false otherwise
   */
  private async verifyHmac(
    rawBody: Buffer,
    hmacHeader: string,
    shopDomain: string,
  ): Promise<boolean> {
    if (!hmacHeader) {
      return false;
    }

    // Get webhook secret from channel config
    const secret = await this.getWebhookSecret(shopDomain);
    if (!secret) {
      this.logger.error(`Webhook secret not found for shop: ${shopDomain}`);
      return false;
    }

    // Compute HMAC
    const computedHmac = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(hmacHeader),
      Buffer.from(computedHmac),
    );
  }

  /**
   * Get webhook secret from channel config or environment
   *
   * Priority:
   * 1. Channel-specific webhook secret in config
   * 2. Environment SHOPIFY_WEBHOOK_SECRET
   * 3. Environment SHOPIFY_API_SECRET
   */
  private async getWebhookSecret(shopDomain: string): Promise<string | null> {
    const channel = await this.findChannelByShopDomain(shopDomain);

    if (channel) {
      // Try channel-specific secret first
      const config = channel.config as any;
      const channelSecret = config.webhookSecret || config.webhook_secret;
      if (channelSecret) {
        return channelSecret;
      }
    }

    // Fallback to environment variables
    const envSecret = this.configService.get<string>('SHOPIFY_WEBHOOK_SECRET') ||
                      this.configService.get<string>('SHOPIFY_API_SECRET');

    return envSecret || null;
  }

  /**
   * Find channel by Shopify shop domain
   */
  private async findChannelByShopDomain(shopDomain: string) {
    const channel = await this.prisma.channel.findFirst({
      where: {
        type: 'SHOPIFY',
        config: {
          path: ['shopDomain'],
          equals: shopDomain,
        },
      },
    });

    return channel;
  }

  /**
   * Extract event ID from payload
   *
   * For most events, the ID is in payload.id
   * For inventory_levels, use inventory_item_id + location_id
   */
  private extractEventId(payload: any, eventType: string): string {
    if (eventType === 'inventory_levels/update') {
      return `${payload.inventory_item_id}-${payload.location_id}-${Date.now()}`;
    }

    return payload.id?.toString() || `unknown-${Date.now()}`;
  }
}
