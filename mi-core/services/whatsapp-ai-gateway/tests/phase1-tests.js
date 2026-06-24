/**
 * Phase 1 — Human-Friendly Operations Assistant
 * Unit tests for new components
 */

const assert = require('assert');

// ── i18n/translations ─────────────────────────────────────────────────────────
const { t, supported, getAllKeys } = require('../src/i18n/translations');

function testTranslations() {
  console.log('\n[ Phase 1 ] i18n/translations');

  assert.strictEqual(t('greeting', 'en', { name: 'Maria' }).includes('Maria'), true, 'en greeting has name');
  assert.strictEqual(t('ask_store_hint', 'es').includes('Rim'), true, 'es store hint');
  assert.strictEqual(t('ask_store_hint', 'vi').includes('Rim'), true, 'vi store hint');
  assert.strictEqual(t('out_of_range', 'en', { item: 'Cooler', value: 50, target: '30-40' }).includes('50'), true, 'out of range en');
  assert.strictEqual(t('out_of_range', 'vi', { item: 'Tủ lạnh', value: 50, target: '30-40' }).includes('50'), true, 'out of range vi');
  assert.strictEqual(supported('en'), true, 'en supported');
  assert.strictEqual(supported('es'), true, 'es supported');
  assert.strictEqual(supported('vi'), true, 'vi supported');
  assert.strictEqual(supported('de'), false, 'de not supported');
  assert.ok(getAllKeys().length > 30, 'translation keys exist');
  console.log('  ✅ All translation tests passed');
}

// ── i18n/detector ─────────────────────────────────────────────────────────────
const { detect, getGroupLanguage } = require('../src/i18n/detector');

function testDetector() {
  console.log('\n[ Phase 1 ] i18n/detector');

  assert.strictEqual(detect('Hello, how are you?'), 'en', 'English greeting');
  assert.strictEqual(detect('Tôi cần giúp'), 'vi', 'Vietnamese phrase');
  assert.strictEqual(detect('Gracias, muy bien'), 'es', 'Spanish thanks');
  assert.strictEqual(detect('xin chào'), 'vi', 'Vietnamese hello');
  assert.strictEqual(detect('¿Qué tal?'), 'es', 'Spanish question');
  assert.strictEqual(detect(''), 'en', 'empty defaults to en');
  assert.strictEqual(detect(null), 'en', 'null defaults to en');
  assert.strictEqual(detect('444'), 'en', 'numbers default to en');

  // Store group language override
  process.env.STORE_GROUP_LANGUAGES = 'chat123:vi,chat456:es';
  assert.strictEqual(getGroupLanguage('chat123'), 'vi', 'vi override');
  assert.strictEqual(getGroupLanguage('chat456'), 'es', 'es override');
  assert.strictEqual(getGroupLanguage('unknown'), null, 'unknown returns null');
  delete process.env.STORE_GROUP_LANGUAGES;

  console.log('  ✅ All detector tests passed');
}

// ── guided-workflow-engine ────────────────────────────────────────────────────
const { STATES, startGuidedWorkflow, handleReply, hasActiveSession, clearSession, sessionKey } = require('../src/workflows/guided/guided-workflow-engine');

