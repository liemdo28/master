/**
 * SEO Control Center — ChatGPTBrowserProvider (spec §3, PRIMARY provider).
 *
 * Automates the CEO's own logged-in chatgpt.com browser session via a
 * persistent Playwright context — no OpenAI API key is ever used or stored.
 * The only thing that persists is the Chromium user-data-dir under
 * .local-agent-global/seo/chatgpt-browser-profile/, which holds the
 * browser's own session cookies exactly the way a normal Chrome profile
 * would. No password is ever read or stored by this code.
 *
 * First-time / re-login flow: run the companion script once (headed):
 *   cd mi-core/server && npx tsx src/seo/ai-providers/chatgpt-manual-login.ts
 * After that, this provider reuses the same profile headlessly. If the
 * session expires (or a CAPTCHA/MFA challenge appears — which this code
 * NEVER attempts to solve or bypass), submit() marks the job
 * `waiting_for_login`, notifies the CEO via WhatsApp, and returns without
 * crashing or looping.
 */

import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { getSeoDb, nowIso } from '../seo-db';
import { recordEvidence } from '../seo-evidence';
import { queueToCeo } from '../../services/whatsapp-sender';
import type { AIProvider, AIProviderRequest, AIProviderResult } from './ai-provider';
import { redactSecrets } from './redact';

const GLOBAL_DIR = process.env.MI_DATA_DIR || 'D:/Project/Master/.local-agent-global';
export const PROFILE_DIR = path.join(GLOBAL_DIR, 'seo', 'chatgpt-browser-profile');
export const CONVERSATION_STATE_FILE = path.join(GLOBAL_DIR, 'seo', 'chatgpt-conversation-state.json');

if (!fs.existsSync(PROFILE_DIR)) fs.mkdirSync(PROFILE_DIR, { recursive: true });

const CHATGPT_URL = 'https://chatgpt.com';
const RESPONSE_TIMEOUT_MS = Number(process.env.CHATGPT_RESPONSE_TIMEOUT_MS || 120_000);
const STABLE_POLL_MS = 1_500;
const STABLE_ROUNDS_REQUIRED = 3; // text must be unchanged this many consecutive polls before considered "done"

// Selectors — ChatGPT's DOM changes periodically. These are intentionally
// redundant (comma-separated fallback selectors) so a single upstream
// markup tweak doesn't fully break the connector; if ALL of them go stale
// the failure mode is a clean timeout/error, never a silent wrong action.
const SEL = {
  composer: 'div#prompt-textarea, textarea#prompt-textarea, textarea[data-id="root"]',
  sendButton: 'button[data-testid="send-button"]',
  stopButton: 'button[data-testid="stop-button"]',
  regenerateButton: 'button:has-text("Regenerate"), button[data-testid="regenerate-button"]',
  loginButton: 'button:has-text("Log in"), a:has-text("Log in")',
  captcha: 'iframe[src*="captcha"], iframe[title*="challenge"], div#challenge-stage',
  mfaHint: 'text=/verification code/i, text=/two-factor/i, input[autocomplete="one-time-code"]',
  assistantMessage: 'div[data-message-author-role="assistant"]',
};

let _context: BrowserContext | null = null;

async function getPersistentContext(headless = true): Promise<BrowserContext> {
  if (_context) {
    try {
      _context.pages(); // sanity check the context is still alive
      return _context;
    } catch {
      _context = null;
    }
  }
  _context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  return _context;
}

function loadConversationState(): { conversationUrl?: string } {
  try {
    if (fs.existsSync(CONVERSATION_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(CONVERSATION_STATE_FILE, 'utf8'));
    }
  } catch {
    /* corrupt state file — start a fresh conversation */
  }
  return {};
}

