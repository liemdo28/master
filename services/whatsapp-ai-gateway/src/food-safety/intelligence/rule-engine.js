'use strict';
/**
 * rule-engine.js — Wraps threshold-engine.js for agent-OS tool use.
 */

const thresholdEngine = require('../threshold-engine');

function checkReadings(readings) {
  return thresholdEngine.checkAll(readings);
}

function evaluate(value, operator, target) {
  return thresholdEngine.evaluate(value, operator, target);
}

module.exports = { checkReadings, evaluate };
