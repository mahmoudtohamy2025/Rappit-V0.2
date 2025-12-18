import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import * as crypto from 'crypto';

/**
 * Channel Connection Service
 *
 * Manages channel connections with secure credential storage.
 *
 * Features:
 * - CRUD operations for channel connections
 * - Encrypted credential storage
 * - Credential validation
 * - Webhook secret generation
 * - OAuth token management
 */
@Injectable()
export class ChannelConnectionService {
  private readonly logger = new Logger(ChannelConnectionService.name);

  // Encryption key from environment (in production, use KMS or secure vault)
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-gcm';

  constructor(private prisma: PrismaService) {
    // Get encryption key from environment
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateDefaultKey();

    if (!process.env.ENCRYPTION_KEY) {
      this.logger.warn(
        'ENCRYPTION_KEY not set in environment. Using default key (NOT SECURE FOR PRODUCTION)',
      );
    }
  }

  /**
   * Generate default encryption key (DEV ONLY)
   */
  private generateDefaultKey(): string {
    // In production, NEVER use a default key
    // Use AWS KMS, HashiCorp Vault, or similar
    return crypto
      .createHash('sha256')
      .update('rappit-dev-encryption-key')
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Create channel connection
   *
   * @param organizationId - Organization ID
   * @param data - Channel data
   * @returns Created channel
   */
  async createConnection(
    organizationId: string,
    data: {
      name: string;
      type: 'SHOPIFY' | 'WOOCOMMERCE';
      credentials: {
        // Shopify
        shopDomain?: string;
        accessToken?: string;
        // WooCommerce
        siteUrl?: string;
        consumerKey?: string;
        consumerSecret?: string;
      };
      webhookSecret?: string;
    },
  ) {
    this.logger.log(
      `Creating ${data.type} connection for organization ${organizationId}`,
    );

    // Validate credentials based on type
    this.validateCredentials(data.type, data.credentials);

    // Encrypt sensitive credentials
    const encryptedConfig = this.encryptCredentials({
      ...data.credentials,
      webhookSecret: data.webhookSecret || this.generateWebhookSecret(),
    });

    // Create channel
    const channel = await this.prisma.channel.create({
      data: {
        organizationId,
        name: data.name,
        type: data.type,
        config: encryptedConfig,
        isActive: true,
      },
    });

    this.logger.log(`Channel connection created: ${channel.id}`);

    return channel;
  }

  /**
   * Update channel connection
   *
   * @param channelId - Channel ID
   * @param organizationId - Organization ID (for security)
   * @param data - Update data
   */
  async updateConnection(
    channelId: string,
    organizationId: string,
    data: {
      name?: string;
      credentials?: Record<string, any>;
      webhookSecret?: string;
      isActive?: boolean;
    },
  ) {
    this.logger.log(`Updating channel connection: ${channelId}`);

    // Get existing channel
    const channel = await this.getConnection(channelId, organizationId);

    // Decrypt existing config
    const existingConfig = this.decryptCredentials(channel.config);

    // Merge credentials
    const newConfig = {
      ...existingConfig,
      ...data.credentials,
    };

    if (data.webhookSecret) {
      newConfig.webhookSecret = data.webhookSecret;
    }

    // Encrypt updated config
    const encryptedConfig = this.encryptCredentials(newConfig);

    // Update channel
    const updated = await this.prisma.channel.update({
      where: {
        id: channelId,
        organizationId, // Ensure org ownership
      },
      data: {
        name: data.name,
        config: encryptedConfig,
        isActive: data.isActive,
      },
    });

    this.logger.log(`Channel connection updated: ${channelId}`);

    return updated;
  }

  /**
   * Get channel connection
   *
   * @param channelId - Channel ID
   * @param organizationId - Organization ID (for security)
   * @returns Channel with decrypted credentials
   */
  async getConnection(channelId: string, organizationId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: {
        id: channelId,
        organizationId, // Ensure org ownership
      },
    });

    if (!channel) {
      throw new NotFoundException(`Channel not found: ${channelId}`);
    }

