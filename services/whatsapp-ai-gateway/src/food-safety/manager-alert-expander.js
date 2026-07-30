/**
 * Manager Alert Expander — Phase 4
 *
 * Automatically alerts manager for:
 *   - Unsafe temperature confirmed
 *   - Missing required field
 *   - Low OCR confidence on confirm
 *   - Multiple retakes (3+ per employee per shift)
 *   - Manager Review requested
 *   - Missing daily submission (by configured cutoff time)
 *   - Duplicate suspicious form
 *
 * Alerts go to MANAGER_ALERT_GROUP_CHAT_ID.
 * Deduplication: same issue type within 5 min per store.
 */

const { makeLogger } = require('../logger');
const { run, all, get } = require('../storage/sqlite');
const replyService = require('../whatsapp/reply-service');

const log = makeLogger('manager-alert-expander');

let tablesOk = false;

async function ensureTables() {
  if (tablesOk) return;
  await run(`
    CREATE TABLE IF NOT EXISTS manager_alert_expanded (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_type TEXT NOT NULL,
      store TEXT,
      employee TEXT,
      employee_id TEXT,
      submission_id TEXT,
      issue_type TEXT,
      severity TEXT,
      details_json TEXT,
      status TEXT DEFAULT 'PENDING',
      sent_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      dedupe_key TEXT
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_alert_expanded_dedupe ON manager_alert_expanded(dedupe_key, created_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_alert_expanded_status ON manager_alert_expanded(status)`);

  await run(`
    CREATE TABLE IF NOT EXISTS manager_alert_retake_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      employee_id TEXT,
      store TEXT,
      shift_date TEXT,
      retake_count INTEGER DEFAULT 0,
      last_retake_at TEXT,
      alerted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_retake_tracking ON manager_alert_retake_tracking(chat_id, employee_id, shift_date)`);

  tablesOk = true;
}

// ── Alert types ─────────────────────────────────────────────────────────────

const ALERT_TYPES = {
  UNSAFE_TEMPERATURE: 'unsafe_temperature',
  MISSING_FIELD: 'missing_field',
  LOW_CONFIDENCE: 'low_confidence',
  MULTIPLE_RETAKES: 'multiple_retakes',
  MANAGER_REVIEW: 'manager_review',
  MISSING_SUBMISSION: 'missing_submission',
  DUPLICATE_FORM: 'duplicate_form',
};

function makeDedupeKey(store, alertType, issueItem) {
  return `${store || ''}:${alertType}:${issueItem || ''}`;
}

async function isDuplicate(key) {
  if (!key) return false;
  await ensureTables();
  const row = await get(
    `SELECT id FROM manager_alert_expanded
     WHERE dedupe_key = ?
       AND datetime(created_at) >= datetime('now', '-5 minutes')
     ORDER BY id DESC LIMIT 1`,
    [key]
  );
  return !!row;
}

// ── Send alert ──────────────────────────────────────────────────────────────

async function sendAlert({ client, alertType, store, employee, employeeId, submissionId, issueType, severity, details, managerChatId }) {
  await ensureTables();

  const dedupeKey = makeDedupeKey(store, alertType, issueType);
  if (await isDuplicate(dedupeKey)) {
    log.info('Alert deduplicated (within 5 min)', { alertType, store, issueType });
    await saveAlert({ alertType, store, employee, employeeId, submissionId, issueType, severity, details, status: 'DUPLICATE_SKIPPED', dedupeKey });
    return { sent: false, reason: 'deduplicated' };
  }

  const text = buildAlertMessage(alertType, { store, employee, employeeId, submissionId, issueType, severity, details });
  let status = 'PENDING';

  if (client && managerChatId) {
    try {
      await replyService.send(client, managerChatId, text);
      status = 'SENT';
    } catch (err) {
      log.warn('Manager alert send failed', { error: err.message, alertType });
      status = 'FAILED';
    }
  }

  await saveAlert({ alertType, store, employee, employeeId, submissionId, issueType, severity, details, status, dedupeKey });
  return { sent: status === 'SENT', status };
}

