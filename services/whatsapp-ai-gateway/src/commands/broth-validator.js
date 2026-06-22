const { DEFAULT_BROTH_ITEMS } = require('./broth-parser');

const HIGH_COUNT_THRESHOLD = Number(process.env.BROTH_HIGH_COUNT_THRESHOLD || 250);

/**
 * Validate count submission against the active item list.
 * @param {{ values: Object, invalid: Array }} parsed
 * @param {string[]} itemList - active item list (defaults to DEFAULT_BROTH_ITEMS)
 */
function validateCounts(parsed, itemList = DEFAULT_BROTH_ITEMS) {
  const values  = parsed.values  || {};
  const invalid = [...(parsed.invalid || [])];
  const missing  = [];
  const warnings = [];
  const counts   = {};

  for (const item of itemList) {
    const raw = values[item];
    if (raw == null || raw === '') {
      missing.push(item);
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      if (!invalid.some(v => v.item === item)) invalid.push({ item, value: raw });
      continue;
    }
    if (value < 0) {
      invalid.push({ item, value: raw, reason: 'negative' });
      continue;
    }
    if (value > HIGH_COUNT_THRESHOLD) {
      warnings.push(`${item}: ${value} is unusually high`);
    }
    counts[item] = value;
  }

  return {
    valid:   missing.length === 0 && invalid.length === 0,
    status:  missing.length ? 'NEEDS_REVIEW' : invalid.length ? 'INVALID' : warnings.length ? 'REVIEW' : 'PASS',
    counts, missing, invalid, warnings,
  };
}

module.exports = { validateCounts, HIGH_COUNT_THRESHOLD };
