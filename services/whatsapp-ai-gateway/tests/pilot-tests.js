'use strict';
/**
 * pilot-tests.js
 * Tests for Phase 8 pilot harness.
 */

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); pass++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); fail++; }
}

console.log('\n=== Pilot Tests ===\n');

test('T01: pilot-report-builder exports buildReport', () => {
  const rb = require('../src/pilot/pilot-report-builder');
  if (typeof rb.buildReport !== 'function') throw new Error('missing');
});
test('T02: pilot-validation-runner exports runValidation', () => {
  const vr = require('../src/pilot/pilot-validation-runner');
  if (typeof vr.runValidation !== 'function') throw new Error('missing');
});
test('T03: missing-submission-detector exports detectMissing', () => {
  const md = require('../src/food-safety/alerts/missing-submission-detector');
  if (typeof md.detectMissing !== 'function') throw new Error('missing');
});
test('T04: alert-template-builder exports all templates', () => {
  const tb = require('../src/food-safety/alerts/alert-template-builder');
  ['missingSubmissionAlert', 'failureAlert', 'warningAlert', 'reviewAlert', 'dailySummaryAlert'].forEach(fn => {
    if (typeof tb[fn] !== 'function') throw new Error(`${fn} missing`);
  });
});
test('T05: missingSubmissionAlert includes store name', () => {
  const { missingSubmissionAlert } = require('../src/food-safety/alerts/alert-template-builder');
  const msg = missingSubmissionAlert({ store_name: 'Stone Oak', store_id: 'stone_oak', shift: 'AM', date: '2026-06-10' });
  if (!msg.includes('Stone Oak')) throw new Error('store name not in message');
  if (!msg.includes('AM')) throw new Error('shift not in message');
});
test('T06: failureAlert includes issues', () => {
  const { failureAlert } = require('../src/food-safety/alerts/alert-template-builder');
  const msg = failureAlert({ store_id: 'rim', employee: 'Ana', shift: 'PM', date: '2026-06-10', issues: [{ item: 'Walk-In', message: '45°F exceeds limit' }] });
  if (!msg.includes('Walk-In')) throw new Error('issue not in message');
});
test('T07: food-safety-audit-package exports buildAuditPackage', () => {
  const ap = require('../src/audit/food-safety-audit-package');
  if (typeof ap.buildAuditPackage !== 'function') throw new Error('missing');
});
test('T08: food-safety-zip-exporter exports zipAuditPackage', () => {
  const ze = require('../src/audit/food-safety-zip-exporter');
  if (typeof ze.zipAuditPackage !== 'function') throw new Error('missing');
});
test('T09: food-safety-csv-exporter exports exportCsv', () => {
  const ce = require('../src/exports/food-safety-csv-exporter');
  if (typeof ce.exportCsv !== 'function') throw new Error('missing');
});
test('T10: food-safety-pdf-exporter exports exportPdf', () => {
  const pe = require('../src/exports/food-safety-pdf-exporter');
  if (typeof pe.exportPdf !== 'function') throw new Error('missing');
});
test('T11: mi food-safety-skill exports matches and handle', () => {
  const sk = require('../src/mi/skills/food-safety-skill');
  if (typeof sk.matches !== 'function') throw new Error('matches missing');
  if (typeof sk.handle !== 'function') throw new Error('handle missing');
  if (!sk.matches('food safety temperature check')) throw new Error('matches failed');
});
test('T12: command-center routes is an express Router', () => {
  const router = require('../src/api/food-safety-command-center-routes');
  if (typeof router !== 'function' && typeof router.get !== 'function') throw new Error('not a router');
});

console.log(`\nPilot: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exitCode = 1;
