/**
 * Threshold Engine
 * Compares extracted readings against rules from the Google Sheet.
 *
 * Supports operators: <= >= < > =
 */

const { getRules } = require('./sheet-source');
const { loadAliases, normalizeLabel } = require('./item-matcher');

/**
 * Evaluate a single reading against a rule.
 * @param {number} value
 * @param {string} operator
 * @param {number} target
 * @returns {boolean}
 */
function evaluate(value, operator, target) {
  switch (operator) {
    case '<=': return value <= target;
    case '>=': return value >= target;
    case '<':  return value < target;
    case '>':  return value > target;
    case '=':  return value === target;
    default:   return false;
  }
}

/**
 * Check all readings against all rules.
 * @param {Array<{item: string, value: number, unit: string}>} readings
 * @returns {{ failures: Array, passed: Array, needsReview: Array }}
 */
function checkAll(readings) {
  const rules = getRules();
  const aliases = loadAliases();
  const failures = [];
  const passed = [];
  const needsReview = [];

  for (const reading of readings) {
    const value = parseFloat(reading.value);
    if (isNaN(value)) {
      needsReview.push({
        item: reading.item || 'Unknown',
        value: reading.value ?? null,
        unit: reading.unit || 'F',
        confidence: reading.confidence ?? null,
        reason: 'unclear_value',
        message: `Unclear reading for "${reading.item || 'Unknown'}" — needs manual review.`,
      });
      continue;
    }

    const canonicalItem = matchCanonicalItem(reading.item, rules, aliases);
    const rule = canonicalItem ? rules.find(r => r.item === canonicalItem) : null;

    if (!rule) {
      needsReview.push({
        item: reading.item,
        value: reading.value,
        unit: reading.unit || 'F',
        confidence: reading.confidence ?? null,
        reason: 'unknown_item',
        rule: null,
        message: `Unknown item: "${reading.item}" — needs manual review.`,
      });
      continue;
    }

    const ok = evaluate(value, rule.operator, rule.target);
    if (!ok) {
      failures.push({
        item: rule.item,
        value: reading.value,
        unit: rule.unit,
        operator: rule.operator,
        target: rule.target,
        reason: 'threshold_exceeded',
        correctiveAction: rule.correctiveAction,
        category: rule.category,
        confidence: reading.confidence ?? null,
        message: `${rule.item}: ${value}°${rule.unit} (${rule.operator} ${rule.target}°${rule.unit})`,
      });
    } else {
      passed.push({
        item: rule.item,
        value: reading.value,
        unit: rule.unit,
        operator: rule.operator,
        target: rule.target,
        category: rule.category,
        confidence: reading.confidence ?? null,
      });
    }
  }

  return { failures, passed, needsReview };
}

function matchCanonicalItem(item, rules = getRules(), aliases = loadAliases()) {
  const normalized = normalizeLabel(item);
  if (!normalized) return null;

  for (const rule of rules) {
    if (normalizeLabel(rule.item) === normalized) return rule.item;
  }

  for (const rule of rules) {
    const configured = aliases[rule.item] || [];
    if (configured.some(alias => normalizeLabel(alias) === normalized)) return rule.item;
  }

  for (const rule of rules) {
    const ruleName = normalizeLabel(rule.item);
    if (normalized.includes(ruleName) || ruleName.includes(normalized)) return rule.item;
  }

  return null;
}

/**
 * Get default rules (for testing / offline use).
 */
function getAllDefaultRules() {
  const { HARD_RULES } = require('./sheet-source');
  return HARD_RULES;
}

module.exports = { evaluate, checkAll, getAllDefaultRules, matchCanonicalItem };
