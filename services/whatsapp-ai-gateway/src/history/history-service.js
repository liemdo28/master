/**
 * History Service (CEO Directive — Historical Log Access)
 * Reads workflow_audit_logs and workflow_edit_history for compliance review.
 * Does NOT write — write operations are in audit-trail.js
 */
const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');
const log = makeLogger('history');

let auditTrail;
try { auditTrail = require('../workflows/audit-trail'); } catch (_) {}

/**
 * Get recent audit logs with optional filters
 */
async function getRecentLogs({ limit = 20, offset = 0, storeId = null, employeeId = null, status = null, workflowType = null, sourceType = null, startDate = null, endDate = null } = {}) {
  const conditions = [];
  const params = [];

  if (storeId) { conditions.push('store_id = ?'); params.push(storeId); }
  if (employeeId) { conditions.push('employee_id = ?'); params.push(employeeId); }
  if (workflowType) { conditions.push('workflow_type = ?'); params.push(workflowType); }
  if (sourceType) { conditions.push("JSON_EXTRACT(original_inputs_json, '$.source_type') = ?"); params.push(sourceType); }
  if (startDate) { conditions.push('confirmed_at >= ?'); params.push(startDate); }
  if (endDate) { conditions.push('confirmed_at <= ?'); params.push(endDate); }

  // Status filtering based on validation + sheet write
  if (status === 'PASS') { conditions.push("(validation_result_json LIKE '%PASS%' AND sheet_write_status = 'SENT')"); }
  if (status === 'WARNING') { conditions.push("(validation_result_json LIKE '%FAIL%' OR validation_result_json LIKE '%WARNING%')"); }
  if (status === 'QUEUED') { conditions.push("sheet_write_status = 'QUEUED'"); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT id, session_id, workflow_type, store_id, store_name, employee_id, employee_name, employee_language, sheet_write_status, manager_alert_status, source_type, created_at, confirmed_at FROM workflow_audit_logs ${where} ORDER BY confirmed_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  return all(sql, params);
}

/**
 * Get one audit log with full detail (payload + validation)
 */
async function getLogDetail(auditLogId) {
  const id = parseInt(auditLogId, 10);
  if (isNaN(id)) return null;
  if (auditTrail) {
    return auditTrail.getAuditLogWithEdits(id);
  }
  // fallback if audit-trail not available
  const row = await get(`SELECT * FROM workflow_audit_logs WHERE id = ?`, [id]);
  if (!row) return null;
  row.edits = await all(`SELECT * FROM workflow_edit_history WHERE audit_log_id = ? ORDER BY edited_at ASC`, [id]);
  return row;
}

/**
 * Get edit history for a log
 */
async function getEditHistoryForLog(auditLogId) {
  const id = parseInt(auditLogId, 10);
  return all(`SELECT * FROM workflow_edit_history WHERE audit_log_id = ? ORDER BY edited_at ASC`, [id]);
}

/**
 * Who recorded a specific item on a specific date
 */
async function getWhoRecorded({ storeId = null, itemName = null, date = null }) {
  // Get all logs for the date (optionally filtered by store)
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const start = targetDate + 'T00:00:00.000Z';
  const end = targetDate + 'T23:59:59.999Z';

  const conditions = ['confirmed_at >= ?', 'confirmed_at <= ?'];
  const params = [start, end];
  if (storeId) { conditions.push('store_id = ?'); params.push(storeId); }

  const logs = await all(
    `SELECT * FROM workflow_audit_logs WHERE ${conditions.join(' AND ')} ORDER BY confirmed_at ASC`,
    params
  );

  // Filter by item if specified
  const results = [];
  for (const l of logs) {
    try {
      const payload = JSON.parse(l.final_payload_json || '{}');
      const items = Array.isArray(payload.items) ? payload.items
        : typeof payload === 'object' ? [payload] : [];
      if (!itemName) {
        results.push(l);
      } else {
        const match = items.find(i => (i.item || i.name || '') === itemName);
        if (match) results.push(l);
      }
    } catch (_) {}
  }

  return results.map(l => {
    let itemValue = null;
    try {
      const payload = JSON.parse(l.final_payload_json || '{}');
      const items = Array.isArray(payload.items) ? payload.items : [payload];
      const match = items.find(i => !itemName || (i.item || i.name || '') === itemName);
      if (match) itemValue = match.value ?? match.count ?? null;
    } catch (_) {}

    let status = 'UNKNOWN';
    try {
      const vr = JSON.parse(l.validation_result_json || '{}');
      if (vr.failCount > 0 || vr.warningCount > 0) status = 'WARNING';
      else if (vr.status === 'PASS') status = 'PASS';
      else status = 'PASS';
    } catch (_) {}

    return {
      audit_log_id: l.id,
      store_id: l.store_id,
      store_name: l.store_name,
      employee_id: l.employee_id,
      employee_name: l.employee_name,
      item_value: itemValue,
      status,
      confirmed_at: l.confirmed_at,
      sheet_write_status: l.sheet_write_status,
    };
  });
}

/**
 * Daily summary for one date
 */
async function getDailySummary(date = null) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const start = targetDate + 'T00:00:00.000Z';
  const end = targetDate + 'T23:59:59.999Z';

  const rows = await all(
    `SELECT
       store_id, store_name, workflow_type,
       COUNT(*) as submission_count,
       SUM(CASE WHEN manager_alert_status = 'SENT' THEN 1 ELSE 0 END) as alert_count,
       MAX(confirmed_at) as last_confirmed_at,
       GROUP_CONCAT(CASE WHEN validation_result_json LIKE '%FAIL%' THEN store_name ELSE NULL END) as warning_stores
     FROM workflow_audit_logs
     WHERE confirmed_at >= ? AND confirmed_at <= ?
     GROUP BY store_id, workflow_type
     ORDER BY store_name ASC`,
    [start, end]
  );

  return rows.map(r => ({
    ...r,
    warning_stores: r.warning_stores || '',
    last_confirmed_at: r.last_confirmed_at || null,
  }));
}

