/**
 * Template Sync Service
 *
 * Polls Daily_Entry_Template from Google Sheets every N minutes,
 * persists to SQLite, and updates the in-process runtime cache.
 *
 * The parsing and persistence path is centralized in
 * daily-entry-template-service.js so admin force-sync, scheduled sync, and
 * tests all exercise the same runtime code.
 */

const dailyTemplate = require('./daily-entry-template-service');
const { run } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('whatsapp');

let _timer        = null;
let _syncing      = false;
let _lastResult   = null; // { status, rowCount, version, syncedAt, error }

// ── Core sync ─────────────────────────────────────────────────────────────────
async function syncOnce() {
  if (_syncing) { log.info('Template sync already in progress — skipping'); return _lastResult; }
  _syncing = true;
  const startedAt = new Date().toISOString();
  let logId = null;

  try {
    // Write sync log start
    const logRow = await run(
      `INSERT INTO template_sync_log (started_at, status) VALUES (?, 'RUNNING')`,
      [startedAt]
    );
    logId = logRow.lastID;

    const template = await dailyTemplate.syncFromGoogleSheet();
    const version = template.template_version;
    const completedAt = new Date().toISOString();

    await run(
      `UPDATE template_sync_log SET completed_at=?, status='SUCCESS', row_count=?, version=? WHERE id=?`,
      [completedAt, template.item_count, version, logId]
    );

    _lastResult = {
      status: 'SUCCESS',
      rowCount: template.item_count,
      version,
      syncedAt: template.last_sync_at || startedAt,
      error: null,
      source: template.source,
      headerRow: template.header_row,
    };
    log.info('Template sync complete', { count: template.item_count, version, tab: template.tab });

  } catch (err) {
    const completedAt = new Date().toISOString();
    log.warn('Template sync failed', { error: err.message });

    if (logId) {
      await run(
        `UPDATE template_sync_log SET completed_at=?, status='FAILED', error=? WHERE id=?`,
        [completedAt, err.message, logId]
      ).catch(() => {});
    }

    _lastResult = { status: 'FAILED', rowCount: 0, version: null, syncedAt: startedAt, error: err.message };
  } finally {
    _syncing = false;
  }

  return _lastResult;
}

// ── Scheduler ─────────────────────────────────────────────────────────────────
function start() {
  const intervalMs = parseInt(process.env.TEMPLATE_SYNC_INTERVAL_MS || '300000', 10);

  // Immediate first sync (non-blocking)
  syncOnce().catch(() => {});

  _timer = setInterval(() => {
    syncOnce().catch(err => log.warn('Template sync interval error', { error: err.message }));
  }, intervalMs);

  _timer.unref(); // Don't prevent process exit
  log.info('Template sync service started', { intervalMs });
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

function getLastResult()  { return _lastResult; }
function isSyncing()      { return _syncing; }

// ── Recent sync log ───────────────────────────────────────────────────────────
async function getRecentSyncLog(limit = 10) {
  const { all } = require('../storage/sqlite');
  return all(
    `SELECT * FROM template_sync_log ORDER BY id DESC LIMIT ?`, [limit]
  );
}

module.exports = { start, stop, syncOnce, getLastResult, isSyncing, getRecentSyncLog };
