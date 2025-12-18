# Rappit Backend

Multi-tenant SaaS operations hub for MENA e-commerce merchants. Centralizes order management, automates inventory reservation, enables one-click shipment creation with integrated labels and tracking across Shopify, WooCommerce, DHL, and FedEx.

## 🔐 Authentication System - READY!

**The complete authentication, authorization, and multi-tenancy system is now implemented and working!**

### Quick Start

```bash
# Run automated setup (sets up database, migrations, seed data)
chmod +x setup-auth.sh
./setup-auth.sh

# Start development server
npm run start:dev
```

### Demo Credentials (after seeding)

| Email | Password | Role |
|-------|----------|------|
| admin@rappit.demo | admin123 | ADMIN |
| manager@rappit.demo | manager123 | MANAGER |
| operator@rappit.demo | operator123 | OPERATOR |

### Documentation

- 📘 **[QUICK_START.md](./QUICK_START.md)** - Get started in 2 minutes
- 📗 **[AUTH_TESTING.md](./AUTH_TESTING.md)** - Complete API testing guide
- 📙 **[AUTH_IMPLEMENTATION.md](./AUTH_IMPLEMENTATION.md)** - Developer implementation guide
- 📕 **[AUTH_SUMMARY.md](./AUTH_SUMMARY.md)** - Implementation summary
- ✅ **[IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)** - What's implemented

### Test Files

- **test-auth.http** - HTTP test file (use with REST Client extension)
- **setup-auth.sh** - Automated setup script

---

## Features

- 🔐 **Authentication & Authorization** - JWT-based auth with role-based access control (RBAC)
- 👥 **Multi-tenant Architecture** - Complete organization isolation with automatic scoping
- 🎭 **Role-Based Access Control** - ADMIN, MANAGER, OPERATOR roles
- 📦 **Order Management** - Unified 11-state lifecycle from "New" to "Delivered/Returned/Cancelled"
- 📊 **Inventory Management** - Model C auto-reserve on import, release on cancel/return
- 🚚 **Shipping Integration** - One-click shipment creation with DHL and FedEx
- 🛒 **Sales Channels** - Shopify and WooCommerce integration
- 🔄 **Webhooks** - Real-time order and tracking updates
- ⚡ **Async Processing** - BullMQ job queues for reliable background tasks
- 🌍 **Arabic-First** - Designed for MENA region with RTL support

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis + BullMQ
- **Authentication**: JWT with Passport
- **Documentation**: Swagger/OpenAPI
- **Validation**: class-validator + class-transformer

## Project Structure

```
src/
├── common/                    # Shared utilities
│   ├── database/              # Prisma service
│   ├── decorators/            # Custom decorators
│   ├── guards/                # Auth guards
│   └── health/                # Health checks
├── config/                    # Configuration files
├── modules/
│   ├── auth/                  # Authentication
│   ├── users/                 # User management
│   ├── organizations/         # Organization management
│   ├── channels/              # Sales channels (Shopify/WooCommerce)
│   ├── orders/                # Order management
│   ├── inventory/             # Inventory & reservations
│   ├── shipping/              # Shipment management
│   ├── webhooks/              # Webhook handlers
│   ├── jobs/                  # Background job processors
│   └── integrations/
│       ├── shopify/           # Shopify API integration
│       ├── woocommerce/       # WooCommerce API integration
│       ├── dhl/               # DHL API integration
│       └── fedex/             # FedEx API integration
└── prisma/
    └── schema.prisma          # Database schema
```

## Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- Redis >= 6

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your credentials
```

### Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Seed database
npm run prisma:seed

# (Optional) Open Prisma Studio
npm run prisma:studio
```

### Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

The API will be available at:
- **API**: http://localhost:3000/api/v1
- **Swagger Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/v1/health

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register organization & admin user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user

### Organizations
- `GET /api/v1/organizations/me` - Get current organization
- `PATCH /api/v1/organizations/me` - Update organization

### Users
- `POST /api/v1/users` - Create user
- `GET /api/v1/users` - List users
- `GET /api/v1/users/:id` - Get user
- `PATCH /api/v1/users/:id` - Update user
- `DELETE /api/v1/users/:id` - Delete user

