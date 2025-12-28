# 🧪 Rappit Backend Test Suite

## Overview

Comprehensive test suite for Rappit backend covering:
- **Unit tests** - Inventory service, Orders state machine
- **Integration tests** - Shopify, WooCommerce, DHL/FedEx (mocked)
- **E2E tests** - Full happy path (Import → Reserve → Ship → Track)

## Prerequisites

- Docker & Docker Compose
- Node.js 18+
- npm or yarn

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start test infrastructure
docker-compose -f docker-compose.test.yml up -d

# 3. Wait for services to be ready
docker-compose -f docker-compose.test.yml ps

# 4. Run all tests
npm run test

# Or run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
```

## Test Infrastructure

### Docker Services

- **PostgreSQL** (port 5433) - Test database
- **Redis** (port 6380) - Test queue storage

```bash
# Start services
docker-compose -f docker-compose.test.yml up -d

# Check health
docker-compose -f docker-compose.test.yml ps

# View logs
docker-compose -f docker-compose.test.yml logs -f

# Stop services
docker-compose -f docker-compose.test.yml down

# Stop and remove volumes (clean state)
docker-compose -f docker-compose.test.yml down -v
```

### Database Migrations

Tests automatically run migrations using `.env.test` configuration:

```bash
# Manual migration (if needed)
DATABASE_URL=postgresql://rappit_test:rappit_test_pass@localhost:5433/rappit_test \
  npx prisma migrate deploy
```

## Test Structure

```
test/
├── unit/                          # Unit tests
│   ├── inventory.spec.ts         # Inventory service tests
│   └── orders_state_machine.spec.ts  # Order state transitions
├── integration/                   # Integration tests (mocked external APIs)
│   ├── shopify_integration.stub.spec.ts
│   ├── woocommerce_integration.stub.spec.ts
│   └── dhl_fedex.stub.spec.ts
├── e2e/                          # End-to-end tests
│   └── happy_path.spec.ts       # Full workflow test
└── helpers/                      # Test utilities
    ├── testDb.ts                # Database setup/teardown
    ├── testRedis.ts             # Redis/queue helpers
    ├── seedData.ts              # Test data factories
    ├── waitForCondition.ts      # Polling utilities
    └── generateShopifyHmac.ts   # Webhook signature generation
```

## Running Tests

### All Tests

```bash
npm run test
```

Expected output:
```
✅ Unit tests: 15 passing
✅ Integration tests: 8 passing
✅ E2E tests: 1 passing
---
Total: 24 tests passing
Duration: ~45 seconds
```

### Unit Tests Only

```bash
npm run test:unit
```

Tests:
- ✅ Inventory reserve (idempotent)
- ✅ Inventory release (idempotent)
- ✅ Adjust stock (positive/negative)
- ✅ Prevent negative inventory
- ✅ Concurrency protection
- ✅ Valid order state transitions
- ✅ Invalid state transition rejection
- ✅ Inventory side effects (reserve on NEW, release on CANCELLED)

Duration: ~10 seconds

### Integration Tests Only

```bash
npm run test:integration
```

Tests:
- ✅ Shopify order sync (mocked API)
- ✅ Shopify webhook processing (idempotent)
- ✅ WooCommerce order sync
- ✅ DHL shipment creation (mocked)
- ✅ FedEx tracking update (mocked)

Duration: ~15 seconds

### E2E Tests Only

```bash
npm run test:e2e
```

Tests:
- ✅ Full happy path: Import → Reserve → Ship → Track

Duration: ~20 seconds

## Test Coverage

```bash
npm run test:coverage
```

Expected coverage:
- **InventoryService**: >90%
- **OrdersService**: >85%
- **Integration services**: >70%
- **Overall**: >75%

## Test Data & Fixtures

### Seed Data Helpers

```typescript
// Create org + user
const { org, user } = await seedOrganizationAndUser(prisma);

// Create SKU with inventory
const sku = await seedSku(prisma, org.id, {
  sku: 'SKU-001',
  quantityOnHand: 100,
  reserved: 0,
});

// Create Shopify channel
const { channel, connection } = await seedShopifyChannel(prisma, org.id);

// Create order
const { order, orderItem } = await seedOrder(prisma, org.id, channel.id, sku.id, {
  quantity: 2,
  status: 'NEW',
});
```

### Mock External APIs

```typescript
import nock from 'nock';

// Mock Shopify API
nock('https://test-store.myshopify.com')
  .get('/admin/api/2024-01/orders.json')
  .reply(200, { orders: [shopifyOrder] });

