/**
 * Mi Browser Agent — WS8
 *
 * Python bridge to browser-use for web automation.
 * browser-use v0.13.1 is installed at system level.
 *
 * Read actions: no approval needed
 * Write actions: L2 approval required (CEO must approve before executing)
 *
 * Setup required:
 *   pip install playwright
 *   playwright install chromium
 *
 * Usage:
 *   const agent = new BrowserAgent();
 *   await agent.navigate('https://dashboard.bakudanramen.com');
 *   await agent.extract('Get all overdue tasks');
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON_BRIDGE = path.join(__dirname, 'browser_bridge.py');

export class BrowserAgent {
  constructor(options = {}) {
    this.headless = options.headless !== false;  // default headless
    this.timeout_ms = options.timeout_ms || 30000;
  }

  /** Check if browser automation is available */
  async isAvailable() {
    return new Promise((resolve) => {
      const proc = spawn('python3', ['-c', 'import browser_use; import playwright; print("ok")'], {
        timeout: 5000,
      });
      let out = '';
      proc.stdout.on('data', d => out += d.toString());
      proc.on('close', code => resolve(code === 0 && out.includes('ok')));
      proc.on('error', () => resolve(false));
    });
  }

  /** Read-only: navigate and extract information */
  async extract(url, task) {
    if (!await this.isAvailable()) {
      return { ok: false, error: 'Browser agent not available. Run: pip install playwright && playwright install chromium' };
    }
    return this._run({ action: 'extract', url, task, headless: this.headless });
  }

  /** Write action: requires CEO approval before execution */
  async write(url, task, approvalId) {
    if (!approvalId) {
      return { ok: false, error: 'Write actions require approval. Create an approval request first.' };
    }
    if (!await this.isAvailable()) {
      return { ok: false, error: 'Browser agent not available.' };
    }
    return this._run({ action: 'write', url, task, approval_id: approvalId, headless: this.headless });
  }

  _run(params) {
    return new Promise((resolve) => {
      const proc = spawn('python3', [PYTHON_BRIDGE, JSON.stringify(params)], {
        timeout: this.timeout_ms,
      });

      let out = '';
      let err = '';
      proc.stdout.on('data', d => out += d.toString());
      proc.stderr.on('data', d => err += d.toString());

      proc.on('close', (code) => {
        if (code !== 0) {
          resolve({ ok: false, error: err || `Process exited with code ${code}` });
          return;
        }
        try {
          resolve(JSON.parse(out));
        } catch {
          resolve({ ok: false, error: `Invalid response: ${out.slice(0, 200)}` });
        }
      });

      proc.on('error', (e) => resolve({ ok: false, error: e.message }));
    });
  }
}

// ── Preset tasks ─────────────────────────────────────────────────────────

export const BrowserTasks = {
  CHECK_DASHBOARD_TASKS: {
    url: process.env.DASHBOARD_URL || 'https://dashboard.bakudanramen.com',
    task: 'Navigate to the task list. Extract all overdue and upcoming tasks. Return as JSON list with: title, assignee, due_date, status.',
    requires_auth: true,
  },

  CHECK_GMAIL_INBOX: {
    url: 'https://mail.google.com',
    task: 'Look at the inbox. List the first 10 unread emails with: subject, from, date, preview.',
    requires_auth: true,
  },

  READ_WEBSITE_MENU: (storeUrl) => ({
    url: storeUrl,
    task: 'Find the menu page. Extract all menu items with name and price.',
    requires_auth: false,
  }),
};

export default BrowserAgent;
