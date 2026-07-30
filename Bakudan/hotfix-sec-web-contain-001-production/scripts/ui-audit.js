const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://dashboard.bakudanramen.com';
const EMAIL = process.env.TEST_EMAIL || 'liem.dt0208@gmail.com';
const PASS = process.env.TEST_PASSWORD || '';
const OUT = path.join(__dirname, '..', 'test-results', 'ui-audit');

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, name: 'Desktop-1440' },
  tablet:  { width: 768,  height: 1024, name: 'Tablet-768' },
  mobile:  { width: 390,  height: 844, name: 'Mobile-390' },
};

// All accessible routes
const ROUTES = [
  { path: '/overview',              name: 'Overview',            needsAuth: true },
  { path: '/my-tasks',              name: 'My-Tasks',            needsAuth: true },
  { path: '/calendar',              name: 'Calendar',            needsAuth: true },
  { path: '/inbox',                 name: 'Inbox',               needsAuth: true },
  { path: '/bills',                 name: 'Bills',               needsAuth: true },
  { path: '/projects',              name: 'Projects',            needsAuth: true },
  { path: '/team',                  name: 'Team',                needsAuth: true },
  { path: '/my-workspace',          name: 'My-Workspace',        needsAuth: true },
  { path: '/notifications',         name: 'Notifications',       needsAuth: true },
  { path: '/activity',              name: 'Activity-Feed',       needsAuth: true },
  { path: '/control-tower',         name: 'Control-Tower',       needsAuth: true },
  { path: '/manager/command',       name: 'Manager-Command',     needsAuth: true },
  { path: '/action-center',         name: 'Action-Center',       needsAuth: true },
  { path: '/my-day',                name: 'My-Day',              needsAuth: true },
  { path: '/penalties',             name: 'My-Penalties',        needsAuth: true },
  { path: '/health',                name: 'Health',              needsAuth: true },
  { path: '/settings',              name: 'Settings',            needsAuth: true },
  { path: '/overview/drilldown/compliance-risk',  name: 'Drilldown-Compliance',  needsAuth: true },
  { path: '/overview/drilldown/overdue-bills',    name: 'Drilldown-OverdueBills', needsAuth: true },
  { path: '/overview/drilldown/critical-tasks',   name: 'Drilldown-Critical',     needsAuth: true },
  { path: '/overview/drilldown/penalty',          name: 'Drilldown-Penalty',      needsAuth: true },
  { path: '/search',                name: 'Search',              needsAuth: true },
];

const errors = [];

async function login(page) {
  console.log('Logging in...');
  await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[name="email"], input[type="email"]', EMAIL);
  await page.fill('input[name="password"], input[type="password"]', PASS);
  await page.click('button[type="submit"], input[type="submit"]');
  await page.waitForURL(/(overview|dashboard|my-tasks)/, { timeout: 15000 });
  console.log('Logged in: ' + page.url());
}

async function auditRoute(page, route, vpName) {
  const url = BASE + route.path;
  const screenshotDir = path.join(OUT, vpName);
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

  const ssFile = path.join(screenshotDir, `${route.name}.png`);
  const issues = [];

  try {
    // Navigate
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Check for internal error
    const bodyText = await page.evaluate(() => document.body ? document.body.innerText : '');
    const hasError = ['Something went wrong', 'Internal Error', 'Fatal error', 'Parse error',
                      'Notice: Undefined', 'Warning:', 'SQLSTATE', '500 Internal Server Error'].some(e => bodyText.includes(e));
    if (hasError) issues.push('INTERNAL_ERROR');

    // Check horizontal scroll
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await page.evaluate(() => document.documentElement.clientWidth);
    if (scrollW > clientW + 2) issues.push(`HORIZONTAL_SCROLL:${scrollW}>${clientW}`);

    // Check content length
    if (bodyText.length < 50) issues.push(`EMPTY_CONTENT:${bodyText.length}`);

    // Check for dead links (broken images)
    const brokenImages = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img');
      return Array.from(imgs).filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src);
    });
    if (brokenImages.length > 0) issues.push(`BROKEN_IMAGES:${brokenImages.length}`);

    // Take screenshot
    await page.screenshot({ path: ssFile, fullPage: false });

    const status = issues.length === 0 ? '✅' : '❌';
    console.log(`${status} [${vpName}] ${route.name}: ${issues.length === 0 ? 'OK' : issues.join(', ')}`);
  } catch (err) {
    issues.push(`EXCEPTION:${err.message.substring(0, 80)}`);
    console.log(`❌ [${vpName}] ${route.name}: EXCEPTION - ${err.message.substring(0, 80)}`);
  }

  if (issues.length > 0) {
    errors.push({ viewport: vpName, route: route.path, name: route.name, issues });
  }
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  for (const [vpKey, vp] of Object.entries(VIEWPORTS)) {
    console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      userAgent: vp.width <= 768
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    const page = await ctx.newPage();

    // Collect console errors
    const consoleErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    try {
      await login(page);
      for (const route of ROUTES) {
        await auditRoute(page, route, vp.name);
      }
    } catch (e) {
      console.log(`FATAL: ${e.message}`);
    }
    await ctx.close();
  }

  await browser.close();

  // Write error report
  const report = {
    timestamp: new Date().toISOString(),
    totalTests: ROUTES.length * Object.keys(VIEWPORTS).length,
    errors: errors,
    verdict: errors.length === 0 ? 'ALL_PASS' : 'ISSUES_FOUND'
  };
  fs.writeFileSync(path.join(OUT, 'audit-report.json'), JSON.stringify(report, null, 2));
  console.log(`\n=== AUDIT COMPLETE: ${report.totalTests} pages checked, ${errors.length} issues found ===`);
})();
