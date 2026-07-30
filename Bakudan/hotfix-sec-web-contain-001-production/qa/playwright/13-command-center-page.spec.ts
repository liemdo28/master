/**
 * Phase 1 — Command Center page UI test
 * Verifies /command-center loads with tabs, summary cards, and queue panel.
 */
import { test, expect } from './fixtures';

test.describe('Command Center — Page', () => {

  test.beforeEach(async ({ page }) => {
    // Ensure authenticated session
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    // If already logged in, go directly
    if (!page.url().includes('/login')) return;
    // Attempt login if on login page
    const emailField = page.locator('input[name="email"]');
    const passField  = page.locator('input[name="password"]');
    if (await emailField.isVisible()) {
      await emailField.fill('qa.bot@bakudanramen.com');
      await passField.fill('QA-Preview-2026!');
      await page.locator('button[type="submit"]').click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('command-center page loads with tabs and summary cards', async ({ page }) => {
    await page.goto('/command-center', { waitUntil: 'networkidle' });

    // Check tabs exist
    const tabs = page.locator('.cc-tab');
    await expect(tabs).toHaveCount(4);
    await expect(page.locator('.cc-tab[data-bucket="my_work"]')).toBeVisible();
    await expect(page.locator('.cc-tab[data-bucket="review"]')).toBeVisible();
    await expect(page.locator('.cc-tab[data-bucket="approve"]')).toBeVisible();
    await expect(page.locator('.cc-tab[data-bucket="critical"]')).toBeVisible();

    // Check summary grid
    const cards = page.locator('.cc-card');
    await expect(cards).toHaveCount(4);

    // Check queue panel
    await expect(page.locator('.cc-queue')).toBeVisible();
    await expect(page.locator('#cc-queue-title')).toBeVisible();

    // Check filters
    await expect(page.locator('#cc-filter-priority')).toBeVisible();
    await expect(page.locator('#cc-filter-status')).toBeVisible();
    await expect(page.locator('#cc-search')).toBeVisible();

    // Check task list area
    await expect(page.locator('#cc-task-list')).toBeVisible();
  });

  test('clicking Reviewer Queue tab switches queue', async ({ page }) => {
    await page.goto('/command-center?bucket=my_work', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500); // wait for JS fetch

    await page.locator('.cc-tab[data-bucket="review"]').click();
    await expect(page.locator('#cc-queue-title')).toContainText(/Review/i);
  });

  test('command-center page has no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/command-center', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // let JS run
    // Filter out known benign errors
    const critical = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('Failed to load resource: net::ERR_') &&
      !e.includes('favicon.ico')
    );
    expect(critical, 'Console errors: ' + critical.join('\n')).toHaveLength(0);
  });
});
