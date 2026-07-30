/**
 * HealthDatabase — SQLite layer for Mi Health V1
 * Manages health.db with full deduplication and incremental sync.
 * All data stays local. No cloud writes.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.HEALTH_DB_PATH ||
  path.join(__dirname, '..', 'data', 'health.db');

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;

-- One row per calendar day
CREATE TABLE IF NOT EXISTS daily_health (
  date            TEXT PRIMARY KEY,   -- YYYY-MM-DD
  steps           INTEGER DEFAULT 0,
  active_cals     REAL    DEFAULT 0,
  total_cals      REAL    DEFAULT 0,
  resting_hr      REAL,
  avg_hr          REAL,
  min_hr          REAL,
  max_hr          REAL,
  spo2_avg        REAL,
  spo2_min        REAL,
  hrv_ms          REAL,
  respiratory_rate REAL,
  stand_hours     INTEGER DEFAULT 0,
  active_minutes  INTEGER DEFAULT 0,
  recovery_score  REAL,
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- One row per sleep session (may be multiple per night for naps)
CREATE TABLE IF NOT EXISTS sleep_sessions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  date            TEXT NOT NULL,       -- calendar date the night belongs to (YYYY-MM-DD)
  source          TEXT DEFAULT 'apple-health',
  bedtime         TEXT,                -- ISO datetime
  wake_time       TEXT,
  total_mins      INTEGER DEFAULT 0,
  deep_mins       INTEGER DEFAULT 0,
  light_mins      INTEGER DEFAULT 0,
  rem_mins        INTEGER DEFAULT 0,
  awake_mins      INTEGER DEFAULT 0,
  quality_score   REAL,                -- 0-100 computed
  UNIQUE(date, bedtime)
);

-- HR time series for trend analysis
CREATE TABLE IF NOT EXISTS heart_rate_samples (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at TEXT NOT NULL UNIQUE,
  value       REAL NOT NULL,
  context     TEXT DEFAULT 'normal'   -- resting | workout | normal | sleep
);

-- One row per workout session
CREATE TABLE IF NOT EXISTS workouts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at    TEXT NOT NULL UNIQUE,
  date          TEXT NOT NULL,
  type          TEXT NOT NULL,         -- Running | Walking | Cycling | Strength | HIIT | Other
  duration_mins INTEGER DEFAULT 0,
  distance_km   REAL DEFAULT 0,
  active_cals   REAL DEFAULT 0,
  avg_hr        REAL,
  max_hr        REAL,
  elevation_m   REAL
);

-- Anomaly and trend alerts
CREATE TABLE IF NOT EXISTS health_alerts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  date        TEXT NOT NULL,
  alert_type  TEXT NOT NULL,   -- sleep_drop | hrv_drop | hr_spike | activity_drop | recovery_low
  severity    TEXT NOT NULL,   -- info | warning | critical
  metric      TEXT NOT NULL,
  value       REAL NOT NULL,
  baseline    REAL,
  change_pct  REAL,
  message_vi  TEXT NOT NULL,   -- Vietnamese alert message
  acknowledged INTEGER DEFAULT 0
);

-- Metadata / sync state
CREATE TABLE IF NOT EXISTS sync_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sleep_date ON sleep_sessions(date);
CREATE INDEX IF NOT EXISTS idx_hr_time    ON heart_rate_samples(recorded_at);
CREATE INDEX IF NOT EXISTS idx_wo_date    ON workouts(date);
CREATE INDEX IF NOT EXISTS idx_al_date    ON health_alerts(date, alert_type);
`;

let _db = null;

export function getDB() {
  if (_db) return _db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec(SCHEMA);
  return _db;
}

// ── daily_health ────────────────────────────────────────────────────────────

export function upsertDailyHealth(row) {
  const db = getDB();
  db.prepare(`
    INSERT INTO daily_health
      (date, steps, active_cals, total_cals, resting_hr, avg_hr, min_hr, max_hr,
       spo2_avg, spo2_min, hrv_ms, respiratory_rate, stand_hours, active_minutes, recovery_score, updated_at)
    VALUES
      (@date, @steps, @active_cals, @total_cals, @resting_hr, @avg_hr, @min_hr, @max_hr,
       @spo2_avg, @spo2_min, @hrv_ms, @respiratory_rate, @stand_hours, @active_minutes, @recovery_score, datetime('now'))
    ON CONFLICT(date) DO UPDATE SET
      steps           = COALESCE(excluded.steps, steps),
      active_cals     = COALESCE(excluded.active_cals, active_cals),
      total_cals      = COALESCE(excluded.total_cals, total_cals),
      resting_hr      = COALESCE(excluded.resting_hr, resting_hr),
      avg_hr          = COALESCE(excluded.avg_hr, avg_hr),
      min_hr          = COALESCE(excluded.min_hr, min_hr),
      max_hr          = COALESCE(excluded.max_hr, max_hr),
      spo2_avg        = COALESCE(excluded.spo2_avg, spo2_avg),
      spo2_min        = COALESCE(excluded.spo2_min, spo2_min),
      hrv_ms          = COALESCE(excluded.hrv_ms, hrv_ms),
      respiratory_rate= COALESCE(excluded.respiratory_rate, respiratory_rate),
      stand_hours     = COALESCE(excluded.stand_hours, stand_hours),
      active_minutes  = COALESCE(excluded.active_minutes, active_minutes),
      recovery_score  = COALESCE(excluded.recovery_score, recovery_score),
      updated_at      = datetime('now')
  `).run(row);
}

export function getDailyHealth(date) {
  return getDB().prepare('SELECT * FROM daily_health WHERE date = ?').get(date) || null;
}

export function getDailyHealthRange(startDate, endDate) {
  return getDB().prepare(
    'SELECT * FROM daily_health WHERE date BETWEEN ? AND ? ORDER BY date ASC'
  ).all(startDate, endDate);
}

export function getRecentDailyHealth(days = 7) {
  return getDB().prepare(`
    SELECT * FROM daily_health
    WHERE date >= date('now', ?)
    ORDER BY date DESC
  `).all(`-${days} days`);
}

// ── sleep_sessions ──────────────────────────────────────────────────────────

export function upsertSleepSession(row) {
  getDB().prepare(`
    INSERT OR IGNORE INTO sleep_sessions
      (date, source, bedtime, wake_time, total_mins, deep_mins, light_mins, rem_mins, awake_mins, quality_score)
    VALUES
      (@date, @source, @bedtime, @wake_time, @total_mins, @deep_mins, @light_mins, @rem_mins, @awake_mins, @quality_score)
  `).run(row);
}

export function getSleepByDate(date) {
  return getDB().prepare(
    'SELECT * FROM sleep_sessions WHERE date = ? ORDER BY total_mins DESC LIMIT 1'
  ).get(date) || null;
}

export function getRecentSleep(days = 7) {
  return getDB().prepare(`
    SELECT * FROM sleep_sessions
    WHERE date >= date('now', ?)
    ORDER BY date DESC
  `).all(`-${days} days`);
}

// ── heart_rate_samples ───────────────────────────────────────────────────────

export function insertHRSample(row) {
  try {
    getDB().prepare(
      'INSERT OR IGNORE INTO heart_rate_samples (recorded_at, value, context) VALUES (?, ?, ?)'
    ).run(row.recorded_at, row.value, row.context || 'normal');
  } catch { /* dedup */ }
}

