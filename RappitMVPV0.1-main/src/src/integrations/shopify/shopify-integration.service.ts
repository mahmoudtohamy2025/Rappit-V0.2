import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { OrdersService } from '@modules/orders/orders.service';
import { CreateOrderFromChannelDto } from '@modules/orders/dto/create-order-from-channel.dto';
import { ActorType } from '@common/enums/actor-type.enum';
import { ShopifyClient } from './shopify-client';
import {
  ShopifyProduct,
  ShopifyOrder,
  ShopifyInventoryLevel,
  ShopifyProductsResponse,
  ShopifyOrdersResponse,
  ShopifyInventoryLevelsResponse,
  CreateShopifyFulfillmentRequest,
} from './shopify.types';
import {
  SHOPIFY_CONFIG,
  SHOPIFY_PAYMENT_STATUS_MAP,
  mapShopifyStatusToOrderStatus,
  SHOPIFY_METADATA_KEYS,
  SHOPIFY_ERROR_MESSAGES,
} from './shopify.constants';

/**
 * Shopify Integration Service
 *
 * Handles Shopify API integration including:
 * - Product sync
 * - Order sync and mapping
 * - Inventory sync
 * - Fulfillment creation
 * - Webhook registration
 */
@Injectable()
export class ShopifyIntegrationService {
  private readonly logger = new Logger(ShopifyIntegrationService.name);

  constructor(
    private prisma: PrismaService,
    private shopifyClient: ShopifyClient,
    private ordersService: OrdersService,
  ) {}

  /**
   * Sync products from Shopify
   *
   * Fetches products from Shopify API and creates/updates internal Product and SKU records.
   *
   * @param channelId - Channel ID
   * @param sinceTimestamp - Only sync products updated since this timestamp
   */
  async syncProductsForChannel(
    channelId: string,
    sinceTimestamp?: string,
  ): Promise<{ productsProcessed: number; skusCreated: number }> {
    this.logger.log(
      `Syncing products for channel ${channelId} since ${sinceTimestamp || 'beginning'}`,
    );

    // Get channel configuration
    const channel = await this.getChannel(channelId);
    const { shopDomain, accessToken } = this.extractCredentials(channel.config);

    // Build client config
    const clientConfig = {
      shopDomain,
      accessToken,
      organizationId: channel.organizationId,
      channelId: channel.id,
    };

    // Build params
    const params: Record<string, string> = {
      limit: String(SHOPIFY_CONFIG.PAGINATION_LIMIT),
    };
    if (sinceTimestamp) {
      params.updated_at_min = sinceTimestamp;
    }

    // Fetch all products (handles pagination)
    const products = await this.shopifyClient.fetchAllPages<ShopifyProduct>(
      clientConfig,
      `/admin/api/${SHOPIFY_CONFIG.API_VERSION}/products.json`,
      params,
    );

    this.logger.log(`Fetched ${products.length} products from Shopify`);

    let skusCreated = 0;

    // Process each product
    for (const shopifyProduct of products) {
      const result = await this.mapAndSaveProduct(
        channelId,
        channel.organizationId,
        shopifyProduct,
      );
      skusCreated += result.skusCreated;
    }

    // Update last sync timestamp
    await this.updateChannelLastSync(channelId);

    this.logger.log(
      `Product sync complete: ${products.length} products, ${skusCreated} SKUs`,
    );

    return {
      productsProcessed: products.length,
      skusCreated,
    };
  }

  /**
   * Sync orders from Shopify
   *
   * Fetches orders from Shopify API and creates internal Order records.
   *
   * @param channelId - Channel ID
   * @param sinceTimestamp - Only sync orders created since this timestamp
   */
  async syncOrdersForChannel(
    channelId: string,
    sinceTimestamp?: string,
  ): Promise<{ ordersProcessed: number; ordersFailed: number }> {
    this.logger.log(
      `Syncing orders for channel ${channelId} since ${sinceTimestamp || 'beginning'}`,
    );

    // Get channel configuration
    const channel = await this.getChannel(channelId);
    const { shopDomain, accessToken } = this.extractCredentials(channel.config);

    // Build client config
    const clientConfig = {
      shopDomain,
      accessToken,
      organizationId: channel.organizationId,
      channelId: channel.id,
    };

    // Build params
    const params: Record<string, string> = {
      status: 'any',
      limit: String(SHOPIFY_CONFIG.PAGINATION_LIMIT),
    };
    if (sinceTimestamp) {
      params.updated_at_min = sinceTimestamp;
    } else if (channel.lastSyncAt) {
      params.updated_at_min = channel.lastSyncAt.toISOString();
    }

    // Fetch all orders (handles pagination)
    const orders = await this.shopifyClient.fetchAllPages<ShopifyOrder>(
      clientConfig,
      `/admin/api/${SHOPIFY_CONFIG.API_VERSION}/orders.json`,
      params,
    );

    this.logger.log(`Fetched ${orders.length} orders from Shopify`);

    let ordersProcessed = 0;
    let ordersFailed = 0;

    // Process each order
    for (const shopifyOrder of orders) {
      try {
        const orderDto = await this.mapExternalOrderToInternal(
          channelId,
          shopifyOrder,
        );

        await this.ordersService.createOrUpdateOrderFromChannelPayload(
          orderDto,
          channel.organizationId,
          ActorType.SYSTEM,
          channelId,
        );

        ordersProcessed++;
      } catch (error) {
        this.logger.error(
          `Failed to process Shopify order ${shopifyOrder.id}: ${error.message}`,
          error.stack,
        );
        ordersFailed++;
      }
    }

    // Update last sync timestamp
    await this.updateChannelLastSync(channelId);

    this.logger.log(
      `Order sync complete: ${ordersProcessed} succeeded, ${ordersFailed} failed`,
    );

    return {
      ordersProcessed,
      ordersFailed,
    };
  }

