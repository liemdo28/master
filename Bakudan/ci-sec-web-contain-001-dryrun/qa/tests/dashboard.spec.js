const { test, expect } = require('@playwright/test');

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'admin@bakudanramen.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|overview|my-tasks)/);
  });

  test('dashboard loads without crash', async ({ page }) => {
    const response = await page.goto('/overview');
    expect(response.status()).toBeLessThan(500);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/overview');
    // Check sidebar exists
    const sidebar = page.locator('nav, [class*="sidebar"], aside');
    await expect(sidebar.first()).toBeVisible();
  });

  test('my-tasks page loads', async ({ page }) => {
    const response = await page.goto('/my-tasks');
    expect(response.status()).toBeLessThan(500);
  });

  test('calendar page loads', async ({ page }) => {
    const response = await page.goto('/calendar');
    expect(response.status()).toBeLessThan(500);
  });

  test('bills page loads', async ({ page }) => {
    const response = await page.goto('/bills');
    expect(response.status()).toBeLessThan(500);
  });

  test('admin stores page loads', async ({ page }) => {
    const response = await page.goto('/admin/stores');
    expect(response.status()).toBeLessThan(500);
  });
});
