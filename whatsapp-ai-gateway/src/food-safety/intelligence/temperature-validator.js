'use strict';
/**
 * temperature-validator.js
 * Validates temperature readings from food safety submissions.
 */

const IMPOSSIBLE_MIN = -20;
const IMPOSSIBLE_MAX = 500;

function isImpossible(value) {
  return value < IMPOSSIBLE_MIN || value > IMPOSSIBLE_MAX;
}

function isCelsius(value, label = '') {
  const lbl = label.toLowerCase();
  if (lbl.includes('celsius') || lbl.includes('°c')) return true;
  // Heuristic: a fridge temperature of 2–8°C looks like a cooler in Celsius
  return value > 0 && value < 50 && !lbl.includes('°f') && !lbl.includes('fahrenheit');
}

function celsiusToFahrenheit(c) {
  return Math.round((c * 9) / 5 + 32);
}

function validate(value, rule, label = '') {
  const num = parseFloat(value);
  if (isNaN(num)) return { ok: false, issue: 'unreadable', message: `Cannot parse "${value}" as a number` };
  if (isImpossible(num)) return { ok: false, issue: 'impossible', message: `Value ${num} is outside the possible range (${IMPOSSIBLE_MIN}–${IMPOSSIBLE_MAX})` };

  let effectiveValue = num;
  let unitWarning = null;
  if (isCelsius(num, label)) {
    unitWarning = `Possible unit mismatch: ${num}°C detected, converting to ${celsiusToFahrenheit(num)}°F for comparison`;
    effectiveValue = celsiusToFahrenheit(num);
  }

  if (!rule) return { ok: true, value: effectiveValue, unitWarning };

  const passes = checkRule(effectiveValue, rule);
  return {
    ok: passes,
    value: effectiveValue,
    unitWarning,
    issue: passes ? null : 'out_of_range',
    message: passes ? null : `${label || 'Value'} ${effectiveValue}°F violates rule ${rule.operator} ${rule.target}`,
  };
}

function checkRule(value, rule) {
  switch (rule.operator) {
    case '<=': return value <= rule.target;
    case '>=': return value >= rule.target;
    case '<':  return value < rule.target;
    case '>':  return value > rule.target;
    case '=':  return value === rule.target;
    default:   return false;
  }
}

module.exports = { validate, isImpossible, isCelsius, celsiusToFahrenheit };
