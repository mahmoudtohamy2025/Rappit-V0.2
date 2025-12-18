import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

test.describe('Inventory E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login programmatically
    await page.goto(FRONTEND_URL);

    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/', { timeout: 10000 });

    // Navigate to inventory
    await page.click('button:has-text("المخزون")');
    await page.waitForURL('**/inventory');
  });

  test('should display inventory list', async ({ page }) => {
    // Wait for table to load
    await page.waitForSelector('table', { timeout: 10000 });

    // Check headers
    await expect(page.locator('th:has-text("SKU")')).toBeVisible();
    await expect(page.locator('th:has-text("الموجود")')).toBeVisible();
    await expect(page.locator('th:has-text("المحجوز")')).toBeVisible();
    await expect(page.locator('th:has-text("المتاح")')).toBeVisible();
  });

  test('should display stats correctly', async ({ page }) => {
    await page.waitForSelector('table');

    // Check stats cards
    await expect(page.locator('text=إجمالي المنتجات')).toBeVisible();
    await expect(page.locator('text=المحجوزة (Model C)')).toBeVisible();
    await expect(page.locator('text=منخفض المخزون')).toBeVisible();
  });

  test('should search inventory', async ({ page }) => {
    await page.waitForSelector('table');

    // Search for SKU
    const searchInput = page.locator('input[placeholder*="البحث"]');
    await searchInput.fill('SKU-001');

    // Wait for debounce + network
    await page.waitForTimeout(500);

    // URL should update
    await expect(page).toHaveURL(/search=SKU-001/);
  });

  test('should open adjust stock modal', async ({ page }) => {
    await page.waitForSelector('table tbody tr');

    // Click adjust button on first row
    await page.click('table tbody tr:first-child button[title="تعديل المخزون"]');

    // Modal should open
    await expect(page.locator('text=تعديل المخزون')).toBeVisible();
    await expect(page.locator('text=التغيير')).toBeVisible();
  });

  test('should adjust stock successfully', async ({ page }) => {
    await page.waitForSelector('table tbody tr');

    // Get initial quantity (store for later verification)
    const firstRowQuantity = await page.locator('table tbody tr:first-child td:nth-child(6)').textContent();

    // Open adjust modal
    await page.click('table tbody tr:first-child button[title="تعديل المخزون"]');

    // Fill form
    await page.fill('input[type="number"]', '1');
    await page.fill('textarea', 'Test adjustment for E2E');

    // Verify preview shows
    await expect(page.locator('text=النتيجة المتوقعة')).toBeVisible();

    // Submit
    await page.click('button:has-text("تأكيد التعديل")');

    // Wait for success toast
    await expect(page.locator('text=تم تعديل المخزون بنجاح')).toBeVisible({ timeout: 10000 });

    // Modal should close
    await expect(page.locator('text=تعديل المخزون')).not.toBeVisible();

    // Table should refresh - quantity should have changed
    await page.waitForTimeout(1000);
    const newQuantity = await page.locator('table tbody tr:first-child td:nth-child(6)').textContent();
    expect(newQuantity).not.toBe(firstRowQuantity);
  });

  test('should validate adjust stock form', async ({ page }) => {
    await page.waitForSelector('table tbody tr');
    await page.click('table tbody tr:first-child button[title="تعديل المخزون"]');

    // Try to submit without filling
    await page.click('button:has-text("تأكيد التعديل")');

    // HTML5 validation should prevent submit (required fields)
    // Modal should still be open
    await expect(page.locator('text=تعديل المخزون')).toBeVisible();

    // Fill delta as 0 (invalid)
    await page.fill('input[type="number"]', '0');
    await page.fill('textarea', 'Test');
    await page.click('button:has-text("تأكيد التعديل")');

    // Should show error
    await expect(page.locator('text=يرجى إدخال قيمة صحيحة')).toBeVisible();
  });

  test('should show low stock indicator', async ({ page }) => {
    await page.waitForSelector('table');

    // Look for low stock warning icon (if any items are low)
    const lowStockIcon = page.locator('svg.lucide-alert-triangle').first();

    if (await lowStockIcon.isVisible()) {
      // Hover to see tooltip
      await lowStockIcon.hover();

      // Tooltip should appear
      await expect(page.locator('text=مخزون منخفض')).toBeVisible();
    }
  });

  test('should handle pagination', async ({ page }) => {
    await page.waitForSelector('table');

    const nextButton = page.locator('button:has-text("التالي")');

    if (await nextButton.isVisible() && await nextButton.isEnabled()) {
      await nextButton.click();

      await expect(page).toHaveURL(/page=2/);
      await page.waitForLoadState('networkidle');
    }
  });

  test('should revert stock adjustment (idempotent test)', async ({ page }) => {
    await page.waitForSelector('table tbody tr');

    // First adjustment: +1
    await page.click('table tbody tr:first-child button[title="تعديل المخزون"]');
    await page.fill('input[type="number"]', '1');
    await page.fill('textarea', 'Test increment');
    await page.click('button:has-text("تأكيد التعديل")');
    await expect(page.locator('text=تم تعديل المخزون بنجاح')).toBeVisible();

    // Wait for modal to close
    await page.waitForTimeout(1000);

    // Second adjustment: -1 to revert
    await page.click('table tbody tr:first-child button[title="تعديل المخزون"]');
    await page.fill('input[type="number"]', '-1');
    await page.fill('textarea', 'Test revert');
    await page.click('button:has-text("تأكيد التعديل")');
    await expect(page.locator('text=تم تعديل المخزون بنجاح')).toBeVisible();
  });

  test('should handle empty state', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/inventory?search=nonexistent-sku-xyz`);

    await page.waitForTimeout(500);

    await expect(page.locator('text=لا توجد منتجات')).toBeVisible();
  });

  test('should handle error state', async ({ page }) => {
    // Intercept and fail requests
    await page.route('**/inventory*', (route) => {
      route.abort('failed');
    });

    await page.goto(`${FRONTEND_URL}/inventory`);

    await expect(page.locator('text=حدث خطأ')).toBeVisible();
    await expect(page.locator('button:has-text("إعادة المحاولة")')).toBeVisible();
  });
});
