# Rappit Frontend E2E Tests

## Overview

This directory contains end-to-end tests for the Rappit frontend using Playwright. These tests run against a **real backend** (no mocking) to ensure complete integration testing.

## Prerequisites

1. **Backend Running**: Ensure your NestJS backend is running and accessible
2. **Test Database**: Use a dedicated test database (not production!)
3. **Test Data**: Backend should have test fixtures or test API endpoints

## Environment Setup

Create a `.env.test` file:

```bash
# Backend API URL (test instance)
BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Test credentials (should match backend test user)
TEST_EMAIL=admin@example.com
TEST_PASSWORD=password123
```

## Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run specific test file
```bash
npx playwright test tests/e2e/orders.e2e.spec.ts
```

### Run with UI mode (interactive)
```bash
npm run test:e2e:ui
```

### Run in debug mode
```bash
npm run test:e2e:debug
```

### Run specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Structure

### Orders Tests (`orders.e2e.spec.ts`)
- ✅ Display orders list
- ✅ Filter by status
- ✅ Search orders
- ✅ Navigate to order detail
- ✅ Change order status
- ✅ Create shipment
- ✅ Pagination
- ✅ Empty state
- ✅ Error handling

### Inventory Tests (`inventory.e2e.spec.ts`)
- ✅ Display inventory list
- ✅ Display stats
- ✅ Search inventory
- ✅ Adjust stock
- ✅ Form validation
- ✅ Low stock indicator
- ✅ Pagination
- ✅ Empty state
- ✅ Error handling
- ✅ Idempotent operations (adjust +1, then -1)

## Backend Test Requirements

### Option 1: Test Fixtures API (Recommended)

Your backend should expose test endpoints to create/delete fixtures:

```typescript
// Example endpoints (only available in test environment)
POST /api/test/fixtures/orders - Create test orders
DELETE /api/test/fixtures/orders - Clean up test orders
POST /api/test/fixtures/inventory - Create test inventory
DELETE /api/test/fixtures/inventory - Clean up test inventory
```

### Option 2: Seed Test Database

Use a separate test database with pre-seeded data:

```bash
# In your backend
npm run db:seed:test
```

### Option 3: Cleanup After Tests

Tests should clean up by reverting changes (e.g., adjust inventory +1 then -1).

## Authentication

Tests use programmatic login before each test:

```typescript
test.beforeEach(async ({ page }) => {
  await page.goto(FRONTEND_URL);
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
});
```

## Common Issues

### Tests fail with "Backend not responding"
- Ensure backend is running on correct port
- Check BACKEND_URL in .env.test
- Verify CORS is configured for test frontend URL

### Authentication fails
- Verify test user exists in backend test database
- Check credentials in .env.test
- Ensure JWT cookies are set correctly

### Timeouts
- Increase timeout in test: `{ timeout: 30000 }`
- Check backend response times
- Verify test database performance

### Flaky tests
- Add explicit waits: `await page.waitForSelector()`
- Use `waitForLoadState('networkidle')`
- Check for race conditions in backend

## Continuous Integration

Example GitHub Actions workflow:

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: rappit_test
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Start Backend
        run: |
          cd backend
          npm ci
          npm run db:migrate:test
          npm run db:seed:test
          npm run start:test &
          npx wait-on http://localhost:4000

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          BACKEND_URL: http://localhost:4000
          FRONTEND_URL: http://localhost:3000

      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Best Practices

1. **Always use real backend** - No mocking
2. **Clean up test data** - Don't pollute test database
3. **Use explicit waits** - Avoid fixed timeouts
4. **Test error states** - Network failures, validation errors
5. **Test accessibility** - Use semantic selectors
6. **Keep tests independent** - Each test should run in isolation
7. **Use Page Object Model** - For complex pages (optional)

## Debugging

### View test in browser
```bash
npx playwright test --headed
```

### Slow down execution
```bash
npx playwright test --headed --slow-mo=1000
```

### Generate test code
```bash
npx playwright codegen http://localhost:3000
```

### View test report
```bash
npx playwright show-report
```

## Manual Verification Checklist

After running automated tests, manually verify:

- [ ] Login flow works with real credentials
- [ ] Orders list loads from backend
- [ ] Filtering updates URL and refetches data
- [ ] Order detail shows correct data
- [ ] Status change updates both UI and backend
- [ ] Create shipment calls backend API
- [ ] Inventory list shows correct quantities
- [ ] Adjust stock updates backend
- [ ] Pagination works correctly
- [ ] RTL layout is correct
- [ ] Loading states show properly
- [ ] Error states display and retry works
- [ ] Toast notifications appear
- [ ] All API calls include credentials
- [ ] No authentication tokens in localStorage/sessionStorage

## Support

For issues or questions:
1. Check test logs: `playwright-report/index.html`
2. Review backend logs
3. Verify environment variables
4. Check network tab in browser DevTools