### Channels
- `POST /api/v1/channels` - Create channel
- `GET /api/v1/channels` - List channels
- `GET /api/v1/channels/:id` - Get channel
- `PATCH /api/v1/channels/:id` - Update channel
- `DELETE /api/v1/channels/:id` - Delete channel
- `POST /api/v1/channels/:id/test` - Test connection

### Orders
- `POST /api/v1/orders` - Create order
- `GET /api/v1/orders` - List orders (with filters)
- `GET /api/v1/orders/:id` - Get order details
- `PATCH /api/v1/orders/:id` - Update order
- `PATCH /api/v1/orders/:id/status` - Update order status
- `DELETE /api/v1/orders/:id` - Cancel order

### Inventory
- `POST /api/v1/inventory` - Create inventory item
- `GET /api/v1/inventory` - List inventory
- `GET /api/v1/inventory/:id` - Get inventory item
- `PATCH /api/v1/inventory/:id` - Update inventory
- `GET /api/v1/inventory/reservations` - List reservations

### Shipping
- `POST /api/v1/shipments` - Create shipment
- `GET /api/v1/shipments` - List shipments
- `GET /api/v1/shipments/:id` - Get shipment
- `PATCH /api/v1/shipments/:id/status` - Update status
- `GET /api/v1/shipments/:id/track` - Track shipment
- `GET /api/v1/shipments/:id/label` - Get label
- `DELETE /api/v1/shipments/:id` - Cancel shipment

### Webhooks (Public endpoints)
- `POST /api/v1/webhooks/shopify/:channelId` - Shopify webhook
- `POST /api/v1/webhooks/woocommerce/:channelId` - WooCommerce webhook
- `POST /api/v1/webhooks/dhl/:shipmentId` - DHL tracking webhook
- `POST /api/v1/webhooks/fedex/:shipmentId` - FedEx tracking webhook
- `GET /api/v1/webhooks/logs/:channelId` - Get webhook logs

### Jobs
- `GET /api/v1/jobs/stats` - Get all queue stats
- `GET /api/v1/jobs/:queue/stats` - Get queue stats
- `GET /api/v1/jobs/:queue/:jobId` - Get job status

## Order Lifecycle States

1. **NEW** - Order imported from sales channel
2. **RESERVED** - Inventory reserved (Model C auto-reserve)
3. **READY_TO_SHIP** - Payment confirmed, ready for shipment
4. **LABEL_CREATED** - Shipping label generated
5. **PICKED_UP** - Picked up by carrier
6. **IN_TRANSIT** - In transit to customer
7. **OUT_FOR_DELIVERY** - Out for delivery
8. **DELIVERED** - Successfully delivered
9. **CANCELLED** - Order cancelled (inventory released)
10. **FAILED** - Delivery failed
11. **RETURNED** - Order returned (inventory released)

## Inventory Reservation (Model C)

- **Auto-reserve on import**: When an order is imported, inventory is automatically reserved
- **Release on cancel**: Cancelled orders release inventory back to available stock
- **Release on return**: Returned orders release inventory back to available stock
- **Deduct on delivery**: Delivered orders deduct from total inventory count

## Environment Variables

See `.env.example` for all available environment variables.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `REDIS_HOST` - Redis host for queues
- `DHL_API_KEY` - DHL API credentials
- `FEDEX_API_KEY` - FedEx API credentials

## Development

```bash
# Linting
npm run lint

# Formatting
npm run format

# Testing
npm run test
npm run test:watch
npm run test:cov
npm run test:e2e
```

## Production Deployment

```bash
# Build
npm run build

# Start production server
npm run start:prod
```

### Required Services
1. PostgreSQL database
2. Redis instance
3. Environment variables configured

## Multi-Tenancy

The system uses organization-based multi-tenancy:
- Each request must include a valid JWT token
- User's organization ID is extracted from the token
- All database queries are automatically scoped to the organization
- Complete data isolation between organizations

## Background Jobs

The system uses BullMQ for async processing:

- **orders** queue - Order import and sync
- **inventory** queue - Inventory reservations
- **shipping** queue - Shipment creation and tracking updates

Jobs are automatically retried with exponential backoff on failure.

## API Documentation

Interactive API documentation is available at `/api/docs` when running the server.

## License

Proprietary - All rights reserved

## Support

For support, contact the Rappit development team.