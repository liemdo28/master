/**
 * CEO Audit Log — records all workflow events for Part 5: Database / Audit
 *
 * Event types:
 *   image_received, image_classified, form_ocr_started, form_ocr_completed,
 *   employee_confirmed, employee_edited, evidence_saved,
 *   mi_called, agent_called, approval_required, approval_completed
 *
 * Each audit row includes:
 *   chat_id, group_id, store_id, sender, message_id,
 *   workflow, event_type, timestamp, status, metadata
 */

const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('ceo-audit');

const EVENT_TYPES = [
  'image_received',
  'image_classified',
  'form_ocr_started',
  'form_ocr_completed',
  'employee_confirmed',
  'employee_edited',
  'evidence_saved',
  'mi_called',
  'agent_called',
  'approval_required',
  'approval_completed',
];

const WORKFLOWS = [
  'food_safety_capture',
  'food_safety_evidence',
  'food_safety_form_photo',
  'mi_executive_assistant',
  'agent_coding',
  'general',
];

/**
 * Record an audit event.
 * @param {object} params
 */
async function recordEvent({
  chatId = '',
  groupId = '',
  storeId = '',
  sender = '',
  senderName = '',
  messageId = '',
  workflow = 'general',
  eventType = '',
  status = 'ok',
  metadata = {},
}) {
  try {
    await ensureTables();
    const eventId = `CE${Date.now().toString(36).toUpperCase()}`;
    await run(
      `INSERT INTO ceo_workflow_audit
       (event_id, chat_id, group_id, store_id, sender, sender_name, message_id,
        workflow, event_type, status, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        eventId,
        chatId || '',
        groupId || '',
        storeId || '',
        sender || '',
        senderName || '',
        messageId || '',
        workflow,
        eventType,
        status,
        JSON.stringify(metadata || {}),
      ]
    );
    log.info('[CEO_AUDIT]', { eventId, workflow, eventType, status });
  } catch (err) {
    log.warn('CEO audit record failed', { error: err.message });
  }
}

// Convenience wrappers for each event type
async function auditImageReceived(metadata = {}) {
  await recordEvent({ ...metadata, eventType: 'image_received', workflow: 'food_safety_capture' });
}
async function auditImageClassified(metadata = {}) {
  await recordEvent({ ...metadata, eventType: 'image_classified', workflow: 'food_safety_capture' });
}
async function auditFormOcrStarted(metadata = {}) {
  await recordEvent({ ...metadata, eventType: 'form_ocr_started', workflow: 'food_safety_form_photo' });
}
async function auditFormOcrCompleted(metadata = {}) {
  await recordEvent({ ...metadata, eventType: 'form_ocr_completed', workflow: 'food_safety_form_photo' });
}
async function auditEmployeeConfirmed(metadata = {}) {
  await recordEvent({ ...metadata, eventType: 'employee_confirmed', workflow: 'food_safety_form_photo', status: 'saved' });
}
async function auditEmployeeEdited(metadata = {}) {
  await recordEvent({ ...metadata, eventType: 'employee_edited', workflow: 'food_safety_form_photo', status: 'edited' });
}
async function auditEvidenceSaved(metadata = {}) {
  await recordEvent({ ...metadata, eventType: 'evidence_saved', workflow: 'food_safety_evidence' });
}
async function auditMiCalled(metadata = {}) {
  await recordEvent({ ...metadata, eventType: 'mi_called', workflow: 'mi_executive_assistant' });
}
async function auditAgentCalled(metadata = {}) {
  await recordEvent({ ...metadata, eventType: 'agent_called', workflow: 'agent_coding' });
}
async function auditApprovalRequired(metadata = {}) {
  await recordEvent({ ...metadata, eventType: 'approval_required', workflow: 'mi_executive_assistant', status: 'pending' });
}
async function auditApprovalCompleted(metadata = {}) {
  await recordEvent({ ...metadata, eventType: 'approval_completed', workflow: 'mi_executive_assistant', status: 'completed' });
}

/**
 * Get audit log with filters.
 */
async function getAuditLog({ workflow, eventType, chatId, sender, limit = 100 } = {}) {
  await ensureTables();
  let sql = `SELECT * FROM ceo_workflow_audit WHERE 1=1`;
  const params = [];
  if (workflow) { sql += ` AND workflow = ?`; params.push(workflow); }
  if (eventType) { sql += ` AND event_type = ?`; params.push(eventType); }
  if (chatId) { sql += ` AND chat_id = ?`; params.push(chatId); }
  if (sender) { sql += ` AND sender = ?`; params.push(sender); }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);
  return all(sql, params);
}

/**
 * Get audit stats.
 */
async function getAuditStats() {
  await ensureTables();
  const row = await get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN event_type = 'image_received' THEN 1 ELSE 0 END) as image_received,
      SUM(CASE WHEN event_type = 'image_classified' THEN 1 ELSE 0 END) as image_classified,
      SUM(CASE WHEN event_type = 'form_ocr_completed' THEN 1 ELSE 0 END) as form_ocr_completed,
      SUM(CASE WHEN event_type = 'employee_confirmed' THEN 1 ELSE 0 END) as employee_confirmed,
      SUM(CASE WHEN event_type = 'employee_edited' THEN 1 ELSE 0 END) as employee_edited,
      SUM(CASE WHEN event_type = 'evidence_saved' THEN 1 ELSE 0 END) as evidence_saved,
      SUM(CASE WHEN event_type = 'mi_called' THEN 1 ELSE 0 END) as mi_called,
      SUM(CASE WHEN event_type = 'agent_called' THEN 1 ELSE 0 END) as agent_called,
      SUM(CASE WHEN event_type = 'approval_required' THEN 1 ELSE 0 END) as approval_required,
      SUM(CASE WHEN event_type = 'approval_completed' THEN 1 ELSE 0 END) as approval_completed,
      MAX(created_at) as last_event_at
    FROM ceo_workflow_audit
  `);
  return row;
}

let tablesOk = false;
async function ensureTables() {
  if (tablesOk) return;
  try {
    await run(`
      CREATE TABLE IF NOT EXISTS ceo_workflow_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL UNIQUE,
        chat_id TEXT,
        group_id TEXT,
        store_id TEXT,
        sender TEXT,
        sender_name TEXT,
        message_id TEXT,
        workflow TEXT NOT NULL,
        event_type TEXT NOT NULL,
        status TEXT DEFAULT 'ok',
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS idx_ceo_audit_workflow ON ceo_workflow_audit(workflow)`).catch(() => {});
    await run(`CREATE INDEX IF NOT EXISTS idx_ceo_audit_event ON ceo_workflow_audit(event_type)`).catch(() => {});
    await run(`CREATE INDEX IF NOT EXISTS idx_ceo_audit_chat ON ceo_workflow_audit(chat_id)`).catch(() => {});
    await run(`CREATE INDEX IF NOT EXISTS idx_ceo_audit_time ON ceo_workflow_audit(created_at)`).catch(() => {});
    tablesOk = true;
    log.info('CEO audit table ready');
  } catch (err) {
    log.warn('CEO audit table init failed', { error: err.message });
  }
}

module.exports = {
  recordEvent,
  auditImageReceived,
  auditImageClassified,
  auditFormOcrStarted,
  auditFormOcrCompleted,
  auditEmployeeConfirmed,
  auditEmployeeEdited,
  auditEvidenceSaved,
  auditMiCalled,
  auditAgentCalled,
  auditApprovalRequired,
  auditApprovalCompleted,
  getAuditLog,
  getAuditStats,
  ensureTables,
  EVENT_TYPES,
  WORKFLOWS,
};
