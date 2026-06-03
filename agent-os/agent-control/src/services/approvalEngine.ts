// ============================================================
// Agent OS - Control Plane - Approval Engine
// Risk assessment + CEO approval workflow
// ============================================================

import { v4 as uuid } from 'uuid';
import { getDatabase } from './database';

export type RiskLevel = 'safe' | 'elevated' | 'dangerous' | 'critical';
export type ApprovalStatus = 'auto_approved' | 'pending' | 'approved' | 'denied';

export interface Approval {
  id: string;
  taskId: string;
  riskLevel: RiskLevel;
  status: ApprovalStatus;
  requestedBy: string;
  approvedBy?: string;
  deniedBy?: string;
  reason?: string;
  createdAt: string;
  resolvedAt?: string;
}

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

export interface RiskAssessment {
  riskLevel: RiskLevel;
  approvalRequired: boolean;
  reasons: string[];
}

export function assessTaskRisk(task: { type: string; payload?: Record<string, any> }): RiskAssessment {
  const reasons: string[] = [];
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

// Initialize approvals table
export function initApprovalSchema(): void {
  const db = getDatabase();
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

/**
 * Create an approval request for a task
 */
export function createApproval(taskId: string, riskLevel: RiskLevel, requestedBy: string = 'system'): Approval {
  const db = getDatabase();
  const now = new Date().toISOString();

  // Auto-approve safe tasks
  const status: ApprovalStatus = riskLevel === 'safe' ? 'auto_approved' : 'pending';

  const approval: Approval = {
    id: uuid(),
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

/**
 * Approve a pending task
 */
export function approveTask(taskId: string, approvedBy: string = 'ceo'): Approval | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  const approval = db.prepare('SELECT * FROM approvals WHERE task_id = ? AND status = ?').get(taskId, 'pending') as any;
  if (!approval) return null;

  db.prepare(`
    UPDATE approvals SET status = 'approved', approved_by = ?, resolved_at = ? WHERE id = ?
  `).run(approvedBy, now, approval.id);

  return { ...approval, status: 'approved', approvedBy, resolvedAt: now };
}

/**
 * Deny a pending task
 */
export function denyTask(taskId: string, deniedBy: string = 'ceo', reason?: string): Approval | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  const approval = db.prepare('SELECT * FROM approvals WHERE task_id = ? AND status = ?').get(taskId, 'pending') as any;
  if (!approval) return null;

  db.prepare(`
    UPDATE approvals SET status = 'denied', denied_by = ?, reason = ?, resolved_at = ? WHERE id = ?
  `).run(deniedBy, reason || null, now, approval.id);

  return { ...approval, status: 'denied', deniedBy, reason, resolvedAt: now };
}

/**
 * Get all pending approvals
 */
export function getPendingApprovals(): Approval[] {
  const db = getDatabase();
  return db.prepare("SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at DESC").all() as Approval[];
}

export function getAllApprovals(): Approval[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM approvals ORDER BY created_at DESC').all() as Approval[];
}

/**
 * Get approval for a specific task
 */
export function getApprovalForTask(taskId: string): Approval | null {
  const db = getDatabase();
  return db.prepare('SELECT * FROM approvals WHERE task_id = ? ORDER BY created_at DESC LIMIT 1').get(taskId) as Approval | null;
}

/**
 * Check if a task is approved (or auto-approved)
 */
export function isTaskApproved(taskId: string): boolean {
  const approval = getApprovalForTask(taskId);
  if (!approval) return true; // No approval record = no restriction
  return approval.status === 'approved' || approval.status === 'auto_approved';
}
