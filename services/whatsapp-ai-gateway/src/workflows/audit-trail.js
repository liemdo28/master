/**
 * Audit Trail Service
 *
 * Tracks every confirmed workflow for compliance and debugging.
 * Captures: original inputs, edits, final payload, validation, sheet write, manager alert.
 *
 * Tables:
 *   workflow_audit_logs    — one row per confirmed workflow
 *   workflow_edit_history  — one row per EDIT before CONFIRM
 */

const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('whatsapp');

let initialized = false;

// ── Schema ──────────────────────────────────────────────────────────────────
async function ensureTables() {
  if (initialized) return;
  await run(`
    CREATE TABLE IF NOT EXISTS workflow_audit_logs (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id          TEXT,
      workflow_type        TEXT NOT NULL,
      store_id             TEXT,
      store_name           TEXT,
      group_chat_id        TEXT,
      group_name           TEXT,
      employee_id          TEXT,
      employee_name        TEXT,
      employee_language    TEXT DEFAULT 'en',
      original_inputs_json TEXT,
      edits_json           TEXT,
      final_payload_json   TEXT,
      validation_result_json TEXT,
      sheet_write_status   TEXT DEFAULT 'PENDING',
      manager_alert_status TEXT DEFAULT 'NOT_SENT',
      created_at           TEXT DEFAULT (datetime('now')),
      confirmed_at         TEXT
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_audit_store ON workflow_audit_logs(store_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_audit_confirmed ON workflow_audit_logs(confirmed_at)`);

  await run(`
    CREATE TABLE IF NOT EXISTS workflow_edit_history (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_log_id    INTEGER NOT NULL,
      item_name       TEXT NOT NULL,
      old_value       TEXT,
      new_value       TEXT,
      edited_by       TEXT,
      edited_at       TEXT DEFAULT (datetime('now'))
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_edit_audit ON workflow_edit_history(audit_log_id)`);

  initialized = true;
}

// ── Create audit log (called before CONFIRM is processed) ────────────────────
async function createAuditLog({
  sessionId,
  workflowType,
  storeId,
  storeName,
  groupChatId,
  groupName,
  employeeId,
  employeeName,
  employeeLanguage = 'en',
  originalInputs = {},
  edits = [],
  finalPayload = {},
  validationResult = null,
  sheetWriteStatus = 'PENDING',
  managerAlertStatus = 'NOT_SENT',
}) {
  await ensureTables();
  const confirmedAt = new Date().toISOString();
  const result = await run(
    `INSERT INTO workflow_audit_logs
     (session_id, workflow_type, store_id, store_name, group_chat_id, group_name,
      employee_id, employee_name, employee_language, original_inputs_json,
      edits_json, final_payload_json, validation_result_json, sheet_write_status,
      manager_alert_status, created_at, confirmed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),?)`,
    [
      sessionId || '',
      workflowType || 'daily_entry',
      storeId || '',
      storeName || '',
      groupChatId || '',
      groupName || '',
      employeeId || '',
      employeeName || '',
      employeeLanguage || 'en',
      JSON.stringify(originalInputs),
      JSON.stringify(edits),
      JSON.stringify(finalPayload),
      validationResult ? JSON.stringify(validationResult) : '{}',
      sheetWriteStatus || 'PENDING',
      managerAlertStatus || 'NOT_SENT',
      confirmedAt,
    ]
  );
  log.info('Audit log created', { auditLogId: result.lastID, workflowType, storeName, employeeName });

  // Phase F/G: Mirror each final value to measurement_records as HUMAN_WHATSAPP
  // so cross-validation can find it. Non-blocking — failures are logged.
  try {
    const measurementSvc = require('../compliance/measurement-records');
    await measurementSvc.ensureSchema();
    const fp = finalPayload || {};
    const items = Array.isArray(fp.items) ? fp.items : [];
    if (items.length) {
      for (const it of items) {
        if (it && (it.name || it.item_name) && it.value != null && it.value !== '') {
          await measurementSvc.record({
            storeId: storeId || null,
            storeName: storeName || null,
            itemName: it.name || it.item_name,
            sourceType: 'HUMAN_WHATSAPP',
            sourceRefId: String(result.lastID),
            value: parseFloat(it.value),
            unit: it.unit || 'F',
            confidence: null,
            status: it.status || (validationResult?.failures?.some(f => f.name === (it.name || it.item_name)) ? 'OUT_OF_RANGE' : 'PENDING'),
            rawPayload: { employeeId, employeeName, sessionId, employeeLanguage },
          });
        }
      }
    }
  } catch (err) {
    log.warn('Failed to mirror final values to measurement_records', { error: err.message });
  }

  return result.lastID;
}

