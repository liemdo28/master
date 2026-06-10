'use strict';
/**
 * whatsapp-web-tool.js
 * Browser automation for WhatsApp Web session checks and recovery.
 */

const { newPage, captureScreenshot, isAvailable } = require('./browser-tool');
const { makeLogger } = require('../../logger');
const log = makeLogger('browser-tool');

const WA_URL = 'https://web.whatsapp.com';

async function openWhatsAppWeb() {
  if (!isAvailable()) return { ok: false, error: 'Puppeteer not available' };
  try {
    const page = await newPage(WA_URL);
    await new Promise(r => setTimeout(r, 3000));
    return { ok: true, page, url: WA_URL };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function checkWhatsAppSession() {
  if (!isAvailable()) return { ok: false, status: 'unavailable', error: 'Puppeteer not available' };
  let page;
  try {
    const result = await openWhatsAppWeb();
    if (!result.ok) return { ok: false, status: 'error', error: result.error };
    page = result.page;

    // Wait up to 10s for either QR code or chat list
    await page.waitForTimeout(5000);
    const html = await page.content();

    const hasQr        = html.includes('data-ref') || html.includes('qr-code') || html.includes('QR');
    const hasChatList  = html.includes('_pnRCb') || html.includes('chat-list') || html.includes('side');
    const hasLoading   = html.includes('loading') || html.includes('startup');

    let status = 'unknown';
    if (hasChatList && !hasQr)    status = 'authenticated';
    else if (hasQr)               status = 'qr_required';
    else if (hasLoading)          status = 'loading';

    const screenshot = await captureScreenshot('whatsapp-session', page);
    await page.close();
    return { ok: true, status, screenshot };
  } catch (err) {
    if (page) try { await page.close(); } catch (_) {}
    return { ok: false, status: 'error', error: err.message };
  }
}

async function recoverWhatsAppSession() {
  // Session recovery: reload the page and log status
  // Full recovery (re-scanning QR) requires manual intervention
  const check = await checkWhatsAppSession();
  if (check.status === 'authenticated') {
    return { ok: true, action: 'none_needed', status: check.status };
  }
  log.warn('WhatsApp session needs recovery', { status: check.status });
  return { ok: false, action: 'manual_qr_scan_required', status: check.status, screenshot: check.screenshot };
}

module.exports = { openWhatsAppWeb, checkWhatsAppSession, recoverWhatsAppSession };
