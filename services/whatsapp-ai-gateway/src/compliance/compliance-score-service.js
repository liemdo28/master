/**
 * Compliance Score Service
 * 
 * Tracks employee compliance scores based on photo audit results.
 * 
 * Score impacts:
 *   +2  — Successful photo proof (PASS)
 *   -5  — Repeated identical values detected
 *   -10 — Missed log submission
 *   -15 — Mismatch confirmed (staff used entered value over photo)
 *   -20 — Ignored photo proof (didn't respond or refused)
 * 
 * Scores range from 0–100.
 * Initial score for new employees: 80.
 */

const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('compliance');

let initialized = false;

const INITIAL_SCORE = 80;
const MIN_SCORE = 0;
const MAX_SCORE = 100;

// Score impacts
const IMPACTS = {
  PASS: 2,
  REPEATED_VALUES: -5,
  MISSED_LOG: -10,
  MISMATCH_CONFIRMED_ENTERED: -15,
  MISMATCH_CONFIRMED_PHOTO: -5, // less penalty for accepting photo
  IGNORED_AUDIT: -20,
  NEEDS_REVIEW: -3,
};

// ── Schema ────────────────────────────────────────────────────────────────────
async function ensureTables() {
  if (initialized) return;

  await run(`
    CREATE TABLE IF NOT EXISTS compliance_scores (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id         TEXT,
      employee_id      TEXT NOT NULL,
      employee_name    TEXT,
      score            INTEGER NOT NULL DEFAULT ${INITIAL_SCORE},
      score_date       TEXT DEFAULT (date('now')),
      reason_json      TEXT,
      updated_at       TEXT DEFAULT (datetime('now')),
      UNIQUE(employee_id, score_date)
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_compliance_employee ON compliance_scores(employee_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_compliance_store ON compliance_scores(store_id)`);

  initialized = true;
}

// ── Score operations ───────────────────────────────────────────────────────────

/**
 * Apply a score impact to an employee.
 */
async function applyScoreImpact(employeeId, employeeName, storeId, impactType, context = {}) {
  await ensureTables();

  const impact = IMPACTS[impactType] ?? 0;
  if (impact === 0) {
    log.warn('Unknown impact type', { impactType });
    return null;
  }

  // Get current score
  const today = new Date().toISOString().slice(0, 10);
  const current = await get(
    `SELECT score FROM compliance_scores WHERE employee_id = ? AND score_date = ?`,
    [employeeId, today]
  );

  const currentScore = current?.score ?? INITIAL_SCORE;
  const newScore = Math.max(MIN_SCORE, Math.min(MAX_SCORE, currentScore + impact));

  // Upsert today's score
  const reason = JSON.stringify({ type: impactType, ...context });
  await run(
    `INSERT INTO compliance_scores (employee_id, employee_name, store_id, score, score_date, reason_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(employee_id, score_date) DO UPDATE SET
       score = ?,
       reason_json = ?,
       employee_name = COALESCE(excluded.employee_name, employee_name),
       store_id = COALESCE(excluded.store_id, store_id),
       updated_at = datetime('now')`,
    [employeeId, employeeName || '', storeId || '', newScore, today, reason, newScore, reason]
  );

  log.info('Compliance score updated', { employeeId, employeeName, impactType, before: currentScore, after: newScore });
  return newScore;
}

// ── Score impacts ──────────────────────────────────────────────────────────────

async function onPhotoAuditPassed(employeeId, employeeName, storeId, auditId) {
  return applyScoreImpact(employeeId, employeeName, storeId, 'PASS', { auditId });
}

async function onRepeatedValuesDetected(employeeId, employeeName, storeId, items) {
  return applyScoreImpact(employeeId, employeeName, storeId, 'REPEATED_VALUES', { items });
}

async function onMissedLog(employeeId, employeeName, storeId) {
  return applyScoreImpact(employeeId, employeeName, storeId, 'MISSED_LOG', {});
}

