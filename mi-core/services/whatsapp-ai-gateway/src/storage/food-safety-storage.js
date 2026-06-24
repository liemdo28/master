/**
 * Food Safety Storage
 * SQLite persistence for food safety checks, readings, and warnings.
 *
 * Tables:
 *   food_safety_checks    — one row per image received
 *   food_safety_readings  — one row per extracted reading
 *   food_safety_warnings  — one row per warning sent
 *   food_safety_sheet_queue — pending Google Sheet daily-log writes
 *   broth_log_entries   — one row per /broth command submission
 *   food_safety_incidents — open/closed review and failure incidents
 *   image_audit           — image intake audit trail
 *   workflow_runs         — multi-step workflow execution records
 */

const { run, all, get } = require('./sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('food-safety');

const CHECK_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS food_safety_checks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id         TEXT,
    sender          TEXT,
    sender_name     TEXT,
    timestamp       TEXT,
    message_id      TEXT,
    image_path      TEXT,
    store           TEXT,
    result          TEXT NOT NULL DEFAULT 'PASS',
    readings_json   TEXT,
    extracted_json  TEXT,
    check_id        TEXT UNIQUE,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS food_safety_readings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    check_id        TEXT NOT NULL,
    item            TEXT NOT NULL,
    value           REAL,
    unit            TEXT,
    confidence      REAL,
    status          TEXT NOT NULL,
    operator        TEXT,
    target          REAL,
    corrective      TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS food_safety_warnings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    check_id        TEXT NOT NULL,
    warning_type    TEXT NOT NULL,
    warning_text    TEXT,
    sent_at         TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS food_safety_sheet_queue (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    check_id        TEXT NOT NULL,
    payload_json    TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'PENDING',
    attempt_count   INTEGER NOT NULL DEFAULT 0,
    last_error      TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    sent_at         TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_food_safety_sheet_queue_status
    ON food_safety_sheet_queue(status, created_at);

  CREATE TABLE IF NOT EXISTS food_safety_incidents (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    check_id        TEXT NOT NULL,
    result          TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'OPEN',
    opened_at       TEXT DEFAULT (datetime('now')),
    closed_at       TEXT,
    assigned_to     TEXT,
    corrective_text TEXT,
    notes           TEXT
  );

  CREATE TABLE IF NOT EXISTS broth_log_entries (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id            TEXT,
    group_name         TEXT,
    sender_id          TEXT,
    sender_name        TEXT,
    sender             TEXT,
    store_id           TEXT,
    store              TEXT,
    payload_json       TEXT,
    status             TEXT,
    sheet_write_status TEXT,
    created_at         TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS image_audit (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    image_path      TEXT NOT NULL,
    chat_id         TEXT,
    sender          TEXT,
    message_id      TEXT,
    mime_type       TEXT,
    size_bytes      INTEGER,
    metadata_json   TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS workflow_runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_name   TEXT NOT NULL,
    status          TEXT NOT NULL,
    input_json      TEXT,
    output_json     TEXT,
    started_at      TEXT,
    completed_at    TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );
`;

let initialized = false;

async function ensureTables() {
  if (initialized) return;
  try {
    const db = require('./sqlite').getDb();
    db.exec(CHECK_TABLES_SQL);
    awaitMaybe(run(`ALTER TABLE broth_log_entries ADD COLUMN group_name TEXT`));
    awaitMaybe(run(`ALTER TABLE broth_log_entries ADD COLUMN sender_id TEXT`));
    awaitMaybe(run(`ALTER TABLE broth_log_entries ADD COLUMN sender_name TEXT`));
    awaitMaybe(run(`ALTER TABLE broth_log_entries ADD COLUMN store_id TEXT`));
    initialized = true;
    log.info('Food safety tables ready');
  } catch (err) {
    log.error('Failed to create food safety tables', { error: err.message });
  }
}

function awaitMaybe(promise) {
  promise.catch(() => {});
}

/**
 * Generate a short unique check ID.
 */
function makeCheckId(chatId, timestamp) {
  const str = `${chatId}-${timestamp}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash = hash & hash;
  }
  return `FS${Math.abs(hash).toString(36).toUpperCase().padStart(8, '0')}`;
}

/**
 * Save a food safety check record.
 */
async function saveCheck({ chatId, sender, senderName, timestamp, messageId, imagePath, store, result, readings, extractedJson }) {
  await ensureTables();
  const checkId = makeCheckId(chatId, timestamp || String(Date.now()));
  const readingsJson = JSON.stringify(readings || []);
  await run(
    `INSERT INTO food_safety_checks (chat_id, sender, sender_name, timestamp, message_id, image_path, store, result, readings_json, extracted_json, check_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [chatId, sender, senderName || '', timestamp || '', messageId || '', imagePath || '', store || 'Unknown', result, readingsJson, JSON.stringify(extractedJson || {}), checkId]
  );
  return checkId;
}

/**
 * Save individual readings for a check.
 */
async function saveReadings(checkId, readings) {
  await ensureTables();
  for (const r of readings) {
    await run(
      `INSERT INTO food_safety_readings (check_id, item, value, unit, confidence, status, operator, target, corrective)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [checkId, r.item, r.value, r.unit || 'F', r.confidence ?? 1.0, r.status || 'PASS', r.operator || '', r.target ?? null, r.corrective || r.correctiveAction || '']
    );
  }
}

