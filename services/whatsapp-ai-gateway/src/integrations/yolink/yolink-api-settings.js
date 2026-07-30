/**
 * YoLink API Settings Service — Phase C (CEO Parallel Validation)
 *
 * Stores YoLink Client ID and Secret securely. Never displays the
 * Client Secret after save (returns only a configured/not-configured flag).
 *
 * Storage order:
 *   1. SQLite app_config (primary — survives restart, no .env needed)
 *   2. .env fallback
 *
 * If credentials are not configured:
 *   - Dashboard shows: "YoLink API not configured. Human workflow remains active."
 *   - Human workflow continues normally.
 *   - No pilot block.
 */

const { run, all, get } = require('../../storage/sqlite');
const { makeLogger } = require('../../logger');
const crypto = require('crypto');

const log = makeLogger('yolink');

const KEY_CLIENT_ID = 'YOLINK_CLIENT_ID';
const KEY_CLIENT_SECRET = 'YOLINK_CLIENT_SECRET';
const KEY_ENABLED = 'YOLINK_ENABLED';

let initialized = false;

async function ensureSchema() {
  if (initialized) return;
  await run(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  initialized = true;
}

// ── Hash secret for "configured" check without exposing ────────────────────
function hashSecret(secret) {
  if (!secret) return null;
  return crypto.createHash('sha256').update(secret).digest('hex').slice(0, 12);
}

async function getStoredCredential(key) {
  await ensureSchema();
  const row = await get(`SELECT value, updated_at FROM app_config WHERE key = ?`, [key]);
  if (row && row.value) return { value: row.value, updated_at: row.updated_at };
  // Fallback to .env
  const envVal = process.env[key];
  if (envVal) return { value: envVal, updated_at: null, source: 'env' };
  return null;
}

async function getClientId() {
  const c = await getStoredCredential(KEY_CLIENT_ID);
  return c ? c.value : null;
}

async function getClientSecret() {
  const c = await getStoredCredential(KEY_CLIENT_SECRET);
  return c ? c.value : null;
}

async function isConfigured() {
  const id = await getClientId();
  const sec = await getClientSecret();
  return !!(id && sec);
}

async function isEnabledFlag() {
  const c = await getStoredCredential(KEY_ENABLED);
  if (c && (c.value === 'true' || c.value === '1')) return true;
  return process.env.YOLINK_ENABLED === 'true';
}

/**
 * Save credentials. The secret is NEVER returned in the response
 * after save (we only confirm it's stored via a short hash).
 */
async function saveCredentials({ clientId, clientSecret }) {
  await ensureSchema();
  if (!clientId) throw new Error('Client ID required');
  if (!clientSecret) throw new Error('Client Secret required');

  await run(
    `INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
    [KEY_CLIENT_ID, String(clientId)]
  );
  await run(
    `INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
    [KEY_CLIENT_SECRET, String(clientSecret)]
  );
  // Auto-enable when both credentials present
  await run(
    `INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
    [KEY_ENABLED, 'true']
  );
  // Sync to in-memory env for immediate effect in this process
  process.env.YOLINK_CLIENT_ID = String(clientId);
  process.env.YOLINK_CLIENT_SECRET = String(clientSecret);
  process.env.YOLINK_ENABLED = 'true';

  // Clear token cache so next call re-auths
  try { const auth = require('./yolink-auth'); auth.clearToken(); } catch (_) {}

  log.info('YoLink API credentials saved (secret hashed for display)');
  return {
    ok: true,
    client_id_preview: String(clientId).slice(0, 6) + '••••',
    secret_hash: hashSecret(clientSecret),
    enabled: true,
    message: 'Credentials saved. Click Test Connection to verify.',
  };
}

async function clearCredentials() {
  await ensureSchema();
  await run(`DELETE FROM app_config WHERE key IN (?, ?, ?)`, [KEY_CLIENT_ID, KEY_CLIENT_SECRET, KEY_ENABLED]);
  delete process.env.YOLINK_CLIENT_ID;
  delete process.env.YOLINK_CLIENT_SECRET;
  process.env.YOLINK_ENABLED = 'false';
  try { const auth = require('./yolink-auth'); auth.clearToken(); } catch (_) {}
  return { ok: true, cleared: true };
}

async function setEnabled(enabled) {
  await ensureSchema();
  await run(
    `INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
    [KEY_ENABLED, enabled ? 'true' : 'false']
  );
  process.env.YOLINK_ENABLED = enabled ? 'true' : 'false';
  return { ok: true, enabled: !!enabled };
}

/**
 * Returns public status. The client_secret value is never returned.
 * The client_id is also masked to avoid leaking full credentials
 * in dashboard API responses.
 */
async function getStatus() {
  await ensureSchema();
  const idRow = await getStoredCredential(KEY_CLIENT_ID);
  const secRow = await getStoredCredential(KEY_CLIENT_SECRET);
  const enabled = await isEnabledFlag();
  const lastAuth = await get(`SELECT value, updated_at FROM app_config WHERE key = 'YOLINK_LAST_AUTH_TEST'`);
  const lastSync = await get(`SELECT value, updated_at FROM app_config WHERE key = 'YOLINK_LAST_SYNC'`);
  const lastPoll = await get(`SELECT value, updated_at FROM app_config WHERE key = 'YOLINK_LAST_POLL'`);

  const idVal = idRow?.value || '';
  return {
    configured: !!(idVal && secRow?.value),
    enabled,
    client_id: idVal ? `${idVal.slice(0, 6)}••••${idVal.length > 4 ? idVal.slice(-2) : ''}` : '',
    client_id_configured: !!idVal,
    client_secret_configured: !!secRow?.value,
    secret_hash: secRow?.value ? hashSecret(secRow.value) : null,
    last_auth_test: lastAuth ? { status: lastAuth.value, at: lastAuth.updated_at } : null,
    last_device_sync: lastSync ? { status: lastSync.value, at: lastSync.updated_at } : null,
    last_poll: lastPoll ? { status: lastPoll.value, at: lastPoll.updated_at } : null,
  };
}

async function recordAuthTest(status) {
  await ensureSchema();
  await run(
    `INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES ('YOLINK_LAST_AUTH_TEST', ?, datetime('now'))`,
    [String(status)]
  );
}

async function recordDeviceSync(status) {
  await ensureSchema();
  await run(
    `INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES ('YOLINK_LAST_SYNC', ?, datetime('now'))`,
    [String(status)]
  );
}

async function recordPoll(status) {
  await ensureSchema();
  await run(
    `INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES ('YOLINK_LAST_POLL', ?, datetime('now'))`,
    [String(status)]
  );
}

module.exports = {
  ensureSchema,
  getClientId,
  getClientSecret,
  isConfigured,
  isEnabledFlag,
  saveCredentials,
  clearCredentials,
  setEnabled,
  getStatus,
  recordAuthTest,
  recordDeviceSync,
  recordPoll,
};
