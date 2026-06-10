/**
 * Broth Command Tests — Phase 2.5
 * Covers all 16 CEO directive scenarios + parser unit tests + legacy sheet/storage tests.
 */

require('dotenv').config();

if (process.env.LEGACY_TESTS !== '1') {
  console.log('Skipping legacy broth command tests. Set LEGACY_TESTS=1 to run this obsolete 11-item broth workflow suite.');
  process.exit(0);
}

let passed = 0; let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) { console.log(`  ✅ PASS: ${label}`); passed++; }
  else { console.log(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}

function section(t) { console.log(`\n[ ${t} ]`); }

// ── Unique IDs per test ────────────────────────────────────────────────────────
let _n = 9000;
function freshId(suffix = '') { return `84TEST${_n++}${suffix}`; }

async function main() {
  console.log('\n=== Broth Command Tests — Phase 2.5 ===\n');

  const brothCommand = require('../../src/commands/broth-command');
  const parser       = require('../../src/commands/broth-parser');
  const validator    = require('../../src/commands/broth-validator');
  const router       = require('../../src/commands/command-router');
  const writer       = require('../../src/google/broth-log-writer');
  const sheetsClient = require('../../src/google/sheets-client');
  const storage      = require('../../src/storage/food-safety-storage');

  await storage.ensureTables();

  // Helper: run a full command through the router
  async function cmd(chatId, sender, text, isGroup = false, groupName = '') {
    return router.handleCommand({ chatId, isGroup, sender, senderName: 'Tester', text, groupName, timestamp: new Date().toISOString() });
  }

  // ════════════════════════════════════════════════════════════════════
  //  PART A — Legacy tests (preserve existing coverage)
  // ════════════════════════════════════════════════════════════════════
  section('A — Legacy: /broth form rendering');
  {
    const r = await brothCommand.startBrothCommand({
      chatId: 'legacy@g.us', sender: 'alice', senderName: 'Alice',
      text: '/broth Stone Oak', groupName: 'Food Safety Test', isGroup: true,
    });
    assert('Legacy: form shows Stone Oak', r.reply.includes('Daily Entry Log - Stone Oak') && r.reply.includes('11. Ichiran ='));
    assert('Legacy: detectStore from inline text', brothCommand.detectStore('/broth Stone Oak') === 'Stone Oak');
    assert('Legacy: detectStore from group name', brothCommand.detectStore('Food Safety Test - Stone Oak') === 'Stone Oak');
    brothCommand.clearSession('legacy@g.us', 'alice');
  }
  {
    const r = await brothCommand.startBrothCommand({
      chatId: 'unk@g.us', sender: 'alice', senderName: 'Alice',
      text: '/broth', groupName: 'Food Safety Test', isGroup: true,
    });
    assert('Legacy: unknown store asks selection', /1\.\s*Rim/i.test(r.reply) && /2\.\s*Stone Oak/i.test(r.reply) && /3\.\s*Bandera/i.test(r.reply));
    brothCommand.clearSession('unk@g.us', 'alice');
  }

  section('A — Legacy: parser');
  const numbered = parser.parseSubmission('1. 34\n2. 34\n3. 36\n4. 34\n5. 27\n6. 40\n7. 10\n8. 5\n9. 5\n10. 5\n11. 5');
  assert('Legacy: numbered parses Tonkotsu=34', numbered.values.Tonkotsu === '34');
  assert('Legacy: numbered parses Ichiran=5', numbered.values.Ichiran === '5');
  const named = parser.parseSubmission('Tonkotsu 34\nMiso 36\nShoyu 40');
  assert('Legacy: named parses Tonkotsu=34', named.values.Tonkotsu === '34');
  const csv = parser.parseSubmission('34,34,36,34,27,40,10,5,5,5,5');
  assert('Legacy: CSV Tonkotsu=34', csv.values.Tonkotsu === '34');
  assert('Legacy: CSV Ichiran=5', csv.values.Ichiran === '5');

  section('A — Legacy: validator');
  const missing = validator.validateCounts(named);
  assert('Legacy: missing fields detected', missing.missing.includes('Cilantro Lime'));
  const invalid = validator.validateCounts(parser.parseSubmission('Tonkotsu abc\nMiso 36'));
  assert('Legacy: invalid text rejected', invalid.invalid.some(v => v.item === 'Tonkotsu'));
  const valid = validator.validateCounts(csv);
  assert('Legacy: valid CSV passes', valid.valid && valid.counts.Shoyu === 40);

  section('A — Legacy: broth-log-writer payload (v2 schema)');
  {
    const { validateAll } = require('../../src/templates/template-validator');
    const vResult = validateAll(valid.counts);
    const row = writer.buildRow({
      metadata: { chatId: 'test@g.us', senderName: 'Sender', timestamp: '2026-06-03T10:00:00.000Z' },
      store: 'Stone Oak', templateVersion: 'test-v1',
      counts: valid.counts, validationResult: vResult, notes: 'test',
    });
    // New schema: 17 dynamic columns (A-Q)
    assert('Legacy: row has 17 columns', row.length === 17, `got ${row.length}`);
    assert('Legacy: row[2] = Stone Oak', row[2] === 'Stone Oak');
    assert('Legacy: row[13] = PASS or FAIL', ['PASS','FAIL'].includes(row[13]));
    assert('Legacy: row[11] is valid JSON', (() => { try { JSON.parse(row[11]); return true; } catch (_) { return false; } })());
  }

  section('A — Legacy: sheet failure → queue');
  {
    const { validateAll } = require('../../src/templates/template-validator');
    const origAppend = sheetsClient.appendValues;
    sheetsClient.appendValues = async () => { throw new Error('sheet down'); };
    const prevEnabled = process.env.GOOGLE_SHEETS_ENABLED;
    process.env.GOOGLE_SHEETS_ENABLED = 'true';
    const queued = await writer.appendBrothLog({
      entryId: 'BROTH_TEST_QUEUE',
      metadata: { chatId: 'test@g.us', senderName: 'Sender', timestamp: '2026-06-03T10:00:00.000Z' },
      store: 'Stone Oak', counts: valid.counts, validationResult: validateAll(valid.counts),
    });
    assert('Legacy: sheet failure → QUEUED', queued.status === 'QUEUED');
    const pending = await storage.getPendingSheetWrites(10);
    const queuedPayloads = pending.filter(i => i.check_id === 'BROTH_TEST_QUEUE').map(i => JSON.parse(i.payload_json));
    assert('Legacy: queue has broth type', queuedPayloads.some(p => p.type === 'broth'));
    assert('Legacy: queue has columnEnd Q', queuedPayloads.some(p => p.columnEnd === 'Q'));
    sheetsClient.appendValues = origAppend;
    if (prevEnabled === undefined) delete process.env.GOOGLE_SHEETS_ENABLED;
    else process.env.GOOGLE_SHEETS_ENABLED = prevEnabled;
  }

  section('A — Legacy: test-mode allowlist');
  {
    const prevMode = process.env.FOOD_SAFETY_TEST_MODE;
    const prevAllowed = process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS;
    process.env.FOOD_SAFETY_TEST_MODE = 'true';
    process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = 'allowed@g.us';
    assert('Legacy: isAllowedTestChat blocks non-allowed', router.isAllowedTestChat('blocked@g.us') === false);
    assert('Legacy: isAllowedTestChat passes allowed', router.isAllowedTestChat('allowed@g.us') === true);
    process.env.FOOD_SAFETY_TEST_MODE = prevMode;
    process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = prevAllowed;
  }

  // ════════════════════════════════════════════════════════════════════
  //  PART B — Phase 2.5 new scenarios (CEO directive T1–T16)
  // ════════════════════════════════════════════════════════════════════
  section('T1 — Direct /broth asks for store');
  {
    const [c, s] = [freshId(), freshId()];
    const r = await cmd(c, s, '/broth', false);
    assert('T1: handled', r.handled === true);
    assert('T1: not blocked', !r.blocked);
    assert('T1: reply has store options', /1\. Rim|2\. Stone Oak|3\. Bandera/i.test(r.reply));
    assert('T1: session WAITING_STORE', brothCommand.getSession(c, s)?.state === 'WAITING_STORE');
    brothCommand.clearSession(c, s);
  }

  section('T2 — Direct /broth Stone Oak shows form immediately');
  {
    const [c, s] = [freshId(), freshId()];
    const r = await cmd(c, s, '/broth Stone Oak', false);
    assert('T2: handled', r.handled);
    assert('T2: reply shows Stone Oak', /stone oak/i.test(r.reply));
    assert('T2: reply shows items', /Tonkotsu|Cilantro/i.test(r.reply));
    assert('T2: session WAITING_COUNTS', brothCommand.getSession(c, s)?.state === 'WAITING_COUNTS');
    brothCommand.clearSession(c, s);
  }

  section('T3 — Group /broth detects store from group name');
  {
    const [c, s] = [freshId('@g.us'), freshId()];
    // Temporarily whitelist this chatId so test mode doesn't block it
    const prevMode = process.env.FOOD_SAFETY_TEST_MODE;
    const prevList = process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS;
    process.env.FOOD_SAFETY_TEST_MODE = 'true';
    process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = c;
    const r = await cmd(c, s, '/broth', true, 'Food Safety Test - Stone Oak');
    process.env.FOOD_SAFETY_TEST_MODE = prevMode || ''; process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = prevList || '';
    assert('T3: handled', r.handled);
    assert('T3: not blocked', !r.blocked);
    assert('T3: shows Stone Oak form directly', /stone oak/i.test(r.reply), `reply: "${(r.reply||'').slice(0,60)}"`);
    assert('T3: no store selection prompt', !/which store/i.test(r.reply));
    brothCommand.clearSession(c, s);
  }

  section('T4 — /broth does not fall through to AI');
  {
    const [c, s] = [freshId(), freshId()];
    const r = await cmd(c, s, '/broth', false);
    assert('T4: handled=true (intercepted before AI)', r.handled === true);
    brothCommand.clearSession(c, s);
  }

  section('T5 — Valid counts → WAITING_CONFIRM, no sheet write yet');
  {
    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Bandera', false);
    const r = await cmd(c, s, '34,34,36,34,27,40,10,5,5,5,5', false);
    const session = brothCommand.getSession(c, s);
    assert('T5: state=WAITING_CONFIRM', session?.state === 'WAITING_CONFIRM');
    assert('T5: CONFIRM in reply', /CONFIRM/i.test(r.reply));
    assert('T5: EDIT in reply', /EDIT/i.test(r.reply));
    assert('T5: CANCEL in reply', /CANCEL/i.test(r.reply));
    assert('T5: 11 draft counts', Object.keys(session?.draftCounts || {}).length === 11);
    // Sheet NOT yet written — session still open
    assert('T5: session still open (not written)', brothCommand.hasActiveSession(c, s));
    // Don't clear — used by nothing else
    brothCommand.clearSession(c, s);
  }

  section('T6 — CONFIRM finalizes and writes (or queues) sheet');
  {
    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Rim', false);
    await cmd(c, s, '34,34,36,34,27,40,10,5,5,5,5', false);
    const r = await cmd(c, s, 'CONFIRM', false);
    assert('T6: session cleared after confirm', !brothCommand.hasActiveSession(c, s));
    assert('T6: reply has confirmed/recorded', /confirmed|recorded|saved/i.test(r.reply));
    assert('T6: result.sheetWrite present', !!r.result?.sheetWrite);
    assert('T6: sheetWrite status SENT or QUEUED', ['SENT','QUEUED'].includes(r.result?.sheetWrite?.status));
  }

  section('T7 — CANCEL deletes session');
  {
    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Stone Oak', false);
    assert('T7: session exists before cancel', brothCommand.hasActiveSession(c, s));
    const r = await cmd(c, s, 'CANCEL', false);
    assert('T7: session gone after cancel', !brothCommand.hasActiveSession(c, s));
    assert('T7: reply confirms cancel', /cancel/i.test(r.reply));
  }

  section('T8 — STATUS shows draft without advancing state');
  {
    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Bandera', false);
    await cmd(c, s, '1. 34\n2. 20', false); // partial
    const r = await cmd(c, s, 'STATUS', false);
    assert('T8: reply has draft content', /draft|state|bandera/i.test(r.reply));
    assert('T8: session still active', brothCommand.hasActiveSession(c, s));
    brothCommand.clearSession(c, s);
  }

  section('T9 — EDIT 6 42 updates Shoyu (by number)');
  {
    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Stone Oak', false);
    await cmd(c, s, '34,34,36,34,27,40,10,5,5,5,5', false); // Shoyu=40
    const r = await cmd(c, s, 'EDIT 6 42', false);
    const session = brothCommand.getSession(c, s);
    assert('T9: Shoyu updated to 42', session?.draftCounts?.['Shoyu'] === 42);
    assert('T9: reply shows update', /updated|shoyu/i.test(r.reply));
    assert('T9: still WAITING_CONFIRM', session?.state === 'WAITING_CONFIRM');
    brothCommand.clearSession(c, s);
  }

  section('T10 — EDIT Shoyu 42 updates by name');
  {
    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Rim', false);
    await cmd(c, s, '34,34,36,34,27,40,10,5,5,5,5', false);
    const r = await cmd(c, s, 'EDIT Shoyu 99', false);
    const session = brothCommand.getSession(c, s);
    assert('T10: Shoyu updated to 99', session?.draftCounts?.['Shoyu'] === 99);
    brothCommand.clearSession(c, s);
  }

  section('T11 — Missing values ask for completion');
  {
    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Bandera', false);
    const r = await cmd(c, s, '1. 34\n2. 34\n3. 10', false); // only 3 of 11
    const session = brothCommand.getSession(c, s);
    // v2: partial input now moves to WAITING_MISSING_VALUES (not WAITING_COUNTS)
    assert('T11: in WAITING_MISSING_VALUES', session?.state === 'WAITING_MISSING_VALUES',
      `got ${session?.state}`);
    assert('T11: reply asks for missing', /missing|provide|please/i.test(r.reply));
    assert('T11: 3 counts saved so far', Object.keys(session?.draftCounts || {}).length === 3);
    brothCommand.clearSession(c, s);
  }

  section('T12 — Invalid values rejected');
  {
    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Stone Oak', false);
    const r = await cmd(c, s, 'abc,34,36,34,27,40,10,5,5,5,5', false);
    assert('T12: reply mentions invalid', /invalid/i.test(r.reply));
    brothCommand.clearSession(c, s);
  }

  section('T13 — Multiple users in same group → separate sessions');
  {
    const groupId = freshId('@g.us');
    const alice = freshId('a'); const bob = freshId('b');
    // Whitelist the group so test mode doesn't block it
    const prevMode = process.env.FOOD_SAFETY_TEST_MODE;
    const prevList = process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS;
    process.env.FOOD_SAFETY_TEST_MODE = 'true';
    process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = groupId;
    await cmd(groupId, alice, '/broth Stone Oak', true, 'Food Safety Group');
    await cmd(groupId, bob,   '/broth Bandera',   true, 'Food Safety Group');
    process.env.FOOD_SAFETY_TEST_MODE = prevMode || ''; process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = prevList || '';
    const sA = brothCommand.getSession(groupId, alice);
    const sB = brothCommand.getSession(groupId, bob);
    assert('T13: Alice session exists', !!sA, `key=${groupId}:${alice}`);
    assert('T13: Bob session exists', !!sB, `key=${groupId}:${bob}`);
    assert('T13: Alice store = Stone Oak', sA?.store === 'Stone Oak', `got ${sA?.store}`);
    assert('T13: Bob store = Bandera', sB?.store === 'Bandera', `got ${sB?.store}`);
    assert('T13: sessions are independent', sA !== sB);
    brothCommand.clearSession(groupId, alice);
    brothCommand.clearSession(groupId, bob);
  }

  section('T14 — Test mode + empty allowlist → direct chat allowed');
  {
    const [origMode, origList] = [process.env.FOOD_SAFETY_TEST_MODE, process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS];
    process.env.FOOD_SAFETY_TEST_MODE = 'true';
    process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = '';
    assert('T14: direct chat allowed', router.checkAccess(freshId(), false).allowed === true);
    process.env.FOOD_SAFETY_TEST_MODE = origMode || ''; process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = origList || '';
  }

  section('T15 — Test mode + empty allowlist → group blocked');
  {
    const [origMode, origList] = [process.env.FOOD_SAFETY_TEST_MODE, process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS];
    process.env.FOOD_SAFETY_TEST_MODE = 'true';
    process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = '';
    assert('T15: group blocked', router.checkAccess(freshId('@g.us'), true).allowed === false);
    process.env.FOOD_SAFETY_TEST_MODE = origMode || ''; process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = origList || '';
  }

  section('T16 — Test mode + allowed group → group allowed, others blocked');
  {
    const [origMode, origList] = [process.env.FOOD_SAFETY_TEST_MODE, process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS];
    const allowed = '11111@g.us';
    process.env.FOOD_SAFETY_TEST_MODE = 'true';
    process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = allowed;
    assert('T16: allowed group passes', router.checkAccess(allowed, true).allowed === true);
    assert('T16: other group blocked', router.checkAccess('99999@g.us', true).allowed === false);
    process.env.FOOD_SAFETY_TEST_MODE = origMode || ''; process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = origList || '';
  }

  // ════════════════════════════════════════════════════════════════════
  //  PART C — Parser unit tests
  // ════════════════════════════════════════════════════════════════════
  section('C — parseControlCommand');
  assert('CONFIRM', parser.parseControlCommand('CONFIRM').type === 'CONFIRM');
  assert('confirm lowercase', parser.parseControlCommand('confirm').type === 'CONFIRM');
  assert('YES = CONFIRM', parser.parseControlCommand('YES').type === 'CONFIRM');
  assert('OK = CONFIRM', parser.parseControlCommand('OK').type === 'CONFIRM');
  assert('CANCEL', parser.parseControlCommand('CANCEL').type === 'CANCEL');
  assert('ABORT = CANCEL', parser.parseControlCommand('ABORT').type === 'CANCEL');
  assert('STATUS', parser.parseControlCommand('STATUS').type === 'STATUS');
  assert('DRAFT = STATUS', parser.parseControlCommand('DRAFT').type === 'STATUS');
  assert('EDIT 6 42 type', parser.parseControlCommand('EDIT 6 42').type === 'EDIT');
  assert('EDIT 6 42 value=42', parser.parseControlCommand('EDIT 6 42').value === 42);
  assert('EDIT 6 42 itemName=Shoyu', parser.parseControlCommand('EDIT 6 42').itemName === 'Shoyu');
  assert('EDIT Shoyu 42 type', parser.parseControlCommand('EDIT Shoyu 42').type === 'EDIT');
  assert('EDIT Shoyu 42 value=42', parser.parseControlCommand('EDIT Shoyu 42').value === 42);
  assert('EDIT Shoyu 42 index=6', parser.parseControlCommand('EDIT Shoyu 42').index === 6);
  assert('Random text → null', parser.parseControlCommand('hello there').type === null);

  section('C — parseSubmission formats');
  const csvR = parser.parseSubmission('34,34,36,34,27,40,10,5,5,5,5');
  assert('CSV: 11 values parsed', Object.keys(csvR.values).length === 11);
  assert('CSV: Tonkotsu=34', csvR.values['Tonkotsu'] === '34');
  assert('CSV: Shoyu=40', csvR.values['Shoyu'] === '40');
  assert('CSV: Ichiran=5', csvR.values['Ichiran'] === '5');
  const linesR = parser.parseSubmission('1. 34\n6. 42\n11. 7');
  assert('Lines: Tonkotsu=34', linesR.values['Tonkotsu'] === '34');
  assert('Lines: Shoyu=42', linesR.values['Shoyu'] === '42');
  assert('Lines: Ichiran=7', linesR.values['Ichiran'] === '7');
  const eqFmt = parser.parseSubmission('Shoyu = 42\nTonkotsu = 34');
  assert('Named =: Shoyu=42', eqFmt.values['Shoyu'] === '42');
  assert('Named =: Tonkotsu=34', eqFmt.values['Tonkotsu'] === '34');

  // ════════════════════════════════════════════════════════════════════
  //  PART D — v2 New Features (CEO Directive — Dynamic Items + Missing Values)
  // ════════════════════════════════════════════════════════════════════
  const itemsLoader = require('../../src/google/broth-items-loader');

  section('D1 — /help returns command list');
  {
    const [c, s] = [freshId(), freshId()];
    const r = await cmd(c, s, '/help', false);
    assert('D1: handled', r.handled === true);
    assert('D1: not blocked', !r.blocked);
    assert('D1: reply has /broth', /\/broth/i.test(r.reply));
    assert('D1: reply has CONFIRM', /CONFIRM/i.test(r.reply));
    assert('D1: reply has EDIT', /EDIT/i.test(r.reply));
    assert('D1: reply has CANCEL', /CANCEL/i.test(r.reply));
    assert('D1: reply has STATUS', /STATUS/i.test(r.reply));
    assert('D1: no session created', !brothCommand.hasActiveSession(c, s));
  }

  section('D2 — Broth items loader: disk cache fallback');
  {
    // Write a test cache and verify getItems() returns it
    itemsLoader.clearCache();
    const testItems = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'];
    itemsLoader.writeCache(testItems);
    itemsLoader.clearCache(); // clear in-process, force re-read from disk
    const loaded = itemsLoader.getItems();
    assert('D2: disk cache loaded', JSON.stringify(loaded) === JSON.stringify(testItems),
      `got ${JSON.stringify(loaded)}`);
    // Restore real cache
    itemsLoader.writeCache(itemsLoader.DEFAULT_ITEMS);
    itemsLoader.clearCache();
  }

  section('D3 — /broth fallback uses cached item list');
  {
    // Ensure items loader has the default list loaded
    itemsLoader.clearCache();
    const items = itemsLoader.getItems(); // loads default
    assert('D3: default items loaded', items.length === 11);
    assert('D3: default has Tonkotsu', items.includes('Tonkotsu'));
    assert('D3: default has Ichiran', items.includes('Ichiran'));
    assert('D3: cacheSource is default or disk_cache', ['default','disk_cache'].includes(itemsLoader.getCacheSource()));
  }

  section('D4 — Partial CSV creates WAITING_MISSING_VALUES state');
  {
    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Bandera', false);
    // Send only 6 of 11 values
    const r = await cmd(c, s, '35,26,67,77,88,99', false);
    const session = brothCommand.getSession(c, s);
    assert('D4: state = WAITING_MISSING_VALUES', session?.state === 'WAITING_MISSING_VALUES',
      `got ${session?.state}`);
    assert('D4: 6 counts saved', Object.keys(session?.draftCounts || {}).length === 6,
      `got ${Object.keys(session?.draftCounts || {}).length}`);
    assert('D4: 5 missing items', (session?.missingItems || []).length === 5,
      `got ${(session?.missingItems || []).length}`);
    assert('D4: reply shows missing items', /missing|provide/i.test(r.reply));
    assert('D4: reply lists item 7', /7\.|black garlic/i.test(r.reply));
    brothCommand.clearSession(c, s);
  }

  section('D5 — Continuation CSV fills missing values in order');
  {
    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Stone Oak', false);
    // Partial: items 1-6
    await cmd(c, s, '35,26,67,77,88,99', false);
    const sess1 = brothCommand.getSession(c, s);
    assert('D5: in WAITING_MISSING_VALUES', sess1?.state === 'WAITING_MISSING_VALUES');
    // Continuation: fills items 7-11
    const r = await cmd(c, s, '0,0,0,0,0', false);
    const session = brothCommand.getSession(c, s);
    assert('D5: state → WAITING_CONFIRM', session?.state === 'WAITING_CONFIRM',
      `got ${session?.state}`);
    assert('D5: all 11 counts filled', Object.keys(session?.draftCounts || {}).length === 11,
      `got ${Object.keys(session?.draftCounts || {}).length}`);
    assert('D5: reply shows summary', /summary|confirm/i.test(r.reply));
    brothCommand.clearSession(c, s);
  }

  section('D6 — Previous values preserved after continuation');
  {
    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Rim', false);
    await cmd(c, s, '35,26,67,77,88,99', false); // items 1-6
    await cmd(c, s, '0,0,0,0,0', false);          // items 7-11
    const session = brothCommand.getSession(c, s);
    const counts = session?.draftCounts || {};
    assert('D6: Tonkotsu=35 preserved', String(counts['Tonkotsu']) === '35', `got ${counts['Tonkotsu']}`);
    assert('D6: Cilantro Lime=26 preserved', String(counts['Cilantro Lime']) === '26');
    assert('D6: Shoyu=99 preserved', String(counts['Shoyu']) === '99', `got ${counts['Shoyu']}`);
    assert('D6: Black Garlic Oil=0 from continuation', String(counts['Black Garlic Oil']) === '0');
    assert('D6: Ichiran=0 from continuation', String(counts['Ichiran']) === '0');
    brothCommand.clearSession(c, s);
  }

  section('D7 — Summary appears when all values complete');
  {
    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Bandera', false);
    // Full CSV — all 11 at once
    const r = await cmd(c, s, '34,34,36,34,27,40,10,5,5,5,5', false);
    assert('D7: state = WAITING_CONFIRM', brothCommand.getSession(c, s)?.state === 'WAITING_CONFIRM');
    assert('D7: reply is summary', /summary|confirm/i.test(r.reply));
    assert('D7: reply shows store name', /bandera/i.test(r.reply));
    assert('D7: reply shows CONFIRM option', /CONFIRM/i.test(r.reply));
    assert('D7: reply shows EDIT option', /EDIT/i.test(r.reply));
    brothCommand.clearSession(c, s);
  }

  section('D8 — No Google Sheet write before CONFIRM');
  {
    let writeCount = 0;
    const origAppend = writer.appendBrothLog;
    writer.appendBrothLog = async (...args) => { writeCount++; return origAppend(...args); };

    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Stone Oak', false);
    await cmd(c, s, '34,34,36,34,27,40,10,5,5,5,5', false); // → WAITING_CONFIRM
    assert('D8: 0 sheet writes before CONFIRM', writeCount === 0, `got ${writeCount}`);
    await cmd(c, s, 'EDIT 6 42', false);
    assert('D8: 0 sheet writes after EDIT', writeCount === 0, `got ${writeCount}`);
    await cmd(c, s, 'STATUS', false);
    assert('D8: 0 sheet writes after STATUS', writeCount === 0, `got ${writeCount}`);

    writer.appendBrothLog = origAppend;
    brothCommand.clearSession(c, s);
  }

  section('D9 — CONFIRM writes sheet');
  {
    let writeCount = 0;
    const origAppend = writer.appendBrothLog;
    writer.appendBrothLog = async (...args) => { writeCount++; return origAppend(...args); };

    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Rim', false);
    await cmd(c, s, '34,34,36,34,27,40,10,5,5,5,5', false);
    await cmd(c, s, 'CONFIRM', false);
    assert('D9: exactly 1 sheet write on CONFIRM', writeCount === 1, `got ${writeCount}`);
    assert('D9: session cleared', !brothCommand.hasActiveSession(c, s));

    writer.appendBrothLog = origAppend;
  }

  section('D10 — EDIT updates value and re-shows summary');
  {
    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Stone Oak', false);
    await cmd(c, s, '34,34,36,34,27,40,10,5,5,5,5', false);
    // Shoyu starts at 40
    const r = await cmd(c, s, 'EDIT 6 42', false);
    const session = brothCommand.getSession(c, s);
    assert('D10: Shoyu updated to 42', session?.draftCounts?.['Shoyu'] === 42);
    assert('D10: state still WAITING_CONFIRM', session?.state === 'WAITING_CONFIRM');
    assert('D10: reply shows updated value', /42|updated/i.test(r.reply));
    assert('D10: reply shows CONFIRM again', /CONFIRM/i.test(r.reply));
    brothCommand.clearSession(c, s);
  }

  section('D11 — CANCEL prevents sheet write');
  {
    let writeCount = 0;
    const origAppend = writer.appendBrothLog;
    writer.appendBrothLog = async (...args) => { writeCount++; return origAppend(...args); };

    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Bandera', false);
    await cmd(c, s, '34,34,36,34,27,40,10,5,5,5,5', false);
    const r = await cmd(c, s, 'CANCEL', false);
    assert('D11: session cleared after cancel', !brothCommand.hasActiveSession(c, s));
    assert('D11: 0 sheet writes on cancel', writeCount === 0, `got ${writeCount}`);
    assert('D11: reply confirms cancel', /cancel/i.test(r.reply));

    writer.appendBrothLog = origAppend;
  }

  section('D12 — STATUS shows current draft correctly');
  {
    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Stone Oak', false);
    await cmd(c, s, '35,26,67,77,88,99', false); // partial — items 1-6
    const r = await cmd(c, s, 'STATUS', false);
    assert('D12: state still active', brothCommand.hasActiveSession(c, s));
    assert('D12: reply has stone oak', /stone oak/i.test(r.reply));
    assert('D12: reply shows Tonkotsu=35', /35/.test(r.reply));
    assert('D12: reply mentions missing', /missing/i.test(r.reply));
    brothCommand.clearSession(c, s);
  }

  section('D13 — Direct chat works end-to-end');
  {
    const [c, s] = [freshId(), freshId()];
    const r1 = await cmd(c, s, '/broth', false);
    assert('D13: direct /broth handled', r1.handled);
    const r2 = await cmd(c, s, '2', false);
    assert('D13: store 2 = Stone Oak', /stone oak/i.test(r2.reply));
    const r3 = await cmd(c, s, '34,34,36,34,27,40,10,5,5,5,5', false);
    assert('D13: summary shown', /summary|confirm/i.test(r3.reply));
    const r4 = await cmd(c, s, 'CONFIRM', false);
    assert('D13: confirmed', /confirmed|recorded|saved/i.test(r4.reply));
    assert('D13: session cleared', !brothCommand.hasActiveSession(c, s));
  }

  section('D14 — Group chat works (with whitelisted chatId)');
  {
    const [c, s] = [freshId('@g.us'), freshId()];
    const prevMode = process.env.FOOD_SAFETY_TEST_MODE;
    const prevList = process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS;
    process.env.FOOD_SAFETY_TEST_MODE = 'true';
    process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = c;

    const r1 = await cmd(c, s, '/broth Stone Oak', true, 'Food Safety Group');
    assert('D14: group /broth handled', r1.handled && !r1.blocked);
    assert('D14: Stone Oak form shown', /stone oak/i.test(r1.reply));
    const r2 = await cmd(c, s, '34,34,36,34,27,40,10,5,5,5,5', false);
    assert('D14: summary shown in group', /summary|confirm/i.test(r2.reply));
    brothCommand.clearSession(c, s);

    process.env.FOOD_SAFETY_TEST_MODE = prevMode || ''; process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = prevList || '';
  }

  section('D15 — Multiple users in same group have separate sessions');
  {
    const groupId = freshId('@g.us');
    const alice = freshId('a'); const bob = freshId('b');
    const prevMode = process.env.FOOD_SAFETY_TEST_MODE;
    const prevList = process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS;
    process.env.FOOD_SAFETY_TEST_MODE = 'true';
    process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = groupId;

    await cmd(groupId, alice, '/broth Stone Oak', true, 'Food Safety Group');
    await cmd(groupId, bob,   '/broth Bandera',   true, 'Food Safety Group');
    const sA = brothCommand.getSession(groupId, alice);
    const sB = brothCommand.getSession(groupId, bob);
    assert('D15: Alice session exists', !!sA);
    assert('D15: Bob session exists', !!sB);
    assert('D15: Alice = Stone Oak', sA?.store === 'Stone Oak');
    assert('D15: Bob = Bandera', sB?.store === 'Bandera');
    // Alice sends partial counts — must not affect Bob
    await cmd(groupId, alice, '35,26,67,77,88,99', true);
    const sAafter = brothCommand.getSession(groupId, alice);
    const sBafter = brothCommand.getSession(groupId, bob);
    assert('D15: Alice in WAITING_MISSING_VALUES', sAafter?.state === 'WAITING_MISSING_VALUES');
    assert('D15: Bob still in WAITING_COUNTS', sBafter?.state === 'WAITING_COUNTS',
      `got ${sBafter?.state}`);
    brothCommand.clearSession(groupId, alice);
    brothCommand.clearSession(groupId, bob);

    process.env.FOOD_SAFETY_TEST_MODE = prevMode || ''; process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = prevList || '';
  }

  // ── parseContinuation unit tests ──────────────────────────────────────────
  section('D — parseContinuation unit tests');
  const missingItems = ['Black Garlic Oil', 'Garlic Paste', 'Chili Oil', 'Spicy Paste', 'Ichiran'];
  const cont = parser.parseContinuation('0,0,0,0,0', missingItems);
  assert('parseContinuation: 5 values mapped', Object.keys(cont.values).length === 5);
  assert('parseContinuation: Black Garlic Oil=0', cont.values['Black Garlic Oil'] === '0');
  assert('parseContinuation: Ichiran=0', cont.values['Ichiran'] === '0');
  assert('parseContinuation: no invalid', cont.invalid.length === 0);

  const contPartial = parser.parseContinuation('10,20,30', missingItems);
  assert('parseContinuation partial: 3 values', Object.keys(contPartial.values).length === 3);
  assert('parseContinuation partial: Black Garlic=10', contPartial.values['Black Garlic Oil'] === '10');
  assert('parseContinuation partial: Garlic Paste=20', contPartial.values['Garlic Paste'] === '20');
  assert('parseContinuation partial: Chili Oil=30', contPartial.values['Chili Oil'] === '30');

  const contSingle = parser.parseContinuation('5', ['Ichiran']);
  assert('parseContinuation single: Ichiran=5', contSingle.values['Ichiran'] === '5');

  // ════════════════════════════════════════════════════════════════════
  //  PART E — Validation against dynamic min/max (CEO directive T19/T20)
  // ════════════════════════════════════════════════════════════════════
  const templateCache   = require('../../src/templates/template-cache');
  const { validateAll, validateItem, formatTarget } = require('../../src/templates/template-validator');

  section('E — template-validator: validateItem');
  assert('E: value in range → PASS', validateItem('Test', 35, { min: 30, max: 40 }).status === 'PASS');
  assert('E: value below min → FAIL', validateItem('Test', 25, { min: 30, max: 40 }).status === 'FAIL');
  assert('E: value above max → FAIL', validateItem('Test', 44, { min: 30, max: 40 }).status === 'FAIL');
  assert('E: max only, value ok → PASS', validateItem('Test', -5, { min: null, max: 0 }).status === 'PASS');
  assert('E: max only, value over → FAIL', validateItem('Test', 10, { min: null, max: 0 }).status === 'FAIL');
  assert('E: min only, value ok → PASS', validateItem('Test', 200, { min: 185, max: null }).status === 'PASS');
  assert('E: min only, value under → FAIL', validateItem('Test', 100, { min: 185, max: null }).status === 'FAIL');
  assert('E: no threshold → PASS', validateItem('Test', 999, null).status === 'PASS');
  assert('E: formatTarget min+max', formatTarget(30, 40) === '30–40');
  assert('E: formatTarget max only', formatTarget(null, 0) === '<= 0');
  assert('E: formatTarget min only', formatTarget(185, null) === '>= 185');
  assert('E: formatTarget none', formatTarget(null, null) === null);

  section('E — validateAll with injected thresholds');
  {
    const thresholds = {
      'Walk-in Cooler':  { min: 30, max: 40 },
      'Walk-in Freezer': { min: null, max: 0 },
      'Pork Broth':      { min: 185, max: 212 },
    };
    const pass_counts = { 'Walk-in Cooler': 35, 'Walk-in Freezer': -5, 'Pork Broth': 200 };
    const fail_counts = { 'Walk-in Cooler': 44, 'Walk-in Freezer': 10, 'Pork Broth': 150 };

    const passResult = validateAll(pass_counts, thresholds);
    assert('E: all pass → PASS', passResult.overallStatus === 'PASS');
    assert('E: no failures in pass result', passResult.failCount === 0);
    assert('E: warningSummary empty on pass', passResult.warningSummary === '');

    const failResult = validateAll(fail_counts, thresholds);
    assert('E: failures → FAIL', failResult.overallStatus === 'FAIL');
    assert('E: failCount=3', failResult.failCount === 3, `got ${failResult.failCount}`);
    assert('E: warningSummary contains cooler', /walk-in cooler/i.test(failResult.warningSummary));
    assert('E: failures array has 3 items', failResult.failures.length === 3);
    assert('E: failure has target range', failResult.failures.some(f => f.target === '30–40'));
  }

  section('T19 — FAIL values show warning in summary and after CONFIRM');
  {
    // Inject thresholds so we get predictable FAIL results
    templateCache.injectSnapshot([
      { name: 'Walk-in Cooler',  min: 30, max: 40, sortOrder: 1 },
      { name: 'Walk-in Freezer', min: null, max: 0, sortOrder: 2 },
    ]);

    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Rim', false);
    await cmd(c, s, '44,10', false); // both FAIL: Cooler=44 (>40), Freezer=10 (>0)
    const session = brothCommand.getSession(c, s);
    assert('T19: state = WAITING_CONFIRM', session?.state === 'WAITING_CONFIRM');

    // Get the confirm message
    const confirmMsg = require('../../src/commands/broth-command').buildConfirmMessage(
      'Rim', { counts: { 'Walk-in Cooler': 44, 'Walk-in Freezer': 10 } },
      ['Walk-in Cooler', 'Walk-in Freezer']
    );
    assert('T19: confirm message shows FAIL', /FAIL/i.test(confirmMsg));
    assert('T19: confirm message shows out of range', /out of range/i.test(confirmMsg));
    assert('T19: confirm message shows target', /30.40|<= 0/i.test(confirmMsg));

    // CONFIRM — should produce warning message
    const r = await cmd(c, s, 'CONFIRM', false);
    assert('T19: session cleared after confirm', !brothCommand.hasActiveSession(c, s));
    assert('T19: reply shows warning', /warning|out of range|FAIL/i.test(r.reply));
    assert('T19: reply shows store', /Rim/i.test(r.reply));

    // Restore default template
    templateCache.injectSnapshot(templateCache.DEFAULT_ITEMS);
  }

  section('T20 — PASS values show success after CONFIRM');
  {
    // Inject thresholds with a value that will PASS
    templateCache.injectSnapshot([
      { name: 'Walk-in Cooler', min: 30, max: 40, sortOrder: 1 },
    ]);

    const [c, s] = [freshId(), freshId()];
    await cmd(c, s, '/broth Stone Oak', false);
    await cmd(c, s, '1. 35', false); // PASS: 35 is within 30–40
    const r = await cmd(c, s, 'CONFIRM', false);
    assert('T20: session cleared', !brothCommand.hasActiveSession(c, s));
    assert('T20: reply shows success', /✅|PASS|Logged/i.test(r.reply));
    assert('T20: reply does NOT show warning', !/out of range|⚠️/i.test(r.reply));

    // Restore
    templateCache.injectSnapshot(templateCache.DEFAULT_ITEMS);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 All broth command tests PASSED\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests FAILED\n');
    process.exit(1);
  }
}

main().catch(err => { console.error('Broth test error:', err); process.exit(1); });