async function testGuidedWorkflow() {
  console.log('\n[ Phase 1 ] guided-workflow-engine');

  // Start a session
  const chatId = 'test_chat_001', sender = 'sender_001';
  const firstMsg = startGuidedWorkflow({
    chatId, sender, senderName: 'Test User',
    store: 'Stone Oak', workflowType: 'daily_entry',
    items: ['Walk-in Cooler', 'Walk-in Freezer', 'Prep Cooler'],
    thresholds: {
      'Walk-in Cooler': { min: 33, max: 41 },
      'Walk-in Freezer': { min: -10, max: 0 },
      'Prep Cooler': { min: 33, max: 41 },
    },
  });

  assert.ok(firstMsg, 'startGuidedWorkflow returns a message');
  assert.ok(firstMsg.includes('Walk-in Cooler'), 'first item asked');
  assert.ok(hasActiveSession(chatId, sender), 'session active');

  // Language detection from Vietnamese reply
  const r1 = await handleReply({ chatId, sender, senderName: 'Test', text: '44', groupName: '' });
  assert.ok(r1?.handled, 'numeric reply handled');

  // Out of range → range confirm state, reply is non-empty
  const r2 = await handleReply({ chatId, sender, senderName: 'Test', text: '999', groupName: '' });
  assert.ok(r2?.handled, 'out of range handled');
  assert.ok(r2?.reply && r2.reply.length > 10, 'out of range reply is non-empty');

  // Confirm the value (option 1) — reply will show next item
  const r3 = await handleReply({ chatId, sender, senderName: 'Test', text: '1', groupName: '' });
  assert.ok(r3?.handled, 'range confirm with 1 handled');
  assert.ok(r3?.reply && r3.reply.length > 5, 'reply after confirm is non-empty');

  // Cancel
  const r4 = await handleReply({ chatId, sender, senderName: 'Test', text: 'CANCEL', groupName: '' });
  assert.ok(r4?.handled, 'cancel handled');
  assert.ok(!hasActiveSession(chatId, sender), 'session cleared after cancel');

  // STATUS
  clearSession(chatId, sender); // ensure clean
  startGuidedWorkflow({ chatId, sender, senderName: 'Test', store: 'Rim', workflowType: 'daily_entry', items: ['Tonkotsu'], thresholds: {} });
  const r5 = await handleReply({ chatId, sender, senderName: 'Test', text: 'STATUS', groupName: '' });
  assert.ok(r5?.reply?.includes('Draft Status'), 'STATUS shows draft');

  clearSession(chatId, sender);
  console.log('  ✅ All guided workflow tests passed');
}

// ── temperature-workflow ──────────────────────────────────────────────────────
const { startTempWorkflow, handleTempReply, hasTempSession, isTempCommand } = require('../src/workflows/guided/temperature-workflow');

async function testTemperatureWorkflow() {
  console.log('\n[ Phase 1 ] temperature-workflow');

  assert.strictEqual(isTempCommand('/temp'), true, '/temp detected');
  assert.strictEqual(isTempCommand('/temp extra'), false, '/temp with args false');

  const chatId = 'temp_chat_001', sender = 'temp_sender_001';
  const result = await startTempWorkflow({ chatId, sender, senderName: 'Chef', store: 'Bandera', storeId: 'bandera', groupName: '', timestamp: new Date().toISOString() });
  assert.ok(result?.handled, 'temp workflow starts');
  assert.ok(result?.reply?.includes('Walk-in Cooler') || result?.reply?.includes('Temperature'), 'welcome message shown');

  const r1 = await handleTempReply({ chatId, sender, senderName: 'Chef', text: '38', timestamp: new Date().toISOString() });
  assert.ok(r1?.handled, '38° handled for Walk-in Cooler (in range 33-41)');

  // STATUS
  const r2 = await handleTempReply({ chatId, sender, senderName: 'Chef', text: 'STATUS', timestamp: new Date().toISOString() });
  assert.ok(r2?.reply?.includes('Draft Status'), 'STATUS shows draft');
  assert.ok(r2?.reply?.includes('38'), 'STATUS shows 38°');

  // CANCEL
  const r3 = await handleTempReply({ chatId, sender, senderName: 'Chef', text: 'CANCEL', timestamp: new Date().toISOString() });
  assert.ok(r3?.handled, 'CANCEL handled');
  assert.ok(!hasTempSession(chatId, sender), 'temp session cleared after cancel');

  console.log('  ✅ All temperature workflow tests passed');
}

// ── missing-submission-reminder ────────────────────────────────────────────────
const { isEnabled } = require('../src/workflows/missing-submission-reminder');

