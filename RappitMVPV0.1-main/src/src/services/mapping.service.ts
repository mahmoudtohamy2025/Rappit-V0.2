import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';

/**
 * Mapping Service
 *
 * Resolves external SKUs/variant IDs to internal SKU records and tracks unmapped items.
 *
 * Features:
 * - Multi-strategy SKU resolution (exact, fuzzy, metadata)
 * - Confidence scoring
 * - Unmapped item tracking for manual review
 * - Bulk mapping helpers for product sync
 */
@Injectable()
export class MappingService {
  private readonly logger = new Logger(MappingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Resolve external SKU/variant ID to internal SKU
   *
   * Resolution strategies (in order):
   * 1. Exact metadata match (shopify_variant_id, woocommerce_variation_id)
   * 2. SKU string exact match
   * 3. SKU string fuzzy match (case-insensitive, trimmed)
   *
   * @param channelId - Channel ID
   * @param externalSkuOrVariantId - External SKU string or variant ID
   * @param organizationId - Organization ID
   * @returns Object with skuId and confidence (0-100)
   */
  async resolveSkuByExternal(
    channelId: string,
    externalSkuOrVariantId: string | number,
    organizationId: string,
  ): Promise<{ skuId?: string; confidence: number }> {
    if (!externalSkuOrVariantId) {
      return { confidence: 0 };
    }

    const externalValue = externalSkuOrVariantId.toString();

    this.logger.debug(
      `Resolving SKU for channel ${channelId}, external: ${externalValue}`,
    );

    // Get channel to determine type
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { type: true },
    });

    if (!channel) {
      this.logger.warn(`Channel not found: ${channelId}`);
      return { confidence: 0 };
    }

    // Strategy 1: Metadata match (highest confidence)
    const metadataResult = await this.resolveByMetadata(
      organizationId,
      channel.type,
      externalValue,
    );

    if (metadataResult.skuId) {
      this.logger.debug(
        `SKU resolved via metadata: ${metadataResult.skuId} (confidence: ${metadataResult.confidence})`,
      );
      return metadataResult;
    }

    // Strategy 2: Exact SKU string match
    const exactResult = await this.resolveByExactSku(
      organizationId,
      externalValue,
    );

    if (exactResult.skuId) {
      this.logger.debug(
        `SKU resolved via exact match: ${exactResult.skuId} (confidence: ${exactResult.confidence})`,
      );
      return exactResult;
    }

    // Strategy 3: Fuzzy SKU match (case-insensitive, trimmed)
    const fuzzyResult = await this.resolveByFuzzySku(
      organizationId,
      externalValue,
    );

    if (fuzzyResult.skuId) {
      this.logger.debug(
        `SKU resolved via fuzzy match: ${fuzzyResult.skuId} (confidence: ${fuzzyResult.confidence})`,
      );
      return fuzzyResult;
    }

