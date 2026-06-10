/**
 * Photo Audit Manager Alert
 * 
 * Sends manager alerts for:
 *   - MISMATCH status
 *   - EXPIRED audits
 *   - NEEDS_REVIEW repeated
 *   - Suspicious pattern detected
 */

const replyService = require('../whatsapp/reply-service');
const { run } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('compliance');

function isEnabled() { return process.env.MANAGER_ALERTS_ENABLED === 'true'; }
function getManagerChatId() { return String(process.env.MANAGER_ALERT_GROUP_CHAT_ID || '').trim(); }

// ── Alert triggers ─────────────────────────────────────────────────────────────
async function sendMismatchAlert(auditRecord, client = null) {
  if (!isEnabled()) return { status: 'DISABLED' };

  const managerChatId = getManagerChatId();
  if (!managerChatId) return { status: 'NO_MANAGER_CHAT' };

  const message = buildMismatchAlertMessage(auditRecord);
  let status = 'PENDING_CLIENT';

  if (client) {
    status = (await replyService.send(client, managerChatId, message)) ? 'SENT' : 'FAILED';
  }

  await saveAlert(auditRecord, status, 'MISMATCH');
  log.info('Mismatch alert sent', { auditId: auditRecord.audit_id, status });

  return { status, message };
}

async function sendExpiredAlert(auditRecord, client = null) {
  if (!isEnabled()) return { status: 'DISABLED' };

  const managerChatId = getManagerChatId();
  if (!managerChatId) return { status: 'NO_MANAGER_CHAT' };

  const message = buildExpiredAlertMessage(auditRecord);
  let status = 'PENDING_CLIENT';

  if (client) {
    status = (await replyService.send(client, managerChatId, message)) ? 'SENT' : 'FAILED';
  }

  await saveAlert(auditRecord, status, 'EXPIRED');
  return { status, message };
}

async function sendNeedsReviewAlert(auditRecord, client = null) {
  if (!isEnabled()) return { status: 'DISABLED' };

  const managerChatId = getManagerChatId();
  if (!managerChatId) return { status: 'NO_MANAGER_CHAT' };

  const message = buildNeedsReviewAlertMessage(auditRecord);
  let status = 'PENDING_CLIENT';

  if (client) {
    status = (await replyService.send(client, managerChatId, message)) ? 'SENT' : 'FAILED';
  }

  await saveAlert(auditRecord, status, 'NEEDS_REVIEW');
  return { status, message };
}

// ── Message builders ───────────────────────────────────────────────────────────
function buildMismatchAlertMessage(audit) {
  return [
    '🚨 PHOTO VERIFICATION MISMATCH',
    '',
    `Store: ${audit.store_name || audit.store || 'Unknown'}`,
    `Employee: ${audit.employee_name || audit.employee_id || 'Unknown'}`,
    `Item: ${audit.item_name || 'Unknown'}`,
    '',
    `Entered: ${audit.entered_value ?? '?'}°F`,
    `Photo Reading: ${audit.observed_value ?? '?'}°F`,
    `Difference: ${audit.difference ?? '?'}°F`,
    '',
    'Possible incorrect or copied entry.',
    '',
    'Action Required:',
    'Manager should verify reading and coach staff if needed.',
    '',
    `Audit ID: ${audit.audit_id || 'Unknown'}`,
  ].join('\n');
}

function buildExpiredAlertMessage(audit) {
  return [
    '⚠️ PHOTO AUDIT EXPIRED',
    '',
    `Store: ${audit.store_name || audit.store || 'Unknown'}`,
    `Employee: ${audit.employee_name || audit.employee_id || 'Unknown'}`,
    `Item: ${audit.item_name || 'Unknown'}`,
    '',
    'Staff did not submit photo proof within the required time.',
    'Possible skipped verification.',
    '',
    `Audit ID: ${audit.audit_id || 'Unknown'}`,
  ].join('\n');
}

function buildNeedsReviewAlertMessage(audit) {
  return [
    '⚠️ PHOTO VERIFICATION NEEDS REVIEW',
    '',
    `Store: ${audit.store_name || audit.store || 'Unknown'}`,
    `Employee: ${audit.employee_name || audit.employee_id || 'Unknown'}`,
    `Item: ${audit.item_name || 'Unknown'}`,
    '',
    `Entered: ${audit.entered_value ?? '?'}°F`,
    `Photo Reading: ${audit.observed_value ?? 'unclear'}°F`,
    '',
    'Photo quality was too poor to verify.',
    'Manager review required.',
    '',
    `Audit ID: ${audit.audit_id || 'Unknown'}`,
  ].join('\n');
}

// ── Save alert record ─────────────────────────────────────────────────────────
let alertInitialized = false;

async function ensureAlertTable() {
  if (alertInitialized) return;
  await run(`
    CREATE TABLE IF NOT EXISTS photo_audit_manager_alerts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id        TEXT NOT NULL,
      alert_type      TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'PENDING',
      sent_at         TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    )
  `);
  alertInitialized = true;
}

async function saveAlert(auditRecord, status, alertType) {
  await ensureAlertTable();
  await run(
    `INSERT INTO photo_audit_manager_alerts (audit_id, alert_type, status, sent_at)
     VALUES (?, ?, ?, ?)`,
    [
      auditRecord.audit_id || '',
      alertType,
      status || 'UNKNOWN',
      status === 'SENT' ? new Date().toISOString() : null,
    ]
  );
  // Mark manager alert sent in photo_audits table
  await run(
    `UPDATE photo_audits SET manager_alert_sent = 1 WHERE audit_id = ?`,
    [auditRecord.audit_id]
  ).catch(() => {});
}

module.exports = {
  isEnabled,
  getManagerChatId,
  sendMismatchAlert,
  sendExpiredAlert,
  sendNeedsReviewAlert,
};