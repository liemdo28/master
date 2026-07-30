/**
 * ApiKeyAuditLog
 *
 * Records and queries all API key security events.
 * Every key action (create, revoke, rotate, validate, route) is logged.
 */

const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');
const log = makeLogger('api-key-audit');

const ACTIONS = {
  KEY_CREATED: 'KEY_CREATED',
  KEY_REVOKED: 'KEY_REVOKED',
  KEY_ROTATED: 'KEY_ROTATED',
  KEY_VALIDATED: 'KEY_VALIDATED',
  KEY_FAILED: 'KEY_FAILED',
  ROUTE_SENT: 'ROUTE_SENT',
  ROUTE_FAILED: 'ROUTE_FAILED',
  ROUTE_APPROVED: 'ROUTE_APPROVED',
  ROUTE_REJECTED: 'ROUTE_REJECTED',
};

/**
 * Record an audit event.
 * @param {{ clientId: string, action: string, detail?: string, ipAddress?: string, success?: boolean }} params
 */
async function record({ clientId, action, detail, ipAddress, success = true }) {
  const timestamp = new Date().toISOString();
  try {
    await run(
      `INSERT INTO api_key_audit (client_id, action, detail, ip_address, timestamp, success)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [clientId, action, detail || '', ipAddress || '', timestamp, success ? 1 : 0]
    );
    log.info(`Audit: ${action} for ${clientId}`, { clientId, action, success });
  } catch (err) {
    log.error('Failed to record audit entry', { error: err.message, clientId, action });
  }
}

/**
 * Query audit logs.
 * @param {{ clientId?: string, limit?: number, offset?: number }} params
 * @returns {Promise<Array>}
 */
async function getLogs({ clientId, limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const safeOffset = Math.max(0, offset);

  if (clientId) {
    return all(
      `SELECT * FROM api_key_audit WHERE client_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
      [clientId, safeLimit, safeOffset]
    );
  }
  return all(
    `SELECT * FROM api_key_audit ORDER BY id DESC LIMIT ? OFFSET ?`,
    [safeLimit, safeOffset]
  );
}

/**
 * Get audit statistics.
 * @returns {Promise<Object>}
 */
async function getStats() {
  const total = await get(`SELECT COUNT(*) as count FROM api_key_audit`);
  const successCount = await get(`SELECT COUNT(*) as count FROM api_key_audit WHERE success = 1`);
  const failCount = await get(`SELECT COUNT(*) as count FROM api_key_audit WHERE success = 0`);
  const actionCounts = await all(
    `SELECT action, COUNT(*) as count FROM api_key_audit GROUP BY action ORDER BY count DESC`
  );
  const byClient = await all(
    `SELECT client_id, COUNT(*) as count FROM api_key_audit GROUP BY client_id ORDER BY count DESC`
  );

  return {
    total: total?.count || 0,
    success: successCount?.count || 0,
    failed: failCount?.count || 0,
    byAction: actionCounts || [],
    byClient: byClient || [],
  };
}

/**
 * Get recent failed actions.
 * @param {number} count
 * @returns {Promise<Array>}
 */
async function getRecentFailures(count = 10) {
  const safe = Math.min(Math.max(1, count), 100);
  return all(
    `SELECT * FROM api_key_audit WHERE success = 0 ORDER BY id DESC LIMIT ?`,
    [safe]
  );
}

module.exports = {
  ACTIONS,
  record,
  getLogs,
  getStats,
  getRecentFailures,
};