    // No match found
    this.logger.warn(`No SKU match found for external: ${externalValue}`);
    return { confidence: 0 };
  }

  /**
   * Resolve by metadata (variant ID, product ID)
   */
  private async resolveByMetadata(
    organizationId: string,
    channelType: string,
    externalValue: string,
  ): Promise<{ skuId?: string; confidence: number }> {
    // Determine metadata field based on channel type
    const metadataFields =
      channelType === 'SHOPIFY'
        ? ['shopify_variant_id', 'shopify_product_id']
        : ['woocommerce_variation_id', 'woocommerce_product_id'];

    // Try to parse as number (variant/product IDs are usually numeric)
    const numericValue = parseInt(externalValue, 10);
    const searchValue = isNaN(numericValue) ? externalValue : numericValue;

    // Try each metadata field
    for (const field of metadataFields) {
      const sku = await this.prisma.sKU.findFirst({
        where: {
          product: {
            organizationId,
          },
          metadata: {
            path: [field],
            equals: searchValue,
          },
        },
        select: { id: true },
      });

      if (sku) {
        return {
          skuId: sku.id,
          confidence: 100, // Highest confidence - exact metadata match
        };
      }
    }

    return { confidence: 0 };
  }

  /**
   * Resolve by exact SKU string match
   */
  private async resolveByExactSku(
    organizationId: string,
    externalSku: string,
  ): Promise<{ skuId?: string; confidence: number }> {
    const sku = await this.prisma.sKU.findFirst({
      where: {
        product: {
          organizationId,
        },
        sku: externalSku,
      },
      select: { id: true },
    });

    if (sku) {
      return {
        skuId: sku.id,
        confidence: 90, // High confidence - exact SKU match
      };
    }

    return { confidence: 0 };
  }

  /**
   * Resolve by fuzzy SKU match (case-insensitive, trimmed)
   */
  private async resolveByFuzzySku(
    organizationId: string,
    externalSku: string,
  ): Promise<{ skuId?: string; confidence: number }> {
    // Normalize: lowercase, trim, remove extra spaces
    const normalizedExternal = externalSku.toLowerCase().trim().replace(/\s+/g, ' ');

    const skus = await this.prisma.sKU.findMany({
      where: {
        product: {
          organizationId,
        },
      },
      select: { id: true, sku: true },
    });

    // Find fuzzy match
    for (const sku of skus) {
      const normalizedInternal = sku.sku.toLowerCase().trim().replace(/\s+/g, ' ');

      if (normalizedInternal === normalizedExternal) {
        return {
          skuId: sku.id,
          confidence: 70, // Medium confidence - fuzzy match
        };
      }
    }

    return { confidence: 0 };
  }

  /**
   * Report unmapped item for manual review
   *
   * Creates an UnmappedItem record and logs it for admin review.
   * Optionally creates a timeline event on the order if provided.
   *
   * @param item - Item data
   * @param channelId - Channel ID
   * @param externalOrderId - External order ID
   * @param organizationId - Organization ID
   */
  async reportUnmapped(
    item: {
      externalItemId?: string;
      externalSku?: string;
      externalVariantId?: string | number;
      name: string;
      quantity: number;
      metadata?: any;
    },
    channelId: string,
    externalOrderId: string,
    organizationId: string,
  ): Promise<void> {
    this.logger.warn(
      `Unmapped item reported: ${item.name} (SKU: ${item.externalSku}, Variant: ${item.externalVariantId}) for order ${externalOrderId}`,
    );

    // Create UnmappedItem record
    await this.prisma.unmappedItem.create({
      data: {
        organizationId,
        channelId,
        externalOrderId,
        externalItemId: item.externalItemId,
        externalSku: item.externalSku,
        externalVariantId: item.externalVariantId?.toString(),
        itemName: item.name,
        quantity: item.quantity,
        status: 'PENDING',
        metadata: item.metadata || {},
      },
    });

    // TODO: Create timeline event if order exists
    // const order = await this.prisma.order.findFirst({
    //   where: {
    //     organizationId,
    //     channelId,
    //     externalOrderId,
    //   },
    // });
    //
    // if (order) {
    //   await this.prisma.orderTimelineEvent.create({
    //     data: {
    //       organizationId,
    //       orderId: order.id,
    //       event: 'UNMAPPED_ITEM_DETECTED',
    //       actorType: 'SYSTEM',
    //       metadata: {
    //         itemName: item.name,
    //         externalSku: item.externalSku,
    //         externalVariantId: item.externalVariantId,
    //       },
    //     },
    //   });
    // }

    this.logger.log(`Unmapped item logged for manual review: ${item.name}`);
  }

  /**
   * Bulk create SKU mappings
   *
   * Helper for product sync to seed mapping tables.
   * Creates/updates SKUs with external metadata.
   *
   * @param mappings - Array of mapping data
   * @param organizationId - Organization ID
   */
  async bulkCreateMappings(
    mappings: Array<{
      sku: string;
      productId: string;
      shopifyVariantId?: number;
      shopifyProductId?: number;
      woocommerceVariationId?: number;
      woocommerceProductId?: number;
      barcode?: string;
    }>,
    organizationId: string,
  ): Promise<{ created: number; updated: number }> {
    this.logger.log(`Bulk creating ${mappings.length} SKU mappings`);

    let created = 0;
    let updated = 0;

    for (const mapping of mappings) {
      // Build metadata object
      const metadata: any = {};

      if (mapping.shopifyVariantId) {
        metadata.shopify_variant_id = mapping.shopifyVariantId;
      }
      if (mapping.shopifyProductId) {
        metadata.shopify_product_id = mapping.shopifyProductId;
      }
      if (mapping.woocommerceVariationId) {
        metadata.woocommerce_variation_id = mapping.woocommerceVariationId;
      }
      if (mapping.woocommerceProductId) {
        metadata.woocommerce_product_id = mapping.woocommerceProductId;
      }

      // Upsert SKU
      const result = await this.prisma.sKU.upsert({
        where: { sku: mapping.sku },
        create: {
          organizationId,
          productId: mapping.productId,
          sku: mapping.sku,
          barcode: mapping.barcode,
          metadata,
        },
        update: {
          metadata,
          barcode: mapping.barcode,
        },
      });

      if (result) {
        // Check if created or updated (simple heuristic)
        const existing = await this.prisma.sKU.count({
          where: { sku: mapping.sku },
        });

        if (existing === 1) {
          created++;
        } else {
          updated++;
        }
      }
    }

    this.logger.log(
      `Bulk mapping complete: ${created} created, ${updated} updated`,
    );

    return { created, updated };
  }

  /**
   * Get unmapped items for review
   *
   * @param organizationId - Organization ID
   * @param status - Filter by status
   * @param limit - Max results
   */
  async getUnmappedItems(
    organizationId: string,
    status?: string,
    limit: number = 50,
  ) {
    return this.prisma.unmappedItem.findMany({
      where: {
        organizationId,
        status: status as any,
      },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Resolve unmapped item manually
   *
   * @param unmappedItemId - Unmapped item ID
   * @param skuId - Internal SKU ID to map to
   * @param resolvedBy - User ID who resolved it
   * @param resolution - Resolution notes
   */
  async resolveUnmappedItem(
    unmappedItemId: string,
    skuId: string,
    resolvedBy: string,
    resolution?: string,
  ): Promise<void> {
    await this.prisma.unmappedItem.update({
      where: { id: unmappedItemId },
      data: {
        status: 'RESOLVED',
        resolvedSkuId: skuId,
        resolvedBy,
        resolvedAt: new Date(),
        resolution: resolution || 'Manually mapped by admin',
      },
    });

    this.logger.log(
      `Unmapped item ${unmappedItemId} resolved and mapped to SKU ${skuId}`,
    );
  }

  /**
   * Ignore unmapped item
   *
   * @param unmappedItemId - Unmapped item ID
   * @param reason - Reason for ignoring
   */
  async ignoreUnmappedItem(
    unmappedItemId: string,
    reason?: string,
  ): Promise<void> {
    await this.prisma.unmappedItem.update({
      where: { id: unmappedItemId },
      data: {
        status: 'IGNORED',
        resolution: reason || 'Intentionally skipped',
      },
    });

    this.logger.log(`Unmapped item ${unmappedItemId} marked as ignored`);
  }

  /**
   * Get unmapped items statistics
   *
   * @param organizationId - Organization ID
   */
  async getUnmappedStats(organizationId: string) {
    const [total, pending, resolved, ignored, failed] = await Promise.all([
      this.prisma.unmappedItem.count({
        where: { organizationId },
      }),
      this.prisma.unmappedItem.count({
        where: { organizationId, status: 'PENDING' },
      }),
      this.prisma.unmappedItem.count({
        where: { organizationId, status: 'RESOLVED' },
      }),
      this.prisma.unmappedItem.count({
        where: { organizationId, status: 'IGNORED' },
      }),
      this.prisma.unmappedItem.count({
        where: { organizationId, status: 'FAILED' },
      }),
    ]);

    return {
      total,
      pending,
      resolved,
      ignored,
      failed,
      resolutionRate: total > 0 ? (resolved / total) * 100 : 0,
    };
  }
}
