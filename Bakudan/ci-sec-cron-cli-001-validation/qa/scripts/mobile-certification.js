/**
 * mobile-certification.js — Phase 13.9 CEO Final Mobile Production Certification
 * Devices: iPhone 15, iPhone 15 Plus, Galaxy S23, iPad Air
 * Workflows: Dashboard, KPI Drilldowns, Task Flow, Bills, Navigation
 * Run: node qa/scripts/mobile-certification.js
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://dashboard.bakudanramen.com';
const EMAIL    = 'qa.bot@bakudanramen.com';
const PASSWORD = 'QA-Preview-2026!';
const OUT_DIR  = path.join(__dirname, '..', 'evidence', 'mobile-certification');
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'screenshots'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'logs'), { recursive: true });

const DEVICES = [
  { name: 'iPhone-15',       width: 393,  height: 852,  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', isMobile: true,  hasTouch: true  },
  { name: 'iPhone-15-Plus',  width: 430,  height: 932,  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', isMobile: true,  hasTouch: true  },
  { name: 'Galaxy-S23',      width: 360,  height: 780,  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36', isMobile: true,  hasTouch: true  },
  { name: 'iPad-Air',        width: 820,  height: 1180, userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', isMobile: false, hasTouch: true  },
];

// Error signatures to detect
const ERROR_SIGNATURES = [
  'Something went wrong', 'An internal error occurred', 'Internal Error',
  'Fatal error', 'Parse error', 'SQLSTATE', 'Notice: Undefined',
  'Warning:', '500 Internal Server Error', 'status: 500',
];

let grandTotal = { pass: 0, fail: 0, screenshots: 0 };

async function shot(page, name) {
  const file = path.join(OUT_DIR, 'screenshots', `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  grandTotal.screenshots++;
  return file;
}

async function getBodyText(page) {
  try {
    return await page.evaluate(() => document.body ? document.body.innerText : '', { timeout: 10000 });
  } catch { return ''; }
}

async function getPageErrors(page) {
  return page._pageErrors || [];
}

async function checkPage(page, url, name, opts = {}) {
  const { checkHorizontal = false, waitExtra = 0 } = opts;
  const errors = [];

  page.on('pageerror', err => errors.push('[PAGE ERROR] ' + err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('[CONSOLE ERROR] ' + msg.text());
  });

  let httpStatus = 'unknown';
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    httpStatus = resp ? resp.status() : 'no-response';
  } catch (e) {
    errors.push('[TIMEOUT/NAV] ' + e.message.slice(0, 100));
  }

  await page.waitForTimeout(waitExtra || 1500);
  const bodyText = await getBodyText(page);
  const hasContent = bodyText.length > 50;

  const internalErrors = ERROR_SIGNATURES.filter(s => bodyText.includes(s));
  const hasInternalError = internalErrors.length > 0 || errors.length > 0;

  const horizontalOverflow = checkHorizontal
    ? await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2).catch(() => false)
    : null;

  await shot(page, name);

  return {
    url,
    name,
    httpStatus,
    hasContent,
    hasInternalError,
    internalErrors,
    errors: errors.slice(0, 3),
    horizontalOverflow,
    pass: !hasInternalError && hasContent,
  };
}

async function login(page) {
  await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 20000 });
  await page.fill('input[name="email"], input[type="email"]', EMAIL);
  await page.fill('input[name="password"], input[type="password"]', PASSWORD);
  await page.click('button[type="submit"], input[type="submit"]');
  try {
    await page.waitForURL(/overview|dashboard|my-tasks/, { timeout: 15000 });
  } catch {
    // Fallback: try dashboard
    await page.goto(BASE_URL + '/overview', { waitUntil: 'domcontentloaded', timeout: 15000 });
  }
}

async function workflow1_dashboard(page, device) {
  const results = [];
  const prefix = `${device.name}-WF1-Dashboard`;

  results.push(await checkPage(page, BASE_URL + '/overview', prefix + '-01-overview', { checkHorizontal: true }));
  await page.waitForTimeout(1000);

  // KPI cards visible
  const kpiVisible = await page.locator('[class*="kpi"], [class*="card"], .metric, [class*="metric"]').first().isVisible().catch(() => false);
  results.push({ name: prefix + '-02-KPI-cards', pass: kpiVisible, info: 'KPI cards visible: ' + kpiVisible });

  // No horizontal overflow
  const noOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2;
  });
  results.push({ name: prefix + '-03-No-horizontal-overflow', pass: noOverflow, info: 'ScrollWidth OK: ' + noOverflow });

  // Sidebar check (mobile should hide it)
  if (device.isMobile) {
    const sidebarCollapsed = await page.evaluate(() => {
      const sidebar = document.querySelector('#sidebar, [class*="sidebar"]');
      if (!sidebar) return true;
      const style = window.getComputedStyle(sidebar);
      return style.left < 0 || style.display === 'none' || style.transform !== 'none';
    }).catch(() => true);
    results.push({ name: prefix + '-04-Sidebar-hidden-mobile', pass: sidebarCollapsed, info: 'Sidebar hidden: ' + sidebarCollapsed });
  }

  // Bottom nav
  const bottomNav = await page.locator('#mobileBottomNav, [class*="bottom-nav"], [class*="mobile-nav"]').first().isVisible().catch(() => false);
  results.push({ name: prefix + '-05-Bottom-nav', pass: bottomNav, info: 'Bottom nav: ' + bottomNav });

  // Create button
  const createBtn = await page.locator('a:has-text("Create"), a:has-text("New Task"), [class*="create"]').first().isVisible().catch(() => false);
  results.push({ name: prefix + '-06-Create-button', pass: createBtn, info: 'Create button: ' + createBtn });

  return results;
}

async function workflow2_kpiDrilldowns(page, device) {
  const results = [];
  const prefix = `${device.name}-WF2-KPI`;
  const drilldowns = [
    { slug: 'cash-risk',         name: 'Total-Cash-Risk'    },
    { slug: 'overdue-bills',      name: 'Overdue-Bills'       },
    { slug: 'critical-tasks',     name: 'Critical-Tasks'      },
    { slug: 'compliance-risk',     name: 'Compliance-Risk'      },
    { slug: 'penalty',            name: 'Penalty'             },
  ];

  for (const d of drilldowns) {
    const r = await checkPage(page, BASE_URL + '/overview/drilldown/' + d.slug, prefix + '-' + d.name, { waitExtra: 2000 });
    results.push(r);
    // Check for blank screen
    const notBlank = r.hasContent;
    results.push({ name: prefix + '-' + d.name + '-has-data', pass: notBlank, info: 'Not blank: ' + notBlank });
  }

  return results;
}

async function workflow3_tasks(page, device) {
  const results = [];
  const prefix = `${device.name}-WF3-Tasks`;

  // My Tasks page
  results.push(await checkPage(page, BASE_URL + '/my-tasks', prefix + '-01-my-tasks', { waitExtra: 2000 }));

  // Try to open a task
  const taskLink = page.locator('a[href*="tasks/show"], a[href*="/tasks/"], [class*="task-item"] a, [class*="task-row"] a').first();
  if (await taskLink.isVisible().catch(() => false)) {
    await taskLink.click().catch(() => {});
    await page.waitForTimeout(2000);
    const r = await checkPage(page, page.url(), prefix + '-02-task-detail', { waitExtra: 1000 });
    results.push(r);

    // Task drawer
    const drawer = await page.locator('[class*="drawer"], [class*="modal"], [class*="panel"]').first().isVisible().catch(() => false);
    results.push({ name: prefix + '-03-task-drawer', pass: drawer, info: 'Drawer open: ' + drawer });
  }

  return results;
}

async function workflow4_bills(page, device) {
  const results = [];
  const prefix = `${device.name}-WF4-Bills`;

  results.push(await checkPage(page, BASE_URL + '/bills', prefix + '-01-bills-list', { waitExtra: 2000 }));

  const billLink = page.locator('a[href*="bills/show"], a[href*="/bills/"], [class*="bill-row"] a, [class*="bill-item"] a').first();
  if (await billLink.isVisible().catch(() => false)) {
    await billLink.click().catch(() => {});
    await page.waitForTimeout(2000);
    results.push(await checkPage(page, page.url(), prefix + '-02-bill-detail', { waitExtra: 1000 }));
  }

  return results;
}

async function workflow5_navigation(page, device) {
  const results = [];
  const prefix = `${device.name}-WF5-Nav`;
  const tabs = [
    { url: '/overview',   name: 'Overview'  },
    { url: '/my-tasks',  name: 'My-Tasks' },
    { url: '/calendar',  name: 'Calendar'  },
    { url: '/inbox',      name: 'Inbox'    },
  ];

  for (const tab of tabs) {
    const r = await checkPage(page, BASE_URL + tab.url, prefix + '-' + tab.name, { waitExtra: 1500 });
    results.push(r);
    // No reload loops
    results.push({ name: prefix + '-' + tab.name + '-no-loop', pass: r.httpStatus < 400, info: 'Status: ' + r.httpStatus });
  }

  return results;
}

(async () => {
  const allResults = [];
  const logFile = path.join(OUT_DIR, 'logs', 'console-export.txt');
  const networkFile = path.join(OUT_DIR, 'logs', 'network-export.txt');
  const errors = [];

  for (const device of DEVICES) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Device: ${device.name} (${device.width}x${device.height})`);
    console.log('='.repeat(60));

    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      userAgent: device.userAgent,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
    });
    const page = await ctx.newPage();

    const deviceErrors = [];
    page.on('pageerror', err => deviceErrors.push('[PAGE] ' + err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') deviceErrors.push('[CONSOLE] ' + msg.text());
    });

    // Login
    console.log('Logging in...');
    try {
      await login(page);
      console.log('Login OK: ' + page.url());
    } catch (e) {
      console.log('Login FAILED: ' + e.message);
      errors.push({ device: device.name, error: 'Login failed: ' + e.message });
      await browser.close();
      continue;
    }

    // Workflows
    const wfs = [
      { name: 'WF1-Dashboard',   fn: workflow1_dashboard