/**
 * Cross-Validation Service (Phase 1.3)
 * Compares human-submitted values with YoLink sensor readings.
 */
const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');
const log = makeLogger('cross-validation');

const TOLERANCE_F = () => parseFloat(process.env.SENSOR_HUMAN_TOLERANCE_F || '2');
const MATCH_WINDOW_MINUTES = () => parseInt(process.env.SENSOR_MATCH_WINDOW_MINUTES || '10', 10);

/**
 * Compare human entry against sensor reading for an item.
 * Returns a comparison result with status: MATCH | MISMATCH | NO_SENSOR | SENSOR_STALE | SENSOR_OFFLINE
 */
async function compareHumanVsSensor(storeId, itemName, humanValue, employeeId) {
  if (!isEnabled()) {
    return { status: 'DISABLED', humanValue };
  }

  let readingService;
  try { readingService = require('../integrations/yolink/yolink-reading-service'); } catch (_) {}
  if (!readingService) {
    return { status: 'NO_SENSOR', humanValue };
  }

  const latestReading = await readingService.getLatestReadingForItem(storeId, itemName);

  if (!latestReading) {
    return { status: 'NO_SENSOR', humanValue };
  }

  // Check online/stale
  if (!latestReading.online_status) {
    return { status: 'SENSOR_OFFLINE', humanValue, sensorValue: latestReading.value };
  }

  if (latestReading.provider_timestamp) {
    const ageMinutes = (Date.now() - new Date(latestReading.provider_timestamp).getTime()) / 60000;
    const staleMinutes = parseInt(process.env.SENSOR_STALE_MINUTES || '15', 10);
    const offlineMinutes = parseInt(process.env.SENSOR_OFFLINE_MINUTES || '60', 10);
    if (ageMinutes >= offlineMinutes) {
      return { status: 'SENSOR_OFFLINE', humanValue, sensorValue: latestReading.value };
    }
    if (ageMinutes >= staleMinutes) {
      return { status: 'SENSOR_STALE', humanValue, sensorValue: latestReading.value };
    }
  }

  const sensorValue = latestReading.value;
  const diff = Math.abs(humanValue - sensorValue);
  const tolerance = TOLERANCE_F();
  const status = diff <= tolerance ? 'MATCH' : 'MISMATCH';

  const result = {
    status,
    humanValue,
    sensorValue,
    difference: Math.round(diff * 10) / 10,
    tolerance,
    sensorId: latestReading.sensor_id,
    readingTimestamp: latestReading.received_at,
    employeeId,
  };

  // Persist result
  await saveResult(result, storeId, itemName, employeeId);

  // Update trust scores
  try {
    const trustSvc = require('./trust-score-service');
    await trustSvc.recordCrossValidationResult(result, storeId, employeeId, latestReading.sensor_id);
  } catch (_) {}

  return result;
}

function isEnabled() {
  return process.env.SENSOR_HUMAN_COMPARE_ENABLED !== 'false';
}

async function saveResult(result, storeId, itemName, employeeId) {
  const { status, humanValue, sensorValue, difference } = result;
  await run(`
    INSERT INTO cross_validation_results
    (store_id, employee_id, item_name, human_value, sensor_value, difference_human_sensor, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [storeId, employeeId, itemName, humanValue, sensorValue ?? null, difference ?? null, status]);
}

/**
 * Resolve a mismatch — employee choice
 * resolution: USE_HUMAN | USE_SENSOR | RE_ENTERED
 */
async function resolveMismatch(crossValId, resolution, employeeId, reEnteredValue = null) {
  const val = reEnteredValue ?? (resolution === 'USE_SENSOR' ? null : null);
  await run(
    'UPDATE cross_validation_results SET resolution = ?, resolved_by = ?, resolved_at = datetime(\'now\') WHERE id = ?',
    [resolution, employeeId, crossValId]
  );
  return { crossValId, resolution };
}

/**
 * Get recent cross-validation results
 */
async function getRecentResults(storeId = null, limit = 20) {
  if (storeId) {
    return all('SELECT * FROM cross_validation_results WHERE store_id = ? ORDER BY created_at DESC LIMIT ?', [storeId, limit]);
  }
  return all('SELECT * FROM cross_validation_results ORDER BY created_at DESC LIMIT ?', [limit]);
}

/**
 * Get cross-validation stats
 */
async function getStats() {
  const total = await get('SELECT COUNT(*) as c FROM cross_validation_results');
  const matches = await get("SELECT COUNT(*) as c FROM cross_validation_results WHERE status = 'MATCH'");
  const mismatches = await get("SELECT COUNT(*) as c FROM cross_validation_results WHERE status = 'MISMATCH'");
  const noSensor = await get("SELECT COUNT(*) as c FROM cross_validation_results WHERE status = 'NO_SENSOR'");
  const stale = await get("SELECT COUNT(*) as c FROM cross_validation_results WHERE status IN ('SENSOR_STALE','SENSOR_OFFLINE')");

  return {
    total: total?.c || 0,
    match: matches?.c || 0,
    mismatch: mismatches?.c || 0,
    noSensor: noSensor?.c || 0,
    stale: stale?.c || 0,
    matchRate: total?.c ? Math.round((matches?.c || 0) / total.c * 100) : 0,
  };
}

module.exports = {
  compareHumanVsSensor, resolveMismatch,
  getRecentResults, getStats, isEnabled,
};
