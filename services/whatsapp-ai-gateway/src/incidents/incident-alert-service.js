/**
 * Incident Alert Service
 * 
 * Sends manager alerts for serious incidents.
 * 
 * Triggers when:
 *   severity = MEDIUM or HIGH
 *   needs_human_review = true
 * 
 * Reuses the existing manager-alert-service infrastructure.
 */

const replyService = require('../whatsapp/reply-service');
const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('incidents');

function isEnabled() { return process.env.MANAGER_ALERTS_ENABLED === 'true'; }

function getManagerChatId() {
  return String(process.env.MANAGER_ALERT_GROUP_CHAT_ID || '').trim();
}

function getDebounceMinutes() {
  const n = parseInt(process.env.MANAGER_ALERT_DEBOUNCE_MINUTES || '5', 10);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

// ── Alert message ─────────────────────────────────────────────────────────────
function buildManagerAlertMessage(incident) {
  const {
    incident_id,
    store_name,
    reported_by_name,
    category,
    severity,
    store_area,
    confidence,
    description,
    recommended_action,
    status,
    image_path,
  } = incident;

  return [
    '🚨 INCIDENT ALERT',
    '',
    `Store: ${store_name || 'Unknown'}`,
    `Reported by: ${reported_by_name || 'Unknown'}`,
    `Category: ${category || 'Unknown'}`,
    `Severity: ${severity || 'Unknown'}`,
    `Area: ${store_area || 'Unknown'}`,
    `Confidence: ${confidence != null ? Math.round(confidence * 100) : '—'}%`,
    '',
    'Description:',
    description || 'No description',
    '',
    'Recommended Action:',
    recommended_action || 'No recommendation',
    '',
    `Incident ID: ${incident_id || 'Unknown'}`,
    `Log Status: ${status === 'CONFIRMED' ? 'Recorded' : status === 'DETECTED' ? 'Pending Confirmation' : 'Queued'}`,
    image_path ? `\nImage: ${image_path}` : '',
  ].filter(Boolean).join('\n');
}

// ── Dedupe check ──────────────────────────────────────────────────────────────
let alertInitialized = false;

async function ensureAlertTable() {
  if (alertInitialized) return;
  await run(`
    CREATE TABLE IF NOT EXISTS incident_manager_alerts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id     TEXT NOT NULL,
      manager_chat_id TEXT,
      status          TEXT NOT NULL DEFAULT 'PENDING',
      sent_at         TEXT,
      created_at      TEXT DEFAULT (datetime('now')),
      dedupe_key      TEXT
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_incident_alert_dedupe ON incident_manager_alerts(dedupe_key, created_at)`);
  alertInitialized = true;
}

function dedupeKey(incidentId, severity) {
  return `${incidentId}:${severity}`;
}

async function isDuplicate(key) {
  if (!key) return false;
  await ensureAlertTable();
  const row = await get(
    `SELECT id FROM incident_manager_alerts
     WHERE dedupe_key = ?
       AND status = 'SENT'
       AND datetime(created_at) >= datetime('now', ?)`,
    [key, `-${getDebounceMinutes()} minutes`]
  );
  return !!row;
}

// ── Send alert ─────────────────────────────────────────────────────────────────
async function sendManagerAlert(incident, client = null) {
  // Should we alert?
  const shouldAlert = incident.severity === 'MEDIUM'
    || incident.severity === 'HIGH'
    || incident.needs_human_review === true
    || incident.requiresManagerAlert === true;

  if (!shouldAlert) {
    log.info('Incident does not require manager alert', { incidentId: incident.incident_id, severity: incident.severity });
    return { status: 'NOT_REQUIRED', reason: `severity=${incident.severity}` };
  }

  if (!isEnabled()) {
    await saveAlert(incident, null, 'DISABLED');
    log.info('Manager alerts disabled');
    return { status: 'DISABLED' };
  }

  const managerChatId = getManagerChatId();
  if (!managerChatId) {
    await saveAlert(incident, managerChatId, 'NO_MANAGER_CHAT');
    log.warn('No manager chat ID configured');
    return { status: 'NO_MANAGER_CHAT' };
  }

  const key = dedupeKey(incident.incident_id, incident.severity);
  if (await isDuplicate(key)) {
    await saveAlert(incident, managerChatId, 'DUPLICATE_SKIPPED', key);
    log.info('Duplicate alert skipped', { incidentId: incident.incident_id });
    return { status: 'DUPLICATE_SKIPPED' };
  }

  const message = buildManagerAlertMessage(incident);
  let alertStatus = 'PENDING_CLIENT';

  if (client) {
    alertStatus = (await replyService.send(client, managerChatId, message)) ? 'SENT' : 'FAILED';
  }

  await saveAlert(incident, managerChatId, alertStatus, key, message);

  log.info('Incident manager alert sent', {
    incidentId: incident.incident_id,
    status: alertStatus,
    severity: incident.severity,
  });

  return { status: alertStatus, message };
}

async function saveAlert(incident, managerChatId, status, dedupeKeyVal = '', message = '') {
  await ensureAlertTable();
  await run(
    `INSERT INTO incident_manager_alerts (incident_id, manager_chat_id, status, sent_at, dedupe_key)
     VALUES (?, ?, ?, ?, ?)`,
    [
      incident.incident_id || '',
      managerChatId || '',
      status || 'UNKNOWN',
      status === 'SENT' ? new Date().toISOString() : null,
      dedupeKeyVal || '',
    ]
  );
}

module.exports = {
  isEnabled,
  getManagerChatId,
  buildManagerAlertMessage,
  sendManagerAlert,
};