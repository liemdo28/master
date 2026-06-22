const replyService = require('../whatsapp/reply-service');
const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('whatsapp');

let initialized = false;

async function ensureTables() {
  if (initialized) return;
  await run(`
    CREATE TABLE IF NOT EXISTS manager_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id TEXT,
      store_name TEXT,
      source_chat_id TEXT,
      source_group_name TEXT,
      manager_chat_id TEXT,
      staff_id TEXT,
      staff_name TEXT,
      workflow TEXT,
      issues_json TEXT,
      sheet_write_status TEXT,
      status TEXT,
      sent_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      dedupe_key TEXT
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_manager_alerts_dedupe ON manager_alerts(dedupe_key, created_at)`);
  initialized = true;
}

// Runtime config — DB first, then .env fallback
async function getRuntimeConfig(key, fallback) {
  try {
    const storeRegistry = require('../stores/store-registry');
    const dbVal = await storeRegistry.getAppConfig(key, null);
    if (dbVal !== null && dbVal !== undefined && dbVal !== '') return dbVal;
  } catch (_) {}
  return process.env[key] || fallback || '';
}

function isEnabled() {
  // Sync version — only checks env. Async version uses DB first.
  return process.env.MANAGER_ALERTS_ENABLED === 'true';
}

async function isEnabledAsync() {
  const val = await getRuntimeConfig('MANAGER_ALERTS_ENABLED', 'false');
  return val === 'true';
}

function getManagerChatId() {
  return String(process.env.MANAGER_ALERT_GROUP_CHAT_ID || '').trim();
}

async function getManagerChatIdAsync() {
  return String(await getRuntimeConfig('MANAGER_ALERT_GROUP_CHAT_ID', '')).trim();
}