/**
 * Weekly summary (ISO week)
 */
async function getWeeklySummary(yearWeek = null) {
  // Parse YYYY-WW format or default to current week
  let startDate, endDate;
  if (yearWeek) {
    const [year, week] = yearWeek.split('-').map(Number);
    const jan1 = new Date(year, 0, 1);
    const dayOffset = (week - 1) * 7;
    startDate = new Date(jan1.getTime() + dayOffset * 86400000);
    endDate = new Date(startDate.getTime() + 6 * 86400000);
  } else {
    const now = new Date();
    const day = now.getDay();
    startDate = new Date(now.getTime() - (day === 0 ? 6 : day - 1) * 86400000);
    endDate = new Date(startDate.getTime() + 6 * 86400000);
  }

  const start = startDate.toISOString().slice(0, 10);
  const end = endDate.toISOString().slice(0, 10);

  const rows = await all(
    `SELECT
       store_id, store_name,
       COUNT(*) as total_entries,
       SUM(CASE WHEN manager_alert_status = 'SENT' THEN 1 ELSE 0 END) as manager_alerts,
       SUM(CASE WHEN sheet_write_status = 'SENT' THEN 1 ELSE 0 END) as sheet_written,
       SUM(CASE WHEN sheet_write_status IN ('QUEUED','PENDING') THEN 1 ELSE 0 END) as sheet_pending,
       MAX(confirmed_at) as last_entry
     FROM workflow_audit_logs
     WHERE confirmed_at >= ? AND confirmed_at <= ?
     GROUP BY store_id
     ORDER BY store_name ASC`,
    [start + 'T00:00:00.000Z', end + 'T23:59:59.999Z']
  );

  return { startDate: start, endDate: end, entries: rows };
}

/**
 * Export logs as CSV rows (one row per item in payload)
 */
