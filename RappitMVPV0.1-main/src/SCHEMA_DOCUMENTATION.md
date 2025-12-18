# Rappit Database Schema Documentation

## Overview

This document describes the PostgreSQL database schema for Rappit MVP, implementing a multi-tenant SaaS architecture for MENA e-commerce operations.

## Design Principles

1. **Multi-Tenancy**: Every domain entity is scoped to `organization_id` for complete data isolation
2. **Audit Trail**: All entities track `created_at` and `updated_at` timestamps
3. **Soft References**: External IDs from integrations stored alongside internal UUIDs
4. **Performance**: Strategic indexes on critical lookup fields (status, tracking numbers, external IDs)
5. **Flexibility**: JSON fields for provider-specific configs and metadata

## Entity Relationship Diagram (ERD) Summary

```
Organizations (1) ──< (N) UserOrganizations (N) >── (1) Users
Organizations (1) ──< (N) Channels
Organizations (1) ──< (N) Products (N) >── (1) Channels
Products (1) ──< (N) SKUs (1) ── (1) InventoryItems
Organizations (1) ──< (N) Customers
Customers (1) ──< (N) Addresses
Orders (N) >── (1) Channels
Orders (N) >── (1) Customers
Orders (1) ──< (N) OrderItems (N) >── (1) SKUs
OrderItems (1) ──< (N) InventoryReservations (N) >── (1) InventoryItems
Orders (1) ──< (N) Shipments (N) >── (1) ShippingAccounts
Shipments (1) ──< (N) ShipmentTrackingEvents
Organizations (1) ──< (N) WebhookEvents
Organizations (1) ──< (N) IntegrationLogs
```

## Core Entities

### Organizations
**Purpose**: Top-level tenant entity for multi-tenancy

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | String | Organization name |
| settings | JSON | Org-wide settings (currency, timezone, language) |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**Indexes**: `created_at`

---

### Users
**Purpose**: Platform users who can belong to multiple organizations

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| email | String | Unique email (login credential) |
| password_hash | String | Bcrypt hashed password |
| first_name | String | |
| last_name | String | |
| is_active | Boolean | Account status |
| last_login_at | Timestamp | Last successful login |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**Indexes**: `email`, `is_active`

**Unique Constraints**: `email`

---

### UserOrganizations
**Purpose**: Many-to-many relationship between users and organizations with role assignment

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to users |
| organization_id | UUID | FK to organizations |
| role | Enum | ADMIN, MANAGER, OPERATOR |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**Indexes**: `organization_id`, `user_id`

**Unique Constraints**: `(user_id, organization_id)`

**Roles**:
- `ADMIN`: Full access to organization
- `MANAGER`: Can manage operations and users
- `OPERATOR`: Can execute day-to-day operations only

---

## Sales Channels

### Channels
**Purpose**: Sales channel integrations (Shopify, WooCommerce)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| name | String | Channel display name |
| type | Enum | SHOPIFY, WOOCOMMERCE |
| config | JSON | API credentials, store URL, etc. |
| is_active | Boolean | Channel status |
| last_sync_at | Timestamp | Last successful sync |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**Indexes**: `organization_id`, `(organization_id, type)`, `(organization_id, is_active)`

**Config Structure**:
```json
// Shopify
{
  "shopUrl": "store.myshopify.com",
  "accessToken": "shpat_xxxxx",
  "apiVersion": "2024-01"
}

// WooCommerce
{
  "siteUrl": "https://example.com",
  "consumerKey": "ck_xxxxx",
  "consumerSecret": "cs_xxxxx"
}
```

---

## Products & Inventory

### Products
**Purpose**: Product catalog (can be imported from channels or manually created)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| channel_id | UUID | FK to channels (null if manual) |
| external_id | String | Product ID from channel |
| name | String | Product name |
| description | Text | Product description |
| category | String | Product category |
| brand | String | Brand name |
| image_url | String | Main product image |
| metadata | JSON | Additional attributes |
| is_active | Boolean | Product status |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**Indexes**: `organization_id`, `(organization_id, is_active)`, `external_id`

**Unique Constraints**: `(organization_id, channel_id, external_id)`

---

### SKUs
**Purpose**: Product variants/SKUs with pricing and inventory tracking

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| product_id | UUID | FK to products |
| sku | String | SKU code (globally unique) |
| name | String | Variant name (e.g., "Size M - Red") |
| barcode | String | Barcode/UPC/EAN |
| price | Decimal(10,2) | Current price |
| compare_at_price | Decimal(10,2) | Original/MSRP price |
| weight | Decimal(10,3) | Weight in kg |
| dimensions | JSON | {length, width, height} in cm |
| metadata | JSON | Additional attributes |
| is_active | Boolean | SKU status |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**Indexes**: `product_id`, `sku`, `barcode`

