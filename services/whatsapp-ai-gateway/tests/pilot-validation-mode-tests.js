const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'gateway-test-pilot-validation.db');
try { fs.unlinkSync(dbPath); } catch (_) {}
try { fs.unlinkSync(dbPath + '-wal'); } catch (_) {}
try { fs.unlinkSync(dbPath + '-shm'); } catch (_) {}

process.env.GATEWAY_DB_PATH = dbPath;
process.env.FOOD_SAFETY_ENABLED = 'true';
process.env.MI_ADMIN_PRIVATE_CHATS = 'admin-private';

const safety = require('../src/food-safety/safety-intelligence');
const formPhotoWorkflow = require('../src/workflows/form-photo-workflow');
const formPhotoStorage = require('../src/workflows/form-photo-storage');
const pilotValidation = require('../src/pilot/food-safety-pilot-validation');
const commandCenter = require('../src/dashboard/food-safety-command-center');
const managerAlertExpander = require('../src/food-safety/manager-alert-expander');
const groupWorkflowConfig = require('../src/workflows/group-workflow-config');
const agentMiRouter = require('../src/commands/agent-mi-router');

let passed = 0;
let failed = 0;

function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.log(`  FAIL: ${label}${detail ? ' - ' + detail : ''}`);
  }
}

async function main() {
  console.log('\n=== Food Safety Pilot Validation Mode Tests ===\n');

  await formPhotoStorage.ensureTables();
  await pilotValidation.ensureTables();
  await managerAlertExpander.ensureTables();

  const unsafe = safety.validateSubmission({
    store: 'Stone Oak',
    employee: 'Sol',
    imagePath: 'walk-in-cooler.jpg',
    items: [
      { label: 'Walk-In Cooler', value: 52, confidence: 0.94 },
      { label: 'Walk-In Freezer', value: -2, confidence: 0.93 },
      { label: 'Fryer 1', value: 310, confidence: 0.9 },
    ],
  });
  check('Unsafe cooler is detected', unsafe.status === 'UNSAFE');
  check('Fryer below 325F is warning', unsafe.issues.some(i => i.type === 'temperature_warning' && i.item === 'Fryer 1'));

  const safetyReply = safety.buildSafetyReply(unsafe, 'Stone Oak');
  check('Warning reply asks verification before confirming', /Please verify before confirming/.test(safetyReply));
  check('Warning reply allows CONFIRM save anyway', /CONFIRM = save anyway/.test(safetyReply));
  check('Warning reply includes MANAGER and RETAKE', /MANAGER = send for manager review/.test(safetyReply) && /RETAKE = upload clearer photo/.test(safetyReply));

  const preConfirm = formPhotoWorkflow.buildPreConfirmReply({
    store: 'Stone Oak',
    senderName: 'Sol',
    ocrResult: { form_date: '2026-06-10', employee_name: 'Sol' },
    items: [{ label: 'Walk-In Cooler', value: 52, status: 'FAIL' }],
    warnings: [],
    intelligence: unsafe,
  });
  check('Form workflow uses safety reply before confirm', /Please verify before confirming/.test(preConfirm));

  const saveResult = await formPhotoStorage.confirmSubmission({
    chatId: 'stone-oak@g.us',
    sender: 'sol',
    senderName: 'Sol',
    storeId: 'stone_oak',
    store: 'Stone Oak',
    imagePath: 'stone-oak-form.jpg',
    ocrResult: { form_date: new Date().toISOString().slice(0, 10), shift: 'AM' },
    ocrConfidence: 0.96,
    items: [{ label: 'Walk-In Cooler', value: 52, status: 'FAIL', confidence: 0.96 }],
    warnings: ['Walk-In Cooler unsafe'],
    safetyStatus: 'UNSAFE',
    safetyIssues: unsafe.issues,
  });
  check('Confirmed unsafe submission saved locally', !!saveResult.submissionId);
  const saved = await formPhotoStorage.getSubmission(saveResult.submissionId);
  check('Saved submission remains visible to dashboard query', saved && saved.status === 'CONFIRMED');

  const alertResult = await managerAlertExpander.onUnsafeConfirmed({
    client: null,
    managerChatId: '',
    store: 'Stone Oak',
    employee: 'Sol',
    employeeId: 'sol',
    submissionId: saveResult.submissionId,
    item: 'Walk-In Cooler',
    captured: '52°F',
    expected: '≤ 40°F',
    imagePath: 'stone-oak-form.jpg',
  });
  check('Manager alert records without requiring live WhatsApp client', alertResult.status === 'PENDING');
  const alertStats = await managerAlertExpander.getAlertStats();
  check('Manager alert proof row exists', Number(alertStats.total || 0) >= 1);

  const center = await commandCenter.getCommandCenterData();
  check('Command Center counts received submissions', center.receivedSubmissions >= 1);
  check('Command Center counts unsafe temperatures', center.unsafeTemperatures >= 1);
  check('Command Center exposes required filters', center.filters.includes('Store') && center.filters.includes('OCR confidence'));
  check('Command Center exposes required actions', center.actions.includes('Export CSV') && center.actions.includes('Request retake'));

  await pilotValidation.recordPilotForm({
    store: 'Stone Oak',
    employee: 'Sol',
    formDate: '2026-06-10',
    shift: 'AM',
    imageQuality: 'GOOD',
    ocrItems: ['Walk-In Cooler', 'Walk-In Freezer'],
    ocrTemperatures: [38, -2],
    ocrConfidence: 0.96,
    correctedFields: 0,
    dbSaveResult: 'PASS',
    sheetSyncResult: 'PASS',
    dashboardVisibility: 'PASS',
    expectedFields: 2,
    capturedFields: 2,
    correctFields: 2,
    submissionId: saveResult.submissionId,
  });
  const metrics = await pilotValidation.getPilotMetrics();
  check('Pilot metrics count tested forms', metrics.total_forms_tested === 1);
  check('Pilot field accuracy calculates correctly', metrics.field_accuracy_rate === 1);
  const readiness = await pilotValidation.getProductionReadiness();
  check('Production readiness fails until 30 real forms are tested', readiness.verdict === 'FAIL');

  check('Group no-prefix text stays silent by command detection', !agentMiRouter.isMiCommand('hello team') && !agentMiRouter.isAgentCommand('hello team'));
  check('/mi group command detected', agentMiRouter.isMiCommand('/mi summarize today'));
  check('/agent group command detected', agentMiRouter.isAgentCommand('/agent run QA'));
  check('Private admin no-prefix eligibility works', await groupWorkflowConfig.isMiAdminPrivateChat('private-chat', 'admin-private'));

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