async function exportLogsAsRows({ storeId = null, startDate = null, endDate = null, limit = 1000 } = {}) {
  const conditions = [];
  const params = [];
  if (storeId) { conditions.push('store_id = ?'); params.push(storeId); }
  if (startDate) { conditions.push('confirmed_at >= ?'); params.push(startDate); }
  if (endDate) { conditions.push('confirmed_at <= ?'); params.push(endDate); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const logs = await all(
    `SELECT * FROM workflow_audit_logs ${where} ORDER BY confirmed_at DESC LIMIT ?`,
    [...params, limit]
  );

  const rows = [];
  for (const log of logs) {
    try {
      const payload = JSON.parse(log.final_payload_json || '{}');
      const items = Array.isArray(payload.items) ? payload.items : [payload];
      for (const item of items) {
        if (!item || (item.item == null && item.name == null && item.count == null)) continue;
        let validation = {};
        try { validation = JSON.parse(log.validation_result_json || '{}'); } catch (_) {}
        const failure = validation.failures?.find(f => (f.name || f.item || '') === (item.item || item.name || '')) || null;
        rows.push({
          timestamp: log.confirmed_at || log.created_at,
          store: log.store_name || '',
          employee: log.employee_name || '',
          phone: log.employee_id || '',
          workflow: log.workflow_type || '',
          item: item.item || item.name || '',
          original_value: item.original_value || null,
          final_value: item.value ?? item.count ?? null,
          target_min: item.target_min ?? item.min ?? null,
          target_max: item.target_max ?? item.max ?? null,
          status: item.status || failure ? (failure?.reason?.includes('above') ? 'FAIL_HIGH' : 'FAIL_LOW') : 'PASS',
          warning: failure ? `${failure.name || failure.item}: ${failure.value}${failure.target}` : '',
          edited: log.edits_json && log.edits_json !== '[]' ? 'YES' : 'NO',
          edited_by: (() => {
            try {
              const edits = JSON.parse(log.edits_json || '[]');
              return edits.find(e => (e.item || '') === (item.item || item.name || ''))?.edited_by || '';
            } catch (_) { return ''; }
          })(),
          sheet_status: log.sheet_write_status || '',
          manager_alert: log.manager_alert_status || '',
          source_type: log.source_type || '',
        });
      }
    } catch (err) {
      log.warn('Failed to parse audit log for export', { auditLogId: log.id, error: err.message });
    }
  }
  return rows;
}

/**
 * Get counts per status for dashboard display
 */
async function getHistoryStats() {
  const total = await get('SELECT COUNT(*) as c FROM workflow_audit_logs');
  const pass = await get("SELECT COUNT(*) as c FROM workflow_audit_logs WHERE validation_result_json LIKE '%PASS%' AND sheet_write_status = 'SENT'");
  const warning = await get("SELECT COUNT(*) as c FROM workflow_audit_logs WHERE validation_result_json LIKE '%FAIL%' OR validation_result_json LIKE '%WARNING%'");
  const queued = await get("SELECT COUNT(*) as c FROM workflow_audit_logs WHERE sheet_write_status IN ('QUEUED','PENDING')");
  const missingToday = await get("SELECT COUNT(*) as c FROM workflow_audit_logs WHERE confirmed_at < datetime('now', 'start of day')");
  const lastLog = await get('SELECT MAX(confirmed_at) as last_at FROM workflow_audit_logs');
  return {
    total: total?.c || 0,
    pass: pass?.c || 0,
    warning: warning?.c || 0,
    queued: queued?.c || 0,
    missingToday: missingToday?.c || 0,
    lastLogAt: lastLog?.last_at || null,
  };
}

/**
 * List of stores that have submitted today (for "missing" detection)
 */
async function getStoresSubmittedToday() {
  const today = new Date().toISOString().slice(0, 10);
  return all(
    `SELECT DISTINCT store_id, store_name, MAX(confirmed_at) as last_confirmed
     FROM workflow_audit_logs
     WHERE confirmed_at >= ?
     GROUP BY store_id, store_name`,
    [today + 'T00:00:00.000Z']
  );
}

module.exports = {
  getRecentLogs,
  getLogDetail,
  getEditHistoryForLog,
  getWhoRecorded,
  getDailySummary,
  getWeeklySummary,
  exportLogsAsRows,
  getHistoryStats,
  getStoresSubmittedToday,
};