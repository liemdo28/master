const { test, expect } = require('@playwright/test');

test.describe('New Modules (Phase 11)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'admin@bakudanramen.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|overview|my-tasks)/);
  });

  test('release dashboard loads', async ({ page }) => {
    const response = await page.goto('/admin/release-dashboard');
    expect(response.status()).toBeLessThan(500);
    await expect(page.locator('body')).toContainText('Release Dashboard');
  });

  test('shift management loads', async ({ page }) => {
    const response = await page.goto('/admin/shifts');
    expect(response.status()).toBeLessThan(500);
    await expect(page.locator('body')).toContainText('Shift Management');
  });

  test('employee center loads', async ({ page }) => {
    const response = await page.goto('/admin/employees');
    expect(response.status()).toBeLessThan(500);
    await expect(page.locator('body')).toContainText('Employee Center');
  });

  test('training center loads', async ({ page }) => {
    const response = await page.goto('/admin/training');
    expect(response.status()).toBeLessThan(500);
    await expect(page.locator('body')).toContainText('Training Center');
  });

  test('procurement loads', async ({ page }) => {
    const response = await page.goto('/admin/procurement');
    expect(response.status()).toBeLessThan(500);
    await expect(page.locator('body')).toContainText('Procurement');
  });

  test('documents loads', async ({ page }) => {
    const response = await page.goto('/admin/documents');
    expect(response.status()).toBeLessThan(500);
    await expect(page.locator('body')).toContainText('Document Center');
  });

  test('compliance loads', async ({ page }) => {
    const response = await page.goto('/admin/compliance');
    expect(response.status()).toBeLessThan(500);
    await expect(page.locator('body')).toContainText('Compliance Center');
  });

  test('store command center loads', async ({ page }) => {
    const response = await page.goto('/admin/store-command');
    expect(response.status()).toBeLessThan(500);
    await expect(page.locator('body')).toContainText('Store Command Center');
  });

  test('CEO boardroom loads', async ({ page }) => {
    const response = await page.goto('/ceo/boardroom');
    expect(response.status()).toBeLessThan(500);
    await expect(page.locator('body')).toContainText('CEO Boardroom');
  });

  test('digital twin loads', async ({ page }) => {
    const response = await page.goto('/admin/digital-twin');
    expect(response.status()).toBeLessThan(500);
    await expect(page.locator('body')).toContainText('Digital Twin');
  });

  test('control tower loads', async ({ page }) => {
    const response = await page.goto('/control-tower');
    expect(response.status()).toBeLessThan(500);
  });

  test('manager command loads', async ({ page }) => {
    const response = await page.goto('/manager/command');
    expect(response.status()).toBeLessThan(500);
    await expect(page.locator('body')).toContainText('Manager Command');
  });
});
