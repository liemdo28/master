require('dotenv').config();

const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { getDb } = require('../../src/storage/sqlite');
const sqlite = require('../../src/storage/sqlite');
const fsStorage = require('../../src/storage/food-safety-storage');
const { renderDashboard } = require('../../src/dashboard/admin-ui');

const SCREENSHOTS_DIR = path.resolve('./screenshots');

async function seedFoodSafetyStatus() {
  process.env.FOOD_SAFETY_ENABLED = 'true';
  process.env.FOOD_SAFETY_TEST_MODE = 'true';
  process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS || '1203xxxx@g.us';

  getDb();
  await delay(300);
  await fsStorage.ensureTables();
  await sqlite.run(`DELETE FROM food_safety_checks WHERE message_id = ?`, ['sheet-write-test']);
  await sqlite.run(`DELETE FROM food_safety_readings WHERE check_id = ?`, ['FS00L9ANYM']);
  await sqlite.run(`DELETE FROM food_safety_warnings WHERE check_id = ?`, ['FS00L9ANYM']);

  const checkId = await fsStorage.saveCheck({
    chatId: '1203xxxx@g.us',
    sender: 'maria',
    senderName: 'Maria',
    timestamp: '2026-06-03T11:25:00.000Z',
    messageId: 'sheet-write-test',
    imagePath: 'data/uploads/food-safety/2026-06-03/img.jpg',
    store: 'Stone Oak',
    result: 'FAIL',
    readings: [],
    extractedJson: { store: 'Stone Oak', date: '2026-06-03', time: 'AM' },
  });
  await fsStorage.saveReadings(checkId, [{
    item: 'Walk-in Cooler',
    value: 44,
    unit: 'F',
    confidence: 0.91,
    status: 'FAIL',
    operator: '<=',
    target: 40,
    corrective: 'Close door, re-temp in 10 min, alert MOD if still high',
  }]);
  await fsStorage.saveWarning(checkId, 'FAIL', [
    'FOOD SAFETY WARNING',
    'Store: Stone Oak',
    'Item: Walk-in Cooler',
    'Reading: 44°F',
    'Target: <= 40°F',
    'Action: Close door, re-temp in 10 min, alert MOD if still high.',
    '',
    'Recorded to daily log.',
    'Please re-temp and confirm.',
  ].join('\n'));
  await fsStorage.saveSheetWriteStatus({
    checkId,
    status: 'QUEUED',
    error: 'Google service account file not found; real Sheet append not verified',
  });
}

async function capture() {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  await seedFoodSafetyStatus();
  const dashboardHtml = await buildDashboardHtml();

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });

  await page.setContent(dashboardHtml, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dashboard-food-safety-status.png'), fullPage: true });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'dashboard-sheet-status.png'), fullPage: true });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'food-safety-result.png'), fullPage: true });

  await page.setContent(sheetHtml(), { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'sheet-write-test.png'), fullPage: true });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'google-sheet-log-row.png'), fullPage: true });

  await page.setContent(warningHtml(), { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'whatsapp-warning-test.png'), fullPage: true });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'whatsapp-warning.png'), fullPage: true });

  await browser.close();
  console.log(`Food-safety screenshots saved in ${SCREENSHOTS_DIR}`);
  process.exit(0);
}

async function buildDashboardHtml() {
  const stats = {
    total: 1,
    incoming: 1,
    lastMessage: { name: 'Maria', phone: '1203xxxx', message: 'Food safety image', timestamp: '2026-06-03T11:25:00.000Z' },
  };
  const fsStats = await fsStorage.getCheckStats();
  const lastCheck = await fsStorage.getLastCheck();
  const lastWarning = await fsStorage.getLastWarning();
  const sheetQueue = await fsStorage.getSheetQueueStatus();
  return renderDashboard({
    waStatus: 'ready',
    telegramEnabled: false,
    stats,
    recent: [],
    qrData: null,
    safetyState: {
      aiPaused: false,
      businessHoursOpen: true,
      todaySchedule: 'Open',
      takeovers: {},
      blocklist: [],
    },
    fsData: {
      enabled: true,
      testMode: true,
      allowedChatIds: '1203xxxx@g.us',
      replyMode: 'warning_only',
      stats: fsStats,
      lastCheck,
      lastWarning,
      sheetQueue,
      lastSynced: '2026-06-03T11:25:00.000Z',
      visionConfigured: false,
      sheetEnabled: true,
    },
  });
}

function sheetHtml() {
  return `<!doctype html><html><head><style>${baseCss()}</style></head><body>
    <h1>Google Sheet Daily Log Test</h1>
    <table>
      <thead><tr><th>Timestamp</th><th>Store</th><th>Chat ID</th><th>Sender</th><th>Message ID</th><th>Source Type</th><th>Image Path</th><th>Item</th><th>Reading</th><th>Unit</th><th>Target</th><th>Status</th><th>Confidence</th><th>Corrective Action</th><th>Warning Sent</th><th>Sheet Write Status</th><th>Notes</th></tr></thead>
      <tbody><tr><td>2026-06-03 11:25</td><td>Stone Oak</td><td>1203xxxx@g.us</td><td>Maria</td><td>sheet-write-test</td><td>image</td><td>data/uploads/food-safety/2026-06-03/img.jpg</td><td>Walk-in Cooler</td><td>44</td><td>F</td><td>&lt;= 40°F</td><td class="fail">FAIL</td><td>0.91</td><td>Close door, re-temp in 10 min, alert MOD if still high</td><td>YES</td><td>BLOCKED - missing service account</td><td>Evidence row shape; actual write pending credentials</td></tr></tbody>
    </table>
  </body></html>`;
}

function warningHtml() {
  return `<!doctype html><html><head><style>${baseCss()}</style></head><body>
    <h1>WhatsApp Warning Test</h1>
    <div class="phone">
      <div class="bubble">
        <strong>FOOD SAFETY WARNING</strong><br>
        Store: Stone Oak<br>
        Item: Walk-in Cooler<br>
        Reading: 44°F<br>
        Target: &lt;= 40°F<br>
        Action: Close door, re-temp in 10 min, alert MOD if still high.<br><br>
        Recorded to daily log.<br>
        Please re-temp and confirm.
      </div>
    </div>
  </body></html>`;
}

function baseCss() {
  return `
    body{font-family:Arial,sans-serif;background:#f8fafc;color:#111827;padding:32px}
    h1{font-size:24px;margin:0 0 18px}
    table{border-collapse:collapse;width:100%;background:white;border:1px solid #d1d5db}
    th,td{border:1px solid #d1d5db;padding:10px;text-align:left;font-size:14px}
    th{background:#e5e7eb}
    .fail{color:#b91c1c;font-weight:700}
    .phone{width:390px;background:#e5ddd5;border:1px solid #cbd5e1;border-radius:18px;padding:24px}
    .bubble{background:#fff;border-radius:12px;padding:16px;line-height:1.55;font-size:15px;box-shadow:0 2px 8px #0001}
  `;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

capture().catch(err => {
  console.error(err);
  process.exit(1);
});
