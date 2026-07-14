#!/usr/bin/env node
/**
 * ChatGPT Manual Login — run this ONCE (and again whenever the ChatGPT
 * session expires, or after a CAPTCHA/MFA challenge blocks the automated
 * connector) to authenticate the persisted browser profile used by
 * ChatGPTBrowserProvider.
 *
 * Run from mi-core/server:
 *   npx tsx src/seo/ai-providers/chatgpt-manual-login.ts
 *
 * This launches a HEADED Chromium window against the exact same profile
 * directory ChatGPTBrowserProvider uses in production
 * (.local-agent-global/seo/chatgpt-browser-profile/). Log in to
 * chatgpt.com by hand in that window — including any 2FA/CAPTCHA step,
 * which this script (and the automated provider) will NEVER attempt to
 * solve or bypass. Once the message composer is visible, the session
 * cookies are already persisted to the profile directory on disk; this
 * script detects that state, prints a success message, and exits cleanly
 * (closing the context so the headless server process can reuse the
 * profile without a file-lock conflict).
 *
 * No password is ever read, stored, or logged by this script or by
 * ChatGPTBrowserProvider — only the browser's own cookie/session state
 * persists in the profile directory, the same way a normal Chrome user
 * profile would.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import { PROFILE_DIR } from './chatgpt-browser-provider';

const CHATGPT_URL = 'https://chatgpt.com';
const MAX_WAIT_MS = 10 * 60 * 1000;
const POLL_MS = 3_000;
const COMPOSER_SELECTOR = 'div#prompt-textarea, textarea#prompt-textarea, textarea[data-id="root"]';

async function main(): Promise<void> {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  console.log(`[chatgpt-manual-login] Launching headed Chromium against profile: ${PROFILE_DIR}`);

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.goto(CHATGPT_URL, { waitUntil: 'domcontentloaded' });

  console.log('[chatgpt-manual-login] Log in to ChatGPT in the opened window (including any 2FA/CAPTCHA step).');
  console.log('[chatgpt-manual-login] Waiting up to 10 minutes for the message composer to appear...');

  const deadline = Date.now() + MAX_WAIT_MS;
  let loggedIn = false;

  while (Date.now() < deadline) {
    const composer = await page.$(COMPOSER_SELECTOR);
    if (composer) { loggedIn = true; break; }
    await page.waitForTimeout(POLL_MS);
  }

  if (loggedIn) {
    console.log('[chatgpt-manual-login] Composer detected — session appears authenticated.');
    console.log('[chatgpt-manual-login] Profile saved to disk. You can close this window; the server will reuse it headlessly.');
  } else {
    console.log('[chatgpt-manual-login] Timed out after 10 minutes without detecting a logged-in composer.');
    console.log('[chatgpt-manual-login] Re-run this script and finish login manually.');
  }

  await context.close();
  process.exit(loggedIn ? 0 : 1);
}

main().catch((e) => {
  console.error('[chatgpt-manual-login] Fatal error:', e);
  process.exit(1);
});
