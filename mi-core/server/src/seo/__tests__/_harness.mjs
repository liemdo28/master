/**
 * Shared plain-node test harness for the SEO Control Center test suite.
 * Matches the style of tests/ceo-os-master-validation.mjs (section() helper,
 * pass/fail counters, plain console output, non-zero exit on failure) but
 * factored out so article.mjs / publishing.mjs / qa.mjs / regression.mjs
 * don't each reimplement it.
 *
 * Adds a third bucket — gap() — for cases where the required test category
 * genuinely can't be exercised against real code yet (functionality not
 * built, or a design property that doesn't exist). Gaps are reported
 * separately from pass/fail so they're never silently miscounted as a pass.
 */

const sections = [];
let currentSection = null;
let totalPass = 0;
let totalFail = 0;
let totalGap = 0;

export function section(name) {
  if (currentSection) sections.push(currentSection);
  currentSection = { name, pass: 0, fail: 0, gap: 0 };
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SECTION: ${name}`);
  console.log('='.repeat(60));
}

export function check(label, ok, detail = '') {
  if (!currentSection) section('(default)');
  if (ok) {
    currentSection.pass++;
    totalPass++;
    console.log(`  PASS  ${label}`);
  } else {
    currentSection.fail++;
    totalFail++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** Documents a required test category that could not be exercised against
 *  real code (missing functionality, undocumented design gap, etc). Never
 *  counted as a pass. */
export function gap(label, detail = '') {
  if (!currentSection) section('(default)');
  currentSection.gap++;
  totalGap++;
  console.log(`  GAP   ${label}${detail ? ` — ${detail}` : ''}`);
}

export function note(msg) {
  console.log(`  ...   ${msg}`);
}

export function finalize(fileLabel) {
  if (currentSection) sections.push(currentSection);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${fileLabel}: ${totalPass} passed, ${totalFail} failed, ${totalGap} gap(s) documented`);
  console.log('='.repeat(60));
  if (totalFail > 0) process.exitCode = 1;
  return { pass: totalPass, fail: totalFail, gap: totalGap };
}