function saveConversationState(state: { conversationUrl?: string }): void {
  try {
    fs.writeFileSync(CONVERSATION_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    /* non-fatal */
  }
}

export type LoginCheckResult =
  | { status: 'logged_in' }
  | { status: 'not_logged_in'; reason: 'login_page' | 'captcha' | 'mfa' | 'unknown' };

/**
 * Navigate to chatgpt.com and determine whether the persisted profile has
 * an active session. CAPTCHA and MFA challenges are treated exactly like
 * "not logged in" — this function never attempts to solve or bypass them.
 */
export async function checkLoginStatus(page: Page): Promise<LoginCheckResult> {
  await page.goto(CHATGPT_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(2_000);

  const captcha = await page.$(SEL.captcha);
  if (captcha) return { status: 'not_logged_in', reason: 'captcha' };

  const mfaVisible = await page.locator(SEL.mfaHint).first().isVisible().catch(() => false);
  if (mfaVisible) return { status: 'not_logged_in', reason: 'mfa' };

  const composer = await page.$(SEL.composer);
  if (composer) return { status: 'logged_in' };

  const loginBtn = await page.$(SEL.loginButton);
  if (loginBtn) return { status: 'not_logged_in', reason: 'login_page' };

  return { status: 'not_logged_in', reason: 'unknown' };
}

export class ChatGPTBrowserProvider implements AIProvider {
  name = 'chatgpt_browser';

  async submit(req: AIProviderRequest): Promise<AIProviderResult> {
    const db = getSeoDb();

    // Idempotency: a previously completed job returns its cached response
    // instead of re-submitting (defense in depth — ai-router.ts also checks this).
    const existing = db.prepare('SELECT id, status FROM seo_ai_jobs WHERE idempotency_key = ?')
      .get(req.idempotency_key) as { id: string; status: string } | undefined;
    if (existing && existing.status === 'completed') {
      const cached = db.prepare(
        'SELECT raw_response FROM seo_ai_responses WHERE job_id = ? ORDER BY created_at DESC LIMIT 1',
      ).get(existing.id) as { raw_response: string } | undefined;
      if (cached) return { status: 'completed', raw_response: cached.raw_response };
    }

    const redactedPrompt = redactSecrets(req.prompt);

    let context: BrowserContext;
    try {
      context = await getPersistentContext(true);
    } catch (e) {
      const error = `Failed to launch ChatGPT browser profile: ${e instanceof Error ? e.message : String(e)}`;
      this.markWaitingForLogin(req, error);
      return { status: 'waiting_for_login', error };
    }

    const page = await context.newPage();
    try {
      const login = await checkLoginStatus(page);
      if (login.status === 'not_logged_in') {
        const error = `ChatGPT session not authenticated (reason: ${login.reason}). Run "npx tsx src/seo/ai-providers/chatgpt-manual-login.ts" from mi-core/server to log in once.`;
        this.markWaitingForLogin(req, error);
        await page.close().catch(() => {});
        return { status: 'waiting_for_login', error };
      }

      const state = loadConversationState();
      if (state.conversationUrl) {
        await page.goto(state.conversationUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
        const recheck = await checkLoginStatus(page);
        if (recheck.status === 'not_logged_in') {
          const error = `ChatGPT session expired while reopening the SEO workspace conversation (reason: ${recheck.reason}).`;
          this.markWaitingForLogin(req, error);
          await page.close().catch(() => {});
          return { status: 'waiting_for_login', error };
        }
      } else {
        await page.goto(CHATGPT_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      }

      let responseText = await this.sendAndWait(page, redactedPrompt);

      if (this.looksTruncated(responseText)) {
        const regenerated = await this.regenerate(page);
        if (regenerated) responseText = regenerated;
      }

      // Persist the conversation URL so the next job in this "SEO workspace" reuses the same thread.
      const url = page.url();
      if (url && url !== `${CHATGPT_URL}/` && url !== CHATGPT_URL) {
        saveConversationState({ conversationUrl: url });
      }

      recordEvidence({
        brand_id: req.brand_id,
        category: 'seo_ai_chatgpt_response',
        summary: `ChatGPT browser response for task ${req.task_id} (${req.template})`,
        payload: {
          task_id: req.task_id,
          template: req.template,
          prompt_length: redactedPrompt.length,
          response_length: responseText.length,
          conversation_url: url,
        },
      });

      await page.close().catch(() => {});
      return { status: 'completed', raw_response: responseText };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await page.close().catch(() => {});
      recordEvidence({
        brand_id: req.brand_id,
        category: 'seo_ai_chatgpt_failed',
        summary: `ChatGPT browser submit failed for task ${req.task_id} (${req.template})`,
        payload: { task_id: req.task_id, template: req.template, error },
      });
      return { status: 'failed', error };
    }
  }

  private markWaitingForLogin(req: AIProviderRequest, error: string): void {
    const db = getSeoDb();
    db.prepare(`
      UPDATE seo_ai_jobs SET status = 'waiting_for_login', error = @error, updated_at = @updated_at
      WHERE idempotency_key = @idempotency_key
    `).run({ error, updated_at: nowIso(), idempotency_key: req.idempotency_key });

    recordEvidence({
      brand_id: req.brand_id,
      category: 'seo_ai_chatgpt_waiting_for_login',
      summary: `ChatGPT session needs manual re-login (task ${req.task_id})`,
      payload: { task_id: req.task_id, template: req.template, error },
    });

    queueToCeo(
      `SEO Control Center: ChatGPT browser session needs manual re-login. ` +
      `Run "npx tsx src/seo/ai-providers/chatgpt-manual-login.ts" from mi-core/server to sign in again. ` +
      `Blocked task: ${req.task_id} (${req.template}).`,
    );
  }

  private async sendAndWait(page: Page, prompt: string): Promise<string> {
    const composer = page.locator(SEL.composer).first();
    await composer.waitFor({ state: 'visible', timeout: 20_000 });
    await composer.click();
    try {
      await composer.fill(prompt);
    } catch {
      // contenteditable divs don't always support fill(); fall back to typing.
      await composer.type(prompt, { delay: 5 });
    }

    const sendBtn = page.locator(SEL.sendButton).first();
    if (await sendBtn.isVisible().catch(() => false)) {
      await sendBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    return this.waitForStableResponse(page);
  }

  /**
   * Poll the last assistant message until (a) the stop button is gone
   * (streaming finished) and (b) the text has been byte-identical across
   * STABLE_ROUNDS_REQUIRED consecutive polls, or until RESPONSE_TIMEOUT_MS
   * elapses (in which case the best-effort partial text is returned).
   */
  private async waitForStableResponse(page: Page): Promise<string> {
    const deadline = Date.now() + RESPONSE_TIMEOUT_MS;
    let lastText = '';
    let stableRounds = 0;

    while (Date.now() < deadline) {
      await page.waitForTimeout(STABLE_POLL_MS);
      const messages = page.locator(SEL.assistantMessage);
      const count = await messages.count().catch(() => 0);
      if (count === 0) continue;

      const text = (await messages.nth(count - 1).innerText().catch(() => '')).trim();
      const stillStreaming = await page.locator(SEL.stopButton).first().isVisible().catch(() => false);

      if (text && text === lastText && !stillStreaming) {
        stableRounds++;
        if (stableRounds >= STABLE_ROUNDS_REQUIRED) return text;
      } else {
        stableRounds = 0;
      }
      lastText = text;
    }

    if (lastText) return lastText; // best-effort partial response on timeout
    throw new Error(`Timed out waiting for ChatGPT response after ${RESPONSE_TIMEOUT_MS}ms`);
  }

  /**
   * Heuristic truncation detector: response has no closing punctuation and
   * (if a code fence was opened) the fence was never closed.
   */
  private looksTruncated(text: string): boolean {
    if (!text) return true;
    const trimmed = text.trimEnd();
    const fenceCount = (trimmed.match(/```/g) || []).length;
    if (fenceCount % 2 !== 0) return true; // unclosed code fence
    const endsCleanly = /[.!?"'\)\]\}`]$/.test(trimmed);
    return !endsCleanly;
  }

  private async regenerate(page: Page): Promise<string | null> {
    try {
      const regenBtn = page.locator(SEL.regenerateButton).first();
      if (!(await regenBtn.isVisible().catch(() => false))) return null;
      await regenBtn.click();
      return await this.waitForStableResponse(page);
    } catch {
      return null;
    }
  }
}

export const chatGptBrowserProvider = new ChatGPTBrowserProvider();

/** Exposed for the manual-login script / future health-check route. */
export async function closeChatGptBrowserContext(): Promise<void> {
  if (_context) {
    await _context.close().catch(() => {});
    _context = null;
  }
}
