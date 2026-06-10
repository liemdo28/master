const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { makeLogger } = require('../logger');

const log = makeLogger('message');
const dataDir = path.resolve('./data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = process.env.GATEWAY_DB_PATH
  ? path.resolve(process.env.GATEWAY_DB_PATH)
  : (process.env.npm_lifecycle_event === 'test'
      ? path.join(dataDir, `gateway-test-${process.pid}.db`)
      : path.join(dataDir, 'gateway.db'));

let db;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH);
    db.serialize(() => {
      db.run('PRAGMA journal_mode = WAL');
      db.run('PRAGMA foreign_keys = ON');
      db.run('PRAGMA busy_timeout = 5000');
      initSchema();
    });
  }
  return db;
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      name TEXT,
      direction TEXT NOT NULL,
      message TEXT NOT NULL,
      intent TEXT,
      ai_replied INTEGER DEFAULT 0,
      timestamp TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp)`);
  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      phone TEXT PRIMARY KEY,
      name TEXT,
      first_seen TEXT,
      last_seen TEXT,
      message_count INTEGER DEFAULT 0
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    )
  `);
  // ── Template tables ──────────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS template_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_name TEXT NOT NULL UNIQUE,
      target_min REAL,
      target_max REAL,
      sort_order INTEGER,
      active INTEGER DEFAULT 1,
      section TEXT,
      template_version TEXT,
      last_sync_at TEXT
    )
  `);
  // Migration: add 'active' column if it doesn't exist (for databases created before this change)
  db.run(`ALTER TABLE template_items ADD COLUMN active INTEGER DEFAULT 1`, () => {});
  db.run(`CREATE INDEX IF NOT EXISTS idx_template_items_order ON template_items(sort_order)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS template_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_name TEXT NOT NULL,
      template_version TEXT,
      source TEXT,
      item_count INTEGER,
      payload_json TEXT NOT NULL,
      last_sync_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_template_cache_name ON template_cache(template_name, id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS template_sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      status TEXT,
      row_count INTEGER,
      version TEXT,
      error TEXT
    )
  `);

  // ── Agent session tables ──────────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS agent_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      chat_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      owner_name TEXT,
      store TEXT,
      state TEXT,
      active_workflow TEXT,
      started_at TEXT NOT NULL,
      last_activity_at TEXT,
      closed_at TEXT,
      close_reason TEXT
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_agent_sessions_chat ON agent_sessions(chat_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_agent_sessions_state ON agent_sessions(state)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      workflow TEXT NOT NULL,
      payload_json TEXT,
      status TEXT DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  `);

  // ── Sensor tables (Phase 1.2B) ─────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS sensors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL DEFAULT 'yolink',
      provider_device_id TEXT,
      store_id TEXT,
      store_name TEXT,
      location_name TEXT,
      item_name TEXT,
      sensor_type TEXT DEFAULT 'temperature',
      unit TEXT DEFAULT 'F',
      active INTEGER DEFAULT 1,
      trust_enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sensors_store ON sensors(store_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sensors_provider ON sensors(provider, provider_device_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL,
      store_id TEXT,
      item_name TEXT,
      value REAL,
      unit TEXT DEFAULT 'F',
      battery_level INTEGER,
      signal_status TEXT,
      online_status INTEGER DEFAULT 1,
      provider_timestamp TEXT,
      received_at TEXT DEFAULT (datetime('now')),
      raw_payload_json TEXT
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor ON sensor_readings(sensor_id, received_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sensor_readings_store ON sensor_readings(store_id, received_at)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS sensor_status_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      status TEXT,
      message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sensor_status_sensor ON sensor_status_events(sensor_id, created_at)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS sensor_item_mapping (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL,
      template_item_id INTEGER,
      store_id TEXT,
      item_name TEXT NOT NULL,
      mapping_confidence REAL DEFAULT 1.0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sensor_mapping_sensor ON sensor_item_mapping(sensor_id, active)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sensor_mapping_item ON sensor_item_mapping(store_id, item_name)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS sensor_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL,
      store_id TEXT,
      item_name TEXT,
      alert_type TEXT NOT NULL,
      reading_value REAL,
      target_min REAL,
      target_max REAL,
      duration_minutes INTEGER DEFAULT 0,
      store_alert_sent INTEGER DEFAULT 0,
      manager_alert_sent INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ACTIVE',
      created_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sensor_alerts_sensor ON sensor_alerts(sensor_id, status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sensor_alerts_store ON sensor_alerts(store_id, status)`);

  // ── Cross-validation tables (Phase 1.3B) ───────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS cross_validation_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_audit_log_id INTEGER,
      store_id TEXT,
      employee_id TEXT,
      item_name TEXT NOT NULL,
      human_value REAL,
      sensor_value REAL,
      photo_value REAL,
      difference_human_sensor REAL,
      difference_human_photo REAL,
      difference_sensor_photo REAL,
      status TEXT,
      resolution TEXT,
      resolved_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cross_val_store ON cross_validation_results(store_id, created_at)`);

  // ── Trust score tables (Phase 1.3C) ────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS employee_trust_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      employee_name TEXT,
      store_id TEXT,
      score REAL DEFAULT 80,
      total_matches INTEGER DEFAULT 0,
      total_mismatches INTEGER DEFAULT 0,
      total_submissions INTEGER DEFAULT 0,
      photo_pass_count INTEGER DEFAULT 0,
      last_updated TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_trust_unique ON employee_trust_scores(employee_id, store_id)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS sensor_trust_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL UNIQUE,
      score REAL DEFAULT 80,
      total_readings INTEGER DEFAULT 0,
      offline_count INTEGER DEFAULT 0,
      stale_count INTEGER DEFAULT 0,
      photo_confirm_count INTEGER DEFAULT 0,
      last_updated TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS store_compliance_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id TEXT NOT NULL,
      store_name TEXT,
      score REAL DEFAULT 80,
      match_rate REAL DEFAULT 0,
      mismatch_count INTEGER DEFAULT 0,
      missed_logs INTEGER DEFAULT 0,
      photo_audit_pass_rate REAL DEFAULT 0,
      last_updated TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_store_compliance_unique ON store_compliance_scores(store_id)`);

  log.info('SQLite schema ready', { path: DB_PATH });
}

const BUSY_RETRY_MAX = 3;
const BUSY_RETRY_DELAY_MS = 150;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isBusyError(err) {
  return err && (err.code === 'SQLITE_BUSY' || String(err.message).includes('SQLITE_BUSY'));
}

// Promise wrappers — with automatic retry on SQLITE_BUSY
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    const attempt = (retry) => {
      getDb().run(sql, params, function (err) {
        if (!err) { resolve(this); return; }
        if (isBusyError(err) && retry < BUSY_RETRY_MAX) {
          sleep(BUSY_RETRY_DELAY_MS).then(() => attempt(retry + 1));
        } else {
          log.warn('SQLite run error', { sql: sql.slice(0, 80), code: err.code, retry });
          reject(err);
        }
      });
    };
    attempt(0);
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    const attempt = (retry) => {
      getDb().all(sql, params, (err, rows) => {
        if (!err) { resolve(rows); return; }
        if (isBusyError(err) && retry < BUSY_RETRY_MAX) {
          sleep(BUSY_RETRY_DELAY_MS).then(() => attempt(retry + 1));
        } else {
          log.warn('SQLite all error', { sql: sql.slice(0, 80), code: err.code, retry });
          reject(err);
        }
      });
    };
    attempt(0);
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    const attempt = (retry) => {
      getDb().get(sql, params, (err, row) => {
        if (!err) { resolve(row); return; }
        if (isBusyError(err) && retry < BUSY_RETRY_MAX) {
          sleep(BUSY_RETRY_DELAY_MS).then(() => attempt(retry + 1));
        } else {
          log.warn('SQLite get error', { sql: sql.slice(0, 80), code: err.code, retry });
          reject(err);
        }
      });
    };
    attempt(0);
  });
}

function close() {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    const current = db;
    db = null;
    current.close(err => err ? reject(err) : resolve());
  });
}

module.exports = { getDb, run, all, get, close, DB_PATH };
