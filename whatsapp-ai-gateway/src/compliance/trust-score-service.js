/**
 * Trust Score Service (Phase 1.3C)
 * Tracks employee, sensor, and store compliance trust scores.
 */
const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');
const log = makeLogger('trust');

// Score impacts
const IMPACT = {
  MATCH: 2,
  MISMATCH: -10,
  SENSOR_OFFLINE: -5,
  SENSOR_STALE: -3,
  PHOTO_CONFIRMS_HUMAN: 5,
  PHOTO_CONFIRMS_SENSOR: 5,
  PHOTO_AUDIT_PASS: 2,
  PHOTO_AUDIT_FAIL: -15,
  MISSED_LOG: -5,
  MANAGER_OVERRIDE: 0, // record but don't auto-adjust heavily
};

const MIN_SCORE = 0;
const MAX_SCORE = 100;
const DEFAULT_SCORE = 80;

// ── Employee trust ──────────────────────────────────────────────────────────

async function getOrCreateEmployeeScore(employeeId, storeId, employeeName = null) {
  const existing = await get(
    'SELECT * FROM employee_trust_scores WHERE employee_id = ? AND store_id = ?',
    [employeeId, storeId]
  );
  if (existing) return existing;

  await run(`
    INSERT INTO employee_trust_scores (employee_id, employee_name, store_id, score)
    VALUES (?, ?, ?, ?)
  `, [employeeId, employeeName, storeId, DEFAULT_SCORE]);

  return get('SELECT * FROM employee_trust_scores WHERE employee_id = ? AND store_id = ?', [employeeId, storeId]);
}

async function applyEmployeeImpact(employeeId, storeId, impact, employeeName = null) {
  const record = await getOrCreateEmployeeScore(employeeId, storeId, employeeName);
  const newScore = clamp(record.score + impact);
  await run(`
    UPDATE employee_trust_scores SET score = ?, total_submissions = total_submissions + 1,
    last_updated = datetime('now') WHERE employee_id = ? AND store_id = ?
  `, [newScore, employeeId, storeId]);
  log.info('Employee trust score updated', { employee_id: employeeId, impact, newScore });
  return newScore;
}

async function onHumanMatchesSensor(employeeId, storeId, employeeName = null) {
  const record = await getOrCreateEmployeeScore(employeeId, storeId, employeeName);
  await run(`
    UPDATE employee_trust_scores SET score = ?, total_matches = total_matches + 1,
    total_submissions = total_submissions + 1, last_updated = datetime('now')
    WHERE employee_id = ? AND store_id = ?
  `, [clamp(record.score + IMPACT.MATCH), employeeId, storeId]);
}

async function onHumanMismatchSensor(employeeId, storeId, employeeName = null) {
  const record = await getOrCreateEmployeeScore(employeeId, storeId, employeeName);
  await run(`
    UPDATE employee_trust_scores SET score = ?, total_mismatches = total_mismatches + 1,
    total_submissions = total_submissions + 1, last_updated = datetime('now')
    WHERE employee_id = ? AND store_id = ?
  `, [clamp(record.score + IMPACT.MISMATCH), employeeId, storeId]);
}

async function onPhotoConfirmsHuman(employeeId, storeId, employeeName = null) {
  const record = await getOrCreateEmployeeScore(employeeId, storeId, employeeName);
  await run(`
    UPDATE employee_trust_scores SET score = ?, photo_pass_count = photo_pass_count + 1,
    total_submissions = total_submissions + 1, last_updated = datetime('now')
    WHERE employee_id = ? AND store_id = ?
  `, [clamp(record.score + IMPACT.PHOTO_CONFIRMS_HUMAN), employeeId, storeId]);
}

async function recordCrossValidationResult(result, storeId, employeeId, sensorId) {
  const { status } = result;
  if (status === 'MATCH') {
    await onHumanMatchesSensor(employeeId, storeId);
  } else if (status === 'MISMATCH') {
    await onHumanMismatchSensor(employeeId, storeId);
  } else if (status === 'SENSOR_OFFLINE') {
    // Sensor unreliable — lightly penalize but not employee's fault
    const record = await getOrCreateEmployeeScore(employeeId, storeId);
    await run(
      'UPDATE employee_trust_scores SET score = ?, last_updated = datetime(\'now\') WHERE employee_id = ? AND store_id = ?',
      [clamp(record.score + IMPACT.SENSOR_OFFLINE), employeeId, storeId]
    );
  }

  // Update sensor trust
  if (sensorId) {
    await recordSensorResult(sensorId, status);
  }

  // Update store compliance
  if (storeId) {
    await updateStoreCompliance(storeId);
  }
}

// ── Sensor trust ─────────────────────────────────────────────────────────────

