/**
 * Runtime Config
 *
 * Provides config read/write with SQLite priority over .env.
 * Enables dashboard-based config without .env editing or restart.
 *
 * Priority:
 *   1. SQLite app_config table
 *   2. process.env fallback
 *   3. default value
 *
 * Supported keys:
 *   MANAGER_ALERTS_ENABLED
 *   MANAGER_ALERT_GROUP_CHAT_ID
 *   MANAGER_ALERT_GROUP_NAME
 *   STORE_GROUPS_LOCKED
 *   DAILY_HEALTH_REPORT_ENABLED
 *   DAILY_HEALTH_REPORT_TIME
 *   DAILY_HEALTH_REPORT_CHAT_ID
 *   GOOGLE_SHEETS_ENABLED
 *   TEMPLATE_SHEET_URL
 *   LOG_SHEET_URL
 *   YOLINK_ENABLED
 *   YOLINK_CLIENT_ID
 *   YOLINK_CLIENT_SECRET
 *   TEMPLATE_SYNC_ENABLED
 *   PILOT_START_DATE
 */

const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('whatsapp');

let initialized = false;
let configCache = new Map();
let cacheTime = 0;
const CACHE_TTL_MS = 60_000; // 1 minute cache

// ── Schema ──────────────────────────────────────────────────────────────────
async function ensureTables() {
  if (initialized) return;
  await run(`
    CREATE TABLE IF NOT EXISTS app_config (
      key   TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  initialized = true;
}

// ── Core ─────────────────────────────────────────────────────────────────────
function getConfig(key, defaultVal = null) {
  // Check cache first
  if (configCache.has(key) && (Date.now() - cacheTime) < CACHE_TTL_MS) {
    const cached = configCache.get(key);
    if (cached !== undefined) return cached;
  }
  // SQLite takes priority over .env
  // Note: synchronous access uses cached module state — async reload for fresh DB values
  return defaultVal;
}

// Async version — reads from DB then falls back to .env
async function getConfigAsync(key, defaultVal = null) {
  await ensureTables();

  // Check DB
  const row = await get(`SELECT value FROM app_config WHERE key = ?`, [key]);
  if (row && row.value !== null && row.value !== undefined) {
    configCache.set(key, row.value);
    cacheTime = Date.now();
    return row.value;
  }

  // Fall back to env
  const envVal = process.env[key];
  if (envVal !== undefined) {
    configCache.set(key, envVal);
    cacheTime = Date.now();
    return envVal;
  }

  configCache.set(key, defaultVal);
  cacheTime = Date.now();
  return defaultVal;
}

async function setConfig(key, value) {
  await ensureTables();
  await run(
    `INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
    [key, String(value ?? '')]
  );
  configCache.set(key, String(value ?? ''));
  cacheTime = Date.now();
  log.info('Config updated', { key, value: value !== undefined ? value : '(cleared)' });
}

async function deleteConfig(key) {
  await ensureTables();
  await run(`DELETE FROM app_config WHERE key = ?`, [key]);
  configCache.delete(key);
  cacheTime = Date.now();
}

async function getBoolean(key, defaultVal = false) {
  const val = await getConfigAsync(key, defaultVal ? 'true' : 'false');
  return val === 'true' || val === true || val === '1';
}

async function getNumber(key, defaultVal = 0) {
  const val = await getConfigAsync(key, null);
  if (val === null || val === undefined || val === '') return defaultVal;
  const n = parseFloat(val);
  return isNaN(n) ? defaultVal : n;
}

function refreshCache() {
  configCache.clear();
  cacheTime = 0;
  log.info('Config cache cleared');
}

// ── Bulk read ─────────────────────────────────────────────────────────────────
async function getAllConfig() {
  await ensureTables();
  const rows = await all(`SELECT key, value, updated_at FROM app_config ORDER BY key ASC`);
  return rows.reduce((acc, r) => {
    acc[r.key] = { value: r.value, updated_at: r.updated_at };
    return acc;
  }, {});
}

async function getConfigByPrefix(prefix) {
  await ensureTables();
  const rows = await all(
    `SELECT key, value, updated_at FROM app_config WHERE key LIKE ? ORDER BY key ASC`,
    [prefix + '%']
  );
  return rows.reduce((acc, r) => {
    acc[r.key] = { value: r.value, updated_at: r.updated_at };
    return acc;
  }, {});
}

// ── Config metadata (non-sensitive) ───────────────────────────────────────────
async function getConfigStatus() {
  const keys = [
    'MANAGER_ALERTS_ENABLED',
    'MANAGER_ALERT_GROUP_CHAT_ID',
    'MANAGER_ALERT_GROUP_NAME',
    'STORE_GROUPS_LOCKED',
    'DAILY_HEALTH_REPORT_ENABLED',
    'DAILY_HEALTH_REPORT_CHAT_ID',
    'GOOGLE_SHEETS_ENABLED',
    'TEMPLATE_SHEET_URL',
    'LOG_SHEET_URL',
    'YOLINK_ENABLED',
    'TEMPLATE_SYNC_ENABLED',
    'PILOT_START_DATE',
  ];

  await ensureTables();
  const dbConfig = await getAllConfig();

  return keys.map(key => {
    const dbVal = dbConfig[key]?.value;
    const envVal = process.env[key];
    const source = dbVal !== undefined ? 'db' : envVal !== undefined ? 'env' : 'default';
    const effectiveVal = dbVal !== undefined ? dbVal : envVal || '';

    // Hide sensitive values
    const sensitive = /SECRET|TOKEN|KEY|PASSWORD|CREDENTIAL/i.test(key);
    const displayVal = sensitive
      ? (effectiveVal ? '(configured)' : '(not set)')
      : (effectiveVal || '(not set)');

    return {
      key,
      configured: !!(dbVal !== undefined || envVal !== undefined),
      source,
      display: displayVal,
      db_value: dbVal !== undefined ? dbVal : null,
      updated_at: dbConfig[key]?.updated_at || null,
    };
  });
}

module.exports = {
  getConfig,
  getConfigAsync,
  setConfig,
  deleteConfig,
  getBoolean,
  getNumber,
  refreshCache,
  getAllConfig,
  getConfigByPrefix,
  getConfigStatus,
};