function testReminder() {
  console.log('\n[ Phase 1 ] missing-submission-reminder');
  // isEnabled returns false when env var not set — that's correct
  assert.strictEqual(isEnabled(), false, 'disabled by default (no env var)');
  console.log('  ✅ Reminder service check passed');
}

// ── audit-trail ───────────────────────────────────────────────────────────────
const auditTrail = require('../src/workflows/audit-trail');

async function testAuditTrail() {
  console.log('\n[ Phase 1.1 ] audit-trail');

  // Wait for DB to settle (WAL mode + fresh schema)
  await new Promise(r => setTimeout(r, 500));
  await auditTrail.ensureTables();
  await new Promise(r => setTimeout(r, 200));

  const auditId = await auditTrail.createAuditLog({
    sessionId: 'test_session_001',
    workflowType: 'daily_entry',
    storeId: 'stone_oak',
    storeName: 'Stone Oak',
    groupChatId: 'grp_001',
    groupName: 'Bakudan Stone Oak',
    employeeId: 'emp_001',
    employeeName: 'Maria',
    employeeLanguage: 'es',
    originalInputs: { 'Walk-in Cooler': 38, 'Walk-in Freezer': -5 },
    finalPayload: { 'Walk-in Cooler': 38, 'Walk-in Freezer': -5 },
    sheetWriteStatus: 'SENT',
    managerAlertStatus: 'NOT_SENT',
  });
  assert.ok(auditId > 0, 'audit log created with ID');

  await auditTrail.recordEdit({ auditLogId: auditId, itemName: 'Walk-in Cooler', oldValue: 38, newValue: 40, editedBy: 'Maria' });

  const logWithEdits = await auditTrail.getAuditLogWithEdits(auditId);
  assert.ok(logWithEdits, 'audit log retrieved');
  assert.strictEqual(logWithEdits.employee_name, 'Maria', 'employee name stored');
  assert.strictEqual(logWithEdits.store_name, 'Stone Oak', 'store name stored');
  assert.ok(logWithEdits.edits.length >= 1, 'edit history preserved');
  assert.strictEqual(logWithEdits.edits[0].item_name, 'Walk-in Cooler', 'edit item name');
  assert.strictEqual(logWithEdits.edits[0].old_value, '38', 'edit old value');
  assert.strictEqual(logWithEdits.edits[0].new_value, '40', 'edit new value');

  const stats = await auditTrail.getAuditStats();
  assert.ok(stats.total >= 1, 'audit stats total >= 1');

  const todaySummary = await auditTrail.getTodayAuditSummary();
  assert.ok(Array.isArray(todaySummary), 'today summary is array');

  console.log('  ✅ All audit trail tests passed');
}

// ── sheet-write-queue ─────────────────────────────────────────────────────────
const sheetQueue = require('../src/workflows/sheet-write-queue');

async function testSheetQueue() {
  console.log('\n[ Phase 1.1 ] sheet-write-queue');

  await sheetQueue.ensureTables();

  const queueId = await sheetQueue.enqueue({
    workflowType: 'daily_entry',
    storeId: 'bandera',
    payload: { store: 'Bandera', rows: [{ item: 'Walk-in Cooler', value: 38 }] },
    lastError: 'test error',
  });
  assert.ok(queueId > 0, 'enqueue returns ID');

  const stats = await sheetQueue.getStats();
  assert.ok(stats.pending_count >= 1, 'pending count >= 1');

  const queue = await sheetQueue.getQueue();
  assert.ok(queue.length >= 1, 'queue has items');
  const item = queue.find(q => q.id === queueId);
  assert.ok(item, 'queued item found');
  assert.strictEqual(item.status, 'PENDING', 'status is PENDING');
  assert.strictEqual(item.store_id, 'bandera', 'store_id correct');

  await sheetQueue.markResolved(queueId);
  const resolved = await sheetQueue.getQueue();
  const found = resolved.find(q => q.id === queueId);
  assert.ok(!found || found.status === 'RESOLVED', 'item marked resolved');

  console.log('  ✅ All sheet queue tests passed');
}

