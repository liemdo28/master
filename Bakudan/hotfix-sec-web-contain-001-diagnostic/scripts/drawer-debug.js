'use strict';
const { chromium } = require('playwright');
const BASE = 'https://dashboard.bakudanramen.com';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Login
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.fill('input[name="email"]', 'liem.dt0208@gmail.com');
  await page.fill('input[name="password"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  process.stdout.write('Logged in: ' + page.url() + '\n');
  
  // Debug tasks page
  process.stdout.write('\n=== /tasks ANALYSIS ===\n');
  await page.goto(BASE + '/tasks', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(5000);
  
  // Print ALL unique hrefs  
  const allHrefs = await page.$$eval('a[href]', links => {
    const hrefs = links.map(l => l.getAttribute('href')).filter(Boolean);
    const unique = [...new Set(hrefs)];
    return unique.sort();
  });
  process.stdout.write('Unique hrefs (' + allHrefs.length + '):\n');
  allHrefs.forEach(h => process.stdout.write('  ' + h + '\n'));
  
  // Print all data-detail-drawer elements
  const ddEls = await page.$$eval('[data-detail-drawer]', els => 
    els.map(e => ({ tag: e.tagName, href: e.getAttribute('href'), text: e.textContent.trim().slice(0, 50) }))
  );
  process.stdout.write('\ndata-detail-drawer elements (' + ddEls.length + '):\n');
  ddEls.forEach(e => process.stdout.write('  ' + e.tag + ' ' + e.href + ' — ' + e.text + '\n'));
  
  // Print data-dd-inline elements
  const ddInline = await page.$$eval('[data-dd-inline]', els =>
    els.map(e => ({ tag: e.tagName, key: e.getAttribute('data-dd-key'), text: e.textContent.trim().slice(0, 50) }))
  );
  process.stdout.write('\ndata-dd-inline elements (' + ddInline.length + '):\n');
  ddInline.forEach(e => process.stdout.write('  ' + e.tag + ' key=' + e.key + ' — ' + e.text + '\n'));
  
  // Get clickable task items
  const clickables = await page.$$eval('.sw-task-row, .sw-task-item, [class*="task"]', els =>
    els.map(e => ({ tag: e.tagName, class: e.className.slice(0, 60), href: e.getAttribute('href') || 'none', hasDataAttr: e.outerHTML.slice(0, 200) })).slice(0, 5)
  );
  process.stdout.write('\nTask row elements (' + clickables.length + '):\n');
  clickables.forEach(e => process.stdout.write('  ' + e.tag + '.' + e.class + ' href=' + e.href + '\n    ' + e.hasDataAttr + '\n'));
  
  await browser.close();
}

main().catch(e => { process.stdout.write('FATAL: ' + e.message + '\n'); process.exit(1); });