  /**
   * Map external Shopify order to internal DTO
   *
   * Transforms Shopify order payload into CreateOrderFromChannelDto format.
   *
   * @param channelId - Channel ID
   * @param externalOrder - Raw Shopify order payload
   * @returns Mapped order DTO
   */
  async mapExternalOrderToInternal(
    channelId: string,
    externalOrder: ShopifyOrder,
  ): Promise<CreateOrderFromChannelDto> {
    this.logger.log(`Mapping Shopify order ${externalOrder.id} to internal format`);

    const channel = await this.getChannel(channelId);

    // Map customer
    const customer = {
      externalId: externalOrder.customer?.id?.toString() || externalOrder.id.toString(),
      firstName: externalOrder.customer?.first_name || externalOrder.shipping_address?.first_name || 'Guest',
      lastName: externalOrder.customer?.last_name || externalOrder.shipping_address?.last_name || 'Customer',
      email: externalOrder.customer?.email || externalOrder.email,
      phone: externalOrder.customer?.phone || externalOrder.phone,
      metadata: {
        shopify_customer_id: externalOrder.customer?.id,
      },
    };

    // Map shipping address
    const shippingAddress = externalOrder.shipping_address ? {
      firstName: externalOrder.shipping_address.first_name,
      lastName: externalOrder.shipping_address.last_name,
      company: externalOrder.shipping_address.company,
      street1: externalOrder.shipping_address.address1,
      street2: externalOrder.shipping_address.address2,
      city: externalOrder.shipping_address.city,
      state: externalOrder.shipping_address.province,
      postalCode: externalOrder.shipping_address.zip,
      country: externalOrder.shipping_address.country_code,
      phone: externalOrder.shipping_address.phone,
    } : {
      firstName: customer.firstName,
      lastName: customer.lastName,
      street1: 'No address provided',
      city: 'Unknown',
      postalCode: '00000',
      country: 'US', // Default fallback
    };

    // Map billing address
    const billingAddress = externalOrder.billing_address ? {
      firstName: externalOrder.billing_address.first_name,
      lastName: externalOrder.billing_address.last_name,
      company: externalOrder.billing_address.company,
      street1: externalOrder.billing_address.address1,
      street2: externalOrder.billing_address.address2,
      city: externalOrder.billing_address.city,
      state: externalOrder.billing_address.province,
      postalCode: externalOrder.billing_address.zip,
      country: externalOrder.billing_address.country_code,
      phone: externalOrder.billing_address.phone,
    } : undefined;

    // Map line items
    const items = await Promise.all(
      externalOrder.line_items.map(async (item: any) => {
        let skuCode: string;
        let skuRecord: { sku: string; id: string } | null = null;

        // Only look up by variant_id if it's provided
        if (item.variant_id) {
          skuRecord = await this.findSkuByShopifyVariantId(item.variant_id, channel.organizationId);
        }

        if (skuRecord) {
          skuCode = skuRecord.sku;
        } else {
          // Fallback: use item SKU or generate one
          skuCode = item.sku || `SHOPIFY-${item.variant_id || item.id}`;
          this.logger.warn(
            `SKU not found for Shopify variant ${item.variant_id}. Using fallback SKU: ${skuCode}`,
          );
        }

        return {
          externalItemId: item.id.toString(),
          sku: skuCode,
          name: item.name,
          variantName: item.variant_title !== 'Default Title' ? item.variant_title : undefined,
          quantity: item.quantity,
          unitPrice: parseFloat(item.price),
          totalPrice: parseFloat(item.price) * item.quantity,
          taxAmount: item.tax_lines?.reduce((sum: number, tax: any) => sum + parseFloat(tax.price), 0) || 0,
          discountAmount: parseFloat(item.total_discount || '0'),
          metadata: {
            shopify_product_id: item.product_id,
            shopify_variant_id: item.variant_id,
          },
        };
      }),
    );

    // Map payment status
    const paymentStatus = this.mapShopifyFinancialStatus(externalOrder.financial_status);

    // Build order DTO
    const orderDto: CreateOrderFromChannelDto = {
      channelId,
      externalOrderId: externalOrder.id.toString(),
      orderNumber: externalOrder.order_number?.toString(),
      customer,
      shippingAddress,
      billingAddress,
      items,
      subtotal: parseFloat(externalOrder.subtotal_price),
      shippingCost: parseFloat(externalOrder.total_shipping_price_set?.shop_money?.amount || '0'),
      taxAmount: parseFloat(externalOrder.total_tax),
      discountAmount: parseFloat(externalOrder.total_discounts || '0'),
      totalAmount: parseFloat(externalOrder.total_price),
      currency: externalOrder.currency,
      paymentStatus,
      customerNote: externalOrder.note,
      tags: externalOrder.tags ? externalOrder.tags.split(', ') : [],
      metadata: {
        shopify_order_id: externalOrder.id,
        shopify_order_number: externalOrder.order_number,
        shopify_fulfillment_status: externalOrder.fulfillment_status,
        shopify_financial_status: externalOrder.financial_status,
        shopify_created_at: externalOrder.created_at,
      },
      orderDate: externalOrder.created_at,
    };

    this.logger.log(`Mapped Shopify order ${externalOrder.id} successfully`);

    return orderDto;
  }

