'use strict';
/**
 * browser-tool.js
 * Base browser automation wrapper.
 * Uses Puppeteer (already installed). Falls back gracefully if not available.
 */

const { makeLogger } = require('../../logger');
const log = makeLogger('browser-tool');

let puppeteer = null;
try { puppeteer = require('puppeteer'); } catch (_) {}

let _browser = null;
let _screenshotDir = null;

function getScreenshotDir() {
  if (_screenshotDir) return _screenshotDir;
  const path = require('path');
  const fs   = require('fs');
  const dir  = path.join(
    process.env.LOG_DIR || path.join(process.cwd(), 'logs'),
    'audit-screenshots'
  );
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _screenshotDir = dir;
  return dir;
}

async function getBrowser() {
  if (!puppeteer) throw new Error('Puppeteer not installed. Run: npm install puppeteer');
  if (_browser && _browser.isConnected()) return _browser;
  _browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  return _browser;
}

async function newPage(url) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  if (url) await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  return page;
}

async function captureScreenshot(name, page) {
  const path = require('path');
  const ts   = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(getScreenshotDir(), `${ts}-${name}.png`);
  if (page) {
    await page.screenshot({ path: file, fullPage: true });
  }
  log.info('Screenshot saved', { file });
  return file;
}

async function closeBrowser() {
  if (_browser) { try { await _browser.close(); } catch (_) {} _browser = null; }
}

function isAvailable() { return !!puppeteer; }

module.exports = { getBrowser, newPage, captureScreenshot, closeBrowser, isAvailable, getScreenshotDir };
