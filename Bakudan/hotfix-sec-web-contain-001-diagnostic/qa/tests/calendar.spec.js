const { test, expect } = require('@playwright/test');

test.describe('Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.TEST_EMAIL || 'admin@bakudanramen.com');
    await page.fill('input[name="password"]', process.env.TEST_PASSWORD || 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|overview|my-tasks)/);
  });

  test('calendar page loads', async ({ page }) => {
    const response = await page.goto('/calendar');
    expect(response.status()).toBeLessThan(500);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('calendar API returns data', async ({ page }) => {
    const response = await page.request.get('/api/calendar');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('tasks');
  });

  test('calendar day API works', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    const response = await page.request.get(`/api/calendar/day/${today}`);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('date');
    expect(data).toHaveProperty('tasks');
  });
});