  /**
   * Find SKU by Shopify variant ID
   */
  async findSkuByShopifyVariantId(
    variantId: number,
    organizationId: string,
    channelId?: string,
  ): Promise<{ sku: string; id: string } | null> {
    const skuRecord = await this.prisma.sKU.findFirst({
      where: {
        product: {
          organizationId,
        },
        metadata: {
          path: [SHOPIFY_METADATA_KEYS.VARIANT_ID],
          equals: variantId,
        },
      },
      select: { sku: true, id: true },
    });

    if (!skuRecord) {
      // Log unmapped item
      this.logger.warn(
        `SKU not found for Shopify variant ${variantId} in org ${organizationId}`,
      );

      // Note: UnmappedItem creation would happen during order processing
      // when we have the full context (order ID, item details, etc.)
    }

    return skuRecord;
  }

  /**
   * Map Shopify financial status to payment status
   */
  private mapShopifyFinancialStatus(financialStatus: string): any {
    return SHOPIFY_PAYMENT_STATUS_MAP[financialStatus] || 'PENDING';
  }

  /**
   * Get channel configuration
   */
  private async getChannel(channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    return channel;
  }

  /**
   * Extract credentials from channel config
   */
  private extractCredentials(config: any): { shopDomain: string; accessToken: string } {
    const shopDomain = config.shopDomain || config.shop_domain;
    const accessToken = config.accessToken || config.access_token;

    if (!shopDomain || !accessToken) {
      throw new Error('Missing Shopify credentials (shopDomain, accessToken)');
    }

    return { shopDomain, accessToken };
  }

  /**
   * Update channel last sync timestamp
   */
  private async updateChannelLastSync(channelId: string): Promise<void> {
    await this.prisma.channel.update({
      where: { id: channelId },
      data: { lastSyncAt: new Date() },
    });
  }

  // ============================================================================
  // Additional Sync Methods
  // ============================================================================

  /**
   * Sync inventory levels from Shopify
   */
  async syncInventoryLevels(channelId: string): Promise<void> {
    this.logger.log(`Syncing inventory levels for channel ${channelId}`);

    const channel = await this.getChannel(channelId);
    const { shopDomain, accessToken } = this.extractCredentials(channel.config);

    const clientConfig = {
      shopDomain,
      accessToken,
      organizationId: channel.organizationId,
      channelId: channel.id,
    };

    // Fetch inventory levels
    const inventoryLevels = await this.shopifyClient.fetchAllPages<ShopifyInventoryLevel>(
      clientConfig,
      `/admin/api/${SHOPIFY_CONFIG.API_VERSION}/inventory_levels.json`,
      { limit: String(SHOPIFY_CONFIG.PAGINATION_LIMIT) },
    );

    this.logger.log(`Fetched ${inventoryLevels.length} inventory levels`);

    // Update local inventory levels
    // Note: This is informational only - actual inventory is managed by InventoryService
    for (const level of inventoryLevels) {
      // Find SKU by inventory_item_id
      const sku = await this.prisma.sKU.findFirst({
        where: {
          product: { organizationId: channel.organizationId },
          metadata: {
            path: [SHOPIFY_METADATA_KEYS.INVENTORY_ITEM_ID],
            equals: level.inventory_item_id,
          },
        },
      });

      if (sku) {
        this.logger.debug(
          `Shopify inventory for SKU ${sku.sku}: ${level.available} available`,
        );
        // Could log discrepancies here if needed
      }
    }
  }

