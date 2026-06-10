/**
 * Missing Submission Reminder Service
 *
 * Runs on a schedule and checks for stores that have not submitted
 * their daily entry log today.
 *
 * Flow:
 *   1. Query broth_log_entries for each store, find most recent submission
 *   2. If no submission today (by local time), send reminder to store group
 *   3. After configurable delay, escalate to manager group if still missing
 *
 * Config:
 *   MISSING_SUBMISSION_CHECK_INTERVAL_MS  — how often to check (default 30 min)
 *   MISSING_SUBMISSION_FIRST_REMINDER_HOUR — hour of day to start reminders (default 14 = 2pm)
 *   MISSING_SUBMISSION_ESCALATE_HOUR      — hour to escalate to manager (default 17 = 5pm)
 *   MISSING_SUBMISSION_ENABLED             — 'true' to enable
 */

const { all } = require('../storage/sqlite');
const { run } = require('../storage/sqlite');
const replyService = require('../whatsapp/reply-service');
const storeRegistry = require('../stores/store-registry');
const managerAlerts = require('../alerts/manager-alert-service');
const { t } = require('../i18n/translations');
const { makeLogger } = require('../logger');

const log = makeLogger('whatsapp');

let _timer = null;
let _sendFn = null; // injected: async (chatId, text) => void

function setSendFunction(fn) { _sendFn = fn; }

// ── Check all stores ─────────────────────────────────────────────────────
async function checkMissingSubmissions() {
  if (!isEnabled()) return;

  const now = new Date();
  const firstReminderHour = parseInt(process.env.MISSING_SUBMISSION_FIRST_REMINDER_HOUR || '14', 10);
  const escalateHour = parseInt(process.env.MISSING_SUBMISSION_ESCALATE_HOUR || '17', 10);

  // Only run during reminder window
  if (now.getHours() < firstReminderHour) return;

  try {
    const mappings = await storeRegistry.listMappings();
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

    for (const store of mappings) {
      if (!store.active) continue;

      // Check last submission
      const lastLog = await getLastLogForStore(store.store_id);
      const hasTodaySubmission = lastLog && lastLog.created_at && lastLog.created_at.slice(0, 10) === today;

      if (!hasTodaySubmission) {
        await processMissingStore(store, now, escalateHour);
      }
    }
  } catch (err) {
    log.warn('Missing submission check failed', { error: err.message });
  }
}

// ── Per-store handling ────────────────────────────────────────────────────
async function processMissingStore(store, now, escalateHour) {
  const chatId = store.chat_id;
  const lastReminder = await getLastReminderTime(store.store_id);
  const debounceMinutes = parseInt(process.env.MISSING_SUBMISSION_DEBOUNCE_MIN || '60', 10);

  // Debounce: don't re-remind within debounce window
  if (lastReminder) {
    const lastDate = new Date(lastReminder);
    const diffMs = now - lastDate;
    if (diffMs < debounceMinutes * 60_000) return;
  }

  const shouldEscalate = now.getHours() >= escalateHour;
  const lang = 'en'; // use default — could integrate language detection per store

  if (shouldEscalate) {
    // Send to manager group
    await sendManagerEscalation(store, lang);
    await recordReminder(store.store_id, 'ESCALATED');
    log.info('Missing submission escalated to manager', { store: store.store_name, chatId });
  } else {
    // Send reminder to store group
    await sendStoreReminder(store, lang);
    await recordReminder(store.store_id, 'REMINDER_SENT');
    log.info('Missing submission reminder sent', { store: store.store_name, chatId });
  }
}

async function sendStoreReminder(store, lang) {
  const msg = [
    '⏰ Nhắc nhở: Nhật Ký Hàng Ngày chưa gửi',
    '',
    `Cửa hàng ${store.store_name || 'của bạn'} chưa gửi nhật ký hàng ngày hôm nay.`,
    '',
    'Trả lời:',
    '/ldagent',
    '',
    'Sau đó chọn "Nhật Ký Hàng Ngày" để gửi.',
  ].join('\n');

  if (_sendFn) {
    await _sendFn(store.chat_id, msg);
  } else {
    // Store in DB for API visibility
    await savePendingReminder(store, msg);
  }
}

async function sendManagerEscalation(store, lang) {
  const msg = [
    '🚨 MANAGER ALERT — Missing Daily Entry',
    '',
    `Store: ${store.store_name || 'Unknown'}`,
    `Group: ${store.group_name || store.chat_id}`,
    `Time: ${new Date().toISOString()}`,
    '',
    'No daily entry log has been submitted today.',
    'Action required: confirm with store team.',
  ].join('\n');

  await managerAlerts.handleConfirmedDailyEntry({
    client: null,
    session: { chatId: store.chat_id, sender: 'system', senderName: 'System Reminder', groupName: store.group_name },
    store: { store_id: store.store_id, store_name: store.store_name },
    validationResult: { overallStatus: 'PASS', failures: [] },
    sheetWriteStatus: 'N/A',
    timestamp: new Date().toISOString(),
    sessionId: `REMINDER_${store.store_id}_${Date.now()}`,
  });
}

async function getLastLogForStore(storeId) {
  const rows = await all(
    `SELECT * FROM broth_log_entries
     WHERE store_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [storeId]
  );
  return rows[0] || null;
}

async function getLastReminderTime(storeId) {
  const row = await all(
    `SELECT created_at FROM submission_reminders
     WHERE store_id = ?
     ORDER BY id DESC LIMIT 1`,
    [storeId]
  );
  return row[0]?.created_at || null;
}

async function recordReminder(storeId, status) {
  await ensureReminderTable();
  await run(
    `INSERT INTO submission_reminders (store_id, reminder_type, status, created_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [storeId, 'DAILY_ENTRY', status]
  );
}

async function savePendingReminder(store, msg) {
  await ensureReminderTable();
  await run(
    `INSERT INTO pending_reminders (store_id, chat_id, message, status, created_at)
     VALUES (?, ?, ?, 'PENDING', datetime('now'))`,
    [store.store_id, store.chat_id, msg]
  );
}

let _reminderTablesInit = false;
async function ensureReminderTable() {
  if (_reminderTablesInit) return;
  await run(`
    CREATE TABLE IF NOT EXISTS submission_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id TEXT NOT NULL,
      reminder_type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS pending_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id TEXT,
      chat_id TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  _reminderTablesInit = true;
}

function isEnabled() {
  return process.env.MISSING_SUBMISSION_ENABLED === 'true';
}

// ── Scheduler ──────────────────────────────────────────────────────────────
function start(sendFn = null) {
  if (sendFn) _sendFn = sendFn;
  const intervalMs = parseInt(process.env.MISSING_SUBMISSION_CHECK_INTERVAL_MS || '1800000', 10); // default 30 min

  _timer = setInterval(() => {
    checkMissingSubmissions().catch(err => log.warn('Reminder check error', { error: err.message }));
  }, intervalMs);

  _timer.unref();
  log.info('Missing submission reminder service started', { intervalMs, enabled: isEnabled() });
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

// ── API helpers ───────────────────────────────────────────────────────────
async function getPendingReminders() {
  await ensureReminderTable();
  return all(`SELECT * FROM pending_reminders ORDER BY created_at DESC LIMIT 20`);
}

async function getReminderStats() {
  await ensureReminderTable();
  const rows = await all(`SELECT store_id, status, MAX(created_at) as last_at FROM submission_reminders GROUP BY store_id, status`);
  return rows;
}

module.exports = {
  start, stop,
  setSendFunction,
  checkMissingSubmissions,
  getPendingReminders,
  getReminderStats,
  isEnabled,
};