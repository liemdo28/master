/**
 * Incident Sheet Writer
 * 
 * Writes confirmed incident reports to Google Sheets.
 * 
 * Tab: Incident_Log
 * 
 * If sheet write fails → queue it (never lose data).
 */

const sheetsClient = require('../google/sheets-client');
const incidentReportService = require('./incident-report-service');
const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('incidents');

const TAB_NAME = 'Incident_Log';
const COLUMNS = [
  'Timestamp',
  'Incident ID',
  'Store',
  'Group',
  'Reported By',
  'Category',
  'Severity',
  'Area',
  'Description',
  'Recommended Action',
  'Confidence',
  'Image Path',
  'Status',
  'Manager Alert Sent',
  'Notes',
];

function isEnabled() {
  return process.env.GOOGLE_SHEETS_ENABLED === 'true';
}

// ── Queue ──────────────────────────────────────────────────────────────────────
let queueInitialized = false;

async function ensureQueueTables() {
  if (queueInitialized) return;
  await run(`
    CREATE TABLE IF NOT EXISTS incident_sheet_queue (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id     TEXT NOT NULL,
      payload_json    TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'PENDING',
      attempt_count   INTEGER NOT NULL DEFAULT 0,
      last_error      TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      sent_at         TEXT
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_incident_queue_status ON incident_sheet_queue(status)`);
  queueInitialized = true;
}

// ── Write single incident ───────────────────────────────────────────────────────
async function writeIncidentToSheet(incident) {
  if (!isEnabled()) {
    await enqueueIncident(incident.incident_id, incident, 'Google Sheets disabled');
    return { status: 'QUEUED', reason: 'Google Sheets disabled' };
  }

  const row = buildRow(incident);
  try {
    await sheetsClient.appendValues({ tab: TAB_NAME, values: [row] });
    return { status: 'SENT', tab: TAB_NAME };
  } catch (err) {
    log.warn('Incident sheet write failed — queued for retry', { incidentId: incident.incident_id, error: err.message });
    await enqueueIncident(incident.incident_id, incident, err.message);
    return { status: 'QUEUED', reason: err.message };
  }
}

async function enqueueIncident(incidentId, incident, lastError = '') {
  await ensureQueueTables();
  await run(
    `INSERT INTO incident_sheet_queue (incident_id, payload_json, status, attempt_count, last_error)
     VALUES (?, ?, 'PENDING', 0, ?)`,
    [incidentId, JSON.stringify(incident), lastError || '']
  );
  log.info('Incident sheet write queued', { incidentId });
}

// ── Retry pending ───────────────────────────────────────────────────────────
async function retryPending(limit = 10) {
  await ensureQueueTables();
  const rows = await all(
    `SELECT * FROM incident_sheet_queue WHERE status IN ('PENDING', 'FAILED') ORDER BY created_at ASC LIMIT ?`,
    [limit]
  );

  const results = [];
  for (const row of rows) {
    try {
      const incident = JSON.parse(row.payload_json || '{}');
      const sheetRow = buildRow(incident);
      await sheetsClient.appendValues({ tab: TAB_NAME, values: [sheetRow] });
      await run(`UPDATE incident_sheet_queue SET status = 'SENT', sent_at = datetime('now') WHERE id = ?`, [row.id]);
      results.push({ id: row.id, status: 'SENT' });
      log.info('Incident sheet retry success', { id: row.id });
    } catch (err) {
      await run(
        `UPDATE incident_sheet_queue SET status = 'FAILED', last_error = ?, attempt_count = attempt_count + 1 WHERE id = ?`,
        [err.message, row.id]
      );
      results.push({ id: row.id, status: 'FAILED', error: err.message });
      log.warn('Incident sheet retry failed', { id: row.id, error: err.message });
    }
  }
  return results;
}

// ── Build row ─────────────────────────────────────────────────────────────────
function buildRow(incident) {
  return [
    incident.created_at || new Date().toISOString(),
    incident.incident_id || '',
    incident.store_name || incident.store || '',
    incident.group_name || incident.group_chat_id || '',
    incident.reported_by_name || incident.reported_by_id || '',
    incident.category || '',
    incident.severity || '',
    incident.store_area || '',
    incident.description || '',
    incident.recommended_action || '',
    incident.confidence != null ? String(incident.confidence) : '',
    incident.image_path || '',
    incident.status || '',
    incident.manager_alert_sent ? 'YES' : 'NO',
    '',
  ];
}

// ── Update manager alert status ───────────────────────────────────────────────
async function markManagerAlertSent(incidentId) {
  await run(
    `UPDATE incident_reports SET manager_alert_sent = 1 WHERE incident_id = ?`,
    [incidentId]
  ).catch(() => {});
}

// ── Get queue stats ─────────────────────────────────────────────────────────────
async function getQueueStats() {
  await ensureQueueTables();
  const s = await get(`
    SELECT
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count,
      MAX(sent_at) as last_sent_at
    FROM incident_sheet_queue
  `);
  return s;
}

module.exports = {
  TAB_NAME,
  COLUMNS,
  isEnabled,
  writeIncidentToSheet,
  retryPending,
  markManagerAlertSent,
  getQueueStats,
};