/**
 * Photo Audit Sheet Writer
 * 
 * Writes completed photo audit results to Google Sheets.
 * 
 * Tab: Photo_Audit_Log
 */

const sheetsClient = require('../google/sheets-client');
const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('compliance');

const TAB_NAME = 'Photo_Audit_Log';
const COLUMNS = [
  'Timestamp',
  'Audit ID',
  'Store',
  'Employee',
  'Item',
  'Entered Value',
  'Photo Reading',
  'Difference',
  'Status',
  'Image Path',
  'Confidence',
  'Manager Alert Sent',
  'Resolution',
  'Notes',
];

function isEnabled() {
  return process.env.GOOGLE_SHEETS_ENABLED === 'true';
}

// ── Queue ─────────────────────────────────────────────────────────────────────
let queueInitialized = false;

async function ensureQueueTables() {
  if (queueInitialized) return;
  await run(`
    CREATE TABLE IF NOT EXISTS photo_audit_sheet_queue (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id        TEXT NOT NULL,
      payload_json    TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'PENDING',
      attempt_count   INTEGER NOT NULL DEFAULT 0,
      last_error      TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      sent_at         TEXT
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_photo_audit_queue ON photo_audit_sheet_queue(status)`);
  queueInitialized = true;
}

async function enqueueAudit(auditId, auditRecord, lastError = '') {
  await ensureQueueTables();
  await run(
    `INSERT INTO photo_audit_sheet_queue (audit_id, payload_json, status, attempt_count, last_error)
     VALUES (?, ?, 'PENDING', 0, ?)`,
    [auditId, JSON.stringify(auditRecord), lastError || '']
  );
  log.info('Photo audit sheet queued', { auditId });
}

// ── Write ─────────────────────────────────────────────────────────────────────
async function writeAuditToSheet(auditRecord) {
  if (!isEnabled()) {
    await enqueueAudit(auditRecord.audit_id, auditRecord, 'Google Sheets disabled');
    return { status: 'QUEUED', reason: 'Google Sheets disabled' };
  }

  const row = buildRow(auditRecord);
  try {
    await sheetsClient.appendValues({ tab: TAB_NAME, values: [row] });
    return { status: 'SENT', tab: TAB_NAME };
  } catch (err) {
    log.warn('Photo audit sheet write failed — queued', { auditId: auditRecord.audit_id, error: err.message });
    await enqueueAudit(auditRecord.audit_id, auditRecord, err.message);
    return { status: 'QUEUED', reason: err.message };
  }
}

// ── Retry ─────────────────────────────────────────────────────────────────────
async function retryPending(limit = 10) {
  await ensureQueueTables();
  const rows = await all(
    `SELECT * FROM photo_audit_sheet_queue WHERE status IN ('PENDING', 'FAILED') ORDER BY created_at ASC LIMIT ?`,
    [limit]
  );

  const results = [];
  for (const row of rows) {
    try {
      const record = JSON.parse(row.payload_json || '{}');
      const sheetRow = buildRow(record);
      await sheetsClient.appendValues({ tab: TAB_NAME, values: [sheetRow] });
      await run(`UPDATE photo_audit_sheet_queue SET status = 'SENT', sent_at = datetime('now') WHERE id = ?`, [row.id]);
      results.push({ id: row.id, status: 'SENT' });
    } catch (err) {
      await run(
        `UPDATE photo_audit_sheet_queue SET status = 'FAILED', last_error = ?, attempt_count = attempt_count + 1 WHERE id = ?`,
        [err.message, row.id]
      );
      results.push({ id: row.id, status: 'FAILED', error: err.message });
    }
  }
  return results;
}

// ── Build row ─────────────────────────────────────────────────────────────────
function buildRow(audit) {
  return [
    audit.created_at || new Date().toISOString(),
    audit.audit_id || '',
    audit.store_name || audit.store || '',
    audit.employee_name || audit.employee_id || '',
    audit.item_name || '',
    audit.entered_value != null ? String(audit.entered_value) : '',
    audit.observed_value != null ? String(audit.observed_value) : '',
    audit.difference != null ? String(audit.difference) : '',
    audit.status || '',
    audit.image_path || '',
    audit.confidence || '',
    audit.manager_alert_sent ? 'YES' : 'NO',
    audit.resolution || '',
    '',
  ];
}

module.exports = {
  TAB_NAME,
  COLUMNS,
  isEnabled,
  writeAuditToSheet,
  retryPending,
};