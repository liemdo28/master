/**
 * ProjectClientRegistry
 *
 * Manages API client records in SQLite.
 * Each client represents a project (agent-coding, mi-core, etc.).
 * API keys are hashed before storage — raw key shown once at creation.
 */

const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');
const { generateApiKey, validateKey, hashKey } = require('./api-key-manager');
const auditLog = require('./api-key-audit-log');

const log = makeLogger('client-registry');

const DEFAULT_CLIENTS = [
  {
    clientId: 'agent-coding',
    allowedCommands: '/agent',
    description: 'Agent-Coding — coding/workflow agent for dev/QA operations',
    rateLimit: 120,
    permissions: 'read,write',
    callbackUrl: '',
  },
  {
    clientId: 'mi-core',
    allowedCommands: '/mi',
    description: 'Mi-Core — executive assistant for summaries, tasks, drafting',
    rateLimit: 60,
    permissions: 'read',
    callbackUrl: '',
  },
];

/**
 * Ensure default clients exist on first load.
 */
async function ensureDefaultClients() {
  for (const client of DEFAULT_CLIENTS) {
    const existing = await getClient(client.clientId);
    if (existing) continue;

    const result = await createClient({
      clientId: client.clientId,
      allowedCommands: client.allowedCommands,
      description: client.description,
      rateLimit: client.rateLimit,
      permissions: client.permissions,
      callbackUrl: client.callbackUrl,
    });

    log.info(`Default client "${client.clientId}" created — key prefix: ${result.keyPrefix}`);
    // Raw key intentionally NOT logged — shown to caller once
    console.log(`\n🔑 RAW API KEY for "${client.clientId}": ${result.rawKey}`);
    console.log(`   Key prefix: ${result.keyPrefix}`);
    console.log(`   Store this key securely — it will NOT be shown again.\n`);
  }
}

/**
 * Create a new client with a generated API key.
 * @param {{ clientId, allowedCommands, callbackUrl, rateLimit, permissions, description }}
 * @returns {Promise<{ rawKey, keyPrefix, client }>}
 */
async function createClient({ clientId, allowedCommands = '/agent,/mi', callbackUrl = '', rateLimit = 60, permissions = 'read', description = '' }) {
  const { rawKey, hash, prefix } = generateApiKey();
  const now = new Date().toISOString();

  await run(
    `INSERT INTO api_keys (client_id, api_key_hash, key_prefix, allowed_commands, callback_url, status, created_at, last_used_at, rate_limit, permissions, description)
     VALUES (?, ?, ?, ?, ?, 'active', ?, NULL, ?, ?, ?)`,
    [clientId, hash, prefix, allowedCommands, callbackUrl, now, rateLimit, permissions, description]
  );

  await auditLog.record({
    clientId,
    action: auditLog.ACTIONS.KEY_CREATED,
    detail: `API key created with prefix ${prefix}`,
    success: true,
  });

  const client = await getClient(clientId);
  return { rawKey, keyPrefix: prefix, client };
}

/**
 * Get client info (never exposes the key).
 * @param {string} clientId
 * @returns {Promise<Object|null>}
 */
async function getClient(clientId) {
  return get(
    `SELECT id, client_id, key_prefix, allowed_commands, callback_url, status, created_at, last_used_at, rate_limit, permissions, description
     FROM api_keys WHERE client_id = ?`,
    [clientId]
  );
}

/**
 * Find client by key prefix.
 * @param {string} keyPrefix
 * @returns {Promise<Object|null>}
 */
async function getClientByPrefix(keyPrefix) {
  return get(
    `SELECT id, client_id, key_prefix, allowed_commands, callback_url, status, created_at, last_used_at, rate_limit, permissions, description
     FROM api_keys WHERE key_prefix = ?`,
    [keyPrefix]
  );
}

/**
 * List all clients.
 * @returns {Promise<Array>}
 */
async function listClients() {
  return all(
    `SELECT id, client_id, key_prefix, allowed_commands, callback_url, status, created_at, last_used_at, rate_limit, permissions, description
     FROM api_keys ORDER BY created_at DESC`
  );
}

