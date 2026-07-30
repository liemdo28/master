/**
 * Template Architecture Tests
 * Covers the 10 CEO-directed scenarios plus unit tests for each component.
 */

require('dotenv').config();

let passed = 0; let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) { console.log(`  ✅ PASS: ${label}`); passed++; }
  else { console.log(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}
function section(t) { console.log(`\n[ ${t} ]`); }
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('\n=== Template Architecture Tests ===\n');

  const templateCache  = require('../src/templates/template-cache');
  const templateSvc    = require('../src/templates/daily-entry-template-service');
  const syncSvc        = require('../src/templates/template-sync-service');
  const infoCmd        = require('../src/commands/info-commands');
  const router         = require('../src/commands/command-router');
  const brothCommand   = require('../src/commands/broth-command');

  // Init DB for tests
  const { getDb } = require('../src/storage/sqlite');
  getDb();
  await delay(500);

  // ── T1: Template sync loads items ────────────────────────────────────────────
  section('T1 — Template sync: injectSnapshot simulates sheet load');
  {
    templateCache.clearSnapshot();
    const testItems = [
      { name: 'Walk-in Cooler',    min: 30, max: 40, sortOrder: 1 },
      { name: 'Walk-in Freezer',   min: -10, max: 0,  sortOrder: 2 },
      { name: 'Prep Area Cooler',  min: 34, max: 40, sortOrder: 3 },
      { name: 'Fryer Oil Temp',    min: 350, max: 375, sortOrder: 4 },
      { name: 'Pork Broth',        min: 185, max: 212, sortOrder: 5 },
    ];
    templateCache.injectSnapshot(testItems);
    const names = templateCache.getItemNames();
    assert('T1: items loaded', names.length === 5, `got ${names.length}`);
    assert('T1: Walk-in Cooler present', names.includes('Walk-in Cooler'));
    assert('T1: Pork Broth present', names.includes('Pork Broth'));
    assert('T1: source is test', templateCache.getStatus().source === 'test');
  }

  // ── T2: Template sync loads min/max thresholds ────────────────────────────────
  section('T2 — Template sync loads min/max thresholds');
  {
    const thresholds = templateCache.getThresholds();
    assert('T2: Walk-in Cooler min=30', thresholds['Walk-in Cooler']?.min === 30);
    assert('T2: Walk-in Cooler max=40', thresholds['Walk-in Cooler']?.max === 40);
    assert('T2: Walk-in Freezer max=0', thresholds['Walk-in Freezer']?.max === 0);
    assert('T2: Fryer Oil min=350', thresholds['Fryer Oil Temp']?.min === 350);
  }

  // ── T3: Added item appears automatically ──────────────────────────────────────
  section('T3 — Added item appears automatically');
  {
    templateCache.injectSnapshot([
      { name: 'Walk-in Cooler', min: 30, max: 40, sortOrder: 1 },
      { name: 'Beer Cooler',    min: 34, max: 38, sortOrder: 2 },  // new item
    ]);
    const names = templateCache.getItemNames();
    assert('T3: Beer Cooler added', names.includes('Beer Cooler'));
    assert('T3: 2 items now', names.length === 2);
    assert('T3: threshold exists for Beer Cooler', !!templateCache.getThresholds()['Beer Cooler']);
  }

  // ── T4: Removed item disappears automatically ─────────────────────────────────
  section('T4 — Removed item disappears automatically');
  {
    templateCache.injectSnapshot([
      { name: 'Walk-in Cooler', min: 30, max: 40, sortOrder: 1 },
      // Beer Cooler removed
    ]);
    const names = templateCache.getItemNames();
    assert('T4: Beer Cooler gone', !names.includes('Beer Cooler'));
    assert('T4: Walk-in Cooler still present', names.includes('Walk-in Cooler'));
  }

  // ── T5: Threshold uses latest template values ────────────────────────────────
  section('T5 — Threshold uses latest injected values');
  {
    // Inject original threshold
    templateCache.injectSnapshot([{ name: 'Walk-in Cooler', min: 30, max: 40, sortOrder: 1 }]);
    assert('T5: original max=40', templateCache.getThresholds()['Walk-in Cooler']?.max === 40);

    // Manager changes max to 45
    templateCache.injectSnapshot([{ name: 'Walk-in Cooler', min: 30, max: 45, sortOrder: 1 }]);
    assert('T5: updated max=45', templateCache.getThresholds()['Walk-in Cooler']?.max === 45, `got ${templateCache.getThresholds()['Walk-in Cooler']?.max}`);
  }

  // ── T6: Dashboard shows last sync ────────────────────────────────────────────
  section('T6 — Dashboard template status accessible via API');
  {
    templateCache.injectSnapshot([
      { name: 'Walk-in Cooler', min: 30, max: 40, sortOrder: 1 },
      { name: 'Walk-in Freezer', min: null, max: 0, sortOrder: 2 },
    ]);
    const status = templateCache.getStatus();
    assert('T6: version is set', !!status.version);
    assert('T6: syncedAt is set', !!status.syncedAt);
    assert('T6: rowCount=2', status.rowCount === 2);
    assert('T6: source=test', status.source === 'test');
  }

  // ── T7: /template command works ──────────────────────────────────────────────
  section('T7 — /template command works');
  {
    templateCache.injectSnapshot([
      { name: 'Walk-in Cooler', min: 30, max: 40, sortOrder: 1 },
      { name: 'Walk-in Freezer', min: null, max: 0, sortOrder: 2 },
    ]);
    const r = await router.handleCommand({ chatId: '84TMPL', isGroup: false, sender: '84TMPL', senderName: 'Test', text: '/template', groupName: '', timestamp: new Date().toISOString() });
    assert('T7: handled', r.handled === true);
    assert('T7: reply contains Template Status', /template status/i.test(r.reply));
    assert('T7: reply shows item count', /items.*2|2.*items/i.test(r.reply));
    assert('T7: reply shows Walk-in Cooler', /walk-in cooler/i.test(r.reply));
  }

  // ── T8: /log command works ───────────────────────────────────────────────────
  section('T8 — /log command works');
  {
    const r = await router.handleCommand({ chatId: '84LOG', isGroup: false, sender: '84LOG', senderName: 'Test', text: '/log', groupName: '', timestamp: new Date().toISOString() });
    assert('T8: handled', r.handled === true);
    assert('T8: reply contains Log Status', /log status/i.test(r.reply));
  }

  // ── T9: /status command works ────────────────────────────────────────────────
  section('T9 — /status command works');
  {
    const r = await router.handleCommand({ chatId: '84STAT', isGroup: false, sender: '84STAT', senderName: 'Test', text: '/status', groupName: '', timestamp: new Date().toISOString() });
    assert('T9: handled', r.handled === true);
    assert('T9: reply contains System Status', /system status/i.test(r.reply));
    assert('T9: reply shows WhatsApp status', /whatsapp/i.test(r.reply));
    assert('T9: reply shows Template status', /template/i.test(r.reply));
  }

  // ── T10: /help shows all 4 commands ─────────────────────────────────────────
  section('T10 — /help shows all commands including new ones');
  {
    const r = await router.handleCommand({ chatId: '84HELP', isGroup: false, sender: '84HELP', senderName: 'Test', text: '/help', groupName: '', timestamp: new Date().toISOString() });
    assert('T10: handled', r.handled === true);
    assert('T10: shows /broth',    /\/broth/i.test(r.reply));
    assert('T10: shows /template', /\/template/i.test(r.reply));
    assert('T10: shows /log',      /\/log/i.test(r.reply));
    assert('T10: shows /status',   /\/status/i.test(r.reply));
    assert('T10: shows CONFIRM',   /CONFIRM/i.test(r.reply));
    assert('T10: shows EDIT',      /EDIT/i.test(r.reply));
  }

  // ── Template cache: persist + warmFromDb round-trip ─────────────────────────
  section('Template Cache — SQLite persist + warmFromDb round-trip');
  {
    const template = templateSvc.parseTemplateRows([
      ['Category', 'Item', 'Target Min', 'Target Max'],
      ['Test', 'RoundTrip A', '10', '20'],
      ['Test', 'RoundTrip B', '30', '40'],
      ['Test', 'RoundTrip C', 'N/A', 'N/A'],
    ], { source: 'test', tab: 'Daily_Entry_Template', syncedAt: new Date().toISOString() });
    await templateSvc.saveTemplate(template);
    assert('Persist: version returned', typeof template.template_version === 'string' && template.template_version.length > 0);
    assert('Persist: snapshot updated', templateCache.getItemNames().includes('RoundTrip A'));

    // Clear and warm from DB
    templateCache.clearSnapshot();
    templateSvc.clearTemplate();
    await templateCache.warmFromDb();
    const names = templateCache.getItemNames();
    assert('WarmFromDb: RoundTrip A present', names.includes('RoundTrip A'));
    assert('WarmFromDb: RoundTrip B present', names.includes('RoundTrip B'));
    assert('WarmFromDb: source=sqlite', templateCache.getStatus().source === 'sqlite');
    const thresholdsAfter = templateCache.getThresholds();
    assert('WarmFromDb: threshold A min=10', thresholdsAfter['RoundTrip A']?.min === 10);
    assert('WarmFromDb: threshold B max=40', thresholdsAfter['RoundTrip B']?.max === 40);
  }

  // ── infoCommands.isInfoCommand ───────────────────────────────────────────────
  section('Info Commands — detection');
  assert('/template detected', infoCmd.isInfoCommand('/template'));
  assert('/log detected',      infoCmd.isInfoCommand('/log'));
  assert('/status detected',   infoCmd.isInfoCommand('/status'));
  assert('/broth not detected', !infoCmd.isInfoCommand('/broth'));
  assert('/help not detected',  !infoCmd.isInfoCommand('/help'));
  assert('random not detected', !infoCmd.isInfoCommand('hello'));

  // ── Template affects /broth item list ────────────────────────────────────────
  section('Template → /broth uses dynamic items');
  {
    const customItems = [
      'Walk-in Cooler',
      'Walk-in Freezer',
      'Prep Area Cooler',
      'Ramen Refrigeration Top',
      'Ramen Refrigeration Below',
      'Line Freezer',
      'Tapas Refrigeration Top',
      'Tapas Refrigeration Below',
      'Bowl Warmers',
      'Hot Holding',
      'Fryer 1',
      'Fryer 2',
      'Pasta Boiler 1',
      'Pasta Boiler 2',
      'Pork Broth',
      'Chicken Broth',
      'Rice Warmer',
      'Dish Machine',
      'Thermometer Calibration',
    ];
    templateCache.injectSnapshot(customItems);

    const chatId = '84DYNAMIC1'; const sender = '84DYNAMIC2';
    const r = await router.handleCommand({ chatId, isGroup: false, sender, senderName: 'Test', text: '/broth Rim', groupName: '', timestamp: new Date().toISOString() });
    assert('Dynamic items: /broth handled', r.handled);
    assert('Dynamic items: form shows Walk-in Cooler', /walk-in cooler/i.test(r.reply));
    assert('Dynamic items: form shows Thermometer Calibration', /thermometer calibration/i.test(r.reply));
    assert('Dynamic items: form shows current 19 items', (r.reply.match(/\d+\./g) || []).length === customItems.length,
      `found ${(r.reply.match(/\d+\./g) || []).length} numbered items`);
    brothCommand.clearSession(chatId, sender);

    // Restore defaults
    templateCache.injectSnapshot(templateCache.DEFAULT_ITEMS);
  }

  // ── Sync service: syncOnce with mocked sheet ─────────────────────────────────
  section('Template Sync Service — syncOnce with mocked getValues');
  {
    const sheetsClient = require('../src/google/sheets-client');
    const origGetValues = sheetsClient.getValues;
    sheetsClient.getValues = async () => [
      ['Walk-in Cooler',  '30', '40'],
      ['Walk-in Freezer', '-10', '0'],
      ['Prep Area',       '34', '40'],
      ['Fryer',           '350', '375'],
      ['Pork Broth',      '185', '212'],
    ];

    templateCache.clearSnapshot();
    const result = await syncSvc.syncOnce();
    assert('syncOnce: status SUCCESS', result?.status === 'SUCCESS', `got ${result?.status}: ${result?.error}`);
    assert('syncOnce: rowCount=5', result?.rowCount === 5, `got ${result?.rowCount}`);
    assert('syncOnce: version set', !!result?.version);

    const names = templateCache.getItemNames();
    assert('syncOnce: Walk-in Cooler loaded', names.includes('Walk-in Cooler'));
    assert('syncOnce: Pork Broth loaded', names.includes('Pork Broth'));
    const thresh = templateCache.getThresholds();
    assert('syncOnce: Walk-in Cooler min=30', thresh['Walk-in Cooler']?.min === 30);
    assert('syncOnce: Pork Broth max=212', thresh['Pork Broth']?.max === 212);

    sheetsClient.getValues = origGetValues;
  }

  // ── Sync failure falls back gracefully ───────────────────────────────────────
  section('Template Sync — sheet failure does not crash');
  {
    const sheetsClient = require('../src/google/sheets-client');
    const origGetValues = sheetsClient.getValues;
    sheetsClient.getValues = async () => { throw new Error('sheet unreachable (test)'); };

    const snapshot0 = templateCache.getItemNames().slice();
    const result = await syncSvc.syncOnce();
    assert('Sync failure: status FAILED', result?.status === 'FAILED', `got ${result?.status}`);
    assert('Sync failure: error message set', !!result?.error);
    assert('Sync failure: runtime cache unchanged', JSON.stringify(templateCache.getItemNames()) === JSON.stringify(snapshot0));

    sheetsClient.getValues = origGetValues;
  }

  // ── computeVersion is stable ─────────────────────────────────────────────────
  section('Template Cache — version is deterministic');
  {
    const items1 = [{ name: 'A', min: 1, max: 2 }, { name: 'B', min: 3, max: 4 }];
    const items2 = [{ name: 'A', min: 1, max: 2 }, { name: 'B', min: 3, max: 4 }];
    const items3 = [{ name: 'A', min: 1, max: 2 }, { name: 'B', min: 3, max: 5 }]; // B.max changed
    assert('Same input → same version', templateCache.computeVersion(items1) === templateCache.computeVersion(items2));
    assert('Different input → different version', templateCache.computeVersion(items1) !== templateCache.computeVersion(items3));
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 All template architecture tests PASSED\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests FAILED\n');
    process.exit(1);
  }
}

main().catch(err => { console.error('Template test error:', err); process.exit(1); });
