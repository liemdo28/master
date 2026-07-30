/**
 * Incident Report Service
 * 
 * Creates, updates, and queries incident reports.
 * 
 * SQLite tables:
 *   incident_reports  — one row per confirmed incident
 *   incident_actions   — action history (confirmed/ignored/escalated/closed)
 */

const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('incidents');

let initialized = false;

// Status constants
const STATUS = {
  DETECTED: 'DETECTED',
  CONFIRMED: 'CONFIRMED',
  IGNORED: 'IGNORED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  ESCALATED: 'ESCALATED',
  CLOSED: 'CLOSED',
};

// ── Schema ────────────────────────────────────────────────────────────────────
async function ensureTables() {
  if (initialized) return;

  await run(`
    CREATE TABLE IF NOT EXISTS incident_reports (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id         TEXT NOT NULL UNIQUE,
      store_id             TEXT,
      store_name           TEXT,
      group_chat_id        TEXT,
      group_name           TEXT,
      reported_by_id       TEXT,
      reported_by_name     TEXT,
      language             TEXT DEFAULT 'en',
      image_path           TEXT,
      category             TEXT,
      severity             TEXT,
      confidence           REAL,
      store_area           TEXT,
      description          TEXT,
      recommended_action   TEXT,
      status               TEXT DEFAULT 'DETECTED',
      created_at           TEXT DEFAULT (datetime('now')),
      confirmed_at         TEXT,
      closed_at            TEXT
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_incident_status ON incident_reports(status)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_incident_store ON incident_reports(store_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_incident_created ON incident_reports(created_at)`);

  await run(`
    CREATE TABLE IF NOT EXISTS incident_actions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id     TEXT NOT NULL,
      action_type     TEXT NOT NULL,
      actor_id        TEXT,
      actor_name      TEXT,
      notes           TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_action_incident ON incident_actions(incident_id)`);

  initialized = true;
  log.info('Incident tables ready');
}

// ── Create ─────────────────────────────────────────────────────────────────────

/**
 * Create a new incident report (detected state, pending confirmation).
 */