async function onMismatchConfirmed(employeeId, employeeName, storeId, auditId, usedEntered) {
  const type = usedEntered ? 'MISMATCH_CONFIRMED_ENTERED' : 'MISMATCH_CONFIRMED_PHOTO';
  return applyScoreImpact(employeeId, employeeName, storeId, type, { auditId, usedEntered });
}

async function onAuditIgnored(employeeId, employeeName, storeId, auditId) {
  return applyScoreImpact(employeeId, employeeName, storeId, 'IGNORED_AUDIT', { auditId });
}

async function onNeedsReview(employeeId, employeeName, storeId, reason) {
  return applyScoreImpact(employeeId, employeeName, storeId, 'NEEDS_REVIEW', { reason });
}

// ── Query ─────────────────────────────────────────────────────────────────────

async function getScore(employeeId, dateStr = null) {
  await ensureTables();
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const row = await get(
    `SELECT * FROM compliance_scores WHERE employee_id = ? AND score_date = ?`,
    [employeeId, date]
  );
  return row || null;
}

async function getRecentScores(employeeId, days = 7) {
  await ensureTables();
  return all(
    `SELECT * FROM compliance_scores WHERE employee_id = ?
     ORDER BY score_date DESC LIMIT ?`,
    [employeeId, days]
  );
}

async function getStoreScores(storeId, limit = 50) {
  await ensureTables();
  // Get most recent score per employee
  return all(
    `SELECT cs.* FROM compliance_scores cs
     JOIN (SELECT employee_id, MAX(score_date) as max_date FROM compliance_scores GROUP BY employee_id) latest
     ON cs.employee_id = latest.employee_id AND cs.score_date = latest.max_date
     WHERE cs.store_id = ?
     ORDER BY cs.score ASC LIMIT ?`,
    [storeId, limit]
  );
}

async function getTopOffenders(storeId = null, limit = 10) {
  await ensureTables();
  const sql = storeId
    ? `SELECT cs.* FROM compliance_scores cs
       JOIN (SELECT employee_id, MAX(score_date) as max_date FROM compliance_scores GROUP BY employee_id) latest
       ON cs.employee_id = latest.employee_id AND cs.score_date = latest.max_date
       WHERE cs.store_id = ? AND cs.score < 60
       ORDER BY cs.score ASC LIMIT ?`
    : `SELECT cs.* FROM compliance_scores cs
       JOIN (SELECT employee_id, MAX(score_date) as max_date FROM compliance_scores GROUP BY employee_id) latest
       ON cs.employee_id = latest.employee_id AND cs.score_date = latest.max_date
       WHERE cs.score < 60
       ORDER BY cs.score ASC LIMIT ?`;
  const params = storeId ? [storeId, limit] : [limit];
  return all(sql, params);
}

async function getScoreStats() {
  await ensureTables();
  const row = await get(`
    SELECT
      COUNT(DISTINCT employee_id) as employee_count,
      AVG(score) as avg_score,
      MIN(score) as min_score,
      MAX(score) as max_score,
      SUM(CASE WHEN score < 60 THEN 1 ELSE 0 END) as below_threshold
    FROM (
      SELECT employee_id, score FROM compliance_scores
      JOIN (SELECT employee_id, MAX(score_date) as max_date FROM compliance_scores GROUP BY employee_id) latest
      ON compliance_scores.employee_id = latest.employee_id AND compliance_scores.score_date = latest.max_date
    )
  `);
  return row;
}

module.exports = {
  ensureTables,
  IMPACTS,
  INITIAL_SCORE,
  applyScoreImpact,
  onPhotoAuditPassed,
  onRepeatedValuesDetected,
  onMissedLog,
  onMismatchConfirmed,
  onAuditIgnored,
  onNeedsReview,
  getScore,
  getRecentScores,
  getStoreScores,
  getTopOffenders,
  getScoreStats,
};