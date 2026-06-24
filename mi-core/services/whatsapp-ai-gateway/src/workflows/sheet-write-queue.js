/**
 * Sheet Write Queue Service
 *
 * Guarantees that no confirmed data is ever lost due to Google Sheet failures.
 *
 * Flow:
 *   1. Workflow confirmed → try sheet write
 *   2. If sheet write fails → save to queue
 *   3. User sees "Saved locally. Google Sheet write queued."
 *   4. Retry every 5 minutes
 *   5. Manager alert still sends (even if sheet is queued)
 *   6. Dashboard shows pending/failed count
 *
 * Table: sheet_write_queue
 */

const sheetsClient = require('../google/sheets-client');
const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('whatsapp');

let initialized = false;
let _retryTimer = null;

const STATUS = { PENDING: 'PENDING', SENT: 'SENT', FAILED: 'FAILED' };

// ── Schema ──────────────────────────────────────────────────────────────────
async function ensureTables() {
  if (initialized) return;
  await run(`
    CREATE TABLE IF NOT EXISTS sheet_write_queue (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_type    TEXT NOT NULL,
      store_id         TEXT,
      payload_json     TEXT NOT NULL,
      target_sheet     TEXT,
      status           TEXT NOT NULL DEFAULT 'PENDING',
      attempt_count    INTEGER NOT NULL DEFAULT 0,
      last_error       TEXT,
      created_at       TEXT DEFAULT (datetime('now')),
      last_attempt_at  TEXT,
      sent_at          TEXT
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_queue_status ON sheet_write_queue(status, created_at)`);
  initialized = true;
}

// ── Enqueue ─────────────────────────────────────────────────────────────────
/**
 * Add a workflow to the sheet write queue.
 * Called when sheet write fails.
 *
 * @param {string} workflowType  — 'daily_entry' | 'temperature_check'
 * @param {string} storeId
 * @param {Object} payload      — the confirmed data
 * @param {string} [targetSheet] — sheet tab name override
 * @param {string} [lastError]  — error from failed attempt
 */
async function enqueue({ workflowType, storeId, payload, targetSheet = null, lastError = null }) {
  await ensureTables();
  const result = await run(
    `INSERT INTO sheet_write_queue
     (workflow_type, store_id, payload_json, target_sheet, status, attempt_count, last_error, created_at)
     VALUES (?,?,?,?,?,0,?,datetime('now'))`,
    [workflowType, storeId || '', JSON.stringify(payload), targetSheet || '', STATUS.PENDING, lastError || '']
  );
  log.info('Sheet write queued', { queueId: result.lastID, workflowType, storeId });
  return result.lastID;
}

// ── Retry pending ───────────────────────────────────────────────────────────
/**
 * Retry all PENDING and FAILED items.
 * Returns count of retried + results per item.
 */
async function retryAll() {
  await ensureTables();
  const rows = await all(
    `SELECT * FROM sheet_write_queue
     WHERE status IN ('PENDING', 'FAILED')
     AND attempt_count < 10
     ORDER BY created_at ASC`
  );

  const results = [];
  for (const row of rows) {
    const result = await retryItem(row.id, row);
    results.push(result);
  }

  return { processed: rows.length, results };
}

// ── Retry single item ──────────────────────────────────────────────────────
async function retryItem(id, row = null) {
  if (!row) {
    const rows = await all(`SELECT * FROM sheet_write_queue WHERE id = ?`, [id]);
    if (!rows.length) return { id, status: 'NOT_FOUND' };
    row = rows[0];
  }

  const now = new Date().toISOString();
  const maxAttempts = 10;

  await run(
    `UPDATE sheet_write_queue SET attempt_count = attempt_count + 1, last_attempt_at = ? WHERE id = ?`,
    [now, id]
  );

  try {
    const payload = JSON.parse(row.payload_json || '{}');
    const tab = row.target_sheet || getDefaultSheet(row.workflow_type);

    // Build rows from payload
    const rowsData = buildSheetRows(row.workflow_type, payload);

    await sheetsClient.appendValues({
      spreadsheetId: process.env.FOOD_SAFETY_LOG_SPREADSHEET_ID || undefined,
      tab,
      values: rowsData,
    });

    await run(
      `UPDATE sheet_write_queue SET status = ?, sent_at = ?, last_error = NULL WHERE id = ?`,
      [STATUS.SENT, now, id]
    );

    log.info('Sheet write retry success', { id, workflowType: row.workflow_type });
    return { id, status: STATUS.SENT };

  } catch (err) {
    const newCount = (row.attempt_count || 0) + 1;
    const newStatus = newCount >= maxAttempts ? STATUS.FAILED : STATUS.PENDING;
    await run(
      `UPDATE sheet_write_queue SET status = ?, last_error = ? WHERE id = ?`,
      [newStatus, err.message, id]
    );
    log.warn('Sheet write retry failed', { id, error: err.message, attempt: newCount });
    return { id, status: newStatus, error: err.message };
  }
}