  /**
   * Create fulfillment in Shopify
   */
  async createFulfillment(
    channelId: string,
    externalOrderId: string,
    lineItems: Array<{ externalItemId: string; quantity: number }>,
    trackingNumber?: string,
    trackingCompany?: string,
    trackingUrl?: string,
  ): Promise<void> {
    this.logger.log(
      `Creating fulfillment for Shopify order ${externalOrderId}`,
    );

    const channel = await this.getChannel(channelId);
    const { shopDomain, accessToken } = this.extractCredentials(channel.config);

    const clientConfig = {
      shopDomain,
      accessToken,
      organizationId: channel.organizationId,
      channelId: channel.id,
    };

    // Build fulfillment request
    const fulfillmentRequest: CreateShopifyFulfillmentRequest = {
      fulfillment: {
        notify_customer: true,
      },
    };

    // Add tracking info if provided
    if (trackingNumber || trackingCompany || trackingUrl) {
      fulfillmentRequest.fulfillment.tracking_info = {
        number: trackingNumber,
        company: trackingCompany,
        url: trackingUrl,
      };
    }

    // Create fulfillment
    await this.shopifyClient.post(
      clientConfig,
      `/admin/api/${SHOPIFY_CONFIG.API_VERSION}/orders/${externalOrderId}/fulfillments.json`,
      fulfillmentRequest,
    );

    this.logger.log(
      `Fulfillment created for Shopify order ${externalOrderId}`,
    );
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Map and save Shopify product to internal Product and SKU records
   */
  private async mapAndSaveProduct(
    channelId: string,
    organizationId: string,
    shopifyProduct: ShopifyProduct,
  ): Promise<{ skusCreated: number }> {
    return this.prisma.$transaction(async (tx) => {
      // Find existing product by shopify_product_id in metadata
      let product = await tx.product.findFirst({
        where: {
          organizationId,
          channelId,
          metadata: {
            path: [SHOPIFY_METADATA_KEYS.PRODUCT_ID],
            equals: shopifyProduct.id,
          },
        },
      });

      // Create or update product
      if (product) {
        product = await tx.product.update({
          where: { id: product.id },
          data: {
            name: shopifyProduct.title,
            description: shopifyProduct.body_html,
            metadata: {
              [SHOPIFY_METADATA_KEYS.PRODUCT_ID]: shopifyProduct.id,
              vendor: shopifyProduct.vendor,
              product_type: shopifyProduct.product_type,
              tags: shopifyProduct.tags,
            },
          },
        });
      } else {
        product = await tx.product.create({
          data: {
            organizationId,
            channelId,
            name: shopifyProduct.title,
            description: shopifyProduct.body_html,
            metadata: {
              [SHOPIFY_METADATA_KEYS.PRODUCT_ID]: shopifyProduct.id,
              vendor: shopifyProduct.vendor,
              product_type: shopifyProduct.product_type,
              tags: shopifyProduct.tags,
            },
          },
        });
      }

      let skusCreated = 0;

      // Upsert variants as SKUs
      for (const variant of shopifyProduct.variants) {
        const skuCode = variant.sku || `SHOPIFY-${variant.id}`;

        await tx.sKU.upsert({
          where: {
            sku: skuCode,
          },
          create: {
            organizationId,
            productId: product.id,
            sku: skuCode,
            barcode: variant.barcode,
            metadata: {
              [SHOPIFY_METADATA_KEYS.VARIANT_ID]: variant.id,
              [SHOPIFY_METADATA_KEYS.PRODUCT_ID]: shopifyProduct.id,
              [SHOPIFY_METADATA_KEYS.INVENTORY_ITEM_ID]: variant.inventory_item_id,
              variant_title: variant.title,
              price: variant.price,
            },
          },
          update: {
            barcode: variant.barcode,
            metadata: {
              [SHOPIFY_METADATA_KEYS.VARIANT_ID]: variant.id,
              [SHOPIFY_METADATA_KEYS.PRODUCT_ID]: shopifyProduct.id,
              [SHOPIFY_METADATA_KEYS.INVENTORY_ITEM_ID]: variant.inventory_item_id,
              variant_title: variant.title,
              price: variant.price,
            },
          },
        });

        skusCreated++;
      }

      return { skusCreated };
    });
  }
}
