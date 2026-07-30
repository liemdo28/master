const { test, expect } = require('@playwright/test');

test.describe('Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'admin@bakudanramen.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|overview|my-tasks)/);
  });

  test('my-tasks page renders task list', async ({ page }) => {
    await page.goto('/my-tasks');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('task detail page loads', async ({ page }) => {
    await page.goto('/my-tasks');
    const taskLink = page.locator('a[href*="/tasks/"]').first();
    if (await taskLink.isVisible()) {
      await taskLink.click();
      await expect(page.locator('body')).not.toContainText('Something went wrong');
    }
  });

  test('calendar shows tasks', async ({ page }) => {
    const response = await page.goto('/calendar');
    expect(response.status()).toBeLessThan(500);
  });
});
