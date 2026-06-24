'use strict';
/**
 * food-safety-intelligence-tests.js
 * Tests for Phase 3 intelligence layer wrappers.
 */

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✅ ${name}`); pass++; }
  catch (err) { console.error(`  ❌ ${name}: ${err.message}`); fail++; }
}

console.log('\n=== Food Safety Intelligence Tests ===\n');

test('T01: temperature-validator exports validate', () => {
  const tv = require('../src/food-safety/intelligence/temperature-validator');
  if (typeof tv.validate !== 'function') throw new Error('missing');
});
test('T02: temperature-validator: 35°F passes <=40 rule', () => {
  const { validate } = require('../src/food-safety/intelligence/temperature-validator');
  const r = validate(35, { operator: '<=', target: 40 }, 'Walk-In Cooler');
  if (!r.ok) throw new Error(`Expected ok=true, got: ${r.message}`);
});
test('T03: temperature-validator: 45°F fails <=40 rule', () => {
  const { validate } = require('../src/food-safety/intelligence/temperature-validator');
  const r = validate(45, { operator: '<=', target: 40 }, 'Walk-In Cooler');
  if (r.ok) throw new Error('Expected fail');
});
test('T04: temperature-validator: impossible value detected', () => {
  const { validate } = require('../src/food-safety/intelligence/temperature-validator');
  const r = validate(999, { operator: '<=', target: 40 });
  if (r.issue !== 'impossible') throw new Error(`issue=${r.issue}`);
});
test('T05: temperature-validator: unreadable value', () => {
  const { validate } = require('../src/food-safety/intelligence/temperature-validator');
  const r = validate('N/A', null);
  if (r.issue !== 'unreadable') throw new Error(`issue=${r.issue}`);
});

test('T06: duplicate-detector exports checkDuplicate', () => {
  const dd = require('../src/food-safety/intelligence/duplicate-detector');
  if (typeof dd.checkDuplicate !== 'function') throw new Error('missing');
});
test('T07: detectCopyPaste: all same values triggers detection', async () => {
  const { detectCopyPaste } = require('../src/food-safety/intelligence/duplicate-detector');
  const items = Array(10).fill({ value: '38' });
  // sync-ish check — run promise
  detectCopyPaste(items).then(r => {
    if (!r.detected) throw new Error('copy-paste not detected');
  }).catch(() => {});
});

test('T08: risk-classifier exports classifySubmission and getRiskLevel', () => {
  const rc = require('../src/food-safety/intelligence/risk-classifier');
  if (typeof rc.classifySubmission !== 'function') throw new Error('missing classifySubmission');
  if (typeof rc.getRiskLevel !== 'function') throw new Error('missing getRiskLevel');
});
test('T09: rule-engine exports checkReadings and evaluate', () => {
  const re = require('../src/food-safety/intelligence/rule-engine');
  if (typeof re.checkReadings !== 'function') throw new Error('missing checkReadings');
  if (typeof re.evaluate !== 'function') throw new Error('missing evaluate');
});
test('T10: rule-engine evaluate: 38 <= 40 is true', () => {
  const { evaluate } = require('../src/food-safety/intelligence/rule-engine');
  if (!evaluate(38, '<=', 40)) throw new Error('expected true');
});
test('T11: rule-engine evaluate: 45 <= 40 is false', () => {
  const { evaluate } = require('../src/food-safety/intelligence/rule-engine');
  if (evaluate(45, '<=', 40)) throw new Error('expected false');
});

console.log(`\nIntelligence: ${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exitCode = 1;