/**
 * Update client fields.
 * @param {string} clientId
 * @param {Object} updates
 * @returns {Promise<boolean>}
 */
async function updateClient(clientId, updates) {
  const allowedFields = ['allowed_commands', 'callback_url', 'rate_limit', 'permissions', 'description'];
  const sets = [];
  const params = [];

  for (const [key, value] of Object.entries(updates)) {
    const dbKey = key.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
    if (allowedFields.includes(dbKey)) {
      sets.push(`${dbKey} = ?`);
      params.push(value);
    }
  }

  if (sets.length === 0) return false;

  params.push(clientId);
  await run(
    `UPDATE api_keys SET ${sets.join(', ')} WHERE client_id = ?`,
    params
  );
  return true;
}

/**
 * Revoke a client's API key.
 * @param {string} clientId
 */
async function revokeClient(clientId) {
  await run(
    `UPDATE api_keys SET status = 'revoked' WHERE client_id = ?`,
    [clientId]
  );

  await auditLog.record({
    clientId,
    action: auditLog.ACTIONS.KEY_REVOKED,
    detail: 'API key revoked',
    success: true,
  });
}

/**
 * Validate a raw API key for a client.
 * @param {string} clientId
 * @param {string} rawKey
 * @returns {Promise<{ valid, client?, reason? }>}
 */
async function validateClientApiKey(clientId, rawKey) {
  const row = await get(
    `SELECT client_id, api_key_hash, status, rate_limit, allowed_commands, permissions
     FROM api_keys WHERE client_id = ?`,
    [clientId]
  );

  if (!row) {
    await auditLog.record({ clientId, action: auditLog.ACTIONS.KEY_FAILED, detail: 'Client not found', success: false });
    return { valid: false, reason: 'client_not_found' };
  }

  if (row.status === 'revoked') {
    await auditLog.record({ clientId, action: auditLog.ACTIONS.KEY_FAILED, detail: 'Key is revoked', success: false });
    return { valid: false, reason: 'key_revoked' };
  }

  if (row.status !== 'active') {
    await auditLog.record({ clientId, action: auditLog.ACTIONS.KEY_FAILED, detail: 'Status: ' + row.status, success: false });
    return { valid: false, reason: 'key_inactive' };
  }

  const valid = validateKey(rawKey, row.api_key_hash);
  if (!valid) {
    await auditLog.record({ clientId, action: auditLog.ACTIONS.KEY_FAILED, detail: 'Invalid API key', success: false });
    return { valid: false, reason: 'invalid_key' };
  }

  // Update last used
  await touchClient(clientId);

  await auditLog.record({ clientId, action: auditLog.ACTIONS.KEY_VALIDATED, detail: 'API key validated', success: true });
  return {
    valid: true,
    client: {
      client_id: row.client_id,
      allowed_commands: row.allowed_commands,
      rate_limit: row.rate_limit,
      permissions: row.permissions,
    },
  };
}

/**
 * Rotate a client's API key.
 * @param {string} clientId
 * @returns {Promise<{ rawKey, keyPrefix }>}
 */
async function rotateClientKey(clientId) {
  const existing = await getClient(clientId);
  if (!existing) throw new Error('Client not found: ' + clientId);

  const { rawKey, hash, prefix } = generateApiKey();

  await run(
    `UPDATE api_keys SET api_key_hash = ?, key_prefix = ?, status = 'active' WHERE client_id = ?`,
    [hash, prefix, clientId]
  );

  await auditLog.record({
    clientId,
    action: auditLog.ACTIONS.KEY_ROTATED,
    detail: 'API key rotated, new prefix: ' + prefix,
    success: true,
  });

  return { rawKey, keyPrefix: prefix };
}

/**
 * Update last_used_at timestamp.
 * @param {string} clientId
 */
async function touchClient(clientId) {
  const now = new Date().toISOString();
  await run(`UPDATE api_keys SET last_used_at = ? WHERE client_id = ?`, [now, clientId]).catch(() => {});
}

module.exports = {
  ensureDefaultClients,
  createClient,
  getClient,
  getClientByPrefix,
  listClients,
  updateClient,
  revokeClient,
  rotateClientKey,
  validateClientApiKey,
  touchClient,
};
