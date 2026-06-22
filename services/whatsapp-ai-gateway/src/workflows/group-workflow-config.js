/**
 * Group Workflow Config — manages per-group workflow configuration
 *
 * Supports:
 *   food_safety_enabled_groups: list of group IDs where Food Safety auto-capture is active
 *   mi_admin_private_chats: list of admin phone IDs where Mi works without /mi prefix
 *   mi_group_mode: 'mention_only' | 'always'
 *   agent_group_mode: 'prefix_only' | 'always'
 *   default_no_prefix_behavior: 'silent' | 'silent_or_help' | 'help'
 */

const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('group-workflow');

const DEFAULT_CONFIG = {
  mi_group_mode: 'mention_only',
  agent_group_mode: 'prefix_only',
  default_no_prefix_behavior: 'silent_or_help',
  enabled_workflows: 'food_safety_capture',
};

/**
 * Get the group workflow config for a chat ID.
 */
async function getGroupConfig(chatId) {
  await ensureTables();
  const row = await get(`SELECT * FROM group_workflow_config WHERE chat_id = ? AND active = 1`, [chatId]);
  if (row) {
    return {
      ...row,
      enabled_workflows: parseWorkflows(row.enabled_workflows),
      mi_admin_private_chats: parseList(row.mi_admin_private_chats),
    };
  }
  return null;
}

/**
 * Get enabled workflows for a group.
 */
async function getEnabledWorkflows(chatId) {
  const cfg = await getGroupConfig(chatId);
  if (cfg) return cfg.enabled_workflows;
  // Fall back to app_config
  const envGroups = parseList(process.env.FOOD_SAFETY_ENABLED_GROUPS || '');
  if (envGroups.includes(chatId)) return ['food_safety_capture'];
  return [];
}

/**
 * Check if Food Safety auto-capture is enabled for a group.
 */
async function isFoodSafetyEnabledForGroup(chatId) {
  const workflows = await getEnabledWorkflows(chatId);
  return workflows.includes('food_safety_capture');
}

/**
 * Check if Mi should respond in a private chat without /mi prefix.
 */
async function isMiAdminPrivateChat(chatId, sender) {
  // Check group_workflow_config
  const cfg = await getGroupConfig(chatId);
  if (cfg) {
    if (cfg.mi_admin_private_chats.includes(sender)) return true;
  }
  // Check app_config
  const adminChats = parseList(process.env.MI_ADMIN_PRIVATE_CHATS || '');
  return adminChats.includes(sender);
}

/**
 * Check if Mi should respond in group (regardless of /mi prefix).
 */
async function isMiAlwaysOn(chatId) {
  const cfg = await getGroupConfig(chatId);
  if (cfg) return cfg.mi_group_mode === 'always';
  return process.env.MI_GROUP_MODE === 'always';
}

/**
 * Upsert group workflow config.
 */
async function upsertGroupConfig({
  chatId,
  groupName = '',
  storeId = '',
  storeName = '',
  miAdminPrivateChats = [],
  miGroupMode = 'mention_only',
  agentGroupMode = 'prefix_only',
  enabledWorkflows = ['food_safety_capture'],
  active = 1,
}) {
  await ensureTables();
  await run(
    `INSERT INTO group_workflow_config
     (chat_id, group_name, store_id, store_name, mi_admin_private_chats,
      mi_group_mode, agent_group_mode, enabled_workflows, active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(chat_id) DO UPDATE SET
       group_name = excluded.group_name,
       store_id = excluded.store_id,
       store_name = excluded.store_name,
       mi_admin_private_chats = excluded.mi_admin_private_chats,
       mi_group_mode = excluded.mi_group_mode,
       agent_group_mode = excluded.agent_group_mode,
       enabled_workflows = excluded.enabled_workflows,
       active = excluded.active,
       updated_at = datetime('now')`,
    [
      chatId,
      groupName,
      storeId,
      storeName,
      miAdminPrivateChats.join(','),
      miGroupMode,
      agentGroupMode,
      enabledWorkflows.join(','),
      active,
    ]
  );
  log.info('Group workflow config upserted', { chatId, storeId, enabledWorkflows });
}

/**
 * List all group configs.
 */
async function listGroupConfigs() {
  await ensureTables();
  const rows = await all(`SELECT * FROM group_workflow_config ORDER BY store_name ASC`);
  return rows.map(row => ({
    ...row,
    enabled_workflows: parseWorkflows(row.enabled_workflows),
    mi_admin_private_chats: parseList(row.mi_admin_private_chats),
  }));
}

function parseWorkflows(val) {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

function parseList(val) {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  return val.split(',').map(s => s.trim()).filter(Boolean);
}

let tablesOk = false;
async function ensureTables() {
  if (tablesOk) return;
  await run(`
    CREATE TABLE IF NOT EXISTS group_workflow_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL UNIQUE,
      group_name TEXT,
      store_id TEXT,
      store_name TEXT,
      mi_admin_private_chats TEXT DEFAULT '',
      mi_group_mode TEXT DEFAULT 'mention_only',
      agent_group_mode TEXT DEFAULT 'prefix_only',
      enabled_workflows TEXT DEFAULT 'food_safety_capture',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_group_workflow_active ON group_workflow_config(active)`).catch(() => {});
  tablesOk = true;
}

module.exports = {
  getGroupConfig,
  getEnabledWorkflows,
  isFoodSafetyEnabledForGroup,
  isMiAdminPrivateChat,
  isMiAlwaysOn,
  upsertGroupConfig,
  listGroupConfigs,
  DEFAULT_CONFIG,
};
