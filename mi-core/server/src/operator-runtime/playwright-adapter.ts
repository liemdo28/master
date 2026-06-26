import { OperatorAction } from './types';
import path from 'path';
import fs from 'fs';

export interface PlaywrightActionResult {
  type: string;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

export interface PlaywrightAdapter {
  runAction(action: OperatorAction): Promise<PlaywrightActionResult>;
  getLastScreenshot(): string | null;
  getLastDownload(): string | null;
  getPageContent(): Promise<string | null>;
  close(): Promise<void>;
}

const SCREENSHOTS_DIR = path.join(process.cwd(), '.local-agent-global', 'operator-runtime', 'screenshots');
const DOWNLOADS_DIR = path.join(process.cwd(), '.local-agent-global', 'operator-runtime', 'downloads');

function ensureDir(p: string) {
  try { require('fs').mkdirSync(p, { recursive: true }); } catch { /* ignore */ }
}

function findExistingChromiumExecutable(): string | null {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return null;
  const root = path.join(localAppData, 'ms-playwright');
  if (!fs.existsSync(root)) return null;
  const candidates = fs.readdirSync(root)
    .filter((name) => name.startsWith('chromium-') || name.startsWith('chromium_headless_shell-'))
    .sort()
    .reverse()
    .flatMap((name) => [
      path.join(root, name, 'chrome-win64', 'chrome.exe'),
      path.join(root, name, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
    ]);
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function downloadToFile(url: string, filePath: string, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? require('https') : require('http');
    const request = client.get(parsed, (response: any) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        downloadToFile(new URL(response.headers.location, parsed).toString(), filePath, timeoutMs).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }
      const out = fs.createWriteStream(filePath);
      response.pipe(out);
      out.on('finish', () => out.close(() => resolve()));
      out.on('error', reject);
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Download timed out after ${timeoutMs}ms`));
    });
    request.on('error', reject);
  });
}

export class PlaywrightRunner implements PlaywrightAdapter {
  private _browser: unknown = null;
  private _context: unknown = null;
  private _page: unknown = null;
  private _lastScreenshot: string | null = null;
  private _lastDownload: string | null = null;
  private _errors: string[] = [];

  async init(): Promise<void> {
    try {
      const { chromium } = await import('playwright-core');
      try {
        this._browser = await chromium.launch({ headless: true });
      } catch (primary: any) {
        const executablePath = findExistingChromiumExecutable();
        if (!executablePath) throw primary;
        this._browser = await chromium.launch({ headless: true, executablePath });
      }
      this._context = await (this._browser as any).newContext();
      this._page = await (this._context as any).newPage();
    } catch (e: any) {
      this._errors.push(`Playwright init failed: ${e.message}`);
    }
  }

  async runAction(action: OperatorAction): Promise<PlaywrightActionResult> {
    if (!this._page) {
      await this.init();
    }
    if (!this._page) {
      return { type: action.type, ok: false, error: 'Playwright not initialized' };
    }

    const page = this._page as any;
    try {
      switch (action.type) {
        case 'navigate': {
          if (!action.url) return { type: action.type, ok: false, error: 'navigate requires url' };
          await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: (action.timeout_ms || 15000) });
          return { type: action.type, ok: true, result: { url: action.url } };
        }
        case 'read_title': {
          const title = await page.title();
          return { type: action.type, ok: true, result: { title } };
        }
        case 'read_text': {
          const text = action.selector
            ? await page.locator(action.selector).innerText().catch(() => '')
            : await page.content();
          return { type: action.type, ok: true, result: { text } };
        }
        case 'click': {
          if (!action.selector) return { type: action.type, ok: false, error: 'click requires selector' };
          await page.locator(action.selector).click({ timeout: action.timeout_ms || 5000 });
          return { type: action.type, ok: true };
        }
        case 'fill': {
          if (!action.selector || action.value === undefined) return { type: action.type, ok: false, error: 'fill requires selector and value' };
          await page.locator(action.selector).fill(action.value, { timeout: action.timeout_ms || 5000 });
          return { type: action.type, ok: true };
        }
        case 'screenshot': {
          ensureDir(SCREENSHOTS_DIR);
          const filename = `ss_${Date.now()}.png`;
          const filePath = path.join(SCREENSHOTS_DIR, filename);
          await page.screenshot({ path: filePath, fullPage: true });
          this._lastScreenshot = filePath;
          return { type: action.type, ok: true, result: { path: filePath } };
        }
        case 'download': {
          if (!action.url) return { type: action.type, ok: false, error: 'download requires url' };
          ensureDir(DOWNLOADS_DIR);
          const filename = action.filename || `download_${Date.now()}`;
          const filePath = path.join(DOWNLOADS_DIR, filename);
          try {
            await downloadToFile(action.url, filePath, action.timeout_ms || 10000);
            this._lastDownload = filePath;
            return { type: action.type, ok: true, result: { path: filePath } };
          } catch (e: any) {
            return { type: action.type, ok: false, error: `Download failed: ${e.message}` };
          }
        }
        case 'upload_test_file': {
          // No-op for safe test — no real uploads in MVP
          return { type: action.type, ok: true, result: { note: 'upload_test_file skipped in MVP' } };
        }
        case 'wait': {
          await page.waitForTimeout(action.timeout_ms || 1000);
          return { type: action.type, ok: true };
        }
        case 'extract_links': {
          const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map((a: HTMLAnchorElement) => ({ href: a.href, text: a.textContent?.trim() || '' }));
          });
          return { type: action.type, ok: true, result: { links } };
        }
        default:
          return { type: action.type, ok: false, error: `Unknown action type: ${action.type}` };
      }
    } catch (e: any) {
      return { type: action.type, ok: false, error: e.message };
    }
  }

  getLastScreenshot(): string | null { return this._lastScreenshot; }
  getLastDownload(): string | null { return this._lastDownload; }
  async getPageContent(): Promise<string | null> {
    if (!this._page) return null;
    try {
      return await (this._page as any).content();
    } catch {
      return null;
    }
  }
  getErrors(): string[] { return this._errors; }

  async close(): Promise<void> {
    try {
      if (this._context) await (this._context as any).close().catch(() => {});
      if (this._browser) await (this._browser as any).close().catch(() => {});
    } catch { /* ignore */ }
  }
}
