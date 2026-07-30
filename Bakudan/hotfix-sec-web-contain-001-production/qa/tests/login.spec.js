const { test, expect } = require('@playwright/test');

test.describe('Login Flow', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/TaskFlow|Login/);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('invalid login shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'invalid@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error, .alert-danger, [class*="error"]')).toBeVisible();
  });

  test('valid login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'admin@bakudanramen.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|overview|my-tasks)/);
    await expect(page.url()).toMatch(/\/(dashboard|overview|my-tasks)/);
  });

  test('logout works', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'admin@bakudanramen.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|overview|my-tasks)/);

    // Logout
    await page.goto('/logout');
    await page.waitForURL(/\/login/);
    await expect(page.url()).toContain('/login');
  });
});
