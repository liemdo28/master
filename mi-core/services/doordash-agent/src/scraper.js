/**
 * DoorDash Merchant Portal scraper using Playwright.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { waitForDoorDashOTP } = require('./gmail-otp');

const SESSION_DIR = path.join(__dirname, '../data/sessions');
const PORTAL_URL = 'https://merchant-portal.doordash.com/';
const LOGIN_URL = 'https://identity.doordash.com/auth/user/login?layout=merchant_web_v2&redirect_uri=https%3A%2F%2Fmerchant-portal.doordash.com%2Fauth_callback';

function sessionPath(accountId) {
  return path.join(SESSION_DIR, `${accountId}.json`);
}

function saveSession(accountId, cookies) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  fs.writeFileSync(sessionPath(accountId), JSON.stringify({ cookies, savedAt: Date.now() }, null, 2));
}

function loadSession(accountId) {
  try {
    const p = sessionPath(accountId);
    if (!fs.existsSync(p)) return null;
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    if (Date.now() - data.savedAt > 8 * 60 * 60 * 1000) return null;
    return data;
  } catch { return null; }
}

async function login(page, account) {
  console.log(`[${account.id}] Navigating to merchant portal...`);

  // Navigate to portal — it will redirect to identity login page
  await page.goto(PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  console.log(`[${account.id}] URL after nav: ${currentUrl}`);

  // Check if already on portal (session still valid)
  // DoorDash may redirect to www.doordash.com/merchant/... or merchant-portal.doordash.com
  const isAuthenticated = (
    (currentUrl.includes('merchant-portal.doordash.com') || currentUrl.includes('doordash.com/merchant')) &&
    !currentUrl.includes('login') && !currentUrl.includes('auth') && !currentUrl.includes('identity')
  );
  if (isAuthenticated) {
    console.log(`[${account.id}] Already authenticated`);
    return true;
  }

  try {
    // Wait for email field — DoorDash uses specific data-testid attrs
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[autocomplete="email"]',
      '[data-testid="email-input"]',
    ];

    let emailFilled = false;
    for (const sel of emailSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5000 });
        await page.fill(sel, account.email);
        emailFilled = true;
        console.log(`[${account.id}] Filled email with selector: ${sel}`);
        break;
      } catch { continue; }
    }

    if (!emailFilled) {
      // Take screenshot to see what's on page
      const ss = path.join(SESSION_DIR, `${account.id}-login-debug.png`);
      await page.screenshot({ path: ss });
      console.log(`[${account.id}] Could not find email field. Screenshot: ${ss}`);
      return false;
    }

    await page.waitForTimeout(500);

    // Click Continue/Next
    const nextSelectors = [
      'button:has-text("Continue to Log In")',
      'button:has-text("Continue")',
      'button:has-text("Log in")',
      'button:has-text("Sign in")',
      '[data-testid="submit-button"]',
      'button[type="submit"]',
    ];

    for (const sel of nextSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible()) {
          await btn.click();
          break;
        }
      } catch { continue; }
    }

    await page.waitForTimeout(2000);

    // Fill password (may be on same or next page)
    const passSelectors = [
      '[data-testid="password-input"]',
      'input[name="password"]',
      'input[type="password"]',
      'input[autocomplete="current-password"]',
    ];

    let passFilled = false;
    for (const sel of passSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5000 });
        await page.fill(sel, account.password);
        passFilled = true;
        console.log(`[${account.id}] Filled password with selector: ${sel}`);
        break;
      } catch { continue; }
    }

    if (!passFilled) {
      const ss = path.join(SESSION_DIR, `${account.id}-pass-debug.png`);
      await page.screenshot({ path: ss });
      console.log(`[${account.id}] Could not find password field. Screenshot: ${ss}`);
      return false;
    }

    await page.waitForTimeout(500);

    // Submit
    for (const sel of nextSelectors) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible()) {
          await btn.click();
          break;
        }
      } catch { continue; }
    }

    // Wait for redirect to portal
    await page.waitForTimeout(5000);

    const finalUrl = page.url();
    console.log(`[${account.id}] Final URL: ${finalUrl}`);

    // Check for 2FA on page (DoorDash shows it on same URL)
    const bodyText = await page.textContent('body').catch(() => '');
    if (bodyText.includes('two-factor') || bodyText.includes('2-Step Verification') || bodyText.includes('6-digit')) {
      console.log(`[${account.id}] 2FA detected — requesting OTP from Gmail...`);
      const otp = await waitForDoorDashOTP(account.email, 90000);
      if (!otp) {
        const ss = path.join(SESSION_DIR, `${account.id}-2fa-timeout.png`);
        await page.screenshot({ path: ss });
        return '2FA_TIMEOUT';
      }
      // Enter OTP
      const otpInput = await page.$('input[name="otp"], input[autocomplete="one-time-code"], input[inputmode="numeric"], input[type="text"], input[type="tel"]');
      if (otpInput) {
        await otpInput.fill(otp);
        await page.waitForTimeout(500);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(5000);
        console.log(`[${account.id}] OTP entered: ${otp}, URL: ${page.url()}`);
      } else {
        console.log(`[${account.id}] Could not find OTP input field`);
        return '2FA_INPUT_NOT_FOUND';
      }
    }

    const currentUrl = page.url();
    const loginSuccess = (
      (currentUrl.includes('merchant-portal.doordash.com') || currentUrl.includes('doordash.com/merchant')) &&
      !currentUrl.includes('login') && !currentUrl.includes('identity')
    );
    if (loginSuccess) {
      console.log(`[${account.id}] Login successful`);
      return true;
    }

    // Still on auth page — login failed
    const ss = path.join(SESSION_DIR, `${account.id}-login-fail.png`);
    await page.screenshot({ path: ss });
    console.log(`[${account.id}] Login failed, URL: ${currentUrl}`);
    return false;

  } catch (err) {
    console.error(`[${account.id}] Login error: ${err.message}`);
    return false;
  }
}

async function extractStoreList(page) {
  return page.evaluate(() => {
    // DoorDash merchant portal has a store selector or store list
    // Look for any element with store names
    const allText = document.body.innerText;
    return { bodyText: allText.slice(0, 5000), fullText: allText };
  });
}

async function scrapeMetrics(page, accountId) {
  const metrics = {
    account_id: accountId,
    scraped_at: new Date().toISOString(),
    stores: [],
    error: null,
  };

  try {
    // Navigate to analytics and wait for SPA to fully render
    const analyticsUrls = [
      `${PORTAL_URL}analytics`,
      `${PORTAL_URL}home`,
      `${PORTAL_URL}reports`,
    ];

    let loaded = false;
    for (const url of analyticsUrls) {
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
        // Wait extra time for React SPA to hydrate and render data
        await page.waitForTimeout(5000);
        loaded = true;
        const ss = path.join(SESSION_DIR, `${accountId}-analytics.png`);
        await page.screenshot({ path: ss, fullPage: true });
        break;
      } catch { continue; }
    }

    if (!loaded) {
      // Fallback: take screenshot of whatever loaded
      const ss = path.join(SESSION_DIR, `${accountId}-portal.png`);
      await page.screenshot({ path: ss, fullPage: true });
    }

    // Extract data using Playwright evaluate (reads from DOM after render)
    const pageData = await page.evaluate(() => {
      const data = {
        bodyText: document.body.innerText.slice(0, 8000),
        allElements: [],
        numbers: [],
        dollarAmounts: [],
      };

      // Walk all text nodes to find meaningful data
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent.trim();
        if (text && text.length > 0 && text.length < 200) {
          data.allElements.push(text);
        }
      }

      // Find dollar amounts anywhere
      const dollarPattern = /\$[\d,]+(?:\.\d{2})?/g;
      let match;
      const fullText = document.body.innerText;
      while ((match = dollarPattern.exec(fullText)) !== null) {
        data.dollarAmounts.push(match[0]);
      }

      // Find standalone numbers that might be order counts
      const numPattern = /\b(\d{1,6})\b/g;
      while ((match = numPattern.exec(fullText)) !== null) {
        const n = parseInt(match[1]);
        if (n > 0 && n < 10000) data.numbers.push(n);
      }

      // Look for specific DoorDash data elements
      const metrics = {};
      const elements = document.querySelectorAll('[data-testid]');
      elements.forEach(el => {
        const testId = el.getAttribute('data-testid');
        metrics[testId] = el.textContent.trim().slice(0, 200);
      });
      data.testIdElements = metrics;

      return data;
    });

    const store = {
      store_name: 'default',
      page_url: page.url(),
      orders_today: null,
      orders_week: null,
      revenue_today: null,
      revenue_week: null,
      avg_rating: null,
      total_reviews: null,
    };

    // Parse from extracted data
    const allText = pageData.bodyText;
    const elements = pageData.allElements || [];

    // Find dollar amounts for revenue
    if (pageData.dollarAmounts.length > 0) {
      store.revenue_today = pageData.dollarAmounts[0].replace('$', '').replace(',', '');
    }

    // Search all text elements for order/revenue patterns
    for (const el of elements) {
      const lower = el.toLowerCase();
      if (lower.includes('order') && lower.match(/\d/)) {
        const num = el.match(/(\d+)/);
        if (num) store.orders_today = parseInt(num[1]);
      }
      if (lower.includes('revenue') || lower.includes('net sale')) {
        const amt = el.match(/\$([\d,]+(?:\.\d{2})?)/);
        if (amt) store.revenue_today = amt[1].replace(',', '');
      }
      if (lower.includes('rating') || lower.includes('star')) {
        const rt = el.match(/([3-5]\.\d)/);
        if (rt) store.avg_rating = parseFloat(rt[1]);
      }
    }

    // Store store-specific name if available
    if (elements.length > 0) {
      store.raw_elements_count = elements.length;
    }

    store.raw_text_snippet = allText.slice(0, 1000);
    store.raw_elements = elements.slice(0, 100);
    store.dollar_amounts = pageData.dollarAmounts;
    metrics.stores.push(store);

  } catch (err) {
    metrics.error = err.message;
  }

  return metrics;
}

async function runScrape(account, headless = true) {
  const browser = await chromium.launch({
    headless,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  // Restore saved session cookies
  const session = loadSession(account.id);
  if (session?.cookies?.length) {
    await context.addCookies(session.cookies);
    console.log(`[${account.id}] Restored ${session.cookies.length} cookies`);
  }

  const page = await context.newPage();

  try {
    const loginResult = await login(page, account);

    if (loginResult === '2FA_REQUIRED') {
      await browser.close();
      return { account_id: account.id, brand: account.brand, error: '2FA_REQUIRED', scraped_at: new Date().toISOString(), stores: [] };
    }

    if (!loginResult) {
      await browser.close();
      return { account_id: account.id, brand: account.brand, error: 'LOGIN_FAILED', scraped_at: new Date().toISOString(), stores: [] };
    }

    // Save session
    const cookies = await context.cookies();
    saveSession(account.id, cookies);

    const metrics = await scrapeMetrics(page, account.id);
    await browser.close();
    return metrics;

  } catch (err) {
    try { await browser.close(); } catch {}
    return { account_id: account.id, error: err.message, scraped_at: new Date().toISOString(), stores: [] };
  }
}

module.exports = { runScrape };