async function saveAlert({ alertType, store, employee, employeeId, submissionId, issueType, severity, details, status, dedupeKey }) {
  await ensureTables();
  await run(
    `INSERT INTO manager_alert_expanded
     (alert_type, store, employee, employee_id, submission_id, issue_type, severity, details_json, status, sent_at, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      alertType, store || '', employee || '', employeeId || '', submissionId || '',
      issueType || '', severity || '',
      JSON.stringify(details || {}),
      status, status === 'SENT' ? new Date().toISOString() : null, dedupeKey || '',
    ]
  );
}

// ── Alert message builders ──────────────────────────────────────────────────

function buildAlertMessage(alertType, { store, employee, employeeId, submissionId, issueType, severity, details }) {
  const d = details || {};
  const lines = ['🚨 *Food Safety Alert*', ''];

  switch (alertType) {
    case ALERT_TYPES.UNSAFE_TEMPERATURE:
      lines.push(`*Store:* ${store || 'Unknown'}`);
      lines.push(`*Employee:* ${employee || 'Unknown'}`);
      lines.push(`*Time:* ${new Date().toISOString()}`);
      lines.push(`*Issue:* Unsafe temperature confirmed`);
      if (d.item) lines.push(`*Item:* ${d.item}`);
      if (d.captured) lines.push(`*Captured:* ${d.captured}`);
      if (d.expected) lines.push(`*Expected:* ${d.expected}`);
      if (d.imagePath) lines.push(`*Form Image:* ${d.imagePath}`);
      if (submissionId) lines.push(`*Submission:* ${submissionId}`);
      lines.push('');
      lines.push('Action required: Verify with store team immediately.');
      break;

    case ALERT_TYPES.MISSING_FIELD:
      lines.push(`*Store:* ${store || 'Unknown'}`);
      lines.push(`*Employee:* ${employee || 'Unknown'}`);
      lines.push(`*Time:* ${new Date().toISOString()}`);
      lines.push(`*Issue:* Missing required field(s) on form`);
      if (d.items && d.items.length) lines.push(`*Missing:* ${d.items.join(', ')}`);
      if (d.imagePath) lines.push(`*Form Image:* ${d.imagePath}`);
      lines.push('');
      lines.push('Action: Check form and re-train staff if needed.');
      break;

    case ALERT_TYPES.LOW_CONFIDENCE:
      lines.push(`*Store:* ${store || 'Unknown'}`);
      lines.push(`*Employee:* ${employee || 'Unknown'}`);
      lines.push(`*Time:* ${new Date().toISOString()}`);
      lines.push(`*Issue:* Low OCR confidence on confirmed submission`);
      if (d.confidence != null) lines.push(`*OCR Confidence:* ${Math.round(d.confidence * 100)}%`);
      if (submissionId) lines.push(`*Submission:* ${submissionId}`);
      lines.push('');
      lines.push('Action: Review form data for accuracy.');
      break;

    case ALERT_TYPES.MULTIPLE_RETAKES:
      lines.push(`*Store:* ${store || 'Unknown'}`);
      lines.push(`*Employee:* ${employee || 'Unknown'}`);
      lines.push(`*Time:* ${new Date().toISOString()}`);
      lines.push(`*Issue:* Multiple photo retakes (${d.retakeCount || '?'}x)`);
      lines.push('Employee is having difficulty capturing a readable form.');
      lines.push('');
      lines.push('Action: Provide in-person assistance or check camera/lighting.');
      break;

    case ALERT_TYPES.MANAGER_REVIEW:
      lines.push(`*Store:* ${store || 'Unknown'}`);
      lines.push(`*Employee:* ${employee || 'Unknown'}`);
      lines.push(`*Time:* ${new Date().toISOString()}`);
      lines.push(`*Issue:* Manager review requested by employee`);
      if (d.reason) lines.push(`*Reason:* ${d.reason}`);
      if (d.imagePath) lines.push(`*Form Image:* ${d.imagePath}`);
      if (submissionId) lines.push(`*Submission:* ${submissionId}`);
      lines.push('');
      lines.push('Action: Review submission and confirm or request retake.');
      break;

    case ALERT_TYPES.MISSING_SUBMISSION:
      lines.push(`*Store:* ${store || 'Unknown'}`);
      lines.push(`*Time:* ${new Date().toISOString()}`);
      lines.push(`*Issue:* Missing daily submission`);
      if (d.expectedBy) lines.push(`*Expected by:* ${d.expectedBy}`);
      if (d.shift) lines.push(`*Shift:* ${d.shift}`);
      lines.push('');
      lines.push('Action: Check with store team for missing log.');
      break;

    case ALERT_TYPES.DUPLICATE_FORM:
      lines.push(`*Store:* ${store || 'Unknown'}`);
      lines.push(`*Employee:* ${employee || 'Unknown'}`);
      lines.push(`*Time:* ${new Date().toISOString()}`);
      lines.push(`*Issue:* Duplicate form photo submitted`);
      lines.push('');
      lines.push('Action: Verify with employee if intentional.');
      break;

    default:
      lines.push(`*Store:* ${store || 'Unknown'}`);
      lines.push(`*Employee:* ${employee || 'Unknown'}`);
      lines.push(`*Alert Type:* ${alertType}`);
      lines.push(`*Details:* ${JSON.stringify(d)}`);
  }

  if (process.env.DASHBOARD_URL) {
    lines.push('');
    lines.push(`*Dashboard:* ${process.env.DASHBOARD_URL}`);
  }

  return lines.join('\n');
}

// ── Trigger points ──────────────────────────────────────────────────────────

/**
 * Trigger: Unsafe temperature confirmed or warning confirmed.
 */
async function onUnsafeConfirmed({ client, store, employee, employeeId, submissionId, item, captured, expected, imagePath, managerChatId }) {
  return sendAlert({
    client, managerChatId,
    alertType: ALERT_TYPES.UNSAFE_TEMPERATURE,
    store, employee, employeeId, submissionId,
    issueType: 'temperature',
    severity: 'UNSAFE',
    details: { item, captured, expected, imagePath },
  });
}

/**
 * Trigger: Missing required field.
 */
async function onMissingField({ client, store, employee, employeeId, submissionId, missingItems, imagePath, managerChatId }) {
  return sendAlert({
    client, managerChatId,
    alertType: ALERT_TYPES.MISSING_FIELD,
    store, employee, employeeId, submissionId,
    issueType: 'missing_field',
    severity: 'WARNING',
    details: { items: missingItems, imagePath },
  });
}

async function onLowConfidence({ client, store, employee, employeeId, submissionId, confidence, managerChatId }) {
  return sendAlert({
    client, managerChatId,
    alertType: ALERT_TYPES.LOW_CONFIDENCE,
    store, employee, employeeId, submissionId,
    issueType: 'low_confidence',
    severity: 'WARNING',
    details: { confidence },
  });
}

async function onMultipleRetakes({ client, store, employee, employeeId, retakeCount, managerChatId }) {
  return sendAlert({
    client, managerChatId,
    alertType: ALERT_TYPES.MULTIPLE_RETAKES,
    store, employee, employeeId,
    issueType: 'retakes',
    severity: 'WARNING',
    details: { retakeCount },
  });
}

async function onManagerReviewRequested({ client, store, employee, employeeId, submissionId, reason, imagePath, managerChatId }) {
  return sendAlert({
    client, managerChatId,
    alertType: ALERT_TYPES.MANAGER_REVIEW,
    store, employee, employeeId, submissionId,
    issueType: 'manager_review',
    severity: 'WARNING',
    details: { reason, imagePath },
  });
}

async function onMissingSubmission({ client, store, shift, expectedBy, managerChatId }) {
  return sendAlert({
    client, managerChatId,
    alertType: ALERT_TYPES.MISSING_SUBMISSION,
    store,
    issueType: 'missing_submission',
    severity: 'WARNING',
    details: { shift, expectedBy },
  });
}

async function onDuplicateForm({ client, store, employee, employeeId, submissionId, managerChatId }) {
  return sendAlert({
    client, managerChatId,
    alertType: ALERT_TYPES.DUPLICATE_FORM,
    store, employee, employeeId, submissionId,
    issueType: 'duplicate',
    severity: 'WARNING',
    details: {},
  });
}

// ── Retake tracking ─────────────────────────────────────────────────────────

async function trackRetake({ chatId, employeeId, store, client, employee, managerChatId }) {
  await ensureTables();
  const shiftDate = new Date().toISOString().slice(0, 10);
  const row = await get(
    `SELECT id, retake_count FROM manager_alert_retake_tracking WHERE chat_id = ? AND employee_id = ? AND shift_date = ?`,
    [chatId || '', employeeId || '', shiftDate]
  );

  if (row) {
    const newCount = row.retake_count + 1;
    await run(`UPDATE manager_alert_retake_tracking SET retake_count = ?, last_retake_at = datetime('now') WHERE id = ?`, [newCount, row.id]);
    if (newCount >= 3) {
      const alerted = await get(`SELECT alerted FROM manager_alert_retake_tracking WHERE id = ?`, [row.id]);
      if (!alerted || !alerted.alerted) {
        await onMultipleRetakes({ client, store, employee, employeeId, retakeCount: newCount, managerChatId });
        await run(`UPDATE manager_alert_retake_tracking SET alerted = 1 WHERE id = ?`, [row.id]);
      }
    }
    return newCount;
  }

  await run(
    `INSERT INTO manager_alert_retake_tracking (chat_id, employee_id, store, shift_date, retake_count, last_retake_at) VALUES (?, ?, ?, ?, 1, datetime('now'))`,
    [chatId || '', employeeId || '', store || '', shiftDate]
  );
  return 1;
}

// ── Query ────────────────────────────────────────────────────────────────────

async function getRecentAlerts(limit = 20) {
  await ensureTables();
  return all(`SELECT * FROM manager_alert_expanded ORDER BY created_at DESC LIMIT ?`, [limit]);
}

async function getAlertStats() {
  await ensureTables();
  return get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent_count,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count,
      SUM(CASE WHEN status = 'DUPLICATE_SKIPPED' THEN 1 ELSE 0 END) as deduped_count,
      SUM(CASE WHEN alert_type = 'unsafe_temperature' THEN 1 ELSE 0 END) as unsafe_count,
      SUM(CASE WHEN alert_type = 'missing_field' THEN 1 ELSE 0 END) as missing_field_count,
      SUM(CASE WHEN alert_type = 'multiple_retakes' THEN 1 ELSE 0 END) as retake_count,
      SUM(CASE WHEN alert_type = 'manager_review' THEN 1 ELSE 0 END) as review_count,
      MAX(created_at) as last_alert_at
    FROM manager_alert_expanded
  `);
}

module.exports = {
  ensureTables,
  ALERT_TYPES,
  sendAlert,
  onUnsafeConfirmed,
  onMissingField,
  onLowConfidence,
  onMultipleRetakes,
  onManagerReviewRequested,
  onMissingSubmission,
  onDuplicateForm,
  trackRetake,
  getRecentAlerts,
  getAlertStats,
};