/**
 * Save a warning record.
 */
async function saveWarning(checkId, warningType, warningText) {
  await ensureTables();
  await run(
    `INSERT INTO food_safety_warnings (check_id, warning_type, warning_text) VALUES (?, ?, ?)`,
    [checkId, warningType, warningText]
  );
}

async function enqueueSheetWrite(checkId, payload, lastError = '') {
  await ensureTables();
  await run(
    `INSERT INTO food_safety_sheet_queue (check_id, payload_json, status, attempt_count, last_error)
     VALUES (?, ?, 'PENDING', 0, ?)`,
    [checkId, JSON.stringify(payload || {}), lastError || '']
  );
  await saveSheetWriteStatus({ checkId, status: 'PENDING', error: lastError || '' });
}

async function markSheetWriteSent(checkId) {
  await ensureTables();
  await run(
    `UPDATE food_safety_sheet_queue
     SET status = 'SENT', sent_at = datetime('now'), last_error = ''
     WHERE check_id = ? AND status != 'SENT'`,
    [checkId]
  );
  await saveSheetWriteStatus({ checkId, status: 'SENT', error: '' });
}

async function getPendingSheetWrites(limit = 10) {
  await ensureTables();
  return all(
    `SELECT * FROM food_safety_sheet_queue
     WHERE status IN ('PENDING', 'FAILED')
     ORDER BY created_at ASC
     LIMIT ?`,
    [limit]
  );
}

async function markQueueItemSent(id) {
  await ensureTables();
  const item = await get(`SELECT check_id FROM food_safety_sheet_queue WHERE id = ?`, [id]);
  await run(
    `UPDATE food_safety_sheet_queue
     SET status = 'SENT', sent_at = datetime('now'), last_error = ''
     WHERE id = ?`,
    [id]
  );
  await saveSheetWriteStatus({ checkId: item?.check_id || '', status: 'SENT', error: '' });
}

async function markQueueItemFailed(id, error) {
  await ensureTables();
  const item = await get(`SELECT check_id FROM food_safety_sheet_queue WHERE id = ?`, [id]);
  await run(
    `UPDATE food_safety_sheet_queue
     SET status = 'FAILED', attempt_count = attempt_count + 1, last_error = ?
     WHERE id = ?`,
    [String(error || '').slice(0, 1000), id]
  );
  await saveSheetWriteStatus({ checkId: item?.check_id || '', status: 'FAILED', error: String(error || '') });
}

async function saveSheetWriteStatus({ checkId, status, error = '' }) {
  await run(
    `INSERT OR REPLACE INTO app_state (key, value, updated_at)
     VALUES ('food_safety_last_sheet_write', ?, datetime('now'))`,
    [JSON.stringify({ checkId, status, error, at: new Date().toISOString() })]
  );
}

async function getLastSheetWriteStatus() {
  await ensureTables();
  const row = await get(`SELECT value, updated_at FROM app_state WHERE key = 'food_safety_last_sheet_write'`);
  if (!row) return null;
  try {
    return { ...JSON.parse(row.value), updatedAt: row.updated_at };
  } catch (_) {
    return { status: 'UNKNOWN', updatedAt: row.updated_at };
  }
}

