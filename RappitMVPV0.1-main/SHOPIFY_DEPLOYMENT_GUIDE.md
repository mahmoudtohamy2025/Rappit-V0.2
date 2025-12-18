# Shopify Integration - Comprehensive Deployment Guide

This guide provides detailed, step-by-step instructions for deploying and testing the Shopify integration in production.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1: Environment Configuration](#step-1-environment-configuration)
3. [Step 2: Configure Shopify App](#step-2-configure-shopify-app)
4. [Step 3: Database Setup](#step-3-database-setup)
5. [Step 4: Deploy Application](#step-4-deploy-application)
6. [Step 5: Create Test Channel](#step-5-create-test-channel)
7. [Step 6: Testing & Verification](#step-6-testing--verification)
8. [Step 7: Monitoring](#step-7-monitoring)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting deployment, ensure you have:

- [ ] Access to Shopify Partner account (or test store)
- [ ] Database credentials (PostgreSQL)
- [ ] Redis instance running
- [ ] API domain/URL where the application will be hosted
- [ ] SSL certificate configured (required for webhooks)

---

## Step 1: Environment Configuration

### 1.1 Create/Update .env File

Create a `.env` file in the project root with the following variables:

```env
# Database (Required)
DATABASE_URL=postgresql://username:password@host:5432/rappit_db

# Redis (Required)
REDIS_URL=redis://localhost:6379

# JWT Authentication (Required)
JWT_SECRET=your_secure_random_jwt_secret_min_32_chars
JWT_EXPIRATION=7d

# Application (Required)
NODE_ENV=production
PORT=3000
APP_URL=https://your-domain.com
CORS_ORIGIN=https://your-frontend.com

# API Configuration
API_PREFIX=api/v1

# Shopify Integration (Required)
SHOPIFY_API_KEY=your_shopify_api_key_here
SHOPIFY_API_SECRET=your_shopify_api_secret_here
SHOPIFY_API_VERSION=2024-01
SHOPIFY_RATE_LIMIT_PER_SECOND=2
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret_from_shopify_app

# WooCommerce Integration (Optional)
WOOCOMMERCE_CONSUMER_KEY=your_consumer_key
WOOCOMMERCE_CONSUMER_SECRET=your_consumer_secret

# DHL Shipping (Optional)
DHL_API_KEY=your_dhl_api_key
DHL_API_SECRET=your_dhl_api_secret
DHL_ACCOUNT_NUMBER=your_dhl_account_number

# FedEx Shipping (Optional)
FEDEX_API_KEY=your_fedex_api_key
FEDEX_SECRET_KEY=your_fedex_secret_key
FEDEX_ACCOUNT_NUMBER=your_fedex_account_number

# Observability
LOG_LEVEL=info
```

### 1.2 Generate Secure Secrets

Generate secure random strings for JWT_SECRET:

```bash
# Generate JWT secret (32+ characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use openssl
openssl rand -hex 32
```

### 1.3 Validate Environment Variables

Create a validation script to check all required variables are set:

```bash
#!/bin/bash
# validate-env.sh

required_vars=(
  "DATABASE_URL"
  "REDIS_URL"
  "JWT_SECRET"
  "APP_URL"
  "SHOPIFY_API_KEY"
  "SHOPIFY_API_SECRET"
)

missing_vars=()

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
  echo "❌ Missing required environment variables:"
  printf '  - %s\n' "${missing_vars[@]}"
  exit 1
else
  echo "✅ All required environment variables are set"
fi
```

Run validation:
```bash
chmod +x validate-env.sh
./validate-env.sh
```

---

## Step 2: Configure Shopify App

### 2.1 Create Shopify App (Partner Dashboard)

1. **Go to Shopify Partner Dashboard**
   - URL: https://partners.shopify.com/
   - Navigate to Apps → Create app

2. **App Configuration**
   - **App name**: Rappit Integration
   - **App URL**: `https://your-domain.com`
   - **Allowed redirection URL(s)**: `https://your-domain.com/auth/shopify/callback`

3. **API Scopes** (Required Permissions)
   Select these scopes in your app settings:
   - `read_products` - Read product data
   - `write_products` - Update product data
   - `read_orders` - Read order data
   - `write_orders` - Update order data
   - `read_inventory` - Read inventory levels
   - `write_inventory` - Update inventory levels
   - `read_fulfillments` - Read fulfillment data
   - `write_fulfillments` - Create fulfillments
   - `read_customers` - Read customer data
   - `read_locations` - Read location data

4. **Copy Credentials**
   - Copy **API key** → Use as `SHOPIFY_API_KEY`
   - Copy **API secret key** → Use as `SHOPIFY_API_SECRET`

### 2.2 Install App on Test Store

1. **Create Development Store** (if needed)
   - Partners Dashboard → Stores → Add store
   - Select "Development store"
   - Fill in store details

2. **Install Your App**
   - In Partner Dashboard, select your app
   - Click "Select store" → Choose your test store
   - Approve permissions

3. **Generate Access Token**
   - After installation, copy the **Access Token**
   - This will be used in channel configuration (next section)

### 2.3 Configure Webhooks in Shopify

Set up webhooks to receive real-time updates:

1. **Go to Your App Settings** in Partner Dashboard
2. **Navigate to Webhooks section**
3. **Add the following webhooks:**

| Topic | URL | Format |
|-------|-----|--------|
| `orders/create` | `https://your-domain.com/api/v1/webhooks/shopify/orders/create` | JSON |
| `orders/updated` | `https://your-domain.com/api/v1/webhooks/shopify/orders/updated` | JSON |
| `orders/cancelled` | `https://your-domain.com/api/v1/webhooks/shopify/orders/cancelled` | JSON |
| `fulfillments/create` | `https://your-domain.com/api/v1/webhooks/shopify/fulfillments/create` | JSON |
| `fulfillments/update` | `https://your-domain.com/api/v1/webhooks/shopify/fulfillments/update` | JSON |
| `inventory_levels/update` | `https://your-domain.com/api/v1/webhooks/shopify/inventory_levels/update` | JSON |

4. **Copy Webhook Signing Secret**
   - Copy the signing secret shown after webhook creation
   - Use this as `SHOPIFY_WEBHOOK_SECRET` in your .env file

### 2.4 Test Webhook Delivery

After deployment, test webhook delivery:

```bash
# Use Shopify's webhook testing feature
# Or manually trigger events in your test store
```

---

## Step 3: Database Setup

### 3.1 Run Prisma Migrations

Ensure your database schema is up to date:

```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Verify migration status
npx prisma migrate status
```

### 3.2 Verify Database Schema

Check that all required tables exist:

```sql
-- Connect to your database
psql $DATABASE_URL

-- Check for required tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'organizations',
  'channels',
  'products',
  'skus',
  'orders',
  'order_items',
  'inventory_levels',
  'integration_logs',
  'processed_webhook_events',
  'unmapped_items'
);

-- Should return all 10 tables
```

### 3.3 Create Initial Organization

Create a test organization to use for Shopify integration:

```sql
-- Insert test organization
INSERT INTO organizations (id, name, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Test Organization',
  true,
  NOW(),
  NOW()
)
RETURNING id;

-- Save the returned ID for use in channel creation
```

Or use the API:

```bash
curl -X POST https://your-domain.com/api/v1/organizations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Test Organization"
  }'
```

---

## Step 4: Deploy Application

### 4.1 Build Application

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Verify build output
ls -la dist/
```

### 4.2 Start Application

```bash
# Production mode
npm run start:prod

# Or using PM2 (recommended for production)
pm2 start dist/main.js --name rappit-api

# View logs
pm2 logs rappit-api

# Check status
pm2 status
```

### 4.3 Verify Application is Running

```bash
# Health check
curl https://your-domain.com/api/v1/health

# Expected response:
# {
#   "status": "ok",
#   "info": {
#     "database": { "status": "up" },
#     "redis": { "status": "up" }
#   }
# }

# API documentation
open https://your-domain.com/api/docs
```

### 4.4 Verify Scheduler is Running

Check logs to ensure the Shopify sync scheduler has started:

```bash
# Check for scheduler initialization
pm2 logs rappit-api | grep "ShopifySyncScheduler"

# You should see:
# [ShopifySyncScheduler] Starting Shopify sync scheduler
```

---

## Step 5: Create Test Channel

### 5.1 Create Shopify Channel via API

Use the API to create a Shopify channel:

```bash
# Get JWT token first (login)
TOKEN=$(curl -X POST https://your-domain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "your_password"
  }' | jq -r '.access_token')

# Create Shopify channel
curl -X POST https://your-domain.com/api/v1/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Test Shopify Store",
    "type": "SHOPIFY",
    "organizationId": "YOUR_ORG_ID",
    "config": {
      "shopDomain": "your-test-store.myshopify.com",
      "accessToken": "shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "webhookSecret": "your_webhook_secret_optional"
    },
    "isActive": true
  }' | jq '.'

# Save the channel ID from response
```

### 5.2 Verify Channel Creation

```bash
# List channels
curl -X GET https://your-domain.com/api/v1/channels \
  -H "Authorization: Bearer $TOKEN" | jq '.data[]'

# Get specific channel
curl -X GET https://your-domain.com/api/v1/channels/CHANNEL_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### 5.3 Test Channel Connection

```bash
# Trigger a test sync
curl -X POST https://your-domain.com/api/v1/channels/CHANNEL_ID/sync \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "product-sync"
  }' | jq '.'
```

---

## Step 6: Testing & Verification

### 6.1 Test Product Sync

#### 6.1.1 Create Test Products in Shopify

1. **Log in to Shopify Admin**
   - URL: `https://your-test-store.myshopify.com/admin`

2. **Create Test Products**
   - Go to Products → Add product
   - Create 2-3 test products with variants
   - Example:
     - **Product 1**: T-Shirt
       - Variant 1: Small - SKU: TSHIRT-SM
       - Variant 2: Medium - SKU: TSHIRT-MD
       - Variant 3: Large - SKU: TSHIRT-LG
     - **Product 2**: Mug
       - Variant 1: Default - SKU: MUG-001

3. **Wait for Auto Sync** (30 minutes) or **Trigger Manual Sync**

#### 6.1.2 Trigger Manual Product Sync

```bash
# Via API
curl -X POST https://your-domain.com/api/v1/channels/CHANNEL_ID/sync \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "product-sync"
  }'

# Via database (add to job queue)
psql $DATABASE_URL -c "
INSERT INTO bullmq_jobs (queue_name, job_name, data, status)
VALUES (
  'shopify-sync',
  'product-sync-manual',
  '{\"type\":\"product-sync\",\"channelId\":\"YOUR_CHANNEL_ID\",\"organizationId\":\"YOUR_ORG_ID\"}'::jsonb,
  'waiting'
);
"
```

#### 6.1.3 Verify Products Were Synced

```bash
# Check products in database
psql $DATABASE_URL -c "
SELECT p.id, p.name, p.metadata->>'shopify_product_id' as shopify_id
FROM products p
WHERE p.channel_id = 'YOUR_CHANNEL_ID'
ORDER BY p.created_at DESC
LIMIT 10;
"

# Check SKUs in database
psql $DATABASE_URL -c "
SELECT s.sku, s.metadata->>'shopify_variant_id' as variant_id, s.metadata->>'variant_title' as variant_name
FROM skus s
INNER JOIN products p ON s.product_id = p.id
WHERE p.channel_id = 'YOUR_CHANNEL_ID'
ORDER BY s.created_at DESC
LIMIT 20;
"

# Via API
curl -X GET "https://your-domain.com/api/v1/products?channelId=CHANNEL_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.data[]'
```

Expected output:
```
 id                                   | name     | shopify_id
--------------------------------------+----------+------------
 123e4567-e89b-12d3-a456-426614174000 | T-Shirt  | 7234567890
 123e4567-e89b-12d3-a456-426614174001 | Mug      | 7234567891
```

### 6.2 Test Order Sync

#### 6.2.1 Create Test Orders in Shopify

1. **Create Draft Order** in Shopify Admin
   - Go to Orders → Create order
   - Add customer information
   - Add products (use the products you created earlier)
   - Set payment status to "Paid"
   - Mark as "Mark as paid"

2. **Create Multiple Test Orders**
   - Order 1: Single item, paid
   - Order 2: Multiple items, paid
   - Order 3: Single item, pending payment

#### 6.2.2 Trigger Manual Order Sync

```bash
# Via API
curl -X POST https://your-domain.com/api/v1/channels/CHANNEL_ID/sync \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "order-sync"
  }'
```

#### 6.2.3 Verify Orders Were Synced

```bash
# Check orders in database
psql $DATABASE_URL -c "
SELECT
  o.id,
  o.order_number,
  o.status,
  o.payment_status,
  o.total_amount,
  o.metadata->>'shopify_order_id' as shopify_id
FROM orders o
WHERE o.channel_id = 'YOUR_CHANNEL_ID'
ORDER BY o.created_at DESC
LIMIT 10;
"

# Check order items
psql $DATABASE_URL -c "
SELECT
  oi.sku,
  oi.quantity,
  oi.unit_price,
  oi.metadata->>'shopify_variant_id' as variant_id
FROM order_items oi
INNER JOIN orders o ON oi.order_id = o.id
WHERE o.channel_id = 'YOUR_CHANNEL_ID'
ORDER BY oi.created_at DESC
LIMIT 20;
"

# Via API
curl -X GET "https://your-domain.com/api/v1/orders?channelId=CHANNEL_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.data[]'
```

#### 6.2.4 Verify Inventory Reservations

```bash
# Check inventory reservations for orders
psql $DATABASE_URL -c "
SELECT
  ir.id,
  ir.sku,
  ir.quantity,
  ir.reservation_type,
  ir.reference_id,
  o.order_number
FROM inventory_reservations ir
INNER JOIN orders o ON ir.reference_id::text = o.id::text
WHERE o.channel_id = 'YOUR_CHANNEL_ID'
AND ir.released_at IS NULL
ORDER BY ir.created_at DESC
LIMIT 20;
"
```

Expected: Each order item should have a corresponding inventory reservation.

### 6.3 Test Webhook Processing

#### 6.3.1 Create Order via Shopify Storefront

1. **Set up a test storefront** (if not already done)
2. **Add items to cart** and complete checkout
3. **Complete payment**

#### 6.3.2 Verify Webhook Was Received

```bash
# Check processed webhook events
psql $DATABASE_URL -c "
SELECT
  id,
  event_type,
  external_event_id,
  status,
  created_at,
  processed_at
FROM processed_webhook_events
WHERE source = 'shopify'
AND channel_id = 'YOUR_CHANNEL_ID'
ORDER BY created_at DESC
LIMIT 10;
"
```

Expected statuses:
- `ENQUEUED` - Webhook received, queued for processing
- `PROCESSING` - Currently being processed
- `COMPLETED` - Successfully processed
- `FAILED` - Processing failed (check error_message)

#### 6.3.3 Test Order Cancellation

1. **Cancel an order** in Shopify Admin
2. **Wait a few seconds** for webhook processing
3. **Verify order status updated**:

```bash
psql $DATABASE_URL -c "
SELECT id, order_number, status, metadata->>'shopify_order_id'
FROM orders
WHERE channel_id = 'YOUR_CHANNEL_ID'
AND status = 'CANCELLED'
ORDER BY updated_at DESC;
"
```

4. **Verify inventory released**:

```bash
psql $DATABASE_URL -c "
SELECT
  ir.sku,
  ir.quantity,
  ir.released_at
FROM inventory_reservations ir
INNER JOIN orders o ON ir.reference_id::text = o.id::text
WHERE o.status = 'CANCELLED'
AND ir.released_at IS NOT NULL
ORDER BY ir.released_at DESC
LIMIT 10;
"
```

### 6.4 Test Fulfillment Push to Shopify

#### 6.4.1 Create a Shipment in Rappit

```bash
# Create fulfillment for an order
curl -X POST https://your-domain.com/api/v1/orders/ORDER_ID/fulfillments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "trackingNumber": "1Z999AA10123456784",
    "carrier": "UPS",
    "lineItems": [
      {
        "orderItemId": "ORDER_ITEM_ID",
        "quantity": 1
      }
    ]
  }'
```

#### 6.4.2 Verify Fulfillment in Shopify

1. **Go to Shopify Admin** → Orders → Select the order
2. **Check Timeline** - Should show fulfillment created
3. **Check Tracking** - Tracking number should be visible

#### 6.4.3 Verify in Database

```bash
psql $DATABASE_URL -c "
SELECT * FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND endpoint LIKE '%fulfillments%'
ORDER BY created_at DESC
LIMIT 5;
"
```

### 6.5 Load Testing

#### 6.5.1 Test with Multiple Orders

Create 50-100 test orders in Shopify to test bulk sync:

```bash
# Trigger full order sync
curl -X POST https://your-domain.com/api/v1/channels/CHANNEL_ID/sync \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "order-sync",
    "fullSync": true
  }'

# Monitor progress
watch -n 2 "psql $DATABASE_URL -c \"SELECT COUNT(*) FROM orders WHERE channel_id = 'YOUR_CHANNEL_ID';\""
```

#### 6.5.2 Monitor Performance

```bash
# Check integration logs for slow requests
psql $DATABASE_URL -c "
SELECT
  endpoint,
  method,
  AVG(duration_ms) as avg_duration,
  MAX(duration_ms) as max_duration,
  COUNT(*) as request_count
FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY endpoint, method
ORDER BY avg_duration DESC;
"
```

---

## Step 7: Monitoring

### 7.1 Set Up Monitoring Queries

Create a monitoring dashboard or use these SQL queries:

#### 7.1.1 API Call Success Rate

```sql
-- Shopify API success rate (last 24 hours)
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as success_count,
  COUNT(*) FILTER (WHERE status_code >= 400) as error_count,
  COUNT(*) as total_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) / COUNT(*), 2) as success_rate
FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

#### 7.1.2 Rate Limit Violations

```sql
-- Check for 429 (rate limit) errors
SELECT
  endpoint,
  COUNT(*) as rate_limit_count,
  MAX(created_at) as last_occurrence
FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND status_code = 429
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY endpoint
ORDER BY rate_limit_count DESC;
```

#### 7.1.3 Sync Performance

```sql
-- Sync job performance
SELECT
  'product-sync' as sync_type,
  COUNT(*) as total_syncs,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration_seconds
FROM channels
WHERE type = 'SHOPIFY'
AND last_sync_at > NOW() - INTERVAL '24 hours'
UNION ALL
SELECT
  'order-sync' as sync_type,
  COUNT(*) as orders_synced,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration_seconds
FROM orders
WHERE channel_id IN (SELECT id FROM channels WHERE type = 'SHOPIFY')
AND created_at > NOW() - INTERVAL '24 hours';
```

#### 7.1.4 Webhook Processing

```sql
-- Webhook processing status
SELECT
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_processing_time_seconds
FROM processed_webhook_events
WHERE source = 'shopify'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

#### 7.1.5 Failed Syncs

```sql
-- Recent failed syncs
SELECT
  il.endpoint,
  il.method,
  il.status_code,
  il.error_message,
  il.created_at
FROM integration_logs il
WHERE il.integration_type = 'SHOPIFY'
AND il.status_code >= 400
AND il.created_at > NOW() - INTERVAL '24 hours'
ORDER BY il.created_at DESC
LIMIT 20;
```

### 7.2 Set Up Alerts

Configure alerts for critical issues:

#### 7.2.1 High Error Rate Alert

```sql
-- Alert if error rate > 10% in last hour
SELECT
  COUNT(*) FILTER (WHERE status_code >= 400) * 100.0 / COUNT(*) as error_rate
FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND created_at > NOW() - INTERVAL '1 hour'
HAVING COUNT(*) FILTER (WHERE status_code >= 400) * 100.0 / COUNT(*) > 10;
```

#### 7.2.2 Sync Lag Alert

```sql
-- Alert if last sync is more than 1 hour old
SELECT
  id,
  name,
  last_sync_at,
  NOW() - last_sync_at as time_since_last_sync
FROM channels
WHERE type = 'SHOPIFY'
AND is_active = true
AND (last_sync_at IS NULL OR last_sync_at < NOW() - INTERVAL '1 hour');
```

#### 7.2.3 Authentication Error Alert

```sql
-- Alert on authentication errors (401, 403)
SELECT
  channel_id,
  COUNT(*) as auth_error_count
FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND status_code IN (401, 403)
AND created_at > NOW() - INTERVAL '15 minutes'
GROUP BY channel_id
HAVING COUNT(*) > 0;
```

### 7.3 Application Logs

Monitor application logs for scheduler activity:

```bash
# Watch logs in real-time
pm2 logs rappit-api --lines 100

# Filter for Shopify-related logs
pm2 logs rappit-api | grep -i shopify

# Filter for sync scheduler
pm2 logs rappit-api | grep "ShopifySyncScheduler"

# Filter for errors
pm2 logs rappit-api | grep -i error
```

Expected log patterns:
- Every 5 minutes: `Starting scheduled order sync for all active Shopify channels`
- Every 30 minutes: `Starting scheduled product sync for all active Shopify channels`
- Every hour: `Starting scheduled inventory sync for all active Shopify channels`

### 7.4 Create Monitoring Dashboard

Example dashboard queries for visualization tools (Grafana, etc.):

```sql
-- Metrics for dashboard

-- 1. Total orders synced today
SELECT COUNT(*) FROM orders
WHERE channel_id IN (SELECT id FROM channels WHERE type = 'SHOPIFY')
AND DATE(created_at) = CURRENT_DATE;

-- 2. Total products synced
SELECT COUNT(*) FROM products
WHERE channel_id IN (SELECT id FROM channels WHERE type = 'SHOPIFY');

-- 3. Active channels
SELECT COUNT(*) FROM channels
WHERE type = 'SHOPIFY' AND is_active = true;

-- 4. API calls in last hour
SELECT COUNT(*) FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND created_at > NOW() - INTERVAL '1 hour';

-- 5. Average response time
SELECT AVG(duration_ms) FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND created_at > NOW() - INTERVAL '1 hour';
```

---

## Troubleshooting

### Issue: Products Not Syncing

**Symptoms:**
- No products appearing in database after sync
- Integration logs show successful API calls but no database records

**Debugging Steps:**

1. **Check channel configuration:**
```sql
SELECT id, name, config, is_active, last_sync_at
FROM channels
WHERE type = 'SHOPIFY';
```

2. **Verify API credentials:**
```bash
# Test API connection manually
curl -X GET "https://your-store.myshopify.com/admin/api/2024-01/products.json?limit=1" \
  -H "X-Shopify-Access-Token: YOUR_ACCESS_TOKEN"
```

3. **Check integration logs for errors:**
```sql
SELECT * FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND endpoint LIKE '%products%'
ORDER BY created_at DESC
LIMIT 10;
```

4. **Check worker is running:**
```bash
# Check if worker is processing jobs
pm2 logs rappit-api | grep "ShopifyWorker"
```

**Solutions:**
- Verify `accessToken` in channel config is correct
- Check API scopes include `read_products`
- Ensure worker is running: `pm2 restart rappit-api`

### Issue: Orders Not Creating Inventory Reservations

**Symptoms:**
- Orders sync successfully but no inventory reservations created

**Debugging Steps:**

1. **Check order status:**
```sql
SELECT id, order_number, status, payment_status
FROM orders
WHERE channel_id = 'YOUR_CHANNEL_ID'
ORDER BY created_at DESC;
```

2. **Check OrdersService logic:**
```sql
-- Orders that should have reservations
SELECT o.id, o.order_number, o.status, o.payment_status
FROM orders o
LEFT JOIN inventory_reservations ir ON ir.reference_id::text = o.id::text
WHERE o.channel_id = 'YOUR_CHANNEL_ID'
AND o.status IN ('RESERVED', 'CONFIRMED')
AND ir.id IS NULL;
```

**Solutions:**
- Verify order status is triggering reservation (should be RESERVED or higher)
- Check OrdersService.createOrUpdateOrderFromChannelPayload logic
- Ensure InventoryService is properly injected

### Issue: Webhooks Not Being Received

**Symptoms:**
- Orders created in Shopify don't appear in database immediately
- ProcessedWebhookEvent table is empty

**Debugging Steps:**

1. **Verify webhook configuration in Shopify:**
   - Go to Shopify Partner Dashboard → Your App → Webhooks
   - Check URLs are correct
   - Check webhook status (should be "Active")

2. **Test webhook endpoint:**
```bash
# Test endpoint is accessible
curl -I https://your-domain.com/api/v1/webhooks/shopify/orders/create
```

3. **Check webhook logs in Shopify:**
   - Partner Dashboard → Your App → Webhooks → Click on webhook → View logs
   - Look for delivery failures

4. **Check HMAC verification:**
```bash
# Check application logs for HMAC errors
pm2 logs rappit-api | grep "HMAC"
```

**Solutions:**
- Verify `SHOPIFY_WEBHOOK_SECRET` matches Shopify configuration
- Ensure SSL certificate is valid (webhooks require HTTPS)
- Check firewall allows Shopify IPs
- Verify webhook URLs have no trailing slashes

### Issue: Rate Limit Errors (429)

**Symptoms:**
- Integration logs show 429 status codes
- Sync jobs taking very long

**Debugging Steps:**

1. **Check rate limit violations:**
```sql
SELECT
  DATE_TRUNC('minute', created_at) as minute,
  COUNT(*) as error_count
FROM integration_logs
WHERE integration_type = 'SHOPIFY'
AND status_code = 429
AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY DATE_TRUNC('minute', created_at)
ORDER BY minute DESC;
```

2. **Check concurrent sync jobs:**
```bash
# Check if multiple sync jobs running
ps aux | grep "shopify"
```

**Solutions:**
- Verify `SHOPIFY_RATE_LIMIT_PER_SECOND=2` in .env
- Ensure only one instance of application is running
- Consider reducing sync frequency in scheduler
- Check for any manual sync jobs running concurrently

### Issue: SKU Not Found Warnings

**Symptoms:**
- Logs show "SKU not found for Shopify variant X"
- Orders import with fallback SKUs like "SHOPIFY-123456"

**Debugging Steps:**

1. **Check if products were synced:**
```sql
SELECT COUNT(*) FROM products
WHERE channel_id = 'YOUR_CHANNEL_ID';
```

2. **Check SKU metadata:**
```sql
SELECT sku, metadata->>'shopify_variant_id' as variant_id
FROM skus
WHERE metadata->>'shopify_variant_id' IS NOT NULL
LIMIT 10;
```

3. **Find unmapped variants:**
```sql
-- Check which variants are missing
SELECT DISTINCT
  oi.metadata->>'shopify_variant_id' as variant_id,
  oi.sku
FROM order_items oi
INNER JOIN orders o ON oi.order_id = o.id
WHERE o.channel_id = 'YOUR_CHANNEL_ID'
AND oi.sku LIKE 'SHOPIFY-%';
```

**Solutions:**
- Run product sync before order sync
- Verify products have variants in Shopify
- Check SKU codes are unique and valid
- Manually create SKUs for specific variants if needed

### Issue: Authentication Errors (401, 403)

**Symptoms:**
- Integration logs show 401 or 403 errors
- Sync jobs fail immediately

**Debugging Steps:**

1. **Verify access token:**
```bash
# Test token validity
curl -X GET "https://your-store.myshopify.com/admin/api/2024-01/shop.json" \
  -H "X-Shopify-Access-Token: YOUR_ACCESS_TOKEN"
```

2. **Check token scopes:**
   - Go to Shopify Admin → Apps → Your App
   - Verify all required scopes are granted

**Solutions:**
- Regenerate access token if expired
- Reinstall app on Shopify store
- Update channel config with new access token
- Verify API version is supported (2024-01)

---

## Additional Resources

### Shopify API Documentation
- [REST Admin API Reference](https://shopify.dev/api/admin-rest)
- [Webhook Topics](https://shopify.dev/api/admin-rest/2024-01/resources/webhook#event-topics)
- [Rate Limits](https://shopify.dev/api/usage/rate-limits)

### Internal Documentation
- [SHOPIFY_INTEGRATION_SUMMARY.md](./SHOPIFY_INTEGRATION_SUMMARY.md) - Implementation overview
- [Schema Documentation](./SCHEMA_DOCUMENTATION.md) - Database schema details

### Support Contacts
- Technical issues: [Create GitHub issue](https://github.com/mahmoudtohamy2025/RappitMVPV0.1/issues)
- Shopify Partner support: https://partners.shopify.com/

---

## Deployment Checklist

Use this checklist to ensure all steps are completed:

- [ ] Environment variables configured in .env
- [ ] JWT secret generated and set
- [ ] Database migrations run successfully
- [ ] Redis instance running and accessible
- [ ] Application deployed and running (PM2 or similar)
- [ ] Health check endpoint responding
- [ ] Shopify app created in Partner Dashboard
- [ ] API scopes configured correctly
- [ ] Webhooks registered in Shopify
- [ ] Test organization created
- [ ] Test Shopify channel created
- [ ] Product sync tested and verified
- [ ] Order sync tested and verified
- [ ] Webhook delivery tested
- [ ] Inventory reservations verified
- [ ] Fulfillment push tested
- [ ] Monitoring queries set up
- [ ] Alert thresholds configured
- [ ] Application logs monitored
- [ ] Load testing completed
- [ ] Documentation reviewed with team

---

**Deployment Status: Ready for Production** ✅

Last updated: 2025-12-13