// ── Mark resolved ──────────────────────────────────────────────────────────
async function markResolved(id) {
  await ensureTables();
  await run(`UPDATE sheet_write_queue SET status = 'RESOLVED' WHERE id = ?`, [id]);
  log.info('Sheet queue item marked resolved', { id });
}

// ── Query ───────────────────────────────────────────────────────────────────
async function getQueue(status = null) {
  await ensureTables();
  const sql = status
    ? `SELECT * FROM sheet_write_queue WHERE status = ? ORDER BY created_at ASC`
    : `SELECT * FROM sheet_write_queue ORDER BY created_at DESC`;
  const params = status ? [status] : [];
  return all(sql, params);
}

async function getStats() {
  await ensureTables();
  const s = await get(`
    SELECT
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_count,
      SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent_count,
      MAX(CASE WHEN status = 'SENT' THEN sent_at ELSE NULL END) as last_sent_at,
      MAX(last_attempt_at) as last_attempt_at,
      MAX(created_at) as last_created_at
    FROM sheet_write_queue
  `);
  return s;
}

// ── Scheduler ──────────────────────────────────────────────────────────────
function startRetryScheduler() {
  if (_retryTimer) return;
  const intervalMs = parseInt(process.env.SHEET_QUEUE_RETRY_INTERVAL_MS || '300000', 10);
  _retryTimer = setInterval(() => {
    checkAndRetry().catch(err => log.warn('Sheet queue retry error', { error: err.message }));
  }, intervalMs);
  _retryTimer.unref();
  log.info('Sheet queue retry scheduler started', { intervalMs });
}

function stop() {
  if (_retryTimer) { clearInterval(_retryTimer); _retryTimer = null; }
}

async function checkAndRetry() {
  const stats = await getStats();
  if ((stats.pending_count || 0) === 0 && (stats.failed_count || 0) === 0) return;
  log.info('Sheet queue retry check', { pending: stats.pending_count, failed: stats.failed_count });
  await retryAll();
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function getDefaultSheet(workflowType) {
  switch (workflowType) {
    case 'daily_entry': return process.env.LOG_SHEET || 'Daily_Entry_Log';
    case 'temperature_check': return process.env.TEMPERATURE_LOG_SHEET || 'Food_Safety_Temperature_Log';
    case 'template_ocr': return process.env.TEMPLATE_OCR_LOG_SHEET || 'WhatsApp_AI_Daily_Log';
    default: return process.env.LOG_SHEET || 'Daily_Entry_Log';
  }
}

function buildSheetRows(workflowType, payload) {
  if (workflowType === 'daily_entry' && Array.isArray(payload.rows)) {
    return payload.rows.map(r => [payload.timestamp || new Date().toISOString(), payload.store || '', r.item || '', r.value || '', r.unit || '', r.status || 'PASS', r.target || '']);
  }
  if (workflowType === 'temperature_check' && Array.isArray(payload.results)) {
    return payload.results.map(r => [payload.timestamp || new Date().toISOString(), payload.store || '', r.name || '', r.value || '', r.unit || '°F', r.status || 'PASS', r.target || '']);
  }
  if (workflowType === 'template_ocr' && Array.isArray(payload.rows)) {
    return payload.rows;
  }
  // Generic fallback
  return [[new Date().toISOString(), payload.store || '', JSON.stringify(payload)]];
}

// ── Public API ──────────────────────────────────────────────────────────────
module.exports = {
  STATUS,
  ensureTables,
  enqueue,
  retryAll,
  retryItem,
  markResolved,
  getQueue,
  getStats,
  startRetryScheduler,
  stop,
  checkAndRetry,
};
