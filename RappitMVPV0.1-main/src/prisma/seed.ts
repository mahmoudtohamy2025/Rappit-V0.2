import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo organization
  const organization = await prisma.organization.create({
    data: {
      name: 'Cairo Electronics Trading',
      settings: {
        currency: 'EGP',
        timezone: 'Africa/Cairo',
        language: 'ar',
        defaultShippingProvider: 'DHL',
      },
    },
  });

  console.log(`✓ Created organization: ${organization.name}`);

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@rappit.demo',
      passwordHash: adminPasswordHash,
      firstName: 'Ahmed',
      lastName: 'Hassan',
      isActive: true,
    },
  });

  // Create admin membership
  await prisma.userOrganization.create({
    data: {
      userId: adminUser.id,
      organizationId: organization.id,
      role: 'ADMIN',
    },
  });

  console.log(`✓ Created admin user: ${adminUser.email}`);

  // Create manager user
  const managerPasswordHash = await bcrypt.hash('manager123', 10);
  const managerUser = await prisma.user.create({
    data: {
      email: 'manager@rappit.demo',
      passwordHash: managerPasswordHash,
      firstName: 'Fatima',
      lastName: 'Ahmed',
      isActive: true,
    },
  });

  // Create manager membership
  await prisma.userOrganization.create({
    data: {
      userId: managerUser.id,
      organizationId: organization.id,
      role: 'MANAGER',
    },
  });

  console.log(`✓ Created manager user: ${managerUser.email}`);

  // Create operator user
  const operatorPasswordHash = await bcrypt.hash('operator123', 10);
  const operatorUser = await prisma.user.create({
    data: {
      email: 'operator@rappit.demo',
      passwordHash: operatorPasswordHash,
      firstName: 'Mohammed',
      lastName: 'Ali',
      isActive: true,
    },
  });

  // Create operator membership
  await prisma.userOrganization.create({
    data: {
      userId: operatorUser.id,
      organizationId: organization.id,
      role: 'OPERATOR',
    },
  });

  console.log(`✓ Created operator user: ${operatorUser.email}`);

  // Create demo Shopify channel
  const shopifyChannel = await prisma.channel.create({
    data: {
      name: 'Main Shopify Store',
      type: 'SHOPIFY',
      organizationId: organization.id,
      config: {
        shopUrl: 'cairo-electronics.myshopify.com',
        accessToken: 'shpat_demo_token_12345',
        apiVersion: '2024-01',
      },
      isActive: true,
    },
  });

  console.log(`✓ Created Shopify channel: ${shopifyChannel.name}`);

  // Create demo WooCommerce channel
  const wooChannel = await prisma.channel.create({
    data: {
      name: 'WooCommerce Store',
      type: 'WOOCOMMERCE',
      organizationId: organization.id,
      config: {
        siteUrl: 'https://shop.cairo-electronics.com',
        consumerKey: 'ck_demo_key',
        consumerSecret: 'cs_demo_secret',
      },
      isActive: true,
    },
  });

  console.log(`✓ Created WooCommerce channel: ${wooChannel.name}`);

  // Create demo products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        organizationId: organization.id,
        channelId: shopifyChannel.id,
        externalProductId: 'shopify-prod-001',
        sku: 'LAPTOP-HP-15',
        title: 'HP Laptop 15-inch',
        description: 'High-performance laptop for business',
        price: 15000.0,
        currency: 'EGP',
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: organization.id,
        channelId: shopifyChannel.id,
        externalProductId: 'shopify-prod-002',
        sku: 'PHONE-SAM-A54',
        title: 'Samsung Galaxy A54',
        description: 'Latest Samsung smartphone',
        price: 12000.0,
        currency: 'EGP',
        isActive: true,
      },
    }),
    prisma.product.create({
      data: {
        organizationId: organization.id,
        channelId: wooChannel.id,
        externalProductId: 'woo-prod-001',
        sku: 'TABLET-IPAD-PRO',
        title: 'iPad Pro 11-inch',
        description: 'Apple iPad Pro tablet',
        price: 25000.0,
        currency: 'EGP',
        isActive: true,
      },
    }),
  ]);

  console.log(`✓ Created ${products.length} products`);

  // Create demo inventory items
  const inventoryItems = await Promise.all([
    prisma.inventoryItem.create({
      data: {
        organizationId: organization.id,
        sku: 'LAPTOP-HP-15',
        name: 'HP Laptop 15-inch',
        quantityTotal: 50,
        quantityAvailable: 45,
        quantityReserved: 5,
        unit: 'unit',
      },
    }),
    prisma.inventoryItem.create({
      data: {
        organizationId: organization.id,
        sku: 'PHONE-SAM-A54',
        name: 'Samsung Galaxy A54',
        quantityTotal: 100,
        quantityAvailable: 92,
        quantityReserved: 8,
        unit: 'unit',
      },
    }),
    prisma.inventoryItem.create({
      data: {
        organizationId: organization.id,
        sku: 'TABLET-IPAD-PRO',
        name: 'iPad Pro 11-inch',
        quantityTotal: 30,
        quantityAvailable: 28,
        quantityReserved: 2,
        unit: 'unit',
      },
    }),
  ]);

  console.log(`✓ Created ${inventoryItems.length} inventory items`);

  // Create demo customer
  const customer = await prisma.customer.create({
    data: {
      organizationId: organization.id,
      channelId: shopifyChannel.id,
      externalCustomerId: 'shopify-cust-001',
      email: 'fatima.khaled@example.com',
      firstName: 'Fatima',
      lastName: 'Khaled',
      phone: '+20 10 1234 5678',
    },
  });

  console.log(`✓ Created demo customer: ${customer.email}`);

  // Create demo shipping account
  const dhlAccount = await prisma.shippingAccount.create({
    data: {
      organizationId: organization.id,
      provider: 'DHL',
      accountNumber: 'DHL-12345-EG',
      config: {
        apiUrl: 'https://api-sandbox.dhl.com',
        apiKey: 'demo-api-key',
        accountId: '12345',
        pickupLocation: 'Cairo Warehouse',
      },
      isActive: true,
    },
  });

  console.log(`✓ Created DHL shipping account`);

  // Create demo orders with different statuses
  const orders = await Promise.all([
    // New order
    prisma.order.create({
      data: {
        organizationId: organization.id,
        channelId: shopifyChannel.id,
        externalOrderId: 'SHOP-001',
        orderNumber: `ORD-${Date.now()}-1`,
        customerId: customer.id,
        customerName: 'Fatima Khaled',
        customerEmail: 'fatima.khaled@example.com',
        customerPhone: '+20 10 1234 5678',
        shippingAddress: {
          street: 'Tahrir Square 123',
          city: 'Cairo',
          state: 'Cairo Governorate',
          postalCode: '11511',
          country: 'Egypt',
        },
        totalAmount: 27000.0,
        currency: 'EGP',
        status: 'NEW',
        createdById: adminUser.id,
        items: {
          create: [
            {
              sku: 'LAPTOP-HP-15',
              name: 'HP Laptop 15-inch',
              quantity: 1,
              unitPrice: 15000.0,
              totalPrice: 15000.0,
            },
            {
              sku: 'PHONE-SAM-A54',
              name: 'Samsung Galaxy A54',
              quantity: 1,
              unitPrice: 12000.0,
              totalPrice: 12000.0,
            },
          ],
        },
      },
    }),
    // Reserved order
    prisma.order.create({
      data: {
        organizationId: organization.id,
        channelId: wooChannel.id,
        externalOrderId: 'WOO-001',
        orderNumber: `ORD-${Date.now()}-2`,
        customerName: 'Ahmed Ibrahim',
        customerEmail: 'ahmed.ibrahim@example.com',
        customerPhone: '+20 11 9876 5432',
        shippingAddress: {
          street: 'Zamalek Street 45',
          city: 'Cairo',
          state: 'Cairo Governorate',
          postalCode: '11211',
          country: 'Egypt',
        },
        totalAmount: 25000.0,
        currency: 'EGP',
        status: 'RESERVED',
        reservedAt: new Date(),
        createdById: adminUser.id,
        items: {
          create: [
            {
              sku: 'TABLET-IPAD-PRO',
              name: 'iPad Pro 11-inch',
              quantity: 1,
              unitPrice: 25000.0,
              totalPrice: 25000.0,
            },
          ],
        },
      },
    }),
  ]);

  console.log(`✓ Created ${orders.length} demo orders`);

  // Create a demo shipment
  const shipment = await prisma.shipment.create({
    data: {
      organizationId: organization.id,
      orderId: orders[1].id,
      shippingAccountId: dhlAccount.id,
      trackingNumber: 'DHL-EG-123456789',
      carrier: 'DHL',
      status: 'IN_TRANSIT',
      shippedAt: new Date(),
      estimatedDeliveryAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
      shippingAddress: {
        street: 'Zamalek Street 45',
        city: 'Cairo',
        state: 'Cairo Governorate',
        postalCode: '11211',
        country: 'Egypt',
      },
      createdById: adminUser.id,
    },
  });

  console.log(`✓ Created demo shipment: ${shipment.trackingNumber}`);

  // Create second organization for multi-tenancy testing
  const org2 = await prisma.organization.create({
    data: {
      name: 'Alexandria Fashion Boutique',
      settings: {
        currency: 'EGP',
        timezone: 'Africa/Cairo',
        language: 'ar',
      },
    },
  });

  // Add admin to second org (multi-tenant test)
  await prisma.userOrganization.create({
    data: {
      userId: adminUser.id,
      organizationId: org2.id,
      role: 'ADMIN',
    },
  });

  console.log(`✓ Created second organization: ${org2.name}`);
  console.log(`✓ Admin user now has access to both organizations`);

  console.log('\n✅ Seeding completed!');
  console.log('\n📝 Demo credentials:');
  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│ Admin:    admin@rappit.demo / admin123          │');
  console.log('│ Manager:  manager@rappit.demo / manager123      │');
  console.log('│ Operator: operator@rappit.demo / operator123    │');
  console.log('└─────────────────────────────────────────────────┘');
  console.log('\n🏢 Organizations:');
  console.log(`   1. ${organization.name} (${organization.id})`);
  console.log(`   2. ${org2.name} (${org2.id})`);
  console.log('\n💡 The admin user belongs to both organizations!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
