const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');
const { normalizeGoogleSheetUrl } = require('../google/sheet-url-validator');

const log = makeLogger('whatsapp');

// ── Lock enforcement ─────────────────────────────────────────────────────────
/**
 * If group is locked, staff cannot override the mapped store via commands.
 * Checks both env (legacy) and DB (runtime).
 */
async function isGroupLocked(chatId) {
  // Check env first (legacy)
  const envLocked = (process.env.STORE_GROUPS_LOCKED || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (envLocked.includes(chatId)) return true;

  // Check DB
  const row = await resolveGroup(chatId);
  return !!(row && row.locked);
}

async function getLockedGroups() {
  await ensureTables();
  const rows = await all(`SELECT chat_id FROM store_groups WHERE locked = 1 AND active = 1`);
  return rows.map(r => r.chat_id);
}

const STORES = [
  { store_id: 'stone_oak', store_name: 'Stone Oak' },
  { store_id: 'bandera', store_name: 'Bandera' },
  { store_id: 'rim', store_name: 'Rim' },
  { store_id: 'test', store_name: 'Test' },
];

let initialized = false;

function normalizeStoreId(value) {
  const v = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (v === 'stoneoak') return 'stone_oak';
  return v;
}

function getStoreById(storeId) {
  const id = normalizeStoreId(storeId);
  return STORES.find(s => s.store_id === id) || null;
}

function getStoreByName(storeName) {
  const v = String(storeName || '').trim().toLowerCase();
  return STORES.find(s => s.store_name.toLowerCase() === v || s.store_id === normalizeStoreId(v)) || null;
}

function detectStoreFromText(text) {
  const v = String(text || '').toLowerCase();
  if (v.includes('stone oak') || v.includes('stoneoak')) return getStoreById('stone_oak');
  if (v.includes('bandera')) return getStoreById('bandera');
  if (v.includes('rim')) return getStoreById('rim');
  return null;
}

async function ensureTables() {
  if (initialized) return;
  // store_groups with locked column
  await run(`
    CREATE TABLE IF NOT EXISTS store_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL UNIQUE,
      group_name TEXT,
      store_id TEXT NOT NULL,
      store_name TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      locked INTEGER DEFAULT 0,
      last_message_at TEXT,
      last_log_write_at TEXT,
      last_test_at TEXT,
      last_test_status TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_store_groups_active ON store_groups(active)`);
  // Migrate: add locked column if missing — check first
  try {
    await run(`ALTER TABLE store_groups ADD COLUMN locked INTEGER DEFAULT 0`);
  } catch (_) {} // Column may already exist

  try {
    await run(`CREATE INDEX IF NOT EXISTS idx_store_groups_locked ON store_groups(locked)`);
  } catch (_) {} // Index may already exist

  // app_config for runtime config
  await run(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  initialized = true;
  await seedFromEnv();
}

function parseEnvMappings() {
  const mappings = [];
  const packed = process.env.STORE_GROUP_MAPPINGS || '';
  for (const part of packed.split(',').map(s => s.trim()).filter(Boolean)) {
    const [chatId, storeId] = part.split('=').map(s => s.trim());
    const store = getStoreById(storeId);
    if (chatId && store) mappings.push({ chat_id: chatId, group_name: '', ...store, active: 1 });
  }

  const explicit = [
    ['STONE_OAK_GROUP_CHAT_ID', 'stone_oak'],
    ['BANDERA_GROUP_CHAT_ID', 'bandera'],
    ['RIM_GROUP_CHAT_ID', 'rim'],
  ];
  for (const [envKey, storeId] of explicit) {
    const chatId = process.env[envKey];
    const store = getStoreById(storeId);
    if (chatId && store) mappings.push({ chat_id: chatId.trim(), group_name: '', ...store, active: 1 });
  }
  return mappings;
}

async function seedFromEnv() {
  for (const m of parseEnvMappings()) {
    await upsertMapping(m).catch(err => log.warn('Store group env seed failed', { error: err.message, chatId: m.chat_id }));
  }
}

async function upsertMapping({ chat_id, group_name = '', store_id, store_name, active = 1, locked = 0 }) {
  await ensureTables();
  const store = getStoreById(store_id) || getStoreByName(store_name);
  if (!chat_id) throw new Error('chat_id required');
  if (!store) throw new Error('valid store_id/store_name required');
  await run(
    `INSERT INTO store_groups (chat_id, group_name, store_id, store_name, active, locked, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(chat_id) DO UPDATE SET
       group_name=excluded.group_name,
       store_id=excluded.store_id,
       store_name=excluded.store_name,
       active=excluded.active,
       locked=CASE WHEN excluded.locked=1 THEN 1 ELSE locked END,
       updated_at=datetime('now')`,
    [chat_id, group_name || '', store.store_id, store.store_name, active ? 1 : 0, locked ? 1 : 0]
  );
  log.info('Store mapping upserted', { chat_id, store_id: store.store_id, active, locked });
}

async function resolveGroup(chatId) {
  await ensureTables();
  const row = await get(`SELECT * FROM store_groups WHERE chat_id = ? AND active = 1`, [chatId]);
  return row || null;
}

async function listMappings() {
  await ensureTables();
  return all(`SELECT * FROM store_groups ORDER BY store_name ASC, group_name ASC`);
}

async function getMappingById(id) {
  await ensureTables();
  return get(`SELECT * FROM store_groups WHERE id = ?`, [id]);
}

// ── Lock / Unlock ────────────────────────────────────────────────────────────
async function lockMapping(chatId) {
  await ensureTables();
  await run(`UPDATE store_groups SET locked = 1, updated_at = datetime('now') WHERE chat_id = ?`, [chatId]);
  log.info('Store mapping locked', { chatId });
  // Sync to env runtime
  await syncLockedGroupsToEnv();
}

async function unlockMapping(chatId) {
  await ensureTables();
  await run(`UPDATE store_groups SET locked = 0, updated_at = datetime('now') WHERE chat_id = ?`, [chatId]);
  log.info('Store mapping unlocked', { chatId });
  await syncLockedGroupsToEnv();
}

async function markLastMessage(chatId, groupName = '') {
  await ensureTables();
  await run(
    `UPDATE store_groups
     SET last_message_at = datetime('now'),
         group_name = CASE WHEN ? != '' THEN ? ELSE group_name END,
         updated_at = datetime('now')
     WHERE chat_id = ? AND active = 1`,
    [groupName || '', groupName || '', chatId]
  );
}

async function markLastLogWrite(chatId) {
  await ensureTables();
  await run(
    `UPDATE store_groups
     SET last_log_write_at = datetime('now'),
         updated_at = datetime('now')
     WHERE chat_id = ? AND active = 1`,
    [chatId]
  );
}

async function syncLockedGroupsToEnv() {
  const locked = await getLockedGroups();
  // Update process.env for in-memory check
  process.env.STORE_GROUPS_LOCKED = locked.join(',');
  log.info('Locked groups synced to runtime', { count: locked.length });
}

// ── Test mapping ─────────────────────────────────────────────────────────────
async function testMapping(chatId, sendFn) {
  await ensureTables();
  const mapping = await resolveGroup(chatId);
  if (!mapping) return { ok: false, error: 'No active mapping for this chat_id' };
  const testMsg = `✅ Test message from Bakudan AI Gateway\n\nMapping verified:\n- Store: ${mapping.store_name}\n- Chat ID: ${mapping.chat_id}\n- Locked: ${mapping.locked ? 'YES' : 'No'}\n\nThis confirms the mapping is active and reachable.`;
  try {
    if (sendFn) await sendFn(chatId, testMsg);
    await run(
      `UPDATE store_groups SET last_test_at = datetime('now'), last_test_status = 'PASS', updated_at = datetime('now') WHERE chat_id = ?`,
      [chatId]
    );
    return { ok: true, status: 'PASS', mapping };
  } catch (err) {
    await run(
      `UPDATE store_groups SET last_test_at = datetime('now'), last_test_status = 'FAIL', updated_at = datetime('now') WHERE chat_id = ?`,
      [chatId]
    );
    return { ok: false, error: err.message };
  }
}

// ── Remove mapping ────────────────────────────────────────────────────────────
async function removeMapping(chatId) {
  await ensureTables();
  await run(`UPDATE store_groups SET active = 0, updated_at = datetime('now') WHERE chat_id = ?`, [chatId]);
  log.info('Store mapping removed', { chatId });
}

// ── Duplicate check ────────────────────────────────────────────────────────────
async function isGroupMappedToAnotherStore(chatId, excludeStoreId) {
  await ensureTables();
  const row = await get(
    `SELECT * FROM store_groups WHERE chat_id = ? AND active = 1 AND store_id != ?`,
    [chatId, excludeStoreId]
  );
  return !!row;
}

async function isStoreMapped(chatId) {
  await ensureTables();
  return all(`SELECT chat_id FROM store_groups WHERE store_id = ? AND active = 1`, [chatId]);
}

// ── Config runtime helpers ──────────────────────────────────────────────────────
async function getAppConfig(key, defaultVal = null) {
  await ensureTables();
  const row = await get(`SELECT value FROM app_config WHERE key = ?`, [key]);
  return row ? row.value : (process.env[key] || defaultVal);
}

async function setAppConfig(key, value) {
  await ensureTables();
  await run(
    `INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
    [key, String(value ?? '')]
  );
  log.info('App config set', { key });
}

async function getManagerAlertGroup() {
  const chatId = await getAppConfig('MANAGER_ALERT_GROUP_CHAT_ID');
  const name = await getAppConfig('MANAGER_ALERT_GROUP_NAME');
  const enabled = await getAppConfig('MANAGER_ALERTS_ENABLED', 'false');
  return { chat_id: chatId, group_name: name, enabled: enabled === 'true' };
}

async function setManagerAlertGroup({ chat_id, group_name = '', enabled = true }) {
  await setAppConfig('MANAGER_ALERT_GROUP_CHAT_ID', chat_id);
  await setAppConfig('MANAGER_ALERT_GROUP_NAME', group_name);
  await setAppConfig('MANAGER_ALERTS_ENABLED', enabled ? 'true' : 'false');
  log.info('Manager alert group updated', { chat_id, group_name, enabled });
}

async function getGoogleSheetLinks() {
  return {
    template_sheet_url: await getAppConfig('TEMPLATE_SHEET_URL', ''),
    log_sheet_url: await getAppConfig('LOG_SHEET_URL', ''),
  };
}

async function setGoogleSheetLinks({ template_sheet_url, log_sheet_url }) {
  if (template_sheet_url !== undefined) {
    await setAppConfig('TEMPLATE_SHEET_URL', normalizeGoogleSheetUrl(template_sheet_url));
  }
  if (log_sheet_url !== undefined) {
    await setAppConfig('LOG_SHEET_URL', normalizeGoogleSheetUrl(log_sheet_url));
  }
  log.info('Google Sheet links updated', { template_sheet_url, log_sheet_url });
}

function unmappedGroupReply() {
  return 'This group is not linked to a store yet.\nPlease ask admin to map this group in Dashboard.';
}

module.exports = {
  STORES,
  ensureTables,
  normalizeStoreId,
  getStoreById,
  getStoreByName,
  detectStoreFromText,
  isGroupLocked,
  getLockedGroups,
  upsertMapping,
  resolveGroup,
  listMappings,
  getMappingById,
  lockMapping,
  unlockMapping,
  markLastMessage,
  markLastLogWrite,
  syncLockedGroupsToEnv,
  testMapping,
  removeMapping,
  isGroupMappedToAnotherStore,
  isStoreMapped,
  getAppConfig,
  setAppConfig,
  getManagerAlertGroup,
  setManagerAlertGroup,
  getGoogleSheetLinks,
  setGoogleSheetLinks,
  unmappedGroupReply,
};
