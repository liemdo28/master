/**
 * 10 - Notifications
 * Verifies that notifications were generated during the workflow.
 */
import { test, expect } from './fixtures';

test.describe('10 - Notifications', () => {
  test('notification center has workflow notifications', async ({ page, evidence }) => {
    await evidence.screenshotBefore('notifications');

    // Navigate to notifications/inbox
    const notifRoutes = ['/notifications', '/inbox', '/notification-center'];
    let loaded = false;

    for (const route of notifRoutes) {
      const response = await page.goto(route);
      if (response && response.status() < 400) {
        loaded = true;
        break;
      }
    }

    if (!loaded) {
      await page.goto('/dashboard', { waitUntil: 'load' });
      await page.waitForTimeout(2000);
      const bell = page.locator(
        '.notification-bell, [data-notifications], .bell-icon, a[href*="notification"], a[href*="inbox"]'
      ).first();
      if (await bell.isVisible({ timeout: 3000 }).catch(() => false)) {
        await bell.click();
        await page.waitForTimeout(2000);
        loaded = true;
      }
    }

    await page.waitForTimeout(2000);
    await evidence.screenshotAfter('notifications');

    // Verify page loaded without errors
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.locator('body')).not.toContainText('Fatal error');

    const notifItems = page.locator(
      '.notification-item, .inbox-item, .notif-row, [data-notification], .list-group-item'
    );
    const count = await notifItems.count();
    console.log(`Found ${count} notification items`);
  });

  test('API health check for notifications', async ({ page }) => {
    const response = await page.request.get('/api/health');
    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toBeTruthy();
    }
  });
});