function getDebounceMinutes() {
  const n = parseInt(process.env.MANAGER_ALERT_DEBOUNCE_MINUTES || '5', 10);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

function buildIssue(failure) {
  const reason = String(failure.reason || '').toLowerCase();
  let status = 'NEEDS_REVIEW';
  if (reason.includes('below') || (reason.includes('outside') && failure.min != null && Number(failure.value) < Number(failure.min))) status = 'LOW';
  if (reason.includes('above') || (reason.includes('outside') && failure.max != null && Number(failure.value) > Number(failure.max))) status = 'HIGH';
  return {
    item: failure.name,
    value: failure.value,
    target: failure.target || '',
    status,
    reason: failure.reason || '',
  };
}

function buildIssues(validationResult) {
  return (validationResult?.failures || []).map(buildIssue);
}

function dedupeKey({ storeId, workflow, issues }) {
  return issues
    .map(i => `${storeId || ''}:${workflow || ''}:${i.item}:${i.status}`)
    .sort()
    .join('|');
}

async function isDuplicate(key) {
  if (!key) return false;
  await ensureTables();
  const row = await get(
    `SELECT id FROM manager_alerts
     WHERE dedupe_key = ?
       AND status IN ('SENT','DUPLICATE_SKIPPED')
       AND datetime(created_at) >= datetime('now', ?)
     ORDER BY id DESC LIMIT 1`,
    [key, `-${getDebounceMinutes()} minutes`]
  );
  return !!row;
}

function storeWarningMessage({ storeName, staffName, issues, sheetWriteStatus }) {
  return [
    '⚠️ DAILY ENTRY WARNING',
    '',
    `Store: ${storeName || 'Unknown'}`,
    `Submitted by: ${staffName || 'Unknown'}`,
    '',
    'Out of range:',
    ...issues.map(i => `- ${i.item}: ${i.value}\n  Target: ${i.target || 'Needs review'}\n  Status: ${i.status}`),
    '',
    'Please re-check. If the reading is correct, notify manager immediately.',
    sheetWriteStatus === 'SENT' ? 'Recorded to Google Sheet.' : 'Log Status: Queued, not yet written.',
  ].join('\n');
}

function managerAlertMessage({ storeName, staffName, staffLanguage, sourceGroupName, workflow, timestamp, issues, sheetWriteStatus, sessionId, originalInputs }) {
  // Phase 1.5: Manager alert is ALWAYS in English. Includes staff language + original input.
  const langLabel = (staffLanguage || 'en').toUpperCase();
  const lines = [
    '🚨 Temperature Alert',
    '',
    `Store: ${storeName || 'Unknown'}`,
    `Employee: ${staffName || 'Unknown'}`,
    `Language: ${langLabel}`,
  ];
  if (issues && issues.length) {
    lines.push('', 'Out of range:');
    for (const i of issues) {
      lines.push(`- ${i.item}: ${i.value}°F | Target ${i.target || 'Needs review'} | Status ${i.status}`);
    }
  }
  if (originalInputs && Object.keys(originalInputs).length) {
    lines.push('', 'Original input:');
    for (const [k, v] of Object.entries(originalInputs)) {
      lines.push(`- ${k}: "${v}"`);
    }
  }
  lines.push(
    '',
    `Workflow: ${workflow || 'daily_entry'}`,
    `Time: ${timestamp || new Date().toISOString()}`,
    '',
    'Action Required:',
    'Please confirm correction with store team.',
    '',
    `Google Sheet write status: ${sheetWriteStatus || 'UNKNOWN'}`,
    `Session ID: ${sessionId || 'unknown'}`,
  );
  return lines.join('\n');
}

async function handleConfirmedDailyEntry({ client, session, store, validationResult, sheetWriteStatus, timestamp, sessionId, staffLanguage, originalInputs }) {
  const issues = buildIssues(validationResult);
  if (!issues.length) return { storeWarning: null, managerAlert: { status: 'NOT_NEEDED' }, issues };

  const storeWarning = storeWarningMessage({
    storeName: store?.store_name || session.store,
    staffName: session.senderName,
    issues,
    sheetWriteStatus,
  });

  // Use DB-first config (runtime) then .env fallback
  const enabled = await isEnabledAsync();
  const managerChatId = await getManagerChatIdAsync();
  const key = dedupeKey({ storeId: store?.store_id || '', workflow: 'daily_entry', issues });

  if (!enabled) {
    await saveAlert({ session, store, managerChatId, issues, sheetWriteStatus, status: 'DISABLED', dedupeKey: key });
    return { storeWarning, managerAlert: { status: 'DISABLED' }, issues };
  }

  if (!managerChatId) {
    await saveAlert({ session, store, managerChatId, issues, sheetWriteStatus, status: 'NO_MANAGER_CHAT', dedupeKey: key });
    return { storeWarning, managerAlert: { status: 'NO_MANAGER_CHAT' }, issues };
  }

  if (await isDuplicate(key)) {
    await saveAlert({ session, store, managerChatId, issues, sheetWriteStatus, status: 'DUPLICATE_SKIPPED', dedupeKey: key });
    return { storeWarning, managerAlert: { status: 'DUPLICATE_SKIPPED' }, issues };
  }

  const text = managerAlertMessage({
    storeName: store?.store_name || session.store,
    staffName: session.senderName,
    staffLanguage: staffLanguage || (session && session.lang) || 'en',
    sourceGroupName: session.groupName,
    workflow: 'daily_entry',
    timestamp,
    issues,
    sheetWriteStatus,
    sessionId,
    originalInputs: originalInputs || (session && session.originalInputs) || null,
  });

  let status = 'PENDING_CLIENT';
  if (client) {
    status = await replyService.send(client, managerChatId, text) ? 'SENT' : 'FAILED';
  }
  await saveAlert({ session, store, managerChatId, issues, sheetWriteStatus, status, dedupeKey: key });
  return { storeWarning, managerAlert: { status, text }, issues };
}

async function saveAlert({ session, store, managerChatId, issues, sheetWriteStatus, status, dedupeKey }) {
  await ensureTables();
  const sentAt = status === 'SENT' ? new Date().toISOString() : null;
  await run(
    `INSERT INTO manager_alerts
     (store_id, store_name, source_chat_id, source_group_name, manager_chat_id, staff_id, staff_name, workflow, issues_json, sheet_write_status, status, sent_at, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      store?.store_id || '',
      store?.store_name || session?.store || '',
      session?.chatId || '',
      session?.groupName || '',
      managerChatId || '',
      session?.sender || '',
      session?.senderName || '',
      'daily_entry',
      JSON.stringify(issues || []),
      sheetWriteStatus || '',
      status || 'UNKNOWN',
      sentAt,
      dedupeKey || '',
    ]
  );
}

async function getRecentAlerts(limit = 10) {
  await ensureTables();
  return all(`SELECT * FROM manager_alerts ORDER BY created_at DESC LIMIT ?`, [limit]);
}

async function getStats() {
  await ensureTables();
  const counts = await get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('PENDING_CLIENT','FAILED','NO_MANAGER_CHAT') THEN 1 ELSE 0 END) as pending_count,
      MAX(created_at) as last_alert_at
    FROM manager_alerts
  `);
  const last = await get(`SELECT * FROM manager_alerts ORDER BY created_at DESC LIMIT 1`);
  const enabled = await isEnabledAsync();
  const managerChatId = await getManagerChatIdAsync();
  return {
    enabled,
    managerChatId,
    debounceMinutes: getDebounceMinutes(),
    total: counts?.total || 0,
    pendingCount: counts?.pending_count || 0,
    lastAlertAt: counts?.last_alert_at || null,
    lastAlert: last || null,
  };
}

async function sendMissingSubmissionAlerts(date = null) {
  const { detectMissing } = require('../food-safety/alerts/missing-submission-detector');
  const { missingSubmissionAlert } = require('../food-safety/alerts/alert-template-builder');

  const enabled = await isEnabledAsync();
  if (!enabled) return { skipped: true, reason: 'alerts_disabled' };

  const { missing } = await detectMissing(date);
  if (!missing.length) return { sent: 0, missing: [] };

  const managerChatId = await getManagerChatIdAsync();
  if (!managerChatId) return { sent: 0, missing, error: 'no_manager_chat_id' };

  let client = null;
  try { client = require('../whatsapp/client-manager').getClient(); } catch (_) {}

  let sent = 0;
  for (const m of missing) {
    const text = missingSubmissionAlert(m);
    const key = `missing:${m.store_id}:${m.shift}:${m.date}`;
    const existing = await get(`SELECT id FROM manager_alerts WHERE dedupe_key = ? AND date(created_at) = date('now') LIMIT 1`, [key]);
    if (existing) continue;
    let status = 'PENDING_CLIENT';
    if (client) status = await replyService.send(client, managerChatId, text) ? 'SENT' : 'FAILED';
    await saveAlert({ session: {}, store: { store_id: m.store_id, store_name: m.store_name }, managerChatId, issues: [], sheetWriteStatus: 'n/a', status, dedupeKey: key });
    if (status === 'SENT') sent++;
  }
  return { sent, missing };
}

module.exports = {
  ensureTables,
  isEnabled,
  getManagerChatId,
  buildIssues,
  storeWarningMessage,
  managerAlertMessage,
  handleConfirmedDailyEntry,
  sendMissingSubmissionAlerts,
  getRecentAlerts,
  getStats,
};
