/**
 * Approval Service
 *
 * Tracks action approval workflows.
 * Defines which actions need single or double approval.
 * Used by Mi-Core to gate actions before execution.
 */

const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');
const auditLog = require('./api-key-audit-log');

const log = makeLogger('approval-service');

/**
 * Check if an action requires approval.
 * @param {string} action
 * @returns {{ required: boolean, double: boolean }}
 */
function requiresApproval(action) {
  if (!action) return { required: false, double: false };
  const normalized = action.toLowerCase().trim();

  // Double approval for sensitive data
  const DOUBLE_APPROVAL = new Set([
    'payroll', 'health', 'employee_private_info',
    'financial_data', 'customer_personal_info', 'salary', 'medical',
  ]);

  // Single approval for actions
  const SINGLE_APPROVAL = new Set([
    'send_message', 'create_task', 'trigger_external',
    'modify_dashboard', 'modify_data', 'send_reply',
  ]);

  if (DOUBLE_APPROVAL.has(normalized)) return { required: true, double: true };
  if (SINGLE_APPROVAL.has(normalized)) return { required: true, double: false };
  return { required: false, double: false };
}

/**
 * Create an action proposal. If approval not required, auto-approves.
 * @returns {Promise<{ approvalId?: number, status: string, autoApproved: boolean, requiresDoubleApproval?: boolean }>}
 */
async function createActionProposal({ chatId, action, detail, proposedBy, metadata = {} }) {
  const approval = requiresApproval(action);
  if (!approval.required) {
    return { autoApproved: true, status: 'approved' };
  }

  const now = new Date().toISOString();
  const result = await run(
    `INSERT INTO approvals (chat_id, action, detail, proposed_by, status, created_at, metadata)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
    [chatId || '', action, detail || '', proposedBy || '', now, JSON.stringify(metadata)]
  );

  const approvalId = result.lastID;
  log.info('Approval created', { approvalId, action, chatId, proposedBy, double: approval.double });

  return {
    approvalId,
    status: 'pending',
    autoApproved: false,
    requiresDoubleApproval: approval.double,
  };
}

/**
 * Approve a pending approval.
 * @returns {Promise<{ ok: boolean, status: string, error?: string }>}
 */
async function approveApproval(approvalId, approvedBy) {
  const existing = await get(`SELECT * FROM approvals WHERE id = ?`, [approvalId]);
  if (!existing) return { ok: false, status: 'not_found', error: 'Approval not found' };
  if (existing.status !== 'pending') {
    return { ok: false, status: existing.status, error: 'Already ' + existing.status };
  }

  const now = new Date().toISOString();
  await run(
    `UPDATE approvals SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ?`,
    [approvedBy, now, approvalId]
  );

  await auditLog.record({
    clientId: 'mi-core',
    action: auditLog.ACTIONS.ROUTE_APPROVED,
    detail: 'Approval ' + approvalId + ' approved by ' + approvedBy,
    success: true,
  });

  return { ok: true, status: 'approved' };
}

/**
 * Reject a pending approval.
 * @returns {Promise<{ ok: boolean, status: string }>}
 */
async function rejectApproval(approvalId, rejectedBy) {
  const existing = await get(`SELECT * FROM approvals WHERE id = ?`, [approvalId]);
  if (!existing) return { ok: false, status: 'not_found' };
  if (existing.status !== 'pending') return { ok: false, status: existing.status };

  await run(
    `UPDATE approvals SET status = 'rejected', approved_by = ?, approved_at = ? WHERE id = ?`,
    [rejectedBy, new Date().toISOString(), approvalId]
  );

  await auditLog.record({
    clientId: 'mi-core',
    action: auditLog.ACTIONS.ROUTE_REJECTED,
    detail: 'Approval ' + approvalId + ' rejected by ' + rejectedBy,
    success: true,
  });

  return { ok: true, status: 'rejected' };
}

/**
 * Get a single approval by ID.
 */
async function getApproval(approvalId) {
  return get(`SELECT * FROM approvals WHERE id = ?`, [approvalId]);
}

/**
 * Get pending approvals for a chat.
 */
async function getPendingApprovals(chatId) {
  if (chatId) {
    return all(`SELECT * FROM approvals WHERE chat_id = ? AND status = 'pending' ORDER BY id DESC`, [chatId]);
  }
  return all(`SELECT * FROM approvals WHERE status = 'pending' ORDER BY id DESC`);
}

/**
 * Query approvals with filters.
 */
async function getApprovals({ chatId, status, limit = 20 } = {}) {
  const safeLimit = Math.min(Math.max(1, limit), 200);
  const conditions = [];
  const params = [];

  if (chatId) { conditions.push('chat_id = ?'); params.push(chatId); }
  if (status) { conditions.push('status = ?'); params.push(status); }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  return all(`SELECT * FROM approvals ${where} ORDER BY id DESC LIMIT ?`, [...params, safeLimit]);
}

module.exports = {
  requiresApproval,
  createActionProposal,
  approveApproval,
  rejectApproval,
  getApproval,
  getPendingApprovals,
  getApprovals,
};
