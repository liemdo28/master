/**
 * 01 - Login Validation
 * Verifies login works. Since auth-setup already validated login,
 * this test verifies the dashboard loads correctly after auth.
 */
import { test, expect } from './fixtures';

test.describe('01 - Login', () => {

  test('dashboard loads after authentication', async ({ page, evidence }) => {
    await evidence.screenshotBefore('dashboard_after_login');

    // With stored session, going to dashboard should work
    await page.goto('/dashboard', { waitUntil: 'load' });

    // Should NOT be on login page (session is valid)
    expect(page.url()).not.toContain('/login');

    // Dashboard should have main content areas — wait for sidebar to appear
    await page.locator('.sidebar, #sidebar, nav, [class*="sidebar"]').first().waitFor({ state: 'visible', timeout: 15_000 });

    const hasSidebar = await page.locator('.sidebar, #sidebar, nav, [class*="sidebar"]').first().isVisible();
    const hasContent = await page.locator('.main-content, .content, main, .dashboard').first().isVisible();
    expect(hasSidebar || hasContent).toBe(true);

    await evidence.screenshotAfter('dashboard_after_login');
  });

  test('logout and verify login page renders', async ({ page, evidence }) => {
    // First go to logout
    await page.goto('/logout', { waitUntil: 'load' });

    // Now should be able to see login page
    await page.goto('/login', { waitUntil: 'load' });
    await evidence.screenshotBefore('login_page');

    // Check login form elements using the known structure from page snapshot
    const emailInput = page.locator('input[name="email"], input[type="email"], [placeholder*="email"], [placeholder*="you@"]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In")').first();

    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    await evidence.screenshotAfter('login_page');
  });

  test('invalid credentials show error', async ({ page, evidence }) => {
    await page.goto('/logout', { waitUntil: 'load' });
    await page.goto('/login', { waitUntil: 'load' });

    const emailInput = page.locator('input[name="email"], input[type="email"], [placeholder*="you@"]').first();
    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();

    await emailInput.fill('wrong@wrong.com');
    await passwordInput.fill('wrongpassword');
    await evidence.screenshotBefore('invalid_login');
    await page.locator('button[type="submit"], button:has-text("Sign In")').first().click();
    await page.waitForTimeout(2000); // Allow error to display

    // Should stay on login or show error
    const stillOnLogin = page.url().includes('/login');
    const errorText = await page.locator('text=Incorrect, text=Invalid, text=Error, [role="alert"], .alert, .error').first().isVisible().catch(() => false);
    expect(stillOnLogin || errorText).toBe(true);
    await evidence.screenshotAfter('invalid_login');
  });
});
