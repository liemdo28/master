const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  console.log('Logging in...');
  await page.goto('https://dashboard.bakudanramen.com/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', 'liem.dt0208@gmail.com');
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForURL(/overview|tasks|dashboard/, { timeout: 20000 });
  console.log('Logged in at:', page.url());

  // Try direct PHP file first (bypasses router), then API routes
  for (const apiPath of ['/bill-audit.php', '/api/bill-audit', '/api/phase13-5/bill-audit']) {
    console.log('Testing:', apiPath);
    const result = await page.evaluate(async (p) => {
      const res = await fetch(p, { credentials: 'same-origin', headers: { 'Accept': 'application/json' } });
      const text = await res.text();
      return { status: res.status, preview: text.slice(0, 200), len: text.length, full: text };
    }, apiPath);
    console.log('  Status:', result.status, '| Len:', result.len, '| Preview:', result.preview);
    if (result.status === 200 && result.len > 100) {
      const out = path.join(__dirname, '..', 'evidence', 'bill-audit-raw.json');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, result.full, 'utf8');
      console.log('✅ Saved', result.len, 'chars to', out);
      await browser.close();
      return;
    }
  }

  console.log('❌ All routes failed — trying admin route debug');
  const dbg = await page.evaluate(async () => {
    const res = await fetch('/api/health', { credentials: 'same-origin' });
    return { status: res.status, text: await res.text() };
  });
  console.log('  /api/health:', dbg.status, dbg.text.slice(0, 100));

  await browser.close();
})();