    return channel;
  }

  /**
   * Get decrypted credentials
   *
   * @param channelId - Channel ID
   * @param organizationId - Organization ID (for security)
   * @returns Decrypted credentials
   */
  async getCredentials(channelId: string, organizationId: string) {
    const channel = await this.getConnection(channelId, organizationId);
    return this.decryptCredentials(channel.config);
  }

  /**
   * Delete channel connection
   *
   * @param channelId - Channel ID
   * @param organizationId - Organization ID (for security)
   */
  async deleteConnection(channelId: string, organizationId: string) {
    this.logger.log(`Deleting channel connection: ${channelId}`);

    await this.prisma.channel.delete({
      where: {
        id: channelId,
        organizationId, // Ensure org ownership
      },
    });

    this.logger.log(`Channel connection deleted: ${channelId}`);
  }

  /**
   * List channel connections
   *
   * @param organizationId - Organization ID
   * @param type - Filter by type
   * @returns List of channels (credentials NOT decrypted for list view)
   */
  async listConnections(organizationId: string, type?: string) {
    return this.prisma.channel.findMany({
      where: {
        organizationId,
        type: type as any,
      },
      select: {
        id: true,
        name: true,
        type: true,
        isActive: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
        // DO NOT include config in list view for security
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Validate credentials
   */
  private validateCredentials(
    type: string,
    credentials: Record<string, any>,
  ): void {
    if (type === 'SHOPIFY') {
      if (!credentials.shopDomain || !credentials.accessToken) {
        throw new BadRequestException(
          'Shopify credentials require shopDomain and accessToken',
        );
      }

      // Validate shop domain format
      if (!credentials.shopDomain.includes('.myshopify.com')) {
        throw new BadRequestException(
          'Invalid Shopify shop domain. Must include .myshopify.com',
        );
      }
    } else if (type === 'WOOCOMMERCE') {
      if (!credentials.siteUrl || !credentials.consumerKey || !credentials.consumerSecret) {
        throw new BadRequestException(
          'WooCommerce credentials require siteUrl, consumerKey, and consumerSecret',
        );
      }

      // Validate site URL format
      try {
        new URL(credentials.siteUrl);
      } catch (error) {
        throw new BadRequestException('Invalid WooCommerce site URL');
      }
    } else {
      throw new BadRequestException(`Unknown channel type: ${type}`);
    }
  }

  /**
   * Encrypt credentials
   *
   * Uses AES-256-GCM for encryption.
   * In production, use AWS KMS or similar for key management.
   */
  private encryptCredentials(credentials: Record<string, any>): any {
    const text = JSON.stringify(credentials);

    // Generate IV (Initialization Vector)
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipheriv(
      this.algorithm,
      Buffer.from(this.encryptionKey, 'hex'),
      iv,
    );

    // Encrypt
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Return encrypted data with IV and auth tag
    return {
      encrypted: true,
      data: encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt credentials
   */
  private decryptCredentials(encryptedConfig: any): Record<string, any> {
    // Check if already decrypted (for backward compatibility)
    if (!encryptedConfig.encrypted) {
      return encryptedConfig;
    }

    try {
      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        Buffer.from(this.encryptionKey, 'hex'),
        Buffer.from(encryptedConfig.iv, 'hex'),
      );

      // Set auth tag
      decipher.setAuthTag(Buffer.from(encryptedConfig.authTag, 'hex'));

      // Decrypt
      let decrypted = decipher.update(encryptedConfig.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      this.logger.error(`Failed to decrypt credentials: ${error.message}`);
      throw new Error('Failed to decrypt credentials');
    }
  }

  /**
   * Generate webhook secret
   */
  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Test connection (validate credentials with external API)
   *
   * @param channelId - Channel ID
   * @param organizationId - Organization ID
   * @returns Test result
   *
   * TODO: Implement actual API validation calls
   */
  async testConnection(
    channelId: string,
    organizationId: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Testing connection: ${channelId}`);

    const channel = await this.getConnection(channelId, organizationId);
    const credentials = this.decryptCredentials(channel.config);

    // TODO: Implement actual API test based on channel type
    // For Shopify: GET /admin/api/2024-01/shop.json
    // For WooCommerce: GET /wp-json/wc/v3/system_status

    if (channel.type === 'SHOPIFY') {
      // TODO: Test Shopify connection
      // const response = await axios.get(
      //   `https://${credentials.shopDomain}/admin/api/2024-01/shop.json`,
      //   {
      //     headers: {
      //       'X-Shopify-Access-Token': credentials.accessToken,
      //     },
      //   },
      // );
      //
      // return {
      //   success: response.status === 200,
      //   message: 'Connected to Shopify successfully',
      // };

      return {
        success: true,
        message: 'Shopify connection test not implemented (stub)',
      };
    } else if (channel.type === 'WOOCOMMERCE') {
      // TODO: Test WooCommerce connection
      return {
        success: true,
        message: 'WooCommerce connection test not implemented (stub)',
      };
    }

    return {
      success: false,
      message: 'Unknown channel type',
    };
  }

  /**
   * Rotate webhook secret
   *
   * @param channelId - Channel ID
   * @param organizationId - Organization ID
   * @returns New webhook secret
   */
  async rotateWebhookSecret(
    channelId: string,
    organizationId: string,
  ): Promise<string> {
    this.logger.log(`Rotating webhook secret for channel: ${channelId}`);

    const newSecret = this.generateWebhookSecret();

    await this.updateConnection(channelId, organizationId, {
      webhookSecret: newSecret,
    });

    return newSecret;
  }
}
