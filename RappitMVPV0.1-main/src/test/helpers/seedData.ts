import { PrismaClient, UserRole, ChannelType, ActorType } from '@prisma/client';
import { hash } from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seed minimal organization + user
 */
export async function seedOrganizationAndUser(prisma: PrismaClient) {
  const org = await prisma.organization.create({
    data: {
      id: `org-${uuidv4()}`,
      name: 'Test Organization',
      slug: `test-org-${Date.now()}`,
      createdAt: new Date(),
    },
  });

  const passwordHash = await hash('password123', 10);

  const user = await prisma.user.create({
    data: {
      id: `user-${uuidv4()}`,
      organizationId: org.id,
      email: `test-${Date.now()}@example.com`,
      passwordHash,
      role: UserRole.ADMIN,
      name: 'Test User',
    },
  });

  return { org, user };
}

/**
 * Seed Shopify channel
 */
export async function seedShopifyChannel(
  prisma: PrismaClient,
  orgId: string,
) {
  const channel = await prisma.channel.create({
    data: {
      id: `channel-${uuidv4()}`,
      organizationId: orgId,
      name: 'Test Shopify Store',
      channelType: ChannelType.SHOPIFY,
      isActive: true,
    },
  });

  const connection = await prisma.channelConnection.create({
    data: {
      id: `conn-${uuidv4()}`,
      channelId: channel.id,
      credentials: {
        shopUrl: 'test-store.myshopify.com',
        accessToken: 'test-access-token',
      },
      webhookSecret: 'test-webhook-secret',
      isActive: true,
    },
  });

  return { channel, connection };
}

/**
 * Seed WooCommerce channel
 */
export async function seedWooCommerceChannel(
  prisma: PrismaClient,
  orgId: string,
) {
  const channel = await prisma.channel.create({
    data: {
      id: `channel-${uuidv4()}`,
      organizationId: orgId,
      name: 'Test WooCommerce Store',
      channelType: ChannelType.WOOCOMMERCE,
      isActive: true,
    },
  });

  const connection = await prisma.channelConnection.create({
    data: {
      id: `conn-${uuidv4()}`,
      channelId: channel.id,
      credentials: {
        siteUrl: 'https://test-store.com',
        consumerKey: 'ck_test',
        consumerSecret: 'cs_test',
      },
      webhookSecret: 'woo-webhook-secret',
      isActive: true,
    },
  });

  return { channel, connection };
}

/**
 * Seed SKU with inventory
 */
export async function seedSku(
  prisma: PrismaClient,
  orgId: string,
  overrides: Partial<{
    sku: string;
    name: string;
    quantityOnHand: number;
    reserved: number;
  }> = {},
) {
  const sku = await prisma.sku.create({
    data: {
      id: `sku-${uuidv4()}`,
      organizationId: orgId,
      sku: overrides.sku || `SKU-${Date.now()}`,
      name: overrides.name || 'Test Product',
      quantityOnHand: overrides.quantityOnHand ?? 100,
      reserved: overrides.reserved ?? 0,
    },
  });

  return sku;
}

/**
 * Seed shipping account (DHL)
 */
export async function seedShippingAccount(
  prisma: PrismaClient,
  orgId: string,
  carrier: 'DHL' | 'FEDEX' = 'DHL',
) {
  const account = await prisma.shippingAccount.create({
    data: {
      id: `shipping-${uuidv4()}`,
      organizationId: orgId,
      name: `Test ${carrier} Account`,
      carrierType: carrier,
      credentials: {
        apiKey: 'test-api-key',
        apiSecret: 'test-api-secret',
        accountNumber: '123456789',
      },
      testMode: true,
      isActive: true,
    },
  });

  return account;
}

/**
 * Build Shopify order payload (webhook)
 */
