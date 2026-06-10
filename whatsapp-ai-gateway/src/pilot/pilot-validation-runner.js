'use strict';
/**
 * pilot-validation-runner.js
 * Runs all pilot validation checks and returns a pass/fail result.
 */

const { makeLogger } = require('../logger');
const log = makeLogger('pilot');

async function runValidation() {
  const checks = [];

  // Check 1: Pilot metrics available
  try {
    const pilotMetrics = require('./pilot-metrics');
    const summary = await pilotMetrics.getPilotSummary();
    const passed = summary && summary.completionRate >= (summary.completionTarget || 0.95);
    checks.push({ name: 'completion_rate', passed, detail: `${((summary?.completionRate || 0) * 100).toFixed(1)}%` });
  } catch (err) {
    checks.push({ name: 'completion_rate', passed: false, detail: err.message });
  }

  // Check 2: Memory layer operational
  try {
    const { getMemoryStatus } = require('../agent-tools/memory/food-safety-memory-indexer');
    const status = await getMemoryStatus();
    checks.push({ name: 'memory_layer', passed: true, detail: `activeBackend: ${status.activeBackend}` });
  } catch (err) {
    checks.push({ name: 'memory_layer', passed: false, detail: err.message });
  }

  // Check 3: Missing submission detector
  try {
    const { detectMissing } = require('../food-safety/alerts/missing-submission-detector');
    await detectMissing();
    checks.push({ name: 'missing_detector', passed: true });
  } catch (err) {
    checks.push({ name: 'missing_detector', passed: false, detail: err.message });
  }

  // Check 4: Alert service
  try {
    const alertSvc = require('../alerts/manager-alert-service');
    const stats = await alertSvc.getStats();
    checks.push({ name: 'alert_service', passed: true, detail: `total alerts: ${stats.total}` });
  } catch (err) {
    checks.push({ name: 'alert_service', passed: false, detail: err.message });
  }

  // Check 5: Command center routes loadable
  try {
    require('../api/food-safety-command-center-routes');
    checks.push({ name: 'command_center_routes', passed: true });
  } catch (err) {
    checks.push({ name: 'command_center_routes', passed: false, detail: err.message });
  }

  const passed = checks.filter(c => c.passed).length;
  const total  = checks.length;
  const allPass = passed === total;

  log.info('Pilot validation', { passed, total, allPass });
  return { ok: allPass, passed, total, checks };
}

module.exports = { runValidation };