// ── daily-health-report ───────────────────────────────────────────────────────
const dailyHealthReport = require('../src/reports/daily-health-report');

async function testDailyHealthReport() {
  console.log('\n[ Phase 1.1 ] daily-health-report');

  const status = dailyHealthReport.getStatus();
  assert.strictEqual(status.enabled, false, 'disabled by default');
  assert.strictEqual(status.reportTime, '20:00', 'default time is 20:00');

  console.log('  ✅ All daily health report tests passed');
}

// ── store-lock ────────────────────────────────────────────────────────────────
const storeRegistry = require('../src/stores/store-registry');

async function testStoreLock() {
  console.log('\n[ Phase 1.1 ] store-mapping-lock');

  // Set locked groups via env (legacy)
  process.env.STORE_GROUPS_LOCKED = 'grp_stone_oak,grp_bandera';
  assert.strictEqual(await storeRegistry.isGroupLocked('grp_stone_oak'), true, 'Stone Oak locked');
  assert.strictEqual(await storeRegistry.isGroupLocked('grp_bandera'), true, 'Bandera locked');
  assert.strictEqual(await storeRegistry.isGroupLocked('grp_rim'), false, 'Rim not locked');
  assert.strictEqual(await storeRegistry.isGroupLocked('unknown'), false, 'unknown not locked');

  // Unmapped group reply
  const reply = storeRegistry.unmappedGroupReply();
  assert.ok(reply.includes('not linked'), 'unmapped reply message');

  // Test store mapping CRUD
  const storeId = 'stone_oak';
  const chatId = 'test_group_' + Date.now() + '@g.us';
  await storeRegistry.upsertMapping({ chat_id: chatId, group_name: 'Test Store Group', store_id: storeId, store_name: 'Stone Oak', active: 1 });
  const mapping = await storeRegistry.resolveGroup(chatId);
  assert.ok(mapping, 'mapping created');
  assert.strictEqual(mapping.store_id, 'stone_oak', 'store_id correct');

  // Test lock/unlock
  await storeRegistry.lockMapping(chatId);
  assert.strictEqual(await storeRegistry.isGroupLocked(chatId), true, 'DB-locked group is locked');
  await storeRegistry.unlockMapping(chatId);
  assert.strictEqual(await storeRegistry.isGroupLocked(chatId), false, 'unlocked group is not locked');

  // Test manager alert group config
  await storeRegistry.setManagerAlertGroup({ chat_id: 'manager_test@g.us', group_name: 'Manager Test', enabled: true });
  const mag = await storeRegistry.getManagerAlertGroup();
  assert.strictEqual(mag.chat_id, 'manager_test@g.us', 'manager chat_id saved');
  assert.strictEqual(mag.enabled, true, 'manager alerts enabled');

  // Test Google Sheet links
  await storeRegistry.setGoogleSheetLinks({ template_sheet_url: 'https://example.invalid/template-sheet', log_sheet_url: 'https://example.invalid/log-sheet' });
  const links = await storeRegistry.getGoogleSheetLinks();
  assert.strictEqual(links.template_sheet_url, 'https://example.invalid/template-sheet', 'template URL saved');
  assert.strictEqual(links.log_sheet_url, 'https://example.invalid/log-sheet', 'log URL saved');

  delete process.env.STORE_GROUPS_LOCKED;
  console.log('  ✅ All store lock tests passed');
}

// ── Run all ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Phase 1 + 1.1 — Operations Assistant Tests ===');
  try {
    testTranslations();
    testDetector();
    testGuidedWorkflow();
    await testTemperatureWorkflow();
    testReminder();
    await testAuditTrail();
    await testSheetQueue();
    await testDailyHealthReport();
    testStoreLock();
    console.log('\n✅ All Phase 1 + 1.1 tests passed');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
