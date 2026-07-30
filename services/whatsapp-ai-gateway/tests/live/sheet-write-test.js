require('dotenv').config();

const fs = require('fs');
const path = require('path');
if (!process.env.GATEWAY_DB_PATH) {
  process.env.GATEWAY_DB_PATH = path.resolve(`data/gateway-live-sheet-${process.pid}.db`);
}

const dailyLogWriter = require('../../src/google/daily-log-writer');
const storage = require('../../src/storage/food-safety-storage');
const sqlite = require('../../src/storage/sqlite');

async function main() {
  await storage.ensureTables();
  if (!fs.existsSync(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '')) {
    console.log(JSON.stringify({
      ok: false,
      status: 'BLOCKED',
      reason: `Google service account file not found: ${process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '(unset)'}`,
    }, null, 2));
    await sqlite.close();
    process.exit(2);
  }

  const payload = {
    checkId: `FS_SHEET_TEST_${Date.now()}`,
    metadata: {
      chatId: 'test-food-safety@g.us',
      sender: 'sheet-test',
      senderName: 'Sheet Test',
      timestamp: new Date().toISOString(),
      messageId: `sheet-test-${Date.now()}`,
      sourceType: 'image',
    },
    imagePath: 'data/uploads/food-safety/test/sheet-write-test.jpg',
    analyzed: { store: 'Stone Oak', date: new Date().toISOString().slice(0, 10), time: 'AM' },
    readings: [{
      item: 'Walk-in Cooler',
      value: 44,
      unit: 'F',
      operator: '<=',
      target: 40,
      status: 'FAIL',
      confidence: 0.91,
      correctiveAction: 'Close door, re-temp in 10 min, alert MOD if still high',
    }],
    result: 'FAIL',
    warning: 'FOOD SAFETY WARNING',
  };

  const result = await dailyLogWriter.appendDailyLog(payload);
  const ok = ['SENT', 'QUEUED'].includes(result.status);
  console.log(JSON.stringify({ ok, ...result }, null, 2));
  await sqlite.close();
  process.exit(ok ? 0 : 1);
}

main().catch(err => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  sqlite.close().finally(() => process.exit(1));
});