export function bulkInsertHRSamples(rows) {
  const db = getDB();
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO heart_rate_samples (recorded_at, value, context) VALUES (?, ?, ?)'
  );
  for (const r of rows) stmt.run(r.recorded_at, r.value, r.context || 'normal');
}

// ── workouts ─────────────────────────────────────────────────────────────────

export function upsertWorkout(row) {
  getDB().prepare(`
    INSERT OR IGNORE INTO workouts
      (started_at, date, type, duration_mins, distance_km, active_cals, avg_hr, max_hr, elevation_m)
    VALUES
      (@started_at, @date, @type, @duration_mins, @distance_km, @active_cals, @avg_hr, @max_hr, @elevation_m)
  `).run(row);
}

export function getWorkoutsByDate(date) {
  return getDB().prepare('SELECT * FROM workouts WHERE date = ? ORDER BY started_at').all(date);
}

export function getRecentWorkouts(days = 7) {
  return getDB().prepare(`
    SELECT * FROM workouts
    WHERE date >= date('now', ?)
    ORDER BY started_at DESC
  `).all(`-${days} days`);
}

// ── health_alerts ─────────────────────────────────────────────────────────────

export function insertAlert(row) {
  getDB().prepare(`
    INSERT INTO health_alerts
      (date, alert_type, severity, metric, value, baseline, change_pct, message_vi)
    VALUES
      (@date, @alert_type, @severity, @metric, @value, @baseline, @change_pct, @message_vi)
  `).run(row);
}

