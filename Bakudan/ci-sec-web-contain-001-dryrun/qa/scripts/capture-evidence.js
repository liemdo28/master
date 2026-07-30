/**
 * Production Evidence Screenshot Capture
 * Captures screenshots of each QA phase on dashboard.bakudanramen.com
 * Run: node qa/scripts/capture-evidence.js
 * Requires: PROD_EMAIL and PROD_PASSWORD env vars (or hardcoded below for local use)
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://dashboard.bakudanramen.com';
const EMAIL    = process.env.PROD_EMAIL    || 'admin@bakudanramen.com';
const PASSWORD = process.env.PROD_PASSWORD || '';

const OUT_DIR = path.join(__dirname, '..', 'evidence', 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function shot(page, name, url) {
  if (url) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  ✅  ${name}.png`);
  return file;
}

(async () => {
  if (!PASSWORD) {
    console.error('Set PROD_PASSWORD env var before running.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page    = await ctx.newPage();

  // ── Login ───────────────────────────────────────────────────────────────────
  console.log('Logging in…');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="email"], input[type="email"]', EMAIL);
  await page.fill('input[name="password"], input[type="password"]', PASSWORD);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForURL(/dashboard|overview|tasks/, { timeout: 15000 });
  await shot(page, '00-login-success');

  // ── Phase K — Drilldowns ────────────────────────────────────────────────────
  console.log('Phase K — drilldowns…');
  await shot(page, 'K-01-overdue-bills',    `${BASE_URL}/overview/drilldown/overdue-bills`);
  await shot(page, 'K-02-critical-tasks',   `${BASE_URL}/overview/drilldown/critical-tasks`);
  await shot(page, 'K-03-unified-risk',     `${BASE_URL}/overview/drilldown/unified-risk`);
  await shot(page, 'K-04-cash-risk',        `${BASE_URL}/overview/drilldown/cash-risk`);
  await shot(page, 'K-05-finance-bills',    `${BASE_URL}/overview/drilldown/finance-bills`);
  await shot(page, 'K-06-execution-health', `${BASE_URL}/overview/drilldown/execution-health`);
  await shot(page, 'K-07-compliance-risk',  `${BASE_URL}/overview/drilldown/compliance-risk`);
  await shot(page, 'K-08-execution-risk',   `${BASE_URL}/overview/drilldown/execution-risk`);
  await shot(page, 'K-09-bills-rent',       `${BASE_URL}/overview/drilldown/bills/category/rent`);
  await shot(page, 'K-10-bills-store-2',    `${BASE_URL}/overview/drilldown/bills/store/2`);

  // ── Phase E — Admin Duplicates UI ───────────────────────────────────────────
  console.log('Phase E — /admin/duplicates…');
  await shot(page, 'E-01-duplicates-ui', `${BASE_URL}/admin/duplicates`);

  // ── Phase B — Bill creation form ────────────────────────────────────────────
  console.log('Phase B — bill form…');
  await shot(page, 'B-01-bill-create-form', `${BASE_URL}/bills/store/2`);

  // ── Phase C — Task quick-create modal ───────────────────────────────────────
  console.log('Phase C — task modal…');
  await shot(page, 'C-01-tasks-page', `${BASE_URL}/tasks`);

  // ── Phase I — AI Import ─────────────────────────────────────────────────────
  console.log('Phase I — AI import…');
  await shot(page, 'I-01-ai-import-bills', `${BASE_URL}/ai-import/bills`);

  // ── Bills Calendar ──────────────────────────────────────────────────────────
  console.log('Bills calendar…');
  await shot(page, 'bills-calendar', `${BASE_URL}/bills?view=calendar`);
  await shot(page, 'bills-list',     `${BASE_URL}/bills`);

  // ── Overview dashboard ──────────────────────────────────────────────────────
  console.log('Overview…');
  await shot(page, 'overview-dashboard', `${BASE_URL}/overview`);

  await browser.close();

  console.log(`\nAll screenshots saved to: ${OUT_DIR}`);
  console.log('Total:', fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).length, 'files');
})();
