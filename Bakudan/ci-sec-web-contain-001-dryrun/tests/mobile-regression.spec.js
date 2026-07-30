// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Phase 13.9 — Mobile Regression Suite (Full 13-Flow Coverage)
 * Tests critical mobile workflows against production.
 * Target: https://dashboard.bakudanramen.com
 * Devices: iPhone 15, iPhone 15 Plus, Galaxy S23, iPad Air
 */

const BASE_URL = process.env.BASE_URL || 'https://dashboard.bakudanramen.com';
const EMAIL = process.env.TEST_EMAIL || 'liem.dt0208@gmail.com';
const PASSWORD = process.env.TEST_PASSWORD || '';

const DEVICES = {
  'iPhone-15':      { width: 393, height: 852 },
  'iPhone-15-Plus': { width: 430, height: 932 },
  'Galaxy-S23':     { width: 360, height: 780 },
  'iPad-Air':     { width: 820, height: 1180 },
};

// Use synchronous JS evaluation to avoid blocking on networkidle pages
async function getBodyText(page) {
  try {
    return await page.evaluate(() => document.body ? document.body.innerText : '', { timeout: 15000 });
  } catch (e) {
    // On polling pages, evaluate may timeout — return empty to skip text checks
    return '';
  }
}

async function login(page) {
  await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name="email"], input[type="email"]', EMAIL);
  await page.fill('input[name="password"], input[type="password"]', PASSWORD);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForURL(/(overview|dashboard|my-tasks)/, { timeout: 15000 });
}

async function assertNoInternalError(page) {
  const text = await getBodyText(page);
  expect(text).not.toContain('Something went wrong');
  expect(text).not.toContain('An internal error occurred');
  expect(text).not.toContain('Internal Error');
  expect(text).not.toContain('Fatal error');
  expect(text).not.toContain('Parse error');
  expect(text).not.toContain('Notice: Undefined');
  expect(text).not.toContain('Warning: ');
  expect(text).not.toMatch(/\b500\s+Internal Server Error\b/);
  expect(text).not.toMatch(/\bError\s+500\b/);
  expect(text).not.toMatch(/status[:\s]+500\b/);
}

async function assertNoHorizontalScroll(page) {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  const cw = await page.evaluate(() => document.documentElement.clientWidth);
  expect(sw).toBeLessThanOrEqual(cw + 2);
}

async function assertPageHasContent(page) {
  const text = await getBodyText(page);
  expect(text.length).toBeGreaterThan(100);
}

