/**
 * Standalone Chromium 1208 test — Phase 10.3
 * Tests if playwright 1.61.1 + chromium_headless_shell-1208 combination works.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const CHROMIUM_PATH = 'C:\\Users\\liemdo\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1208\\chrome-headless-shell-win64\\chrome-headless-shell.exe';
const OUT_FILE = path.join(__dirname, 'chromium-1208-test-result.json');

async function test() {
  const result = {
    captured_at: new Date().toISOString(),
    chromium_path: CHROMIUM_PATH,
    chromium_exists: fs.existsSync(CHROMIUM_PATH),
    playwright_version: require('playwright/package.json').version,
    playwright_core_version: require('playwright-core/package.json').version,
    launch_result: null,
    browser_version: null,
    error: null,
  };

  console.log('Testing Chromium 1208 path...');
  console.log('Path:', CHROMIUM_PATH);
  console.log('Exists:', result.chromium_exists);

  if (!result.chromium_exists) {
    result.error = 'Chromium 1208 binary not found';
    fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
    return result;
  }

  try {
    const browser = await chromium.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
    });

    result.launch_result = 'SUCCESS';
    const version = await browser.version();
    result.browser_version = version;
    console.log('Browser launched! Version:', version);

    // Quick smoke test — open a page
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://merchant-portal.doordash.com/', { timeout: 15000, waitUntil: 'domcontentloaded' });
    const url = page.url();
    console.log('Navigated to:', url);
    result.navigation_url = url;
    result.navigation_success = true;

    await browser.close();
    console.log('Test PASSED — Chromium 1208 is compatible with playwright 1.61.1');
  } catch (err) {
    result.launch_result = 'FAIL';
    result.error = err.message;
    console.error('Test FAILED:', err.message);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
  return result;
}

test().then(r => {
  console.log('\nResult:', JSON.stringify(r, null, 2));
  process.exit(r.launch_result === 'SUCCESS' ? 0 : 1);
}).catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});