**Unique Constraints**: `sku`

---

### InventoryItems
**Purpose**: Inventory tracking per SKU (Model C: auto-reserve on import)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| sku_id | UUID | FK to skus (one-to-one) |
| quantity_total | Integer | Total inventory count |
| quantity_available | Integer | Available = Total - Reserved |
| quantity_reserved | Integer | Reserved for orders |
| reorder_point | Integer | Low stock alert threshold |
| reorder_quantity | Integer | Suggested reorder quantity |
| location_bin | String | Warehouse location |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**Indexes**: `organization_id`, `(organization_id, quantity_available)`

**Unique Constraints**: `sku_id`

**Business Rule**: `quantity_available = quantity_total - quantity_reserved`

---

### InventoryReservations
**Purpose**: Track Model C inventory reservations (auto-reserve on order import)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| inventory_item_id | UUID | FK to inventory_items |
| order_id | UUID | FK to orders |
| order_item_id | UUID | FK to order_items |
| quantity_reserved | Integer | Quantity reserved |
| reserved_at | Timestamp | When reservation was created |
| released_at | Timestamp | When reservation was released |
| reason | String | Release reason (cancelled, returned, delivered) |

**Indexes**: `inventory_item_id`, `order_id`, `order_item_id`, `reserved_at`

**Lifecycle**:
1. Created when order imported (status: NEW → RESERVED)
2. Released when order cancelled/returned
3. Marked complete when order delivered (inventory deducted)

---

### InventoryAdjustments
**Purpose**: Audit trail for all inventory changes

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| inventory_item_id | UUID | FK to inventory_items |
| user_id | UUID | FK to users (who made adjustment) |
| type | Enum | PURCHASE, SALE, RETURN, DAMAGE, LOSS, CORRECTION, TRANSFER |
| quantity_change | Integer | Change amount (can be negative) |
| reason | String | Reason for adjustment |
| reference_type | String | "order", "shipment", "manual" |
| reference_id | String | ID of referenced entity |
| notes | Text | Additional notes |
| created_at | Timestamp | |

**Indexes**: `organization_id`, `inventory_item_id`, `created_at`, `(reference_type, reference_id)`

---

## Customers & Addresses

### Customers
**Purpose**: Customer records (imported from channels or manually created)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| external_id | String | Customer ID from channel |
| first_name | String | |
| last_name | String | |
| email | String | Contact email |
| phone | String | Contact phone |
| metadata | JSON | Additional customer data |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**Indexes**: `organization_id`, `(organization_id, email)`, `(organization_id, phone)`

**Unique Constraints**: `(organization_id, external_id)`

---

### Addresses
**Purpose**: Customer addresses (shipping/billing)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| customer_id | UUID | FK to customers |
| type | Enum | SHIPPING, BILLING, BOTH |
| first_name | String | Recipient name |
| last_name | String | Recipient surname |
| company | String | Company name |
| street_1 | String | Street address line 1 |
| street_2 | String | Street address line 2 |
| city | String | City |
| state | String | State/Province |
| postal_code | String | Postal code |
| country | String | ISO 3166-1 alpha-2 (SA, AE, etc.) |
| phone | String | Contact phone |
| is_default | Boolean | Default address flag |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**Indexes**: `customer_id`, `(customer_id, type)`

---

## Orders

### Orders
**Purpose**: Order management with 11-state lifecycle

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| channel_id | UUID | FK to channels |
| customer_id | UUID | FK to customers |
| shipping_address_id | UUID | FK to addresses |
| billing_address_id | UUID | FK to addresses (nullable) |
| external_order_id | String | Order ID from channel |
| order_number | String | Our internal order number |
| status | Enum | Order status (11 states) |
| payment_status | Enum | Payment status |
| subtotal | Decimal(10,2) | Items subtotal |
| shipping_cost | Decimal(10,2) | Shipping charges |
| tax_amount | Decimal(10,2) | Tax amount |
| discount_amount | Decimal(10,2) | Discount amount |
| total_amount | Decimal(10,2) | Grand total |
| currency | String | Currency code (default: SAR) |
| customer_note | Text | Customer's note |
| internal_notes | Text | Internal operations notes |
| tags | String[] | Searchable tags |
| metadata | JSON | Additional order data |
| imported_at | Timestamp | When imported from channel |
| reserved_at | Timestamp | When inventory reserved |
| ready_to_ship_at | Timestamp | When ready for shipment |
| shipped_at | Timestamp | When shipped |
| delivered_at | Timestamp | When delivered |
| cancelled_at | Timestamp | When cancelled |
| returned_at | Timestamp | When returned |
| created_by_id | UUID | FK to users |
| updated_by_id | UUID | FK to users |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**Indexes**: `organization_id`, `(organization_id, status)`, `(organization_id, channel_id)`, `(organization_id, customer_id)`, `channel_id`, `external_order_id`, `order_number`, `status`, `created_at`, `imported_at`