// Mock DHL API
nock('https://api.dhl.com')
  .post('/shipments')
  .reply(200, {
    shipmentId: 'DHL-123',
    trackingNumber: 'TRACK-123',
  });
```

## Debugging Tests

### Run Single Test File

```bash
npm test -- test/unit/inventory.spec.ts
```

### Run Single Test Case

```bash
npm test -- -t "should reserve stock successfully"
```

### Enable Debug Logging

```bash
LOG_LEVEL=debug npm run test
```

### View Database State

```bash
# Connect to test database
PGPASSWORD=rappit_test_pass psql -h localhost -p 5433 -U rappit_test -d rappit_test

# List tables
\dt

# Query orders
SELECT * FROM orders;

# Query inventory reservations
SELECT * FROM inventory_reservations;
```

### View Redis Queues

```bash
# Connect to Redis
redis-cli -p 6380

# List all keys
KEYS *

# View queue
LRANGE bull:webhook-processing:wait 0 -1
```

## Common Issues

### Issue: Database connection refused

**Solution:**
```bash
# Check if PostgreSQL is running
docker-compose -f docker-compose.test.yml ps

# Restart services
docker-compose -f docker-compose.test.yml restart postgres-test
```

### Issue: Redis connection timeout

**Solution:**
```bash
# Check Redis health
docker-compose -f docker-compose.test.yml exec redis-test redis-cli ping

# Should return: PONG
```

### Issue: Tests fail with "table does not exist"

**Solution:**
```bash
# Reset database
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d

# Wait for health checks
sleep 5

# Run migrations
DATABASE_URL=postgresql://rappit_test:rappit_test_pass@localhost:5433/rappit_test \
  npx prisma migrate deploy
```

### Issue: Flaky tests (intermittent failures)

**Cause:** Worker timing issues

**Solution:**
- Tests use `waitForCondition` with exponential backoff
- Increase timeout: `TEST_TIMEOUT=60000 npm run test`
- Run tests serially: Already configured in `jest.config.js`

### Issue: Port conflicts

**Solution:**
```bash
# Change ports in docker-compose.test.yml if needed
# PostgreSQL: 5433 → 5434
# Redis: 6380 → 6381

# Update .env.test accordingly
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: rappit_test
          POSTGRES_PASSWORD: rappit_test_pass
          POSTGRES_DB: rappit_test
        ports:
          - 5433:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6380:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://rappit_test:rappit_test_pass@localhost:5433/rappit_test

      - name: Run tests
        run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://rappit_test:rappit_test_pass@localhost:5433/rappit_test
          REDIS_HOST: localhost
          REDIS_PORT: 6380

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Test Maintenance

### Adding New Tests

1. Create test file in appropriate directory (`unit/`, `integration/`, `e2e/`)
2. Import helpers:
   ```typescript
   import { setupTestDB, teardownTestDB, clearTables } from '../helpers/testDb';
   import { seedOrganizationAndUser } from '../helpers/seedData';
   ```
3. Follow existing patterns for setup/teardown
4. Use descriptive test names: `it('should [expected behavior] when [condition]')`

### Updating Seed Data

Edit `/test/helpers/seedData.ts`:
```typescript
export async function seedNewEntity(prisma: PrismaClient, orgId: string) {
  // Implementation
}
```

### Best Practices

- ✅ Each test is independent (no shared state)
- ✅ Use transactions for unit tests where possible
- ✅ Clean tables between tests (`clearTables()`)
- ✅ Use `waitForCondition` for async operations
- ✅ Mock external APIs with `nock`
- ✅ Use deterministic data (fixed IDs, timestamps)
- ✅ Keep tests fast (<30s total)
- ✅ Assert both success and failure paths

## Performance

### Optimization Tips

1. **Parallel execution** (for independent tests)
   ```json
   // jest.config.js
   "maxWorkers": "50%"
   ```

2. **Transaction rollback** (for unit tests)
   ```typescript
   await executeInTransaction(async (tx) => {
     // Test logic
   }); // Auto-rollback
   ```

3. **Reuse database connections**
   ```typescript
   // Global setup
   beforeAll(async () => {
     prisma = await setupTestDB();
   });
   ```

## Support

For issues or questions:
1. Check this README
2. Review test logs: `npm test -- --verbose`
3. Check Docker logs: `docker-compose -f docker-compose.test.yml logs`
4. Contact: backend-team@rappit.com

---

**Last Updated:** 2024-12-15
**Maintainer:** Rappit Backend Team
