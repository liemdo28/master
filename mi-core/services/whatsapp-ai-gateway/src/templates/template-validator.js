/**
 * Template Validator
 *
 * Validates submitted values against dynamic min/max thresholds
 * loaded from the template cache (Google Sheet → SQLite → defaults).
 *
 * Never hardcodes any business values.
 * All limits come from templateCache.getThresholds().
 */

const templateCache = require('./template-cache');

// ── Per-item validation ────────────────────────────────────────────────────────

/**
 * Validate a single numeric value against a threshold.
 * @param {string} name      - item name
 * @param {number} value     - submitted value
 * @param {{ min: number|null, max: number|null }|undefined} threshold
 * @returns {{ status: 'PASS'|'FAIL'|'WARN', target: string|null, reason: string|null }}
 */
function validateItem(name, value, threshold) {
  if (!threshold || (threshold.min == null && threshold.max == null)) {
    return { status: 'PASS', target: null, reason: null, min: null, max: null };
  }

  const { min, max } = threshold;
  const target = formatTarget(min, max);

  if (min !== null && max !== null) {
    if (value < min || value > max) {
      return { status: 'FAIL', target, reason: `${value} outside ${target}`, min, max };
    }
  } else if (min !== null) {
    if (value < min) return { status: 'FAIL', target, reason: `${value} below min ${min}`, min, max };
  } else if (max !== null) {
    if (value > max) return { status: 'FAIL', target, reason: `${value} above max ${max}`, min, max };
  }

  return { status: 'PASS', target, reason: null, min, max };
}

/**
 * Validate all submitted counts against the current template thresholds.
 *
 * @param {{ [itemName]: number }} counts  - validated numeric counts
 * @param {Object} [thresholds]            - optional override (defaults to templateCache)
 * @returns {{
 *   overallStatus: 'PASS'|'FAIL',
 *   failCount: number,
 *   results: Array<{ name, value, status, target, reason }>,
 *   failures: Array<{ name, value, target, reason }>,
 *   warningSummary: string
 * }}
 */
function validateAll(counts, thresholds = null) {
  const thr = thresholds || templateCache.getThresholds();
  const itemNames = templateCache.getItemNames();
  const names = itemNames.length ? itemNames : Object.keys(counts || {});
  const results = [];
  const failures = [];

  for (const name of names) {
    const value = counts[name];
    if (value == null || value === '') {
      results.push({ name, value: null, status: 'WARN', target: thr[name] ? formatTarget(thr[name].min, thr[name].max) : null, reason: 'missing', min: thr[name]?.min ?? null, max: thr[name]?.max ?? null });
      continue;
    }
    const result = validateItem(name, value, thr[name]);
    results.push({ name, value, ...result });
    if (result.status === 'FAIL') {
      failures.push({ name, value, target: result.target, reason: result.reason });
    }
  }

  const overallStatus = failures.length > 0 ? 'FAIL' : 'PASS';
  const warningSummary = failures.length > 0
    ? failures.map(f => `${f.name}: ${f.value}${f.target ? `, target ${f.target}` : ''}`).join('; ')
    : '';

  return { overallStatus, failCount: failures.length, results, failures, warningSummary };
}

// ── Display helpers ────────────────────────────────────────────────────────────

function formatTarget(min, max) {
  if (min !== null && max !== null) return `${min}–${max}`;
  if (min !== null) return `>= ${min}`;
  if (max !== null) return `<= ${max}`;
  return null;
}

/**
 * Build a human-readable per-item line for the summary.
 * e.g. "1. Walk-in Cooler: 44  ⚠️ FAIL (target 30–40)"
 *      "2. Walk-in Freezer: -5  ✅ PASS"
 */
function formatItemLine(idx, result) {
  const label = result.status === 'FAIL'
    ? `⚠️ FAIL${result.target ? ` (target ${result.target})` : ''}`
    : (result.target ? `✅ PASS (target ${result.target})` : '✅');
  return `${idx + 1}. ${result.name}: ${result.value}  ${label}`;
}

module.exports = { validateItem, validateAll, formatTarget, formatItemLine };
