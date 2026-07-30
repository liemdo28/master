/**
 * compliance-kpi-verify.js — Phase 13.9C
 * Verify Compliance KPI drilldown loads without errors on production.
 * Run: node qa/scripts/compliance-kpi-verify.js
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://dashboard.bakudanramen.com';
const EMAIL    = 'qa.bot@bakudanramen.com';
const PASSWORD = 'QA-Preview-2026!';
const OUT_DIR  = path.join(__dirname, '..', 'evidence', 'screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const routes = [
  '/overview/drilldown/compliance-risk',
  '/overview/drilldown/overdue-bills',
  '/overview/drilldown/critical-tasks',
];

async function checkRoute(page, route) {
  const errors = [];
  const pageErrors = [];

  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') pageErrors.push(msg.text());
  });

  const url = BASE_URL + route;
  console.log(`\nChecking: ${route}`);
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const status = response ? response.status() : 'unknown';
    const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');

    const hasContent = bodyText.length > 100;
    const hasError = [
      'Something went wrong', 'Internal Error', 'Fatal error',
      'Parse error', 'Notice: Undefined', 'SQLSTATE',
      '500 Internal', 'An internal error',
    ].some(e => bodyText.includes(e));

    const screenshot = path.join(OUT_DIR, `compliance-risk-${route.replace(/[\/\-]/g, '_')}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });

    console.log(`  Status: ${status}`);
    console.log(`  Content: ${hasContent ? 'YES' : 'NO (empty)'}`);
    console.log(`  Errors: ${pageErrors.length > 0 ? pageErrors.slice(0, 3).join(', ') : 'NONE'}`);
    console.log(`  Screenshot: ${path.basename(screenshot)}`);

    return {
      route,
      status,
      hasContent,
      hasInternalError: hasError,
      pageErrors: pageErrors.slice(0, 3),
      screenshot: path.basename(screenshot),
      pass: !hasError && hasContent && status < 400,
    };
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
    return { route, error: e.message, pass: false };
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  console.log('Phase 13.9C — Compliance KPI Verification');
  console.log('Base: ' + BASE_URL);

  // Login
  console.log('\nLogging in...');
  await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[name="email"], input[type="email"]', EMAIL);
  await page.fill('input[name="password"], input[type="password"]', PASSWORD);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForURL(/overview|dashboard|tasks/, { timeout: 15000 });
  console.log('Login OK — URL: ' + page.url());

  const results = [];
  for (const route of routes) {
    results.push(await checkRoute(page, route));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  for (const r of results) {
    const mark = r.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} ${r.route}`);
    if (r.error) console.log(`  Error: ${r.error}`);
  }

  const allPass = results.every(r => r.pass);
  console.log(`\nOverall: ${allPass ? '✅ ALL PASS' : '❌ SOME FAILED'}`);

  await browser.close();

  if (!allPass) process.exit(1);
})();
