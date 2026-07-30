/**
 * Role Service (CEO Directive — Permissions)
 * Determines access level based on WhatsApp ID or SQLite users table.
 *
 * Roles: CEO, ADMIN, MANAGER, STAFF
 * CEOs/ADMINs → full history, all stores, exports
 * MANAGERs → store-level history, daily/weekly summary
 * STAFF → own session only, no global history
 */
const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('auth');

const ROLES = { CEO: 100, ADMIN: 90, MANAGER: 50, STAFF: 10 };

// ── Config fallback ──────────────────────────────────────────────────────────

function getAdminIds() {
  return (process.env.ADMIN_WHATSAPP_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
}

function getManagerIds() {
  return (process.env.MANAGER_WHATSAPP_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
}

// ── Schema ────────────────────────────────────────────────────────────────────

async function ensureTables() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wa_id TEXT UNIQUE NOT NULL,
      phone TEXT,
      display_name TEXT,
      role TEXT DEFAULT 'STAFF',
      store_id TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_users_waid ON users(wa_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
}

// ── Role lookup ────────────────────────────────────────────────────────────────

async function getRole(waId) {
  if (!waId) return 'STAFF';

  // Config fallback — highest priority overrides
  const adminIds = getAdminIds();
  const managerIds = getManagerIds();
  if (adminIds.includes(waId)) return 'ADMIN';
  if (managerIds.includes(waId)) return 'MANAGER';

  // SQLite lookup
  try {
    await ensureTables();
    const row = await get('SELECT role, active FROM users WHERE wa_id = ? AND active = 1', [waId]);
    if (row) return row.role || 'STAFF';
  } catch (err) {
    log.warn('Role lookup failed', { waId, error: err.message });
  }
  return 'STAFF';
}

function getRoleLevel(role) {
  return ROLES[role?.toUpperCase()] ?? 0;
}

// ── Permission helpers ─────────────────────────────────────────────────────────

async function canViewAllStores(waId) {
  const role = await getRole(waId);
  return getRoleLevel(role) >= getRoleLevel('MANAGER');
}

async function canViewStore(waId, storeId) {
  const role = await getRole(waId);
  if (getRoleLevel(role) >= getRoleLevel('ADMIN')) return true;
  if (getRoleLevel(role) >= getRoleLevel('MANAGER')) {
    // Managers can only view their own store
    try {
      await ensureTables();
      const user = await get('SELECT store_id FROM users WHERE wa_id = ? AND active = 1', [waId]);
      return !user?.store_id || user.store_id === storeId;
    } catch (_) {}
  }
  return false;
}

async function canExport(waId) {
  const role = await getRole(waId);
  return getRoleLevel(role) >= getRoleLevel('ADMIN');
}

async function canViewHistory(waId) {
  const role = await getRole(waId);
  return getRoleLevel(role) >= getRoleLevel('MANAGER');
}

async function canViewAllEmployees(waId) {
  const role = await getRole(waId);
  return getRoleLevel(role) >= getRoleLevel('ADMIN');
}

// ── Apply role filter to history queries ────────────────────────────────────

/**
 * Filter a history query based on the caller's role.
 * Returns { storeId, employeeId, limit } to apply to the query.
 */
async function filterByRole(waId, requestedStoreId = null) {
  const role = await getRole(waId);

  if (getRoleLevel(role) >= getRoleLevel('ADMIN')) {
    return { storeId: requestedStoreId, employeeId: null, limit: 200 };
  }

  if (getRoleLevel(role) >= getRoleLevel('MANAGER')) {
    try {
      await ensureTables();
      const user = await get('SELECT store_id FROM users WHERE wa_id = ? AND active = 1', [waId]);
      const storeId = user?.store_id || requestedStoreId;
      return { storeId, employeeId: null, limit: 50 };
    } catch (_) {}
  }

  // STAFF — only own history
  return { storeId: null, employeeId: waId, limit: 10 };
}

// ── User management ────────────────────────────────────────────────────────────

async function upsertUser({ waId, phone, displayName, role = 'STAFF', storeId = null }) {
  await ensureTables();
  await run(
    `INSERT INTO users (wa_id, phone, display_name, role, store_id, active, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
     ON CONFLICT(wa_id) DO UPDATE SET
       phone = excluded.phone,
       display_name = excluded.display_name,
       role = excluded.role,
       store_id = excluded.store_id,
       active = 1,
       updated_at = datetime('now')`,
    [waId, phone || '', displayName || '', role, storeId || null]
  );
}

async function getUsersByRole(role) {
  await ensureTables();
  return all('SELECT * FROM users WHERE role = ? AND active = 1 ORDER BY display_name ASC', [role]);
}

async function deactivateUser(waId) {
  await ensureTables();
  await run('UPDATE users SET active = 0, updated_at = datetime(\'now\') WHERE wa_id = ?', [waId]);
}

// ── Check if manager/alert group ─────────────────────────────────────────────

function isManagerGroup(chatId) {
  const managerIds = getManagerIds();
  return managerIds.includes(chatId);
}

function isAdminChat(chatId) {
  const adminIds = getAdminIds();
  return adminIds.includes(chatId);
}

module.exports = {
  getRole,
  getRoleLevel,
  canViewAllStores,
  canViewStore,
  canExport,
  canViewHistory,
  canViewAllEmployees,
  filterByRole,
  upsertUser,
  getUsersByRole,
  deactivateUser,
  isManagerGroup,
  isAdminChat,
  getAdminIds,
  getManagerIds,
  ensureTables,
};