// ── Record edit ──────────────────────────────────────────────────────────────
async function recordEdit({ auditLogId, itemName, oldValue, newValue, editedBy = '' }) {
  await ensureTables();
  await run(
    `INSERT INTO workflow_edit_history (audit_log_id, item_name, old_value, new_value, edited_by)
     VALUES (?,?,?,?,?)`,
    [auditLogId, itemName, String(oldValue ?? ''), String(newValue ?? ''), editedBy]
  );
  log.info('Edit recorded', { auditLogId, itemName, oldValue, newValue });
}

// ── Update after CONFIRM ──────────────────────────────────────────────────────
async function markConfirmed(auditLogId, { sheetWriteStatus, managerAlertStatus, finalPayload, validationResult }) {
  await ensureTables();
  const updates = [];
  const values = [];
  if (sheetWriteStatus) { updates.push('sheet_write_status = ?'); values.push(sheetWriteStatus); }
  if (managerAlertStatus) { updates.push('manager_alert_status = ?'); values.push(managerAlertStatus); }
  if (finalPayload) { updates.push('final_payload_json = ?'); values.push(JSON.stringify(finalPayload)); }
  if (validationResult) { updates.push('validation_result_json = ?'); values.push(JSON.stringify(validationResult)); }
  if (updates.length === 0) return;
  values.push(auditLogId);
  await run(`UPDATE workflow_audit_logs SET ${updates.join(', ')} WHERE id = ?`, values);
}

// ── Query ────────────────────────────────────────────────────────────────────
async function getAuditLogs({ storeId = null, limit = 20 } = {}) {
  await ensureTables();
  const sql = storeId
    ? `SELECT * FROM workflow_audit_logs WHERE store_id = ? ORDER BY confirmed_at DESC LIMIT ?`
    : `SELECT * FROM workflow_audit_logs ORDER BY confirmed_at DESC LIMIT ?`;
  const params = storeId ? [storeId, limit] : [limit];
  return all(sql, params);
}

async function getAuditLogWithEdits(auditLogId) {
  await ensureTables();
  const log = await get(`SELECT * FROM workflow_audit_logs WHERE id = ?`, [auditLogId]);
  if (!log) return null;
  log.edits = await all(`SELECT * FROM workflow_edit_history WHERE audit_log_id = ? ORDER BY edited_at ASC`, [auditLogId]);
  return log;
}

async function getEditHistory(auditLogId) {
  await ensureTables();
  return all(`SELECT * FROM workflow_edit_history WHERE audit_log_id = ? ORDER BY edited_at ASC`, [auditLogId]);
}

// ── Stats ────────────────────────────────────────────────────────────────────
async function getAuditStats() {
  await ensureTables();
  const counts = await get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN sheet_write_status = 'SENT' THEN 1 ELSE 0 END) as sheet_written,
      SUM(CASE WHEN sheet_write_status = 'PENDING' THEN 1 ELSE 0 END) as sheet_pending,
      SUM(CASE WHEN sheet_write_status = 'QUEUED' THEN 1 ELSE 0 END) as sheet_queued,
      SUM(CASE WHEN manager_alert_status = 'SENT' THEN 1 ELSE 0 END) as manager_alerts_sent,
      MAX(confirmed_at) as last_confirmed_at
    FROM workflow_audit_logs
  `);
  return counts;
}

async function getStoreSummary(storeId) {
  await ensureTables();
  const rows = await all(
    `SELECT store_name, workflow_type, confirmed_at, sheet_write_status, manager_alert_status
     FROM workflow_audit_logs WHERE store_id = ? ORDER BY confirmed_at DESC LIMIT 50`,
    [storeId]
  );
  return rows;
}

// ── Daily health helper ─────────────────────────────────────────────────────
async function getTodayAuditSummary() {
  await ensureTables();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await all(
    `SELECT
       store_id,
       store_name,
       workflow_type,
       COUNT(*) as submission_count,
       SUM(CASE WHEN manager_alert_status = 'SENT' THEN 1 ELSE 0 END) as alert_count,
       MAX(confirmed_at) as last_confirmed_at
     FROM workflow_audit_logs
     WHERE confirmed_at >= ?
     GROUP BY store_id, workflow_type
     ORDER BY store_name ASC`,
    [today + 'T00:00:00.000Z']
  );
  return rows;
}

module.exports = {
  ensureTables,
  createAuditLog,
  recordEdit,
  markConfirmed,
  getAuditLogs,
  getAuditLogWithEdits,
  getEditHistory,
  getAuditStats,
  getStoreSummary,
  getTodayAuditSummary,
};