async function createIncident({
  incidentId,
  storeId = '',
  storeName = '',
  groupChatId = '',
  groupName = '',
  reportedById = '',
  reportedByName = '',
  language = 'en',
  imagePath = '',
  category = '',
  severity = '',
  confidence = 0,
  storeArea = '',
  description = '',
  recommendedAction = '',
}) {
  await ensureTables();

  const id = await run(
    `INSERT INTO incident_reports
     (incident_id, store_id, store_name, group_chat_id, group_name,
      reported_by_id, reported_by_name, language, image_path, category, severity,
      confidence, store_area, description, recommended_action, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      incidentId,
      storeId,
      storeName,
      groupChatId,
      groupName,
      reportedById,
      reportedByName,
      language,
      imagePath,
      category,
      severity,
      confidence,
      storeArea,
      description,
      recommendedAction,
      STATUS.DETECTED,
    ]
  );

  await recordAction(incidentId, 'DETECTED', reportedById, reportedByName, 'Incident detected from image');
  log.info('Incident report created', { incidentId, category, severity });
  return id.lastID;
}

/**
 * Confirm an incident (staff replied YES).
 */
async function confirmIncident(incidentId, confirmedById = '', confirmedByName = '') {
  await ensureTables();
  await run(
    `UPDATE incident_reports SET status = ?, confirmed_at = datetime('now') WHERE incident_id = ?`,
    [STATUS.CONFIRMED, incidentId]
  );
  await recordAction(incidentId, 'CONFIRMED', confirmedById, confirmedByName, 'Staff confirmed incident report');
  log.info('Incident confirmed', { incidentId });
}

// ── Update ─────────────────────────────────────────────────────────────────────

/**
 * Ignore an incident (staff replied NO).
 */
async function ignoreIncident(incidentId, ignoredById = '', ignoredByName = '', reason = '') {
  await ensureTables();
  await run(
    `UPDATE incident_reports SET status = ? WHERE incident_id = ?`,
    [STATUS.IGNORED, incidentId]
  );
  await recordAction(incidentId, 'IGNORED', ignoredById, ignoredByName, reason || 'Staff ignored incident report');
  log.info('Incident ignored', { incidentId });
}

/**
 * Mark an incident as needs review (staff did not respond within timeout).
 */
async function markNeedsReview(incidentId, reason = 'Timeout — no response') {
  await ensureTables();
  await run(
    `UPDATE incident_reports SET status = ? WHERE incident_id = ? AND status = ?`,
    [STATUS.NEEDS_REVIEW, incidentId, STATUS.DETECTED]
  );
  await recordAction(incidentId, 'NEEDS_REVIEW', 'SYSTEM', 'System', reason);
  log.info('Incident marked needs review', { incidentId });
}

/**
 * Escalate an incident (manager triggered).
 */
async function escalateIncident(incidentId, escalatedById = '', escalatedByName = '', reason = '') {
  await ensureTables();
  await run(
    `UPDATE incident_reports SET status = ? WHERE incident_id = ?`,
    [STATUS.ESCALATED, incidentId]
  );
  await recordAction(incidentId, 'ESCALATED', escalatedById, escalatedByName, reason || 'Manager escalated incident');
  log.info('Incident escalated', { incidentId });
}

/**
 * Close an incident (manager resolved).
 */
async function closeIncident(incidentId, closedById = '', closedByName = '', notes = '') {
  await ensureTables();
  await run(
    `UPDATE incident_reports SET status = ?, closed_at = datetime('now') WHERE incident_id = ?`,
    [STATUS.CLOSED, incidentId]
  );
  await recordAction(incidentId, 'CLOSED', closedById, closedByName, notes || 'Incident resolved');
  log.info('Incident closed', { incidentId });
}

/**
 * Update an incident (staff edited category/severity via EDIT).
 */
async function updateIncident(incidentId, updates = {}) {
  await ensureTables();
  const allowed = ['category', 'severity', 'store_area', 'description', 'recommended_action'];
  const setParts = [];
  const values = [];

  for (const [key, val] of Object.entries(updates)) {
    if (allowed.includes(key)) {
      setParts.push(`${key} = ?`);
      values.push(val);
    }
  }

  if (setParts.length === 0) return;

  values.push(incidentId);
  await run(`UPDATE incident_reports SET ${setParts.join(', ')} WHERE incident_id = ?`, values);
  await recordAction(incidentId, 'EDITED', 'STAFF', 'Staff', `Updated: ${Object.keys(updates).join(', ')}`);
  log.info('Incident updated', { incidentId, updates: Object.keys(updates) });
}

// ── Record action ───────────────────────────────────────────────────────────────

async function recordAction(incidentId, actionType, actorId = '', actorName = '', notes = '') {
  await ensureTables();
  await run(
    `INSERT INTO incident_actions (incident_id, action_type, actor_id, actor_name, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [incidentId, actionType, actorId, actorName, notes]
  );
}

// ── Query ──────────────────────────────────────────────────────────────────────

async function getIncident(incidentId) {
  await ensureTables();
  return get(`SELECT * FROM incident_reports WHERE incident_id = ?`, [incidentId]);
}

async function getIncidentsByStatus(status, limit = 50) {
  await ensureTables();
  return all(`SELECT * FROM incident_reports WHERE status = ? ORDER BY created_at DESC LIMIT ?`, [status, limit]);
}

async function getRecentIncidents(limit = 20) {
  await ensureTables();
  return all(`SELECT * FROM incident_reports ORDER BY created_at DESC LIMIT ?`, [limit]);
}

async function getOpenIncidents() {
  await ensureTables();
  return all(
    `SELECT * FROM incident_reports WHERE status IN (?, ?, ?) ORDER BY created_at DESC`,
    [STATUS.DETECTED, STATUS.NEEDS_REVIEW, STATUS.ESCALATED]
  );
}

async function getIncidentActions(incidentId) {
  await ensureTables();
  return all(`SELECT * FROM incident_actions WHERE incident_id = ? ORDER BY created_at ASC`, [incidentId]);
}

async function getIncidentStats() {
  await ensureTables();
  const row = await get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'DETECTED' THEN 1 ELSE 0 END) as detected,
      SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'NEEDS_REVIEW' THEN 1 ELSE 0 END) as needs_review,
      SUM(CASE WHEN status = 'ESCALATED' THEN 1 ELSE 0 END) as escalated,
      SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as closed,
      SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) as high_severity,
      SUM(CASE WHEN severity = 'MEDIUM' THEN 1 ELSE 0 END) as medium_severity,
      MAX(created_at) as last_incident_at
    FROM incident_reports
  `);
  return row;
}

module.exports = {
  ensureTables,
  STATUS,
  createIncident,
  confirmIncident,
  ignoreIncident,
  markNeedsReview,
  escalateIncident,
  closeIncident,
  updateIncident,
  getIncident,
  getIncidentsByStatus,
  getRecentIncidents,
  getOpenIncidents,
  getIncidentActions,
  getIncidentStats,
};