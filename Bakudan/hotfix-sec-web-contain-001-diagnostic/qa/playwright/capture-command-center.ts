/**
 * Phase 1 — Command Center Screenshot Capture
 * Run: npx playwright test qa/playwright/capture-command-center.ts
 * Produces 4 screenshots in qa/artifacts/command-center/
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREEN_DIR = path.join(__dirname, '..', 'artifacts', 'command-center');
if (!fs.existsSync(SCREEN_DIR)) fs.mkdirSync(SCREEN_DIR, { recursive: true });

test.describe('Command Center screenshots', () => {

  test('capture all 4 queue views', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'qa.bot@bakudanramen.com');
    await page.fill('input[name="password"]', 'QA-Preview-2026!');
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');

    // 4 views to capture
    const views = [
      { name: '01-my-work',     bucket: 'my_work',  title: 'My Work' },
      { name: '02-reviewer',    bucket: 'review',   title: 'Reviewer Queue' },
      { name: '03-approver',    bucket: 'approve',  title: 'Approver Queue' },
      { name: '04-critical',    bucket: 'critical', title: 'Critical / Overdue' },
    ];

    for (const view of views) {
      await page.goto(`/command-center?bucket=${view.bucket}`, { waitUntil: 'networkidle' });
      // Wait for JS to populate the queue
      await page.waitForTimeout(2500);

      const file = path.join(SCREEN_DIR, `${view.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`Captured ${view.name}: ${view.title} → ${file}`);
    }
  });
});