export function buildShopifyOrderPayload(overrides: any = {}) {
  return {
    id: overrides.id || 123456789,
    order_number: overrides.order_number || 1001,
    email: overrides.email || 'customer@example.com',
    created_at: overrides.created_at || new Date().toISOString(),
    updated_at: overrides.updated_at || new Date().toISOString(),
    total_price: overrides.total_price || '99.99',
    subtotal_price: overrides.subtotal_price || '89.99',
    total_tax: overrides.total_tax || '10.00',
    currency: overrides.currency || 'SAR',
    financial_status: overrides.financial_status || 'paid',
    fulfillment_status: overrides.fulfillment_status || null,
    line_items: overrides.line_items || [
      {
        id: 987654321,
        variant_id: 111222333,
        title: 'Test Product',
        quantity: 2,
        sku: 'SKU-TEST-001',
        price: '44.99',
        vendor: 'Test Vendor',
        product_id: 444555666,
      },
    ],
    shipping_address: overrides.shipping_address || {
      first_name: 'Ahmed',
      last_name: 'Ali',
      address1: '123 King Fahd Road',
      address2: 'Apt 4B',
      city: 'Riyadh',
      province: 'Riyadh Region',
      country: 'Saudi Arabia',
      zip: '12345',
      phone: '+966501234567',
      company: null,
    },
    customer: overrides.customer || {
      id: 777888999,
      email: 'customer@example.com',
      first_name: 'Ahmed',
      last_name: 'Ali',
    },
  };
}

/**
 * Build WooCommerce order payload (webhook)
 */
export function buildWooCommerceOrderPayload(overrides: any = {}) {
  return {
    id: overrides.id || 789,
    order_key: overrides.order_key || 'wc_order_abc123',
    number: overrides.number || '789',
    status: overrides.status || 'processing',
    currency: overrides.currency || 'SAR',
    date_created: overrides.date_created || new Date().toISOString(),
    date_modified: overrides.date_modified || new Date().toISOString(),
    total: overrides.total || '99.99',
    subtotal: overrides.subtotal || '89.99',
    total_tax: overrides.total_tax || '10.00',
    customer_id: overrides.customer_id || 123,
    billing: overrides.billing || {
      first_name: 'Ahmed',
      last_name: 'Ali',
      company: '',
      address_1: '123 King Fahd Road',
      address_2: 'Apt 4B',
      city: 'Riyadh',
      state: 'Riyadh Region',
      postcode: '12345',
      country: 'SA',
      email: 'customer@example.com',
      phone: '+966501234567',
    },
    shipping: overrides.shipping || {
      first_name: 'Ahmed',
      last_name: 'Ali',
      company: '',
      address_1: '123 King Fahd Road',
      address_2: 'Apt 4B',
      city: 'Riyadh',
      state: 'Riyadh Region',
      postcode: '12345',
      country: 'SA',
    },
    line_items: overrides.line_items || [
      {
        id: 456,
        name: 'Test Product',
        product_id: 101,
        variation_id: 0,
        quantity: 2,
        sku: 'SKU-TEST-001',
        price: 44.99,
        total: '89.98',
      },
    ],
  };
}

/**
 * Create order in database
 */
export async function seedOrder(
  prisma: PrismaClient,
  orgId: string,
  channelId: string,
  skuId: string,
  overrides: any = {},
) {
  // Create shipping address
  const shippingAddress = await prisma.shippingAddress.create({
    data: {
      firstName: 'Ahmed',
      lastName: 'Ali',
      street1: '123 King Fahd Road',
      street2: 'Apt 4B',
      city: 'Riyadh',
      postalCode: '12345',
      country: 'SA',
      phone: '+966501234567',
    },
  });

  // Create order
  const order = await prisma.order.create({
    data: {
      id: `order-${uuidv4()}`,
      organizationId: orgId,
      channelId,
      orderNumber: overrides.orderNumber || `ORD-${Date.now()}`,
      channelOrderId: overrides.channelOrderId || `EXT-${Date.now()}`,
      status: overrides.status || 'NEW',
      financialStatus: overrides.financialStatus || 'paid',
      totalAmount: overrides.totalAmount || 99.99,
      currency: overrides.currency || 'SAR',
      shippingAddressId: shippingAddress.id,
    },
  });

  // Create order item
  const orderItem = await prisma.orderItem.create({
    data: {
      id: `item-${uuidv4()}`,
      orderId: order.id,
      skuId,
      quantity: overrides.quantity || 2,
      price: overrides.price || 44.99,
      productName: overrides.productName || 'Test Product',
    },
  });

  return { order, orderItem, shippingAddress };
}
