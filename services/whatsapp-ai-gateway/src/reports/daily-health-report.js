/**
 * Daily Health Report Service
 *
 * Sends an 8 PM summary to the manager group covering all 3 stores.
 *
 * Config:
 *   DAILY_HEALTH_REPORT_ENABLED=true
 *   DAILY_HEALTH_REPORT_TIME=20:00
 *   DAILY_HEALTH_REPORT_CHAT_ID=<manager_group_chat_id>
 *
 * Format:
 *   📊 Daily Operations Summary
 *   (per store: submitted?, warnings?, last submit time)
 *   Outstanding items
 *   Sheet queue status
 *   Manager alerts today
 */

const auditTrail = require('../workflows/audit-trail');
const sheetQueue  = require('../workflows/sheet-write-queue');
const storeRegistry = require('../stores/store-registry');
const { makeLogger } = require('../logger');

const log = makeLogger('whatsapp');

let _timer = null;
let _sendFn = null;
let _lastSentAt = null;
let _lastError = null;

function setSendFunction(fn) { _sendFn = fn; }

function isEnabled() {
  return process.env.DAILY_HEALTH_REPORT_ENABLED === 'true';
}

function getReportTime() {
  const cfg = process.env.DAILY_HEALTH_REPORT_TIME || '20:00';
  const [h, m] = cfg.split(':').map(Number);
  return { hour: h, minute: m };
}

function getManagerChatId() {
  return String(process.env.DAILY_HEALTH_REPORT_CHAT_ID || process.env.MANAGER_ALERT_GROUP_CHAT_ID || '').trim();
}

// ── Build report text ─────────────────────────────────────────────────────────
async function buildReport() {
  const storeMappings = await storeRegistry.listMappings();
  const todaySummary = await auditTrail.getTodayAuditSummary();
  const queueStats = await sheetQueue.getStats();
  const alertStats = await auditTrail.getAuditStats();

  const storeMap = {};
  for (const s of storeMappings) storeMap[s.store_id] = s;

  const lines = ['📊 Daily Operations Summary', '', new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), ''];

  for (const mapping of storeMappings) {
    if (!mapping.active) continue;
    const entries = todaySummary.filter(e => e.store_id === mapping.store_id && e.workflow_type === 'daily_entry');
    const submitted = entries.length > 0;
    const alertCount = entries.reduce((sum, e) => sum + (e.alert_count || 0), 0);
    const lastConfirmed = entries.length > 0
      ? entries.reduce((latest, e) => e.last_confirmed_at > latest ? e.last_confirmed_at : latest, '1970-01-01')
      : null;

    const submittedStr = submitted ? '✅ YES' : '❌ NO';
    const lastStr = lastConfirmed
      ? new Date(lastConfirmed).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : '—';
    const alertStr = alertCount > 0 ? `⚠️ ${alertCount}` : '0';

    lines.push(`*${mapping.store_name}*`);
    lines.push(`  Submitted: ${submittedStr}`);
    lines.push(`  Warnings: ${alertStr}`);
    lines.push(`  Last Submit: ${lastStr}`);
    lines.push('');
  }

  // Outstanding
  const missingStores = storeMappings.filter(m => {
    if (!m.active) return false;
    return !todaySummary.some(e => e.store_id === m.store_id);
  });
  if (missingStores.length > 0) {
    lines.push('Outstanding:');
    for (const s of missingStores) {
      lines.push(`- ${s.store_name} missing Daily Entry`);
    }
    lines.push('');
  }

  // Sheet queue
  const pending = queueStats?.pending_count || 0;
  const failed  = queueStats?.failed_count  || 0;
  lines.push('Sheet Queue:');
  lines.push(`  Pending: ${pending}`);
  lines.push(`  Failed: ${failed}`);
  lines.push('');

  // Manager alerts today
  const alertCount = alertStats?.manager_alerts_sent || 0;
  lines.push(`Manager Alerts: ${alertCount} today`);
  lines.push('');

  return lines.join('\n');
}

// ── Send report ──────────────────────────────────────────────────────────────
async function sendReport() {
  if (!isEnabled()) return { status: 'DISABLED' };
  const chatId = getManagerChatId();
  if (!chatId) return { status: 'NO_CHAT_ID' };

  try {
    const text = await buildReport();
    if (_sendFn) {
      await _sendFn(chatId, text);
    }
    _lastSentAt = new Date().toISOString();
    _lastError = null;
    log.info('Daily health report sent', { chatId });
    return { status: 'SENT', sentAt: _lastSentAt };
  } catch (err) {
    _lastError = err.message;
    log.warn('Daily health report failed', { error: err.message });
    return { status: 'FAILED', error: err.message };
  }
}

// ── Scheduler ──────────────────────────────────────────────────────────────
function start() {
  if (process.env.NODE_ENV === 'test') return; // skip in tests

  const checkInterval = 60_000; // check every minute

  _timer = setInterval(() => {
    checkAndMaybeSend().catch(err => log.warn('Health report check error', { error: err.message }));
  }, checkInterval);

  _timer.unref();
  log.info('Daily health report service started', {
    enabled: isEnabled(),
    reportTime: process.env.DAILY_HEALTH_REPORT_TIME || '20:00',
    managerChatId: getManagerChatId() ? '(configured)' : '(not set)',
  });
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

async function checkAndMaybeSend() {
  if (!isEnabled()) return;
  const now = new Date();
  const { hour, minute } = getReportTime();
  if (now.getHours() === hour && now.getMinutes() >= minute && now.getMinutes() < minute + 2) {
    return sendReport();
  }
}

// ── Status for dashboard ─────────────────────────────────────────────────────
function getStatus() {
  return {
    enabled: isEnabled(),
    reportTime: process.env.DAILY_HEALTH_REPORT_TIME || '20:00',
    managerChatId: getManagerChatId() || null,
    lastSentAt: _lastSentAt,
    lastError: _lastError,
  };
}

module.exports = { start, stop, setSendFunction, sendReport, checkAndMaybeSend, getStatus, buildReport };
