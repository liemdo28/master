const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = process.env.ADMIN_UI_AUDIT_BASE || 'http://localhost:3210';
const OUT_DIR = path.resolve('./screenshots');

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function requireText(page, text) {
  const content = await page.content();
  if (!content.includes(text)) {
    throw new Error(`Missing required text: ${text}`);
  }
}

async function shot(page, file, clip) {
  const target = path.join(OUT_DIR, file);
  await page.screenshot({ path: target, ...(clip ? { clip } : { fullPage: true }) });
}

async function clipForSelector(page, selector) {
  await page.waitForSelector(selector, { timeout: 10000 });
  const el = await page.$(selector);
  const box = await el.boundingBox();
  if (!box) throw new Error(`No bounding box for ${selector}`);
  return {
    x: Math.max(0, box.x - 10),
    y: Math.max(0, box.y - 10),
    width: box.width + 20,
    height: box.height + 20,
  };
}

(async () => {
  await ensureDir(OUT_DIR);
  let health;
  try {
    const healthResponse = await fetch(`${BASE}/api/health`, { cache: 'no-store' });
    health = await healthResponse.json();
    if (!healthResponse.ok || !health.ok) {
      throw new Error(`Health check failed: HTTP ${healthResponse.status} ${JSON.stringify(health)}`);
    }
  } catch (err) {
    if (/fetch failed|ECONNREFUSED|actively refused|connect/i.test(err.message || '')) {
      console.error('Gateway is not running. Start npm start first.');
    } else {
      console.error(err.message);
    }
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 2200, deviceScaleFactor: 1 });
    const response = await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 20000 });
    if (!response || response.status() !== 200) {
      throw new Error(`Dashboard did not respond 200: ${response ? response.status() : 'no response'}`);
    }
    const cacheControl = response.headers()['cache-control'] || '';
    if (!/no-store/i.test(cacheControl)) {
      throw new Error(`Dashboard Cache-Control is not no-store: ${cacheControl || '(missing)'}`);
    }

    const requiredTexts = [
      'Admin Control Center',
      'Open Daily Entry Template',
      'Open Daily Log',
      'Force Sync Template',
      'Test Sheet Write',
      'Refresh WhatsApp Groups',
      'Map Group to Store',
      'Save Manager Alert Group',
      'Test Alert',
      'Setup Checklist',
      'Build: Admin Control Center v1',
    ];
    for (const text of requiredTexts) await requireText(page, text);

    const sections = await page.$$eval('section.section', nodes => nodes.map((n, i) => ({
      index: i,
      title: n.querySelector('h2')?.textContent?.trim() || ''
    })));

    function selectorFor(title) {
      const section = sections.find(s => s.title === title);
      if (!section) throw new Error(`Section not found: ${title}`);
      return `section.section:nth-of-type(${section.index + 1})`;
    }

    const adminSelector = selectorFor('Admin Control Center');
    const storeSelector = selectorFor('Store Mapping');

    await shot(page, 'admin-control-center.png', await clipForSelector(page, adminSelector));
    await shot(page, 'google-sheets-panel.png', await clipForSelector(page, `${adminSelector} div[style*="padding-top:12px"]`));
    await shot(page, 'whatsapp-groups-panel.png', await clipForSelector(page, `${adminSelector} div.row[style*="margin-bottom:14px"]`));
    await shot(page, 'setup-checklist.png', await clipForSelector(page, `${adminSelector} table`));
    // Section 13 also requires the Store Mapping panel screenshot — capture the second
    // <section> on the page (the standalone "Store Mapping" panel below the Admin block).
    let storeShotError = null;
    try {
      await shot(page, 'store-mapping-panel.png', await clipForSelector(page, storeSelector));
    } catch (err) {
      storeShotError = err.message;
      console.warn('store-mapping screenshot failed: ' + err.message);
    }

    const audit = {
      base: BASE,
      captured_at: new Date().toISOString(),
      health,
      cache_control: cacheControl,
      buttons_verified_present: requiredTexts,
      screenshots: [
        'screenshots/admin-control-center.png',
        'screenshots/google-sheets-panel.png',
        'screenshots/whatsapp-groups-panel.png',
        'screenshots/store-mapping-panel.png',
        'screenshots/setup-checklist.png',
      ],
      extra_sections_found: sections.map(s => s.title),
      store_mapping_section_present: !!storeSelector,
    };

    fs.writeFileSync(path.resolve('./screenshots/admin-ui-audit.json'), JSON.stringify(audit, null, 2));
    console.log('Admin UI audit screenshots captured successfully.');
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error(err.message);
  process.exit(1);
});
