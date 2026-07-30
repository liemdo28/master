/**
 * Toast POS Connector — Playwright browser automation
 * Uses headless Chromium to scrape Toast Merchant Portal.
 * No paid API required.
 */

import { ingestJson } from '../../ingestion-service';

const TOAST_EMAIL    = process.env.TOAST_EMAIL    || '';
const TOAST_PASSWORD = process.env.TOAST_PASSWORD || '';
const SOURCE_NAME    = 'toast-pos';

interface ToastSalesData extends Record<string, unknown> {
  date: string;
  net_sales: number;
  gross_sales: number;
  orders: number;
  avg_ticket: number;
  refunds: number;
  labor_cost?: number;
  top_items?: { name: string; qty: number; revenue: number }[];
  source: 'playwright';
  captured_at: string;
}

async function scrapeToast(): Promise<ToastSalesData | null> {
  let chromium: typeof import('playwright').chromium;
  try {
    const playwright = await import('playwright');
    chromium = playwright.chromium;
  } catch {
    console.warn('[Toast] playwright not installed — run: npm install playwright');
    return null;
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await ctx.newPage();

  try {
    // Login
    await page.goto('https://pos.toasttab.com/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[type="email"], input[name="email"], #email', TOAST_EMAIL);
    await page.fill('input[type="password"], input[name="password"], #password', TOAST_PASSWORD);
    await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")');
    await page.waitForURL('**/reports**', { timeout: 15000 }).catch(() => {});

    // Navigate to daily sales report
    await page.goto('https://pos.toasttab.com/reports/sales-summary', {
      waitUntil: 'networkidle',
      timeout: 20000,
    }).catch(async () => {
      // Fallback — try dashboard
      await page.goto('https://pos.toasttab.com/dashboard', { waitUntil: 'networkidle', timeout: 15000 });
    });

    // Extract visible sales figures via page eval
    const data = await page.evaluate(() => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const doc = (globalThis as any).document as { querySelector(s: string): { innerText?: string } | null };
      const getText = (sel: string) => (doc.querySelector(sel)?.innerText || '').replace(/[^0-9.]/g, '') || '0';
      return {
        net_sales:   parseFloat(getText('[data-testid="net-sales"], .net-sales, [class*="netSales"]')) || 0,
        gross_sales: parseFloat(getText('[data-testid="gross-sales"], .gross-sales, [class*="grossSales"]')) || 0,
        orders:      parseInt(getText('[data-testid="order-count"], .order-count, [class*="orderCount"]'), 10) || 0,
        avg_ticket:  parseFloat(getText('[data-testid="avg-ticket"], .avg-ticket, [class*="avgTicket"]')) || 0,
        refunds:     parseFloat(getText('[data-testid="refunds"], .refunds, [class*="refunds"]')) || 0,
      };
    });

    const today = new Date().toISOString().slice(0, 10);
    return {
      date: today,
      ...data,
      source: 'playwright',
      captured_at: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[Toast] scrape failed:', (err as Error).message);
    return null;
  } finally {
    await browser.close();
  }
}

export async function ingestToast(): Promise<void> {
  if (!TOAST_EMAIL || !TOAST_PASSWORD) {
    console.warn('[Toast] TOAST_EMAIL / TOAST_PASSWORD not set — skipping ingest');
    return;
  }

  const data = await scrapeToast();
  if (!data) {
    console.warn('[Toast] No data scraped — skipping ingest');
    return;
  }

  await ingestJson({
    source_name: SOURCE_NAME,
    payload: data,
    filename: `toast_${data.date}.json`,
    actor: 'toast-playwright-connector',
  });

  console.log(`[Toast] Ingest complete — net_sales: $${data.net_sales}, orders: ${data.orders}`);
}

export async function getToastStatus(): Promise<{
  connected: boolean;
  credentials_set: boolean;
  last_scrape?: string;
  note: string;
}> {
  const credentials_set = !!(TOAST_EMAIL && TOAST_PASSWORD);
  if (!credentials_set) {
    return { connected: false, credentials_set: false, note: 'Set TOAST_EMAIL + TOAST_PASSWORD in .env' };
  }
  return {
    connected: true,
    credentials_set: true,
    note: 'Credentials set — call POST /api/bigdata/connectors/toast/sync to run scrape',
  };
}