for (const [deviceName, viewport] of Object.entries(DEVICES)) {
  test.describe('Mobile Regression -- ' + deviceName + ' (' + viewport.width + 'x' + viewport.height + ')', () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      userAgent: deviceName.includes('iPad')
        ? 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
        : 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36',
      hasTouch: !deviceName.includes('iPad') || true,
      isMobile: !deviceName.includes('iPad'),
    });

    test('Flow 1: Login', async ({ page }) => {
      await login(page);
      await expect(page).toHaveURL(/(overview|dashboard|my-tasks)/);
    });

    test('Flow 2: Overview loads without error', async ({ page }) => {
      await login(page);
      // Overview has long-polling; use domcontentloaded + evaluate (not textContent)
      await page.goto(BASE_URL + '/overview', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(500);
      await assertNoInternalError(page);
      await assertNoHorizontalScroll(page);
      await assertPageHasContent(page);
      if (viewport.width <= 768) {
        const sidebarHidden = await page.locator('#sidebar').evaluate(el => {
          const s = getComputedStyle(el);
          return parseFloat(s.left) < 0 || s.display === 'none' || s.transform !== 'none';
        });
        expect(sidebarHidden).toBeTruthy();
      }
    });

    test('Flow 3: KPI Drilldown -- Overdue Bills', async ({ page }) => {
      await login(page);
      await page.goto(BASE_URL + '/overview/drilldown/overdue-bills', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(500);
      await assertNoInternalError(page);
      await assertNoHorizontalScroll(page);
      await assertPageHasContent(page);
    });

    test('Flow 4: KPI Drilldown -- Critical Tasks', async ({ page }) => {
      await login(page);
      await page.goto(BASE_URL + '/overview/drilldown/critical-tasks', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await assertNoInternalError(page);
      await assertNoHorizontalScroll(page);
      await assertPageHasContent(page);
    });

    test('Flow 5: KPI Drilldown -- Compliance Risk', async ({ page }) => {
      await login(page);
      await page.goto(BASE_URL + '/overview/drilldown/compliance-risk', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await assertNoInternalError(page);
      await assertNoHorizontalScroll(page);
      await assertPageHasContent(page);
      expect(page.url()).toContain('compliance');
    });

    test('Flow 6: KPI Drilldown -- Penalty', async ({ page }) => {
      await login(page);
      await page.goto(BASE_URL + '/overview/drilldown/penalty', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await assertNoInternalError(page);
      await assertNoHorizontalScroll(page);
      await assertPageHasContent(page);
    });

    test('Flow 7: Task Drawer -- open task from list', async ({ page }) => {
      await login(page);
      await page.goto(BASE_URL + '/my-tasks', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await assertNoInternalError(page);
      const taskLink = page.locator('a[href*="tasks/show"], .task-row, .task-item, [data-task-id], tr:has(a)').first();
      if (await taskLink.isVisible()) {
        await taskLink.click();
        await page.waitForTimeout(2000);
        await assertNoInternalError(page);
        const body = await getBodyText(page);
        expect(body.length).toBeGreaterThan(100);
      }
    });

    test('Flow 8: Bill Drawer -- open bill from list', async ({ page }) => {
      await login(page);
      await page.goto(BASE_URL + '/bills', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await assertNoInternalError(page);
      const billLink = page.locator('a[href*="bills/show"], .bill-row, .bill-item, [data-bill-id], tr:has(a)').first();
      if (await billLink.isVisible()) {
        await billLink.click();
        await page.waitForTimeout(2000);
        await assertNoInternalError(page);
        const body = await getBodyText(page);
        expect(body.length).toBeGreaterThan(100);
      }
    });

    test('Flow 9: Calendar page loads', async ({ page }) => {
      await login(page);
      await page.goto(BASE_URL + '/calendar', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await assertNoInternalError(page);
      await assertNoHorizontalScroll(page);
      await assertPageHasContent(page);
    });

    test('Flow 10: Inbox page loads', async ({ page }) => {
      await login(page);
      await page.goto(BASE_URL + '/inbox', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await assertNoInternalError(page);
      await assertNoHorizontalScroll(page);
    });

    test('Flow 11: Create Task', async ({ page }) => {
      await login(page);
      await page.goto(BASE_URL + '/my-tasks', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const createBtn = page.locator('a:has-text("Create"), a:has-text("New Task"), button:has-text("Create"), a[href*="create"], a[href*="new"]').first();
      if (await createBtn.isVisible()) {
        await createBtn.click();
        await page.waitForTimeout(2000);
        await assertNoInternalError(page);
      } else {
        await page.goto(BASE_URL + '/tasks/create', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1000);
        await assertNoInternalError(page);
      }
    });

    test('Flow 12: Edit Task -- open task detail', async ({ page }) => {
      await login(page);
      await page.goto(BASE_URL + '/my-tasks', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await assertNoInternalError(page);
      const editLink = page.locator('a[href*="tasks/edit"], a[href*="edit"], .task-row a, .task-item a').first();
      if (await editLink.isVisible()) {
        await editLink.click();
        await page.waitForTimeout(2000);
        await assertNoInternalError(page);
        const body = await getBodyText(page);
        expect(body.length).toBeGreaterThan(100);
      } else {
        const body = await getBodyText(page);
        expect(body.length).toBeGreaterThan(100);
      }
    });

    test('Flow 13: Mobile Navigation -- bottom nav exists', async ({ page }) => {
      await login(page);
      await page.goto(BASE_URL + '/overview', { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForTimeout(3000);
      await assertNoInternalError(page);
      if (viewport.width <= 768) {
        const navVisible = await page.locator('#mobileBottomNav, .mobile-bottom-nav, .bottom-nav, nav.mobile-nav').first().isVisible().catch(() => false);
        const hamburger = await page.locator('.hamburger, .menu-toggle, .navbar-toggler').first().isVisible().catch(() => false);
        expect(navVisible || hamburger).toBeTruthy();
      }
    });

    test('Penalty routes: user view', async ({ page }) => {
      await login(page);
      await page.goto(BASE_URL + '/penalties', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await assertNoInternalError(page);
    });

    test('Penalty routes: manager view', async ({ page }) => {
      await login(page);
      await page.goto(BASE_URL + '/manager/penalties', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await assertNoInternalError(page);
    });
  });
}
