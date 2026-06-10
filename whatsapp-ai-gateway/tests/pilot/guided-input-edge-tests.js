/**
 * Guided Input Edge Case Tests
 *
 * Direct tests for the guided-workflow-engine to verify Phase 1 fix:
 *   - Numeric input (44) is parsed correctly
 *   - Out-of-range triggers confirm/re-enter/skip flow
 *   - Non-numeric input shows helpful error
 *   - Decimal, comma, unit, name-prefixed all work
 */

const assert = require('assert');
const { parseHumanInput, parseTextNumber, celsiusToFahrenheit, classifyOutOfRange } =
  require('../../src/workflows/guided/guided-workflow-engine');

let total = 0;
let passed = 0;
let failed = 0;
const failures = [];

function test(id, name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✅ ${id}: ${name}`);
  } catch (err) {
    failed++;
    failures.push({ id, name, error: err.message });
    console.log(`  ❌ ${id}: ${name}\n     ${err.message}`);
  }
}

console.log('\n═══ Phase 1: Guided Input Edge Case Tests ═══\n');

// ── Phase 1 critical bug: 44 must be parsed as numeric ────────────────────
test('GE-01', '44 is parsed as numeric value (THE BUG)', () => {
  const result = parseHumanInput('44');
  assert.strictEqual(result.value, 44, '44 should parse to 44');
  assert.strictEqual(result.unit, null, 'unit should be null');
});

test('GE-02', '44 is NOT classified as "Not understood"', () => {
  const result = parseHumanInput('44');
  assert.notStrictEqual(result.value, null);
});

// ── Integer inputs ─────────────────────────────────────────────────────────
test('GE-03', 'Integer 35', () => {
  assert.strictEqual(parseHumanInput('35').value, 35);
});
test('GE-04', 'Integer 40 (boundary)', () => {
  assert.strictEqual(parseHumanInput('40').value, 40);
});
test('GE-05', 'Integer 38', () => {
  assert.strictEqual(parseHumanInput('38').value, 38);
});

// ── Decimal inputs ─────────────────────────────────────────────────────────
test('GE-06', 'Decimal 35.5', () => {
  assert.strictEqual(parseHumanInput('35.5').value, 35.5);
});
test('GE-07', 'Decimal 40.2', () => {
  assert.strictEqual(parseHumanInput('40.2').value, 40.2);
});
test('GE-08', 'Comma decimal 35,5 → 35.5', () => {
  assert.strictEqual(parseHumanInput('35,5').value, 35.5);
});

// ── Unit inputs ────────────────────────────────────────────────────────────
test('GE-09', '35F (with F unit)', () => {
  const r = parseHumanInput('35F');
  assert.strictEqual(r.value, 35);
  assert.strictEqual(r.unit, 'F');
});
test('GE-10', '35°F (with °F unit)', () => {
  const r = parseHumanInput('35°F');
  assert.strictEqual(r.value, 35);
  assert.strictEqual(r.unit, 'F');
});
test('GE-11', '4C (Celsius)', () => {
  const r = parseHumanInput('4C');
  assert.strictEqual(r.value, 4);
  assert.strictEqual(r.unit, 'C');
});
test('GE-12', '4°C (Celsius with degree)', () => {
  const r = parseHumanInput('4°C');
  assert.strictEqual(r.value, 4);
  assert.strictEqual(r.unit, 'C');
});

// ── Negative numbers ───────────────────────────────────────────────────────
test('GE-13', 'Negative -5 (freezer)', () => {
  assert.strictEqual(parseHumanInput('-5').value, -5);
});
test('GE-14', 'Negative -10', () => {
  assert.strictEqual(parseHumanInput('-10').value, -10);
});

// ── Whitespace handling ────────────────────────────────────────────────────
test('GE-15', 'Leading/trailing whitespace " 35 "', () => {
  assert.strictEqual(parseHumanInput(' 35 ').value, 35);
});
test('GE-16', 'Multiple trailing spaces "35   "', () => {
  assert.strictEqual(parseHumanInput('35   ').value, 35);
});

// ── Named input ────────────────────────────────────────────────────────────
test('GE-17', 'Named "Walk-in Cooler 35" → 35', () => {
  assert.strictEqual(parseHumanInput('Walk-in Cooler 35').value, 35);
});
test('GE-18', 'With colon "Cooler: 35" → 35', () => {
  assert.strictEqual(parseHumanInput('Cooler: 35').value, 35);
});
test('GE-19', 'With equals "Cooler = 35" → 35', () => {
  assert.strictEqual(parseHumanInput('Cooler = 35').value, 35);
});

// ── Non-numeric input → null ───────────────────────────────────────────────
test('GE-20', 'Text "good" → null', () => {
  assert.strictEqual(parseHumanInput('good').value, null);
});
test('GE-21', 'Text "ok" → null', () => {
  assert.strictEqual(parseHumanInput('ok').value, null);
});
test('GE-22', 'Text "cold" → null', () => {
  assert.strictEqual(parseHumanInput('cold').value, null);
});
test('GE-23', 'Text "done" → null', () => {
  assert.strictEqual(parseHumanInput('done').value, null);
});

// ── Text number conversion ─────────────────────────────────────────────────
test('GE-24', '"thirty five" → 35', () => {
  assert.strictEqual(parseTextNumber('thirty five'), 35);
});
test('GE-25', '"forty" → 40', () => {
  assert.strictEqual(parseTextNumber('forty'), 40);
});
test('GE-26', '"forty-two" → 42', () => {
  assert.strictEqual(parseTextNumber('forty-two'), 42);
});

// ── Celsius → Fahrenheit conversion ────────────────────────────────────────
test('GE-27', 'Celsius 0 → 32°F', () => {
  assert.strictEqual(celsiusToFahrenheit(0), 32);
});
test('GE-28', 'Celsius 4 → 39.2°F', () => {
  assert.strictEqual(celsiusToFahrenheit(4), 39.2);
});
test('GE-29', 'Celsius 100 → 212°F', () => {
  assert.strictEqual(celsiusToFahrenheit(100), 212);
});

// ── Out-of-range classification ────────────────────────────────────────────
test('GE-30', 'Cooler 44 (40 max) → OUT_OF_RANGE', () => {
  const severity = classifyOutOfRange(44, 30, 40, { type: 'cooler' });
  assert.strictEqual(severity, 'OUT_OF_RANGE');
});
test('GE-31', 'Cooler 65 → CRITICAL (well over max)', () => {
  // 30-40 range: range=10, range*2=20, max+20=60. So 65 > 60 = CRITICAL.
  const severity = classifyOutOfRange(65, 30, 40, { type: 'cooler' });
  assert.strictEqual(severity, 'CRITICAL');
});
test('GE-32', 'Cooler 400 → CRITICAL', () => {
  const severity = classifyOutOfRange(400, 30, 40, { type: 'cooler' });
  assert.strictEqual(severity, 'CRITICAL');
});
test('GE-33', 'Freezer 50 → CRITICAL', () => {
  // Freezer: no min, max=0, value=50 > 20 = CRITICAL
  const severity = classifyOutOfRange(50, null, 0, { type: 'freezer' });
  assert.strictEqual(severity, 'CRITICAL');
});
test('GE-34', 'Broth 500 → CRITICAL', () => {
  const severity = classifyOutOfRange(500, 200, 220, { type: 'broth' });
  assert.strictEqual(severity, 'CRITICAL');
});

// ── Summary ────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log(`Phase 1 Edge Case Tests: ${passed}/${total} passed`);
if (failed > 0) {
  console.log(`\n❌ ${failed} failures:`);
  failures.forEach(f => console.log(`  ${f.id} — ${f.name}: ${f.error}`));
}
console.log('═'.repeat(60));

process.exit(failed > 0 ? 1 : 0);