export function getActiveAlerts(days = 7) {
  return getDB().prepare(`
    SELECT * FROM health_alerts
    WHERE date >= date('now', ?) AND acknowledged = 0
    ORDER BY created_at DESC
  `).all(`-${days} days`);
}

export function acknowledgeAlert(id) {
  getDB().prepare('UPDATE health_alerts SET acknowledged = 1 WHERE id = ?').run(id);
}

// ── sync_state ────────────────────────────────────────────────────────────────

export function getSyncState(key) {
  const row = getDB().prepare('SELECT value FROM sync_state WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setSyncState(key, value) {
  getDB().prepare(`
    INSERT INTO sync_state (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, String(value));
}

// ── summary queries ──────────────────────────────────────────────────────────

export function getWeeklySummary(weekStartDate) {
  const db = getDB();
  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const endDate = weekEnd.toISOString().split('T')[0];

  const days = getDailyHealthRange(weekStartDate, endDate);
  if (!days.length) return null;

  const avg = (arr, key) => {
    const vals = arr.map(r => r[key]).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const sum = (arr, key) => arr.reduce((a, r) => a + (r[key] || 0), 0);

  const sleepRows = db.prepare(`
    SELECT * FROM sleep_sessions
    WHERE date BETWEEN ? AND ?
  `).all(weekStartDate, endDate);

  return {
    week_start: weekStartDate,
    week_end: endDate,
    days_with_data: days.length,
    avg_steps: Math.round(avg(days, 'steps')),
    total_steps: sum(days, 'steps'),
    avg_active_cals: Math.round(avg(days, 'active_cals')),
    avg_resting_hr: avg(days, 'resting_hr')?.toFixed(1),
    avg_hrv: avg(days, 'hrv_ms')?.toFixed(1),
    avg_spo2: avg(days, 'spo2_avg')?.toFixed(1),
    avg_sleep_mins: sleepRows.length
      ? Math.round(sleepRows.reduce((a, r) => a + r.total_mins, 0) / sleepRows.length)
      : null,
    avg_deep_mins: sleepRows.length
      ? Math.round(sleepRows.reduce((a, r) => a + r.deep_mins, 0) / sleepRows.length)
      : null,
    avg_sleep_quality: sleepRows.length
      ? (sleepRows.reduce((a, r) => a + (r.quality_score || 0), 0) / sleepRows.length).toFixed(1)
      : null,
    workouts: db.prepare(
      'SELECT COUNT(*) as count FROM workouts WHERE date BETWEEN ? AND ?'
    ).get(weekStartDate, endDate)?.count || 0,
  };
}

export function getMonthSummary(yearMonth) {
  const [year, month] = yearMonth.split('-').map(Number);
  const startDate = `${yearMonth}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

  const days = getDailyHealthRange(startDate, endDate);
  if (!days.length) return null;

  const avg = (arr, key) => {
    const vals = arr.map(r => r[key]).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const sleepRows = getDB().prepare(
    'SELECT * FROM sleep_sessions WHERE date BETWEEN ? AND ?'
  ).all(startDate, endDate);

  return {
    month: yearMonth,
    days_with_data: days.length,
    avg_steps: Math.round(avg(days, 'steps')),
    total_steps: days.reduce((a, r) => a + (r.steps || 0), 0),
    avg_resting_hr: avg(days, 'resting_hr')?.toFixed(1),
    avg_hrv: avg(days, 'hrv_ms')?.toFixed(1),
    avg_sleep_mins: sleepRows.length
      ? Math.round(sleepRows.reduce((a, r) => a + r.total_mins, 0) / sleepRows.length)
      : null,
    workouts: getDB().prepare(
      'SELECT COUNT(*) as count FROM workouts WHERE date BETWEEN ? AND ?'
    ).get(startDate, endDate)?.count || 0,
  };
}
