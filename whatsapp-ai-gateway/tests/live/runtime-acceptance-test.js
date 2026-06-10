require('dotenv').config();

const http = require('http');

const BASE = process.env.RUNTIME_ACCEPTANCE_BASE || 'http://localhost:3210';
let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`PASS ${label}`);
    passed += 1;
  } else {
    console.log(`FAIL ${label}${detail ? ` - ${detail}` : ''}`);
    failed += 1;
  }
}

function requestJson(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 30000,
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(data || '{}') }); }
        catch (_) { resolve({ status: res.statusCode, text: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout ${method} ${path}`)); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('\n=== Runtime Acceptance Test ===\n');

  const truth = await requestJson('/api/runtime-truth');
  assert('/api/runtime-truth returns build', truth.status === 200 && !!truth.json.build_id);
  assert('runtime truth template count is 19', truth.json.template_item_count === 19, `got ${truth.json.template_item_count}`);

  const links = await requestJson('/api/admin/google-sheet-links');
  assert('template URL valid', /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/edit$/.test(links.json.template_sheet_url || ''));
  assert('log URL valid', /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/edit$/.test(links.json.log_sheet_url || ''));

  const sync = await requestJson('/api/admin/google-sheets/sync-template', 'POST', {});
  assert('template sync succeeds', sync.json.status === 'SUCCESS', JSON.stringify(sync.json));
  assert('template sync returns 19 items', sync.json.rowCount === 19, `got ${sync.json.rowCount}`);

  const current = await requestJson('/api/template/current');
  assert('template current returns 19', current.json.item_count === 19, `got ${current.json.item_count}`);

  const templateCache = require('../../src/templates/template-cache');
  await templateCache.warmFromDb();
  const info = require('../../src/commands/info-commands');
  const version = await info.handleInfoCommand('/version');
  assert('/version includes template count', /Template:\s*\n19 items/m.test(version), version);
  assert('/version includes build text', /Build:/i.test(version) && /Commit:/i.test(version));

  const langMem = require('../../src/i18n/language-memory');
  const router = require('../../src/commands/command-router');
  const broth = require('../../src/commands/broth-command');
  const guided = require('../../src/workflows/guided/guided-workflow-engine');

  const chatId = `ACCEPT_${Date.now()}`;
  const sender = `ACCEPT_USER_${Date.now()}`;
  await langMem.rememberFromMessage(sender, 'CEO Test', 'Biết tiếng Việt ko');

  let r = await router.handleCommand({ chatId, isGroup: false, sender, senderName: 'CEO Test', text: '/ldagent', groupName: '', timestamp: new Date().toISOString() });
  assert('/ldagent handled', r.handled === true);
  assert('Vietnamese persists into /ldagent', /Chọn cửa hàng/.test(r.reply || ''), r.reply);
  assert('no generic fallback on /ldagent', !/Thank you for your message/i.test(r.reply || ''));

  r = await router.handleCommand({ chatId, isGroup: false, sender, senderName: 'CEO Test', text: '1', groupName: '', timestamp: new Date().toISOString() });
  assert('store choice handled by session', /Rim|Cửa hàng/.test(r.reply || ''), r.reply);

  r = await router.handleCommand({ chatId, isGroup: false, sender, senderName: 'CEO Test', text: '1', groupName: '', timestamp: new Date().toISOString() });
  assert('Daily Entry starts', /Daily Entry Log/i.test(r.reply || ''));
  assert('Daily Entry shows Item 1/19', /Item 1\/19/.test(r.reply || ''), r.reply);
  assert('target range displays', /30°F - 45°F/.test(r.reply || ''), r.reply);

  r = await router.handleCommand({ chatId, isGroup: false, sender, senderName: 'CEO Test', text: '44', groupName: '', timestamp: new Date().toISOString() });
  assert('44 for Walk-in Cooler accepted and advances', /Item 2\/19/.test(r.reply || ''), r.reply);

  r = await router.handleCommand({ chatId, isGroup: false, sender, senderName: 'CEO Test', text: '10', groupName: '', timestamp: new Date().toISOString() });
  assert('10 for Walk-in Freezer triggers outside range', /Outside Target Range|Critical Temperature/i.test(r.reply || ''), r.reply);
  assert('no generic fallback during workflow', !/Thank you for your message/i.test(r.reply || ''));

  r = await router.handleCommand({ chatId, isGroup: false, sender, senderName: 'CEO Test', text: 'STATUS', groupName: '', timestamp: new Date().toISOString() });
  assert('STATUS shows progress out of 19', /Progress:\s*1\/19|1\/19/.test(r.reply || ''), r.reply);

  broth.clearSession(chatId, sender);
  guided.clearSession(chatId, sender);

  if (failed) {
    console.log(`\nFAILED ${failed}, PASSED ${passed}`);
    process.exit(1);
  }
  console.log(`\nPASSED ${passed}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
