/**
 * Browser Agent — Playwright automation + Screenshot QA + Approval Layer
 * Runs headed or headless Chromium for UI testing and web automation.
 */

import * as fs from 'fs';
import * as path from 'path';

const EVIDENCE_DIR = path.join(
  process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global',
  'engineering', 'evidence'
);

export interface BrowserTask {
  url:         string;
  actions:     BrowserAction[];
  screenshot:  boolean;
  task_id?:    string;
}

export interface BrowserAction {
  type:    'click' | 'fill' | 'navigate' | 'wait' | 'screenshot' | 'evaluate';
  selector?: string;
  value?:    string;
  timeout?:  number;
}

export interface BrowserResult {
  success:      boolean;
  screenshots:  string[];   // file paths
  console_logs: string[];
  errors:       string[];
  latency_ms:   number;
}

export async function runBrowserTask(task: BrowserTask): Promise<BrowserResult> {
  const start = Date.now();
  const screenshots: string[] = [];
  const errors: string[] = [];
  const console_logs: string[] = [];

  // Dynamic import — playwright may not be installed
  let chromium: any;
  try {
    const pw = require('playwright');
    chromium = pw.chromium;
  } catch {
    return {
      success: false, screenshots: [], console_logs: [],
      errors: ['Playwright not installed. Run: npm install playwright'],
      latency_ms: Date.now() - start,
    };
  }

  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage();

  page.on('console', (msg: any) => console_logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err: any) => errors.push(err.message));

  try {
    await page.goto(task.url, { timeout: 30000, waitUntil: 'networkidle' });

    for (const action of task.actions) {
      const timeout = action.timeout || 10000;
      switch (action.type) {
        case 'click':
          await page.click(action.selector!, { timeout });
          break;
        case 'fill':
          await page.fill(action.selector!, action.value || '', { timeout });
          break;
        case 'navigate':
          await page.goto(action.value!, { timeout, waitUntil: 'networkidle' });
          break;
        case 'wait':
          await page.waitForTimeout(parseInt(action.value || '1000'));
          break;
        case 'evaluate':
          await page.evaluate(action.value!);
          break;
        case 'screenshot': {
          const ssPath = saveScreenshot(await page.screenshot(), task.task_id);
          screenshots.push(ssPath);
          break;
        }
      }
    }

    if (task.screenshot) {
      const ssPath = saveScreenshot(await page.screenshot({ fullPage: true }), task.task_id);
      screenshots.push(ssPath);
    }
  } catch (e: any) {
    errors.push(e.message);
  } finally {
    await browser.close();
  }

  return {
    success:      errors.length === 0,
    screenshots,
    console_logs,
    errors,
    latency_ms:   Date.now() - start,
  };
}

function saveScreenshot(buffer: Buffer, taskId?: string): string {
  const dir = taskId
    ? path.join(EVIDENCE_DIR, taskId, 'screenshots')
    : path.join(EVIDENCE_DIR, 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  const fname = `screenshot-${Date.now()}.png`;
  const fpath = path.join(dir, fname);
  fs.writeFileSync(fpath, buffer);
  return fpath;
}

// ── Quick smoke test helper ───────────────────────────────────────────────────

export async function smokeTest(url: string, taskId?: string): Promise<{
  reachable: boolean; status_code: number; has_errors: boolean; screenshot?: string;
}> {
  const result = await runBrowserTask({
    url, task_id: taskId, screenshot: true, actions: [],
  });
  return {
    reachable:   result.success,
    status_code: result.success ? 200 : 0,
    has_errors:  result.errors.length > 0,
    screenshot:  result.screenshots[0],
  };
}
