"use strict";
// ============================================================
// Agent OS - Control Plane - Approval Engine
// Risk assessment + CEO approval workflow
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTaskApproved = exports.getApprovalForTask = exports.getAllApprovals = exports.getPendingApprovals = exports.denyTask = exports.approveTask = exports.createApproval = exports.initApprovalSchema = exports.assessTaskRisk = void 0;
const uuid_1 = require("uuid");
const database_1 = require("./database");
const APPROVAL_REQUIRED_TYPES = new Set(['deploy', 'cloud']);
const DANGEROUS_COMMAND_PATTERNS = [
    /\bgit\s+push\b/i,
    /\b(del|erase|rm|rmdir|remove-item)\b/i,
    /\bwrangler\s+(deploy|publish)\b/i,
    /\bdocker\s+push\b/i,
    /\bdns\b/i,
    /\bemail\b/i,
    /\bsend(mail)?\b/i,
];
function assessTaskRisk(task) {
    const reasons = [];
    const command = String(task.payload?.command || '');
    const operations = Array.isArray(task.payload?.operations) ? task.payload.operations.join(' ') : '';
    const text = `${task.type} ${command} ${operations}`;
    if (APPROVAL_REQUIRED_TYPES.has(task.type)) {
        reasons.push(`${task.type} tasks require CEO approval`);
    }
    for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
        if (pattern.test(text)) {
            reasons.push(`matched risky operation: ${pattern.source}`);
        }
    }
    if (/\b(delete|remove|deploy|production|cloud|dns|email|push)\b/i.test(text)) {
        reasons.push('payload contains approval-required keyword');
    }
    if (reasons.some(r => /delete|remove|deploy|production|cloud|dns|email|push|git\\s\+push/i.test(r))) {
        return { riskLevel: 'dangerous', approvalRequired: true, reasons };
    }
    if (reasons.length > 0) {
        return { riskLevel: 'elevated', approvalRequired: true, reasons };
    }
    return { riskLevel: 'safe', approvalRequired: false, reasons: ['no approval-required operation detected'] };
}
exports.assessTaskRisk = assessTaskRisk;
// Initialize approvals table
function initApprovalSchema() {
    const db = (0, database_1.getDatabase)();
    db.exec(`
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_by TEXT NOT NULL DEFAULT 'system',
      approved_by TEXT,
      denied_by TEXT,
      reason TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_approvals_task ON approvals(task_id);
    CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
  `);
}
exports.initApprovalSchema = initApprovalSchema;
/**
 * Create an approval request for a task
 */
function createApproval(taskId, riskLevel, requestedBy = 'system') {
    const db = (0, database_1.getDatabase)();
    const now = new Date().toISOString();
    // Auto-approve safe tasks
    const status = riskLevel === 'safe' ? 'auto_approved' : 'pending';
    const approval = {
        id: (0, uuid_1.v4)(),
        taskId,
        riskLevel,
        status,
        requestedBy,
        createdAt: now,
        resolvedAt: status === 'auto_approved' ? now : undefined,
    };
    const stmt = db.prepare(`
    INSERT INTO approvals (id, task_id, risk_level, status, requested_by, created_at, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(approval.id, approval.taskId, approval.riskLevel, approval.status, approval.requestedBy, approval.createdAt, approval.resolvedAt || null);
    return approval;
}
exports.createApproval = createApproval;
/**
 * Approve a pending task
 */
function approveTask(taskId, approvedBy = 'ceo') {
    const db = (0, database_1.getDatabase)();
    const now = new Date().toISOString();
    const approval = db.prepare('SELECT * FROM approvals WHERE task_id = ? AND status = ?').get(taskId, 'pending');
    if (!approval)
        return null;
    db.prepare(`
    UPDATE approvals SET status = 'approved', approved_by = ?, resolved_at = ? WHERE id = ?
  `).run(approvedBy, now, approval.id);
    return { ...approval, status: 'approved', approvedBy, resolvedAt: now };
}
exports.approveTask = approveTask;
/**
 * Deny a pending task
 */
function denyTask(taskId, deniedBy = 'ceo', reason) {
    const db = (0, database_1.getDatabase)();
    const now = new Date().toISOString();
    const approval = db.prepare('SELECT * FROM approvals WHERE task_id = ? AND status = ?').get(taskId, 'pending');
    if (!approval)
        return null;
    db.prepare(`
    UPDATE approvals SET status = 'denied', denied_by = ?, reason = ?, resolved_at = ? WHERE id = ?
  `).run(deniedBy, reason || null, now, approval.id);
    return { ...approval, status: 'denied', deniedBy, reason, resolvedAt: now };
}
exports.denyTask = denyTask;
/**
 * Get all pending approvals
 */
function getPendingApprovals() {
    const db = (0, database_1.getDatabase)();
    return db.prepare("SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at DESC").all();
}
exports.getPendingApprovals = getPendingApprovals;
function getAllApprovals() {
    const db = (0, database_1.getDatabase)();
    return db.prepare('SELECT * FROM approvals ORDER BY created_at DESC').all();
}
exports.getAllApprovals = getAllApprovals;
/**
 * Get approval for a specific task
 */
function getApprovalForTask(taskId) {
    const db = (0, database_1.getDatabase)();
    return db.prepare('SELECT * FROM approvals WHERE task_id = ? ORDER BY created_at DESC LIMIT 1').get(taskId);
}
exports.getApprovalForTask = getApprovalForTask;
/**
 * Check if a task is approved (or auto-approved)
 */
function isTaskApproved(taskId) {
    const approval = getApprovalForTask(taskId);
    if (!approval)
        return true; // No approval record = no restriction
    return approval.status === 'approved' || approval.status === 'auto_approved';
}
exports.isTaskApproved = isTaskApproved;
//# sourceMappingURL=approvalEngine.js.map