**Unique Constraints**: `order_number`, `(organization_id, channel_id, external_order_id)`

**11-State Order Lifecycle**:
1. **NEW** - Order imported from sales channel
2. **RESERVED** - Inventory auto-reserved (Model C)
3. **READY_TO_SHIP** - Payment confirmed, ready for shipment creation
4. **LABEL_CREATED** - Shipping label generated
5. **PICKED_UP** - Picked up by carrier
6. **IN_TRANSIT** - In transit to customer
7. **OUT_FOR_DELIVERY** - Out for delivery
8. **DELIVERED** - Successfully delivered
9. **CANCELLED** - Order cancelled (inventory released)
10. **FAILED** - Delivery failed
11. **RETURNED** - Order returned (inventory released)

**Payment Statuses**: PENDING, AUTHORIZED, PAID, PARTIALLY_REFUNDED, REFUNDED, FAILED

---

### OrderItems
**Purpose**: Line items within an order

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| order_id | UUID | FK to orders |
| sku_id | UUID | FK to skus |
| external_item_id | String | Item ID from channel |
| name | String | Product name at order time |
| variant_name | String | Variant description |
| quantity | Integer | Quantity ordered |
| unit_price | Decimal(10,2) | Price per unit |
| total_price | Decimal(10,2) | Line total |
| tax_amount | Decimal(10,2) | Tax for this line |
| discount_amount | Decimal(10,2) | Discount for this line |
| metadata | JSON | Additional item data |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**Indexes**: `order_id`, `sku_id`

---

## Shipping

### ShippingAccounts
**Purpose**: DHL/FedEx account credentials per organization

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| provider | Enum | DHL, FEDEX |
| account_name | String | Account display name |
| account_number | String | Carrier account number |
| credentials | JSON | Encrypted API keys/secrets |
| config | JSON | Provider-specific settings |
| is_active | Boolean | Account status |
| is_default | Boolean | Default account for provider |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**Indexes**: `organization_id`, `(organization_id, provider)`, `(organization_id, is_active)`

**Security Note**: `credentials` field should be encrypted at application level before storage

---

### Shipments
**Purpose**: Shipment tracking and label management

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| order_id | UUID | FK to orders |
| shipping_account_id | UUID | FK to shipping_accounts |
| address_id | UUID | FK to addresses |
| tracking_number | String | Carrier tracking number |
| external_shipment_id | String | Provider's shipment ID |
| status | Enum | Shipment status |
| provider | Enum | DHL, FEDEX |
| service_type | String | Service level (express, economy) |
| weight | Decimal(10,3) | Total weight in kg |
| dimensions | JSON | Package dimensions |
| number_of_packages | Integer | Number of packages |
| label_url | String | PDF label URL |
| label_format | String | Label format (PDF, ZPL) |
| shipping_cost | Decimal(10,2) | Actual shipping cost |
| currency | String | Currency code |
| estimated_delivery | Timestamp | Estimated delivery date |
| picked_up_at | Timestamp | Actual pickup time |
| delivered_at | Timestamp | Actual delivery time |
| cancelled_at | Timestamp | Cancellation time |
| metadata | JSON | Additional shipment data |
| internal_notes | Text | Internal notes |
| created_by_id | UUID | FK to users |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**Indexes**: `organization_id`, `(organization_id, status)`, `order_id`, `tracking_number`, `status`, `created_at`

**Unique Constraints**: `tracking_number`

**Shipment Statuses**: PENDING, LABEL_CREATED, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED, CANCELLED, RETURNED

---

### ShipmentTrackingEvents
**Purpose**: Tracking event history from carriers

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| shipment_id | UUID | FK to shipments |
| status | String | Event status code |
| location | String | Event location |
| description | Text | Event description |
| event_time | Timestamp | When event occurred |
| metadata | JSON | Provider-specific event data |
| created_at | Timestamp | When event was recorded |

**Indexes**: `shipment_id`, `(shipment_id, event_time)`

---

## Integration & Logging

### WebhookEvents
**Purpose**: Incoming webhook events from integrations

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| channel_id | UUID | FK to channels (nullable) |
| source | Enum | SHOPIFY, WOOCOMMERCE, DHL, FEDEX |
| event_type | String | Event type (order.created, etc.) |
| external_id | String | External event/resource ID |
| payload | JSON | Raw webhook payload |
| status | Enum | Processing status |
| processed_at | Timestamp | When successfully processed |
| failure_reason | Text | Error message if failed |
| retry_count | Integer | Number of retry attempts |
| metadata | JSON | Processing metadata |
| received_at | Timestamp | When webhook received |
| created_at | Timestamp | |
| updated_at | Timestamp | |

