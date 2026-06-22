/**
 * Pilot Metrics Service
 *
 * Tracks operational pilot KPIs across 3 stores over 7 days.
 * Stores: Stone Oak, Bandera, Rim
 *
 * Metrics tracked:
 *   - Daily Entry Started / Completed
 *   - Completion Time
 *   - Warnings / Manager Alerts
 *   - Missing Logs
 *   - Language Used
 *   - Sheet Queue Events
 */

const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('whatsapp');

let initialized = false;

const PILOT_STORES = ['stone_oak', 'bandera', 'rim'];
const PILOT_DURATION_DAYS = 7;
const COMPLETION_TARGET = 0.95;

// ── Schema ──────────────────────────────────────────────────────────────────
async function ensureTables() {
  if (initialized) return;
  await run(`
    CREATE TABLE IF NOT EXISTS pilot_daily_logs (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      pilot_day           INTEGER NOT NULL,
      date                TEXT NOT NULL,
      store_id            TEXT NOT NULL,
      store_name          TEXT NOT NULL,
      entry_started       INTEGER DEFAULT 0,
      entry_completed     INTEGER DEFAULT 0,
      completion_time_sec INTEGER DEFAULT 0,
      warnings            INTEGER DEFAULT 0,
      manager_alerts      INTEGER DEFAULT 0,
      missing_logs        INTEGER DEFAULT 0,
      language_used       TEXT DEFAULT 'en',
      sheet_queue_ok      INTEGER DEFAULT 0,
      sheet_queue_fail    INTEGER DEFAULT 0,
      notes               TEXT DEFAULT '',
      created_at          TEXT DEFAULT (datetime('now')),
      updated_at          TEXT DEFAULT (datetime('now'))
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_pilot_date ON pilot_daily_logs(date)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_pilot_store ON pilot_daily_logs(store_id)`);

  await run(`
    CREATE TABLE IF NOT EXISTS pilot_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  initialized = true;
}

// ── Pilot Config ────────────────────────────────────────────────────────────
async function getPilotStartDate() {
  await ensureTables();
  const row = await get(`SELECT value FROM pilot_config WHERE key = 'start_date'`);
  return row ? row.value : null;
}

async function setPilotStartDate(dateStr) {
  await ensureTables();
  await run(`INSERT OR REPLACE INTO pilot_config (key, value) VALUES ('start_date', ?)`, [dateStr]);
  log.info('Pilot start date set', { startDate: dateStr });
}

async function isPilotActive() {
  const startDate = await getPilotStartDate();
  if (!startDate) return false;
  const start = new Date(startDate);
  const now = new Date();
  const daysDiff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return daysDiff >= 0 && daysDiff < PILOT_DURATION_DAYS;
}

async function getPilotDay() {
  const startDate = await getPilotStartDate();
  if (!startDate) return null;
  const start = new Date(startDate);
  const now = new Date();
  const daysDiff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  if (daysDiff < 0 || daysDiff >= PILOT_DURATION_DAYS) return null;
  return daysDiff + 1;
}

// ── Record Events ───────────────────────────────────────────────────────────
async function recordEntry({
  storeId, storeName,
  started = false, completed = false,
  completionTimeSec = 0,
  warnings = 0, managerAlerts = 0,
  language = 'en',
  sheetQueueOk = false, sheetQueueFail = false,
  notes = '',
}) {
  await ensureTables();
  const pilotDay = await getPilotDay();
  if (!pilotDay) return null;

  const today = new Date().toISOString().slice(0, 10);
  const existing = await get(
    `SELECT id FROM pilot_daily_logs WHERE date = ? AND store_id = ?`,
    [today, storeId]
  );

  if (existing) {
    await run(`
      UPDATE pilot_daily_logs SET
        entry_started = entry_started + ?,
        entry_completed = entry_completed + ?,
        completion_time_sec = CASE WHEN ? > 0 THEN ? ELSE completion_time_sec END,
        warnings = warnings + ?,
        manager_alerts = manager_alerts + ?,
        language_used = ?,
        sheet_queue_ok = sheet_queue_ok + ?,
        sheet_queue_fail = sheet_queue_fail + ?,
        notes = CASE WHEN ? != '' THEN notes || '; ' || ? ELSE notes END,
        updated_at = datetime('now')
      WHERE id = ?
    `, [
      started ? 1 : 0,
      completed ? 1 : 0,
      completionTimeSec, completionTimeSec,
      warnings,
      managerAlerts,
      language,
      sheetQueueOk ? 1 : 0,
      sheetQueueFail ? 1 : 0,
      notes, notes,
      existing.id,
    ]);
    return existing.id;
  }

  const result = await run(`
    INSERT INTO pilot_daily_logs
    (pilot_day, date, store_id, store_name, entry_started, entry_completed,
     completion_time_sec, warnings, manager_alerts, missing_logs,
     language_used, sheet_queue_ok, sheet_queue_fail, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `, [
    pilotDay, today, storeId, storeName || storeId,
    started ? 1 : 0,
    completed ? 1 : 0,
    completionTimeSec,
    warnings,
    managerAlerts,
    completed ? 0 : 1,
    language,
    sheetQueueOk ? 1 : 0,
    sheetQueueFail ? 1 : 0,
    notes,
  ]);
  return result.lastID;
}

// ── Query: Per-store KPIs ───────────────────────────────────────────────────
async function getStoreKPIs(storeId) {
  await ensureTables();
  const row = await get(`
    SELECT
      COUNT(*) as total_days,
      SUM(entry_completed) as completed_entries,
      SUM(entry_started) as started_entries,
      ROUND(AVG(CASE WHEN completion_time_sec > 0 THEN completion_time_sec END), 0) as avg_completion_sec,
      SUM(warnings) as total_warnings,
      SUM(manager_alerts) as total_alerts,
      SUM(missing_logs) as total_missing,
      SUM(sheet_queue_fail) as total_queue_fails
    FROM pilot_daily_logs WHERE store_id = ?
  `, [storeId]);
  if (!row || !row.total_days) return null;
  row.completion_rate = row.total_days > 0
    ? Math.round((row.completed_entries / row.total_days) * 100)
    : 0;
  row.passes_target = row.completion_rate >= (COMPLETION_TARGET * 100);
  return row;
}

// ── Query: All daily logs ───────────────────────────────────────────────────
async function getAllDailyLogs() {
  await ensureTables();
  return all(`SELECT * FROM pilot_daily_logs ORDER BY date ASC, store_id ASC`);
}

// ── Query: Summary for dashboard ────────────────────────────────────────────
async function getPilotSummary() {
  await ensureTables();
  const active = await isPilotActive();
  const pilotDay = await getPilotDay();
  const startDate = await getPilotStartDate();

  const storeKPIs = {};
  for (const sid of PILOT_STORES) {
    storeKPIs[sid] = await getStoreKPIs(sid);
  }

  const totals = await get(`
    SELECT
      COUNT(DISTINCT date) as days_recorded,
      SUM(entry_started) as total_started,
      SUM(entry_completed) as total_completed,
      ROUND(AVG(CASE WHEN completion_time_sec > 0 THEN completion_time_sec END), 0) as avg_completion_sec,
      SUM(warnings) as total_warnings,
      SUM(manager_alerts) as total_alerts,
      SUM(missing_logs) as total_missing,
      SUM(sheet_queue_fail) as total_queue_fails,
      SUM(sheet_queue_ok) as total_queue_ok
    FROM pilot_daily_logs
  `);

  const overallRate = totals && totals.days_recorded > 0
    ? Math.round((totals.total_completed / (totals.days_recorded * PILOT_STORES.length)) * 100)
    : 0;

  const allPass = Object.values(storeKPIs).every(k => k && k.passes_target);

  return {
    active,
    pilotDay,
    startDate,
    durationDays: PILOT_DURATION_DAYS,
    completionTarget: COMPLETION_TARGET * 100,
    stores: PILOT_STORES,
    storeKPIs,
    totals: totals || {},
    overallCompletionRate: overallRate,
    allStoresPass: allPass,
    pilotResult: !active && startDate ? (allPass ? 'PASS' : 'FAIL') : 'IN_PROGRESS',
  };
}

// ── API: Get status for REST endpoint ───────────────────────────────────────
async function getStatus() {
  return getPilotSummary();
}

module.exports = {
  ensureTables,
  getPilotStartDate,
  setPilotStartDate,
  isPilotActive,
  getPilotDay,
  recordEntry,
  getStoreKPIs,
  getAllDailyLogs,
  getPilotSummary,
  getStatus,
  PILOT_STORES,
  PILOT_DURATION_DAYS,
  COMPLETION_TARGET,
};
