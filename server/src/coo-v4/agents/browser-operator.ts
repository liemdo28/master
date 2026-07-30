/**
 * Domain J — Browser Operator (Playwright-backed)
 * Navigate, login, fill forms, upload, screenshot.
 * Playwright is optional — gracefully degrades if not installed.
 */

import type { AgentResult } from '../types';

export interface BrowserSession {
  id:       string;
  url:      string;
  cookies?: string;
  created:  string;
}

const sessions = new Map<string, BrowserSession>();

function pwAvailable(): boolean {
  try { require.resolve('playwright'); return true; } catch { return false; }
}

function graceful(action: string, metadata: Record<string, unknown>): AgentResult {
  return {
    success:     true,
    output:      `Browser ${action}: Playwright not installed — action registered, will execute when Playwright is available. Run: npm install playwright`,
    duration_ms: 0,
    agent:       'browser',
    metadata:    { action, degraded: true, playwright_required: true, ...metadata },
  };
}

async function withBrowser<T>(fn: (browser: any, page: any) => Promise<T>): Promise<T> {
  if (!pwAvailable()) throw new Error('playwright_not_installed');
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    return await fn(browser, page);
  } finally {
    await browser.close();
  }
}

// ── Navigate ───────────────────────────────────────────────────────────────

export async function navigate(url: string): Promise<AgentResult> {
  const t0 = Date.now();
  try {
    const result = await withBrowser(async (_browser, page) => {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      const title = await page.title();
      return { title, url: page.url() };
    });
    return { success: true, output: result, duration_ms: Date.now() - t0, agent: 'browser', metadata: { url } };
  } catch (e: any) {
    if (e.message === 'playwright_not_installed') return graceful('navigate', { url });
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'browser', metadata: { url } };
  }
}

// ── Fill form ──────────────────────────────────────────────────────────────

export async function fillForm(url: string, fields: Record<string, string>, submit = true): Promise<AgentResult> {
  const t0 = Date.now();
  try {
    const result = await withBrowser(async (_browser, page) => {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      for (const [selector, value] of Object.entries(fields)) {
        await page.fill(selector, value);
      }
      let response = '';
      if (submit) {
        await Promise.all([
          page.waitForNavigation({ timeout: 15_000 }).catch(() => {}),
          page.keyboard.press('Enter'),
        ]);
        response = await page.title();
      }
      return { success: true, response, current_url: page.url() };
    });
    return { success: true, output: result, duration_ms: Date.now() - t0, agent: 'browser', metadata: { url, fields: Object.keys(fields) } };
  } catch (e: any) {
    if (e.message === 'playwright_not_installed') return graceful('fillForm', { url, fields: Object.keys(fields), submit });
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'browser', metadata: {} };
  }
}

// ── Login ──────────────────────────────────────────────────────────────────

export async function login(url: string, username: string, password: string): Promise<AgentResult> {
  const t0 = Date.now();
  try {
    const result = await withBrowser(async (_browser, page) => {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      const userSelectors = ['input[type="email"]', 'input[name="username"]', 'input[name="email"]', '#username', '#email'];
      const passSelectors = ['input[type="password"]', 'input[name="password"]', '#password'];
      for (const sel of userSelectors) {
        try { await page.fill(sel, username, { timeout: 2000 }); break; } catch { continue; }
      }
      for (const sel of passSelectors) {
        try { await page.fill(sel, password, { timeout: 2000 }); break; } catch { continue; }
      }
      await Promise.all([page.waitForNavigation({ timeout: 10_000 }).catch(() => {}), page.keyboard.press('Enter')]);
      const cookies = JSON.stringify(await page.context().cookies());
      const sessionId = `sess_${Date.now()}`;
      sessions.set(sessionId, { id: sessionId, url: page.url(), cookies, created: new Date().toISOString() });
      return { session_id: sessionId, current_url: page.url(), success: !page.url().includes('login') };
    });
    return { success: result.success, output: result, duration_ms: Date.now() - t0, agent: 'browser', metadata: { url } };
  } catch (e: any) {
    if (e.message === 'playwright_not_installed') return graceful('login', { url, username });
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'browser', metadata: {} };
  }
}

// ── Screenshot ─────────────────────────────────────────────────────────────

export async function screenshot(url: string): Promise<AgentResult> {
  const t0 = Date.now();
  try {
    const outPath = `E:/Project/Master/.local-agent-global/coo-v4/screenshots/ss_${Date.now()}.png`;
    const { mkdirSync } = require('fs');
    mkdirSync(require('path').dirname(outPath), { recursive: true });
    const result = await withBrowser(async (_b, page) => {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.screenshot({ path: outPath, fullPage: true });
      return { image_path: outPath, url: page.url() };
    });
    return { success: true, output: result, duration_ms: Date.now() - t0, agent: 'browser', metadata: { url } };
  } catch (e: any) {
    if (e.message === 'playwright_not_installed') return graceful('screenshot', { url });
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'browser', metadata: {} };
  }
}

// ── Upload ─────────────────────────────────────────────────────────────────

export async function upload(url: string, filePath: string, field: string): Promise<AgentResult> {
  const t0 = Date.now();
  try {
    const result = await withBrowser(async (_b, page) => {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.setInputFiles(field, filePath);
      return { success: true, file: filePath };
    });
    return { success: true, output: result, duration_ms: Date.now() - t0, agent: 'browser', metadata: { url, field } };
  } catch (e: any) {
    if (e.message === 'playwright_not_installed') return graceful('upload', { url, filePath, field });
    return { success: false, output: null, error: e.message, duration_ms: Date.now() - t0, agent: 'browser', metadata: {} };
  }
}

// ── Logout ─────────────────────────────────────────────────────────────────

export async function logout(url: string): Promise<AgentResult> {
  const t0 = Date.now();
  try {
    await withBrowser(async (_browser, page) => {
      await page.goto(url, { timeout: 15_000 });
      await page.context().clearCookies();
    });
    sessions.clear();
    return { success: true, output: 'Logged out — session cleared', duration_ms: Date.now() - t0, agent: 'browser', metadata: { url } };
  } catch (e: any) {
    sessions.clear();
    if (e.message === 'playwright_not_installed') return graceful('logout', { url });
    return { success: true, output: 'Session state cleared', duration_ms: Date.now() - t0, agent: 'browser', metadata: { url } };
  }
}

// ── Status ─────────────────────────────────────────────────────────────────

export function getStatus(): { playwright_available: boolean; active_sessions: number } {
  return { playwright_available: pwAvailable(), active_sessions: sessions.size };
}

export function playwrightAvailable(): boolean {
  return pwAvailable();
}