**Indexes**: `organization_id`, `(organization_id, status)`, `channel_id`, `source`, `event_type`, `status`, `received_at`

**Webhook Statuses**: PENDING, PROCESSING, PROCESSED, FAILED, IGNORED

**Common Event Types**:
- Shopify: `orders/create`, `orders/updated`, `orders/cancelled`
- WooCommerce: `order.created`, `order.updated`
- DHL/FedEx: `shipment.tracking`, `shipment.delivered`

---

### IntegrationLogs
**Purpose**: Audit trail for all external API calls

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| organization_id | UUID | FK to organizations |
| channel_id | UUID | FK to channels (nullable) |
| integration | Enum | SHOPIFY, WOOCOMMERCE, DHL, FEDEX |
| action | String | Action performed |
| direction | Enum | OUTBOUND (our request), INBOUND (webhook) |
| request_url | String | API endpoint URL |
| request_method | String | HTTP method |
| request_headers | JSON | Request headers |
| request_body | JSON | Request payload |
| response_status | Integer | HTTP status code |
| response_headers | JSON | Response headers |
| response_body | JSON | Response payload |
| error_message | Text | Error message if failed |
| duration | Integer | Request duration in ms |
| metadata | JSON | Additional log data |
| created_at | Timestamp | |

**Indexes**: `organization_id`, `(organization_id, integration)`, `channel_id`, `integration`, `action`, `created_at`

**Common Actions**:
- `fetch_order`, `create_order`, `update_order`
- `create_shipment`, `track_shipment`, `cancel_shipment`
- `create_webhook`, `verify_webhook`

---

## Data Retention & Archival

**Recommended Retention Policies**:
- **Orders**: 7 years (compliance)
- **Shipments**: 2 years
- **Inventory Adjustments**: 3 years
- **Webhook Events**: 90 days (archive after 30 days)
- **Integration Logs**: 30 days (archive after 7 days)

**Archival Strategy**: Move old records to separate archive tables or cold storage

---

## Performance Considerations

### Critical Indexes
All critical lookup patterns are indexed:
- Multi-tenant queries: `organization_id` on all tenant-scoped tables
- Status filtering: `status` fields for orders, shipments, webhooks
- External ID lookups: `external_order_id`, `tracking_number`, `external_id`
- Time-based queries: `created_at`, `imported_at`, `reserved_at`

### Query Optimization Tips
1. Always filter by `organization_id` first (partition by tenant)
2. Use composite indexes for common filter combinations
3. Consider partitioning large tables by `created_at` for time-series data
4. Use `EXPLAIN ANALYZE` for query optimization

### Scaling Considerations
- Use read replicas for reporting queries
- Implement caching (Redis) for frequently accessed data
- Consider table partitioning for orders/logs when exceeding 10M records
- Archive old data regularly

---

## Security & Compliance

### Multi-Tenancy Enforcement
- Row-level security at application level via Prisma middleware
- All queries automatically scoped to `organization_id`
- Foreign key constraints prevent cross-tenant references

### Data Encryption
- Password hashes use bcrypt (cost factor: 10)
- API credentials in `credentials` JSON fields should be encrypted
- Consider PostgreSQL encryption at rest for production

### PII Fields
Fields containing personally identifiable information:
- Users: `email`, `first_name`, `last_name`
- Customers: `email`, `phone`, `first_name`, `last_name`
- Addresses: All fields

**GDPR Compliance**: Implement data export and deletion workflows for customer data

---

## Migration Strategy

### Initial Setup
```bash
# Generate Prisma client
npm run prisma:generate

# Run migration
npm run prisma:migrate deploy

# Seed demo data (optional)
npm run prisma:seed
```

### Schema Changes
1. Update `schema.prisma`
2. Create migration: `npx prisma migrate dev --name description_of_change`
3. Review generated SQL in `prisma/migrations/`
4. Test migration on staging
5. Deploy to production: `npx prisma migrate deploy`

### Rollback Strategy
Keep database backups before migrations. PostgreSQL transactions ensure atomic migrations.

---

## Future Schema Enhancements

**Potential Additions**:
1. **Returns Management**: `Return`, `ReturnItem` tables for RMA workflow
2. **Warehouse Management**: `Warehouse`, `WarehouseLocation` for multi-location inventory
3. **Promotions**: `Discount`, `Coupon` tables for promotional campaigns
4. **Analytics**: Pre-aggregated tables for reporting performance
5. **Multi-Currency**: Enhanced currency support with exchange rates
6. **Product Bundles**: Support for product bundles/kits
7. **Serial Numbers**: Batch/serial number tracking for specific SKUs
8. **Notifications**: `Notification` table for in-app alerts

---

**Document Version**: 1.0
**Last Updated**: 2024-12-11
**Schema Version**: Initial Migration
