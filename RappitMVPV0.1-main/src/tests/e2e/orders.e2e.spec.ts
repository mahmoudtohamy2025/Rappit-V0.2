import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

test.describe('Orders E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login programmatically
    await page.goto(FRONTEND_URL);

    // Fill login form (adjust selectors based on your actual form)
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for redirect after login
    await page.waitForURL('**/orders', { timeout: 10000 });
  });

  test('should display orders list', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/orders`);

    // Wait for orders to load
    await page.waitForSelector('table', { timeout: 10000 });

    // Check that table has headers
    await expect(page.locator('th:has-text("رقم الطلب")')).toBeVisible();
    await expect(page.locator('th:has-text("العميل")')).toBeVisible();
    await expect(page.locator('th:has-text("الحالة")')).toBeVisible();
  });

  test('should filter orders by status', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/orders`);

    // Wait for initial load
    await page.waitForSelector('table');

    // Click NEW status filter
    await page.click('button:has-text("جديد")');

    // Check URL updated
    await expect(page).toHaveURL(/status=NEW/);

    // Verify table reloaded (wait for network idle)
    await page.waitForLoadState('networkidle');
  });

  test('should search orders', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/orders`);

    // Wait for search input
    const searchInput = page.locator('input[placeholder*="البحث"]');
    await searchInput.fill('ORD-1234');

    // Wait for debounce (300ms) + network request
    await page.waitForTimeout(500);

    // Check URL updated
    await expect(page).toHaveURL(/search=ORD-1234/);
  });

  test('should navigate to order detail', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/orders`);

    // Wait for table
    await page.waitForSelector('table tbody tr');

    // Click first order row
    await page.click('table tbody tr:first-child');

    // Should navigate to detail page
    await page.waitForURL(/\/orders\/[^/]+$/);

    // Verify detail page elements
    await expect(page.locator('h1:has-text("تفاصيل الطلب")')).toBeVisible();
  });

  test('should change order status', async ({ page }) => {
    // This test requires a real backend with test data
    // Navigate to a specific test order
    await page.goto(`${FRONTEND_URL}/orders`);
    await page.waitForSelector('table tbody tr');
    await page.click('table tbody tr:first-child');

    // Wait for detail page
    await page.waitForURL(/\/orders\/[^/]+$/);

    // Open status dropdown
    await page.click('button:has-text("تغيير الحالة")');

    // Select CANCELLED (this will trigger confirmation)
    await page.click('button:has-text("ملغي")');

    // Confirm in modal
    await page.click('button:has-text("تأكيد")');

    // Wait for success toast
    await expect(page.locator('text=تم تحديث حالة الطلب بنجاح')).toBeVisible({ timeout: 10000 });

    // Verify timeline updated
    await expect(page.locator('text=CANCELLED')).toBeVisible();
  });

  test('should create shipment', async ({ page }) => {
    // Navigate to order detail
    await page.goto(`${FRONTEND_URL}/orders`);
    await page.waitForSelector('table tbody tr');
    await page.click('table tbody tr:first-child');

    await page.waitForURL(/\/orders\/[^/]+$/);

    // Click create shipment button (only visible if items are shippable)
    const shipmentButton = page.locator('button:has-text("إنشاء شحنة")');

    if (await shipmentButton.isVisible()) {
      await shipmentButton.click();

      // Modal should open
      await expect(page.locator('text=إنشاء شحنة جديدة')).toBeVisible();

      // Select carrier and service (should be pre-filled)
      await page.selectOption('select', { value: 'dhl' });

      // Submit
      await page.click('button:has-text("إنشاء شحنة")');

      // Wait for success
      await expect(page.locator('text=تم إنشاء الشحنة بنجاح')).toBeVisible({ timeout: 10000 });

      // Tracking number should be displayed
      await expect(page.locator('text=رقم التتبع')).toBeVisible();
    }
  });

  test('should handle pagination', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/orders`);

    // Wait for table
    await page.waitForSelector('table');

    // Check if pagination exists (may not if less than pageSize items)
    const nextButton = page.locator('button:has-text("التالي")');

    if (await nextButton.isVisible() && await nextButton.isEnabled()) {
      await nextButton.click();

      // URL should update
      await expect(page).toHaveURL(/page=2/);

      // Table should reload
      await page.waitForLoadState('networkidle');
    }
  });

  test('should handle empty state', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/orders?search=nonexistent-order-12345`);

    // Wait for search to complete
    await page.waitForTimeout(500);

    // Should show empty state
    await expect(page.locator('text=لا توجد طلبات')).toBeVisible();
  });

  test('should handle error state', async ({ page }) => {
    // Simulate backend being down by using invalid URL
    // This requires setting NEXT_PUBLIC_BACKEND_URL to invalid endpoint
    // Or you can intercept network requests

    await page.route('**/orders*', (route) => {
      route.abort('failed');
    });

    await page.goto(`${FRONTEND_URL}/orders`);

    // Should show error state
    await expect(page.locator('text=حدث خطأ')).toBeVisible();

    // Retry button should be visible
    await expect(page.locator('button:has-text("إعادة المحاولة")')).toBeVisible();
  });
});
