/**
 * 00 - Auth Setup
 * Logs in and saves session state for subsequent tests.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const AUTH_DIR = path.join(__dirname, '.auth');
const SESSION_FILE = path.join(AUTH_DIR, 'session.json');

const EMAIL = process.env.TEST_EMAIL || 'liem.dt0208@gmail.com';
const PASSWORD = process.env.TEST_PASSWORD || 'admin';

setup('authenticate and save session', async ({ page }) => {
  // Ensure .auth directory exists
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  // Clear any stale session
  if (fs.existsSync(SESSION_FILE)) {
    fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookies: [], origins: [] }));
  }

  // Navigate to login page directly
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Check for server error page
  const pageContent = await page.content();
  if (pageContent.includes('Something went wrong') || pageContent.includes('Fatal error') || pageContent.includes('Failed opening required')) {
    const errorMsg = await page.locator('code').first().textContent().catch(() => 'unknown');
    throw new Error(`SERVER ERROR on login page: ${errorMsg}`);
  }

  // Check if we're on login page or already authenticated
  const currentUrl = page.url();

  if (currentUrl.includes('/login')) {
    // On login page - fill credentials
    const emailInput = page.locator('input[name="email"], input[type="email"], [placeholder*="you@"]').first();
    await expect(emailInput).toBeVisible({ timeout: 10_000 });

    await emailInput.fill(EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(PASSWORD);
    await page.locator('button[type="submit"], button:has-text("Sign In")').first().click();

    // Wait for redirect to dashboard
    await page.waitForURL(/\/(dashboard|overview|my-tasks|my-day|control-tower|tasks)/, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/login/);
    console.log('[AUTH] Login successful.');
  } else {
    // Already authenticated
    console.log('[AUTH] Already authenticated at:', currentUrl);
  }

  // Save storage state
  await page.context().storageState({ path: SESSION_FILE });
});
