/**
 * Food Safety Tests — Phase 3
 * Run with: node tests/food-safety-tests.js
 */

require('dotenv').config();

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) { console.log(`  ✅ PASS: ${label}`); passed++; }
  else { console.log(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}

async function main() {
  console.log('\n=== Food Safety AI — Phase 3 Tests ===\n');

  // ── Load modules ─────────────────────────────────────────────────────────────
  let thresholdEngine, warningGenerator, sheetSource;
  try {
    thresholdEngine = require('../src/food-safety/threshold-engine');
    warningGenerator = require('../src/food-safety/warning-generator');
    sheetSource = require('../src/food-safety/sheet-source');
  } catch (err) {
    console.error('Failed to load food safety modules:', err.message);
    process.exit(1);
  }

  // ── Load fixtures ────────────────────────────────────────────────────────────
  const samplePass = require('./fixtures/food-safety/sample-pass.json');
  const sampleFail = require('./fixtures/food-safety/sample-fail.json');
  const sampleUnclear = require('./fixtures/food-safety/sample-unclear.json');

  // Init sheet source
  await sheetSource.init();
  const rules = sheetSource.getRules();

  // ── Suite 1: Threshold Engine — evaluate() ──────────────────────────────────
  console.log('[ Suite 1 ] Threshold Engine — evaluate()');
  assert('44 <= 40 → false', thresholdEngine.evaluate(44, '<=', 40) === false);
  assert('40 <= 40 → true', thresholdEngine.evaluate(40, '<=', 40) === true);
  assert('38 <= 40 → true', thresholdEngine.evaluate(38, '<=', 40) === true);
  assert('10 >= 0 → true', thresholdEngine.evaluate(10, '>=', 0) === true);
  assert('10 <= 0 → false', thresholdEngine.evaluate(10, '<=', 0) === false);
  assert('353 >= 325 → true', thresholdEngine.evaluate(353, '>=', 325) === true);
  assert('325 >= 325 → true', thresholdEngine.evaluate(325, '>=', 325) === true);
  assert('190 >= 200 → false', thresholdEngine.evaluate(190, '>=', 200) === false);
  assert('205 >= 200 → true', thresholdEngine.evaluate(205, '>=', 200) === true);
  assert('45 <= 40 → false', thresholdEngine.evaluate(45, '<=', 40) === false);

  // ── Suite 2: Threshold Engine — checkAll() ─────────────────────────────────
  console.log('\n[ Suite 2 ] Threshold Engine — checkAll()');

  // Walk-in Cooler 44°F → FAIL
  const walkIn44 = thresholdEngine.checkAll([{ item: 'Walk-in Cooler', value: 44, unit: 'F' }]);
  assert('Walk-in Cooler 44°F → FAIL', walkIn44.failures.length === 1);
  assert('Failure reason is threshold_exceeded', walkIn44.failures[0].reason === 'threshold_exceeded');
  assert('Failure item is Walk-in Cooler', walkIn44.failures[0].item === 'Walk-in Cooler');

  // Walk-in Cooler 40°F → PASS (boundary)
  const walkIn40 = thresholdEngine.checkAll([{ item: 'Walk-in Cooler', value: 40, unit: 'F' }]);
  assert('Walk-in Cooler 40°F → PASS (boundary)', walkIn40.passed.length === 1 && walkIn40.failures.length === 0);

  // Walk-in Cooler 38°F → PASS
  const walkIn38 = thresholdEngine.checkAll([{ item: 'Walk-in Cooler', value: 38, unit: 'F' }]);
  assert('Walk-in Cooler 38°F → PASS', walkIn38.passed.length === 1 && walkIn38.failures.length === 0);

  // Walk-in Freezer 10°F → FAIL (10 > 0, must be <= 0)
  const freezer10 = thresholdEngine.checkAll([{ item: 'Walk-in Freezer', value: 10, unit: 'F' }]);
  assert('Walk-in Freezer 10°F → FAIL', freezer10.failures.length === 1);

  // Walk-in Freezer -5°F → PASS
  const freezerNeg = thresholdEngine.checkAll([{ item: 'Walk-in Freezer', value: -5, unit: 'F' }]);
  assert('Walk-in Freezer -5°F → PASS', freezerNeg.passed.length === 1 && freezerNeg.failures.length === 0);

  // Fryer 353°F → PASS
  const fryer353 = thresholdEngine.checkAll([{ item: 'Fryer 1', value: 353, unit: 'F' }]);
  assert('Fryer 353°F → PASS', fryer353.passed.length === 1 && fryer353.failures.length === 0);

  // Fryer 300°F → FAIL
  const fryer300 = thresholdEngine.checkAll([{ item: 'Fryer 1', value: 300, unit: 'F' }]);
  assert('Fryer 300°F → FAIL', fryer300.failures.length === 1);

  // Pork Broth 190°F → FAIL
  const porkBroth = thresholdEngine.checkAll([{ item: 'Pork Broth', value: 190, unit: 'F' }]);
  assert('Pork Broth 190°F → FAIL', porkBroth.failures.length === 1);

  // Pork Broth 205°F → PASS
  const porkBroth205 = thresholdEngine.checkAll([{ item: 'Pork Broth', value: 205, unit: 'F' }]);
  assert('Pork Broth 205°F → PASS', porkBroth205.passed.length === 1 && porkBroth205.failures.length === 0);

  // Chicken Chashu 45°F → FAIL (must be <= 40°F)
  const chicken45 = thresholdEngine.checkAll([{ item: 'Chicken Chashu', value: 45, unit: 'F' }]);
  assert('Chicken Chashu 45°F → FAIL', chicken45.failures.length === 1);

  // Chicken Chashu 35°F → PASS
  const chicken35 = thresholdEngine.checkAll([{ item: 'Chicken Chashu', value: 35, unit: 'F' }]);
  assert('Chicken Chashu 35°F → PASS', chicken35.passed.length === 1 && chicken35.failures.length === 0);

  // Bowl Warmers 99°F → FAIL
  const bowlWarmers = thresholdEngine.checkAll([{ item: 'Bowl Warmers', value: 99, unit: 'F' }]);
  assert('Bowl Warmers 99°F → FAIL', bowlWarmers.failures.length === 1);

  // Bowl Warmers 140°F → PASS
  const bowlWarmers140 = thresholdEngine.checkAll([{ item: 'Bowl Warmers', value: 140, unit: 'F' }]);
  assert('Bowl Warmers 140°F → PASS', bowlWarmers140.passed.length === 1 && bowlWarmers140.failures.length === 0);

  // Unknown item → NEEDS_REVIEW with unknown_item reason
  const unknownItem = thresholdEngine.checkAll([{ item: 'Mystery Freezer', value: -5, unit: 'F' }]);
  assert('Unknown item → NEEDS_REVIEW', unknownItem.needsReview.length === 1 && unknownItem.failures.length === 0);
  assert('Unknown item reason is unknown_item', unknownItem.needsReview[0].reason === 'unknown_item');

  const aliasChecks = [
    ['FREEZER - PHOTO', -4, 'Walk-in Freezer', 'PASS'],
    ['FREEZER - LINE', 10, 'Line Freezer', 'FAIL'],
    ['RAMEN - TOP', 41, 'Ramen Refrigeration Top', 'FAIL'],
    ['RAMEN - BELOW', 38, 'Ramen Refrigeration Below', 'PASS'],
    ['TAPAS - TOP', 50, 'Tapas Refrigeration Top', 'FAIL'],
    ['TAPAS - BELOW', 39, 'Tapas Refrigeration Below', 'PASS'],
    ['FRYER - LEFT', 353, 'Fryer 1', 'PASS'],
    ['FRYER - RIGHT', 331, 'Fryer 2', 'PASS'],
    ['BOILER - LEFT', 210, 'Pasta Boiler 1', 'PASS'],
    ['BOILER - RIGHT', 211, 'Pasta Boiler 2', 'PASS'],
    ['PORK SOUP BROTH', 200, 'Pork Broth', 'PASS'],
    ['CHICKEN SOUP BROTH', 200, 'Chicken Broth', 'PASS'],
  ];
  for (const [rawItem, value, canonical, expected] of aliasChecks) {
    const checked = thresholdEngine.checkAll([{ item: rawItem, value, unit: 'F' }]);
    const matched = expected === 'PASS' ? checked.passed[0] : checked.failures[0];
    assert(`${rawItem} maps to ${canonical}`, matched?.item === canonical);
  }

  // Empty readings → PASS
  const emptyReadings = thresholdEngine.checkAll([]);
  assert('Empty readings → PASS', emptyReadings.passed.length === 0 && emptyReadings.failures.length === 0);

  // ── Suite 3: Warning Generator ──────────────────────────────────────────────
  console.log('\n[ Suite 3 ] Warning Generator');

  // FAIL warning has ⚠️ prefix
  const failResult = warningGenerator.generateResult(
    thresholdEngine.checkAll([{ item: 'Walk-in Cooler', value: 44, unit: 'F' }]),
    { store: 'Bandera Road', needs_review: [], unclear_fields: [] }
  );
  assert('FAIL result type', failResult.result === 'FAIL');
  assert('FAIL has warning text', !!failResult.warning);
  assert('FAIL warning contains FOOD SAFETY WARNING', failResult.warning.includes('FOOD SAFETY WARNING'));
  assert('FAIL warning contains store name', failResult.warning.includes('Bandera Road'));
  assert('FAIL warning contains reading value', failResult.warning.includes('44°'));
  assert('FAIL warning contains corrective action', failResult.warning.includes('Action:'));

  // NEEDS_REVIEW warning
  const needsReviewResult = warningGenerator.generateResult(
    { failures: [], passed: [] },
    { store: 'Medical Center', needs_review: ['Walk-in Cooler'], unclear_fields: ['Fryer 1'] }
  );
  assert('NEEDS_REVIEW result type', needsReviewResult.result === 'NEEDS_REVIEW');
  assert('NEEDS_REVIEW has warning text', !!needsReviewResult.warning);
  assert('NEEDS_REVIEW warning contains NEEDS REVIEW', needsReviewResult.warning.includes('NEEDS REVIEW'));
  assert('NEEDS_REVIEW lists unclear items', needsReviewResult.warning.includes('Walk-in Cooler'));

  const unknownReviewResult = warningGenerator.generateResult(
    unknownItem,
    { store: 'Bandera Road', needs_review: [], unclear_fields: [] }
  );
  assert('Unknown item generates NEEDS_REVIEW result', unknownReviewResult.result === 'NEEDS_REVIEW');
  assert('Unknown item sends warning', !!unknownReviewResult.warning);

  const genericReviewResult = warningGenerator.generateResult(
    { failures: [], passed: [], needsReview: [] },
    { store: 'Unknown', needs_review: ['*'], unclear_fields: [] }
  );
  assert('Generic analyzer fallback triggers NEEDS_REVIEW', genericReviewResult.result === 'NEEDS_REVIEW');

  // PASS warning is null
  const passResult = warningGenerator.generateResult(
    { failures: [], passed: [{ item: 'Walk-in Cooler', value: 38, unit: 'F' }] },
    { store: 'Stone Oak', needs_review: [], unclear_fields: [] }
  );
  assert('PASS result type', passResult.result === 'PASS');
  assert('PASS warning is null', passResult.warning === null);

  // Multiple failures — extra failures listed
  const multiFail = thresholdEngine.checkAll([
    { item: 'Walk-in Cooler', value: 44, unit: 'F' },
    { item: 'Walk-in Freezer', value: 10, unit: 'F' },
  ]);
  const multiFailResult = warningGenerator.generateResult(multiFail, { store: 'Bandera Road', needs_review: [], unclear_fields: [] });
  assert('Multiple failures include other failures list', multiFailResult.warning.includes('Other failures:'));

  // ── Suite 4: Full pipeline simulation with fixtures ──────────────────────────
  console.log('\n[ Suite 4 ] Full Pipeline Simulation (Fixtures)');

  // sample-pass.json → PASS
  const passCheck = thresholdEngine.checkAll(samplePass.readings);
  const passGen = warningGenerator.generateResult(passCheck, samplePass);
  assert('sample-pass.json → PASS', passGen.result === 'PASS');
  assert('sample-pass.json → no warning', passGen.warning === null);

  // sample-fail.json → FAIL (multiple violations)
  const failCheck = thresholdEngine.checkAll(sampleFail.readings);
  const failGen = warningGenerator.generateResult(failCheck, sampleFail);
  assert('sample-fail.json → FAIL', failGen.result === 'FAIL');
  assert('sample-fail.json → has warning', !!failGen.warning);
  assert('sample-fail.json → warning mentions Walk-in Cooler 44', failGen.warning.includes('44°'));

  // sample-unclear.json → NEEDS_REVIEW
  const unclearCheck = thresholdEngine.checkAll(sampleUnclear.readings);
  const unclearGen = warningGenerator.generateResult(unclearCheck, sampleUnclear);
  assert('sample-unclear.json → NEEDS_REVIEW', unclearGen.result === 'NEEDS_REVIEW');
  assert('sample-unclear.json → has warning', !!unclearGen.warning);

  // ── Suite 5: Sheet Source ───────────────────────────────────────────────────
  console.log('\n[ Suite 5 ] Sheet Source');

  assert('getRules returns array', Array.isArray(rules));
  assert('getRules has at least 19 items', rules.length >= 19);
  assert('lastSynced is set', !!sheetSource.getLastSynced());

  // Verify known thresholds are present
  const wiCooler = rules.find(r => r.item === 'Walk-in Cooler');
  assert('Walk-in Cooler rule present', !!wiCooler);
  assert('Walk-in Cooler operator is <=', wiCooler.operator === '<=');
  assert('Walk-in Cooler target is 40', wiCooler.target === 40);

  const fryer = rules.find(r => r.item === 'Fryer 1');
  assert('Fryer 1 rule present', !!fryer);
  assert('Fryer 1 operator is >=', fryer.operator === '>=');
  assert('Fryer 1 target is 325', fryer.target === 325);

  const chickenRule = rules.find(r => r.item === 'Chicken Chashu');
  assert('Chicken Chashu rule present', !!chickenRule);
  assert('Chicken Chashu operator is <=', chickenRule.operator === '<=');
  assert('Chicken Chashu target is 40', chickenRule.target === 40);

  assert('Sharing URL converts to Thresholds_SOP CSV', sheetSource.toCsvExportUrl('https://docs.google.com/spreadsheets/d/12J9CRkTpDJ4boKClVaz0qiev9KV7dEyr-TK4KA1ugJs/edit?usp=sharing').includes('sheet=Thresholds_SOP'));

  // isAllowedChat
  const origAllowed = process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS;
  process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = '123,456';
  assert('isAllowedChat returns true for allowed', sheetSource.isAllowedChat('123') === true);
  assert('isAllowedChat returns true for other allowed', sheetSource.isAllowedChat('456') === true);
  assert('isAllowedChat returns false for disallowed', sheetSource.isAllowedChat('789') === false);
  process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = origAllowed || '';

  // Empty ALLOWED_CHAT_IDS in test mode → block all until a test chat is explicitly allowed
  const prev = process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS;
  const prevTestMode = process.env.FOOD_SAFETY_TEST_MODE;
  process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = '';
  process.env.FOOD_SAFETY_TEST_MODE = 'true';
  assert('Test mode with empty ALLOWED_CHAT_IDS → blocked', sheetSource.isAllowedChat('999') === false);
  process.env.FOOD_SAFETY_TEST_MODE = 'false';
  assert('Non-test mode with empty ALLOWED_CHAT_IDS → allowed', sheetSource.isAllowedChat('999') === true);
  process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS = prev;
  process.env.FOOD_SAFETY_TEST_MODE = prevTestMode;

  const prevSheetUrl = process.env.FOOD_SAFETY_SHEET_URL;
  process.env.FOOD_SAFETY_SHEET_URL = 'https://invalid.localhost/sheet.csv';
  const fallbackRules = await sheetSource.syncRules();
  assert('Google Sheet unavailable uses cached rules', Array.isArray(fallbackRules) && fallbackRules.length >= 19);
  process.env.FOOD_SAFETY_SHEET_URL = prevSheetUrl;

  // ── Suite 6: Image Analyzer fallback ───────────────────────────────────────
  console.log('\n[ Suite 6 ] Image Analyzer Fallback');
  let imageAnalyzer;
  try {
    imageAnalyzer = require('../src/food-safety/image-analyzer');
  } catch (_) {
    assert('Image analyzer loads', false, 'Could not load');
    process.exit(1);
  }

  const fallbackResult = await imageAnalyzer.analyzeImage('/nonexistent/path.jpg');
  assert('Fallback returns needs_review ["*"]', fallbackResult.needs_review.includes('*'));
  assert('Fallback has Unknown store', fallbackResult.store === 'Unknown');
  assert('Fallback has empty readings', fallbackResult.readings.length === 0);
  assert('Vision fallback explains missing configuration', fallbackResult.unclear_fields.join(' ').includes('Vision API not configured'));

  // analyzeMock
  const mockResult = await imageAnalyzer.analyzeMock('/fake.jpg', { store: 'Test Store', readings: [{ item: 'Walk-in Cooler', value: 44, unit: 'F', confidence: 0.95 }], needs_review: [], unclear_fields: [] });
  assert('analyzeMock returns provided result', mockResult.store === 'Test Store');
  assert('analyzeMock has readings', mockResult.readings.length === 1);

  // ── Suite 7: Google Sheet Daily Log Writer ────────────────────────────────
  console.log('\n[ Suite 7 ] Google Sheet Daily Log Writer');
  const dailyLogWriter = require('../src/google/daily-log-writer');
  const sheetMapper = require('../src/google/sheet-mapper');
  const fsStorage = require('../src/storage/food-safety-storage');
  const sqlite = require('../src/storage/sqlite');
  const sheetsClient = require('../src/google/sheets-client');
  const logSheetSync = require('../src/google/log-sheet-sync');

  await fsStorage.ensureTables();
  await sqlite.run(`DELETE FROM food_safety_sheet_queue`);

  const metadata = {
    chatId: '1203xxxx@g.us',
    sender: 'maria',
    senderName: 'Maria',
    timestamp: '2026-06-03T11:25:00.000Z',
    messageId: 'xxxxx',
  };
  const failPayload = {
    checkId: 'FS_TEST_FAIL',
    metadata,
    imagePath: 'data/uploads/food-safety/2026-06-03/img.jpg',
    analyzed: { store: 'Stone Oak', date: '2026-06-03', time: 'AM', needs_review: [], unclear_fields: [] },
    readings: [{
      item: 'Walk-in Cooler',
      value: 44,
      unit: 'F',
      operator: '<=',
      target: 40,
      correctiveAction: 'Close door, re-temp in 10 min, alert MOD if still high',
      confidence: 0.91,
      status: 'FAIL',
    }],
    result: 'FAIL',
    warning: 'warning',
  };
  const builtFail = dailyLogWriter.buildRows(failPayload);
  assert('FAIL reading writes one row payload', builtFail.rows.length === 1);
  assert('FAIL row contains Stone Oak store', builtFail.rows[0][1] === 'Stone Oak');
  assert('FAIL row contains target <= 40°F', builtFail.rows[0][10] === '<= 40°F');
  assert('FAIL row marks warning sent YES', builtFail.rows[0][14] === 'YES');
  assert('FAIL row uses required 17-column schema', builtFail.rows[0].length === 17 && dailyLogWriter.COLUMNS.length === 17);
  assert('Daily log columns match CEO schema', dailyLogWriter.COLUMNS.join('|') === [
    'Timestamp',
    'Store',
    'Chat ID',
    'Sender',
    'Message ID',
    'Source Type',
    'Image Path',
    'Item',
    'Reading',
    'Unit',
    'Target',
    'Status',
    'Confidence',
    'Corrective Action',
    'Warning Sent',
    'Sheet Write Status',
    'Notes',
  ].join('|'));

  const passPayload = { ...failPayload, checkId: 'FS_TEST_PASS', result: 'PASS', warning: null, readings: [{ ...failPayload.readings[0], value: 38, status: 'PASS' }] };
  const builtPass = dailyLogWriter.buildRows(passPayload);
  assert('PASS reading writes row payload', builtPass.rows[0][11] === 'PASS' && builtPass.rows[0][14] === 'NO');

  const reviewPayload = { ...failPayload, checkId: 'FS_TEST_REVIEW', result: 'NEEDS_REVIEW', warning: 'review', analyzed: { store: 'Unknown', date: '2026-06-03', time: 'AM', needs_review: ['Walk-in Cooler'], unclear_fields: [] }, readings: [{ item: 'Walk-in Cooler', status: 'NEEDS_REVIEW', unit: 'F' }] };
  const builtReview = dailyLogWriter.buildRows(reviewPayload);
  assert('NEEDS_REVIEW writes row + warning flag', builtReview.rows[0][11] === 'NEEDS_REVIEW' && builtReview.rows[0][14] === 'YES');
  assert('Unknown store goes to Needs_Review', builtReview.tab === 'Needs_Review');
  assert('PASS/FAIL known stores write to WhatsApp_AI_Daily_Log', builtFail.tab === 'WhatsApp_AI_Daily_Log');

  assert('Store mapping: Rim', sheetMapper.mapStoreName('Rim').tab === 'Rim');
  assert('Store mapping: Stone Oak', sheetMapper.mapStoreName('Stone Oak').tab === 'Stone Oak');
  assert('Store mapping: Bandera Road', sheetMapper.mapStoreName('Bandera Road').tab === 'Bandera');
  assert('Required Google tabs include Sheet_Write_Queue', !!logSheetSync.REQUIRED_SHEETS.Sheet_Write_Queue);

  const prevLogId = process.env.FOOD_SAFETY_LOG_SPREADSHEET_ID;
  const prevDailyId = process.env.FOOD_SAFETY_DAILY_LOG_SPREADSHEET_ID;
  process.env.FOOD_SAFETY_LOG_SPREADSHEET_ID = 'new-log-id';
  process.env.FOOD_SAFETY_DAILY_LOG_SPREADSHEET_ID = 'old-log-id';
  assert('Sheets client prefers FOOD_SAFETY_LOG_SPREADSHEET_ID', sheetsClient.getSpreadsheetId() === 'new-log-id');
  if (prevLogId === undefined) delete process.env.FOOD_SAFETY_LOG_SPREADSHEET_ID;
  else process.env.FOOD_SAFETY_LOG_SPREADSHEET_ID = prevLogId;
  if (prevDailyId === undefined) delete process.env.FOOD_SAFETY_DAILY_LOG_SPREADSHEET_ID;
  else process.env.FOOD_SAFETY_DAILY_LOG_SPREADSHEET_ID = prevDailyId;

  const prevSheetsEnabled = process.env.GOOGLE_SHEETS_ENABLED;
  process.env.GOOGLE_SHEETS_ENABLED = 'true';
  // Mock BEFORE calling appendDailyLog so we simulate sheet being unavailable
  const originalAppend = sheetsClient.appendValues;
  sheetsClient.appendValues = async () => { throw new Error('sheet unavailable (test mock)'); };
  await dailyLogWriter.appendDailyLog(failPayload);
  let pending = await fsStorage.getPendingSheetWrites(10);
  assert('Google Sheet unavailable queues payload', pending.some(r => r.check_id === 'FS_TEST_FAIL'));

  // Now restore a working mock to test retry
  sheetsClient.appendValues = async () => ({ ok: true });
  const retryResult = await dailyLogWriter.retryPending(10);
  pending = await fsStorage.getPendingSheetWrites(10);
  assert('Queue retry sends pending rows', retryResult.some(r => r.status === 'SENT') && !pending.some(r => r.check_id === 'FS_TEST_FAIL'));
  sheetsClient.appendValues = originalAppend;
  if (prevSheetsEnabled === undefined) delete process.env.GOOGLE_SHEETS_ENABLED;
  else process.env.GOOGLE_SHEETS_ENABLED = prevSheetsEnabled;

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('🎉 All food safety tests PASSED\n');
    process.exit(0);
  } else {
    console.log(`⚠️  ${failed} test(s) FAILED\n`);
    process.exit(1);
  }
}

main().catch(err => { console.error('Test runner error:', err); process.exit(1); });