async function getOrCreateSensorScore(sensorId) {
  const existing = await get('SELECT * FROM sensor_trust_scores WHERE sensor_id = ?', [sensorId]);
  if (existing) return existing;

  await run('INSERT INTO sensor_trust_scores (sensor_id, score) VALUES (?, ?)', [sensorId, DEFAULT_SCORE]);
  return get('SELECT * FROM sensor_trust_scores WHERE sensor_id = ?', [sensorId]);
}

async function recordSensorResult(sensorId, status) {
  const record = await getOrCreateSensorScore(sensorId);
  let impact = 0;

  if (status === 'MATCH') impact = 2;
  else if (status === 'MISMATCH') impact = 0; // sensor might be correct — neutral
  else if (status === 'SENSOR_OFFLINE') impact = -5;
  else if (status === 'SENSOR_STALE') impact = -3;
  else if (status === 'PHOTO_CONFIRMS_SENSOR') impact = 5;

  await run(`
    UPDATE sensor_trust_scores SET score = ?, total_readings = total_readings + 1,
    ${status === 'SENSOR_OFFLINE' ? 'offline_count = offline_count + 1,' : ''}
    ${status === 'SENSOR_STALE' ? 'stale_count = stale_count + 1,' : ''}
    ${status === 'PHOTO_CONFIRMS_SENSOR' ? 'photo_confirm_count = photo_confirm_count + 1,' : ''}
    last_updated = datetime('now') WHERE sensor_id = ?
  `, [clamp(record.score + impact), sensorId]);
}

// ── Store compliance ─────────────────────────────────────────────────────────

async function getOrCreateStoreScore(storeId, storeName = null) {
  const existing = await get('SELECT * FROM store_compliance_scores WHERE store_id = ?', [storeId]);
  if (existing) return existing;

  await run('INSERT INTO store_compliance_scores (store_id, store_name, score) VALUES (?, ?, ?)', [storeId, storeName, DEFAULT_SCORE]);
  return get('SELECT * FROM store_compliance_scores WHERE store_id = ?', [storeId]);
}

async function updateStoreCompliance(storeId) {
  // Calculate match rate from cross_validation_results
  const total = await get('SELECT COUNT(*) as c FROM cross_validation_results WHERE store_id = ?', [storeId]);
  const matches = await get("SELECT COUNT(*) as c FROM cross_validation_results WHERE store_id = ? AND status = 'MATCH'", [storeId]);
  const mismatches = await get("SELECT COUNT(*) as c FROM cross_validation_results WHERE store_id = ? AND status = 'MISMATCH'", [storeId]);
  const missedLogs = await get(
    "SELECT COUNT(*) as c FROM cross_validation_results WHERE store_id = ? AND status = 'NO_SENSOR'",
    [storeId]
  );

  const matchRate = total?.c ? (matches?.c || 0) / total.c : 0;
  const record = await getOrCreateStoreScore(storeId);

  await run(`
    UPDATE store_compliance_scores SET score = ?, match_rate = ?, mismatch_count = ?,
    missed_logs = ?, last_updated = datetime('now') WHERE store_id = ?
  `, [clamp(record.score + (matchRate > 0.8 ? 0.5 : matchRate < 0.5 ? -1 : 0)), Math.round(matchRate * 100) / 100, mismatches?.c || 0, missedLogs?.c || 0, storeId]);
}

// ── Getters ─────────────────────────────────────────────────────────────────

async function getEmployeeScore(employeeId, storeId) {
  const record = await get('SELECT * FROM employee_trust_scores WHERE employee_id = ? AND store_id = ?', [employeeId, storeId]);
  return record || { score: DEFAULT_SCORE, total_matches: 0, total_mismatches: 0 };
}

async function getStoreScore(storeId) {
  const record = await get('SELECT * FROM store_compliance_scores WHERE store_id = ?', [storeId]);
  return record || { score: DEFAULT_SCORE, match_rate: 0, mismatch_count: 0 };
}

async function getTopEmployees(limit = 20) {
  return all('SELECT * FROM employee_trust_scores ORDER BY score DESC LIMIT ?', [limit]);
}

async function getAllStoreScores() {
  return all('SELECT * FROM store_compliance_scores ORDER BY score DESC');
}

async function getEmployeeStats(employeeId) {
  const record = await get('SELECT * FROM employee_trust_scores WHERE employee_id = ? ORDER BY created_at DESC LIMIT 1', [employeeId]);
  if (!record) return { score: DEFAULT_SCORE };
  return record;
}

// ── Utility ─────────────────────────────────────────────────────────────────

function clamp(score) {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(score * 10) / 10));
}

module.exports = {
  getOrCreateEmployeeScore, applyEmployeeImpact,
  onHumanMatchesSensor, onHumanMismatchSensor, onPhotoConfirmsHuman,
  recordCrossValidationResult, recordSensorResult,
  getOrCreateStoreScore, updateStoreCompliance,
  getEmployeeScore, getStoreScore, getTopEmployees, getAllStoreScores, getEmployeeStats,
  IMPACT,
};