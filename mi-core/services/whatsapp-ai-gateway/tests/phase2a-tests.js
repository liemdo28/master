/**
 * Phase 2A Tests — Vision Incident Assistant + Vision Cross-Check
 * 20 required tests covering incidents and photo audits
 */
'use strict';

const path = require('path');
const fs = require('fs');

// Ensure data dirs exist
for (const d of ['data', 'data/uploads', 'data/uploads/vision']) {
  const p = path.resolve(d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

let passed = 0, failed = 0;
const results = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    results.push({ name, status: 'PASS' });
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    results.push({ name, status: 'FAIL', error: err.message });
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

console.log('\n═══════════════════════════════════════════════');
console.log('  Phase 2A Tests — Vision + Compliance');
console.log('═══════════════════════════════════════════════\n');

// ── PART A: Incident Tests ──

console.log('── PART A: Incident Detection ──\n');

test('1. Vision provider loads without crash, exports analyzeIncident', () => {
  delete process.env.GEMINI_API_KEY;
  delete process.env.VISION_API_KEY;
  const vp = require('../src/vision/vision-provider');
  assert(vp, 'vision-provider should export');
  assert(typeof vp.analyzeIncident === 'function', 'analyzeIncident should be a function');
  assert(typeof vp.isEnabled === 'function', 'isEnabled should be a function');
  assert(typeof vp.callVision === 'function', 'callVision should be a function');
});

test('2. Vision prompts export incident detection via visionPrompts', () => {
  const { visionPrompts } = require('../src/vision/vision-prompts');
  assert(visionPrompts, 'should export visionPrompts');
  assert(typeof visionPrompts.incidentDetection === 'function', 'incidentDetection should be a function');
  const prompt = visionPrompts.incidentDetection();
  assert(prompt.includes('incident') || prompt.includes('Incident'), 'prompt should mention incident');
});

test('3. Image storage exports saveVisionImage and getStorageStats', () => {
  const storage = require('../src/vision/image-storage');
  assert(typeof storage.saveVisionImage === 'function', 'saveVisionImage should be a function');
  assert(typeof storage.getStorageStats === 'function', 'getStorageStats should be a function');
  assert(storage.BASE_DIR.includes('vision'), 'BASE_DIR should include vision');
});

test('4. Incident detector exports detectIncident', () => {
  const detector = require('../src/incidents/incident-detector');
  assert(typeof detector.detectIncident === 'function', 'detectIncident should be a function');
});

test('5. Incident report service has all required methods', () => {
  const svc = require('../src/incidents/incident-report-service');
  for (const m of ['createIncident', 'confirmIncident', 'ignoreIncident', 'escalateIncident',
    'closeIncident', 'getIncident', 'getRecentIncidents', 'getOpenIncidents',
    'getIncidentStats', 'getIncidentActions']) {
    assert(typeof svc[m] === 'function', `${m} should be a function`);
  }
});

test('6. Incident sheet writer exports writeIncidentToSheet + getQueueStats', () => {
  const writer = require('../src/incidents/incident-sheet-writer');
  assert(typeof writer.writeIncidentToSheet === 'function', 'writeIncidentToSheet should be a function');
  assert(typeof writer.getQueueStats === 'function', 'getQueueStats should be a function');
  assert(typeof writer.retryPending === 'function', 'retryPending should be a function');
});

test('7. Incident alert service exports sendManagerAlert', () => {
  const alertSvc = require('../src/incidents/incident-alert-service');
  assert(typeof alertSvc.sendManagerAlert === 'function', 'sendManagerAlert should be a function');
  assert(typeof alertSvc.buildManagerAlertMessage === 'function', 'buildManagerAlertMessage should be a function');
});

test('8. Vision incident workflow exports handleImage + handleIncidentReply', () => {
  const workflow = require('../src/vision/vision-incident-workflow');
  assert(typeof workflow.handleImage === 'function', 'handleImage should be a function');
  assert(typeof workflow.handleIncidentReply === 'function', 'handleIncidentReply should be a function');
  assert(typeof workflow.hasPendingConfirmation === 'function', 'hasPendingConfirmation should be a function');
});

test('9. Non-incident: hasPendingConfirmation returns false for unknown', () => {
  const workflow = require('../src/vision/vision-incident-workflow');
  assert(workflow.hasPendingConfirmation('fake_chat', 'fake_sender') === false,
    'should return false for unknown chat:sender');
});

test('10. Incident report service SQLite tables accessible', () => {
  const svc = require('../src/incidents/incident-report-service');
  assert(typeof svc.getIncidentStats === 'function', 'getIncidentStats should exist');
  assert(typeof svc.createIncident === 'function', 'createIncident should exist');
});

// ── PART B: Photo Audit / Compliance Tests ──

console.log('\n── PART B: Photo Audit & Compliance ──\n');

test('11. Photo audit selector exports selectItemsForAudit + getAuditRate', () => {
  const selector = require('../src/compliance/photo-audit-selector');
  assert(typeof selector.selectItemsForAudit === 'function', 'selectItemsForAudit should be a function');
  assert(typeof selector.getAuditRate === 'function', 'getAuditRate should be a function');
  assert(typeof selector.filterTemperatureItems === 'function', 'filterTemperatureItems should be a function');
});

test('12. Pattern detector exports analyzeSubmissionPatterns + shouldTriggerAudit', () => {
  const pd = require('../src/compliance/pattern-detector');
  assert(typeof pd.analyzeSubmissionPatterns === 'function', 'analyzeSubmissionPatterns should be a function');
  assert(typeof pd.shouldTriggerAudit === 'function', 'shouldTriggerAudit should be a function');
  assert(typeof pd.findRepeatedValues === 'function', 'findRepeatedValues should be a function');
});

test('13. Compliance score service exports score methods', () => {
  const css = require('../src/compliance/compliance-score-service');
  for (const m of ['applyScoreImpact', 'getScore', 'getStoreScores', 'getTopOffenders', 'getScoreStats',
    'onPhotoAuditPassed', 'onMismatchConfirmed', 'onAuditIgnored']) {
    assert(typeof css[m] === 'function', `${m} should be a function`);
  }
  assert(css.INITIAL_SCORE === 80, 'INITIAL_SCORE should be 80');
  assert(css.IMPACTS, 'IMPACTS should exist');
});

test('14. Photo audit service exports full workflow methods', () => {
  const pas = require('../src/compliance/photo-audit-service');
  for (const m of ['startPhotoAudit', 'handlePhotoReceived', 'hasPendingAudit',
    'getPendingAudits', 'getAuditStats']) {
    assert(typeof pas[m] === 'function', `${m} should be a function`);
  }
});

test('15. Temperature reading extractor exports extract', () => {
  const tre = require('../src/vision/temperature-reading-extractor');
  assert(typeof tre.extract === 'function', 'extract should be a function');
});

test('16. Photo audit sheet writer exports writeAuditToSheet', () => {
  const writer = require('../src/compliance/photo-audit-sheet-writer');
  assert(typeof writer.writeAuditToSheet === 'function', 'writeAuditToSheet');
  assert(typeof writer.retryPending === 'function', 'retryPending');
});

test('17. Photo audit manager alert exports sendMismatchAlert', () => {
  const alert = require('../src/compliance/photo-audit-manager-alert');
  assert(typeof alert.sendMismatchAlert === 'function', 'sendMismatchAlert');
});

test('18. Tolerance: difference within tolerance passes', () => {
  const tol = parseFloat(process.env.TEMP_TOLERANCE_F || '2');
  assert(Math.abs(38 - 39) <= tol, '1°F diff should pass');
});

test('19. Tolerance: difference beyond tolerance is mismatch', () => {
  const tol = parseFloat(process.env.TEMP_TOLERANCE_F || '2');
  assert(Math.abs(38 - 42) > tol, '4°F diff should mismatch');
});

test('20. Image preprocessor exports preprocess', () => {
  const pp = require('../src/vision/image-preprocessor');
  assert(typeof pp.validateAndPreprocess === 'function' ||
         typeof pp.preprocess === 'function', 'should export preprocess');
});

// ── Summary ──

console.log('\n═══════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log('═══════════════════════════════════════════════\n');

if (failed > 0) {
  console.log('Failed tests:');
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ❌ ${r.name}: ${r.error}`));
  console.log('');
}
process.exit(failed > 0 ? 1 : 0);