async function saveIncident({ checkId, result, status = 'OPEN', assignedTo = '', correctiveText = '', notes = '' }) {
  await ensureTables();
  await run(
    `INSERT INTO food_safety_incidents (check_id, result, status, assigned_to, corrective_text, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [checkId, result, status, assignedTo, correctiveText, notes]
  );
}

async function saveImageAudit({ imagePath, chatId, sender, messageId, mimeType, sizeBytes, metadata }) {
  await ensureTables();
  await run(
    `INSERT INTO image_audit (image_path, chat_id, sender, message_id, mime_type, size_bytes, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [imagePath, chatId || '', sender || '', messageId || '', mimeType || '', sizeBytes || 0, JSON.stringify(metadata || {})]
  );
}

async function saveWorkflowRun({ workflowName, status, inputJson, outputJson, startedAt, completedAt }) {
  await ensureTables();
  await run(
    `INSERT INTO workflow_runs (workflow_name, status, input_json, output_json, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      workflowName,
      status || 'UNKNOWN',
      JSON.stringify(inputJson || {}),
      JSON.stringify(outputJson || {}),
      startedAt || '',
      completedAt || '',
    ]
  );
}

async function saveBrothLogEntry({ chatId, groupName = '', senderId = '', senderName = '', sender, storeId = '', store, payload, status, sheetWriteStatus }) {
  await ensureTables();
  const result = await run(
    `INSERT INTO broth_log_entries (chat_id, group_name, sender_id, sender_name, sender, store_id, store, payload_json, status, sheet_write_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chatId || '',
      groupName || '',
      senderId || '',
      senderName || sender || '',
      sender || senderName || senderId || '',
      storeId || '',
      store || 'Unknown',
      JSON.stringify(payload || {}),
      status || 'PENDING',
      sheetWriteStatus || 'PENDING',
    ]
  );
  return result.lastID;
}

async function updateBrothSheetStatus(id, sheetWriteStatus) {
  await ensureTables();
  await run(
    `UPDATE broth_log_entries SET sheet_write_status = ? WHERE id = ?`,
    [sheetWriteStatus || 'UNKNOWN', id]
  );
}

async function getRecentBrothLogs(limit = 10) {
  await ensureTables();
  return all(`SELECT * FROM broth_log_entries ORDER BY created_at DESC LIMIT ?`, [limit]);
}

async function getLastBrothLog() {
  const rows = await getRecentBrothLogs(1);
  return rows[0] || null;
}

/**
 * Get recent checks with their readings.
 */
async function getRecentChecks(limit = 20) {
  await ensureTables();
  const checks = await all(
    `SELECT * FROM food_safety_checks ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
  for (const check of checks) {
    check.readings = await all(
      `SELECT * FROM food_safety_readings WHERE check_id = ?`,
      [check.check_id]
    );
  }
  return checks;
}

/**
 * Get summary stats for the dashboard.
 */
async function getCheckStats() {
  await ensureTables();
  const row = await get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN result = 'PASS' THEN 1 ELSE 0 END) as pass_count,
      SUM(CASE WHEN result = 'FAIL' THEN 1 ELSE 0 END) as fail_count,
      SUM(CASE WHEN result = 'NEEDS_REVIEW' THEN 1 ELSE 0 END) as needs_review_count,
      MAX(created_at) as last_check_at
    FROM food_safety_checks
  `);
  return row;
}

/**
 * Get the most recent check.
 */
async function getLastCheck() {
  await ensureTables();
  const checks = await getRecentChecks(1);
  return checks[0] || null;
}

/**
 * Get the last warning sent.
 */
async function getLastWarning() {
  await ensureTables();
  const w = await get(
    `SELECT w.*, c.image_path, c.store FROM food_safety_warnings w
     JOIN food_safety_checks c ON c.check_id = w.check_id
     ORDER BY w.sent_at DESC LIMIT 1`
  );
  return w || null;
}

async function getSheetQueueStatus() {
  await ensureTables();
  const counts = await get(`
    SELECT
      SUM(CASE WHEN status IN ('PENDING', 'FAILED') THEN 1 ELSE 0 END) as pending_count,
      MAX(CASE WHEN status = 'SENT' THEN sent_at ELSE NULL END) as last_synced_at,
      MAX(created_at) as last_written_at
    FROM food_safety_sheet_queue
  `);
  const last = await get(`
    SELECT * FROM food_safety_sheet_queue
    ORDER BY created_at DESC
    LIMIT 1
  `);
  return {
    pendingCount: counts?.pending_count || 0,
    lastSyncedAt: counts?.last_synced_at || null,
    lastWrittenAt: counts?.last_written_at || null,
    lastStatus: last?.status || null,
    lastError: last?.last_error || '',
    lastWriteStatus: await getLastSheetWriteStatus(),
  };
}

module.exports = {
  ensureTables,
  saveCheck,
  saveReadings,
  saveWarning,
  enqueueSheetWrite,
  markSheetWriteSent,
  getPendingSheetWrites,
  markQueueItemSent,
  markQueueItemFailed,
  saveSheetWriteStatus,
  getLastSheetWriteStatus,
  saveIncident,
  saveImageAudit,
  saveWorkflowRun,
  saveBrothLogEntry,
  updateBrothSheetStatus,
  getRecentBrothLogs,
  getLastBrothLog,
  getRecentChecks,
  getCheckStats,
  getLastCheck,
  getLastWarning,
  getSheetQueueStatus,
};
