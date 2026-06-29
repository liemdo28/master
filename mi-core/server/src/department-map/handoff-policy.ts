/**
 * handoff-policy.ts
 * Defines rules for cross-department task handoffs.
 */
import type { DepartmentId } from './department-registry';

export interface HandoffRequest {
  task_id: string;
  from_dept: DepartmentId;
  to_dept: DepartmentId;
  reason: string;
  approved_by: DepartmentId;
}

export interface HandoffResult {
  allowed: boolean;
  reason: string;
  requires_approval: boolean;
  approver: DepartmentId;
}

export function evaluateHandoff(req: HandoffRequest): HandoffResult {
  const { from_dept, to_dept, reason } = req;

  // Same department = no handoff needed
  if (from_dept === to_dept) {
    return { allowed: false, reason: 'Cannot handoff to same department', requires_approval: false, approver: from_dept };
  }

  // Executive can handoff to anyone
  if (from_dept === 'executive') {
    return { allowed: true, reason: 'Executive-initiated handoff approved', requires_approval: false, approver: 'executive' };
  }

  // CFO can handoff finance tasks
  if (from_dept === 'finance' && to_dept === 'executive') {
    return { allowed: true, reason: 'Finance escalation to executive', requires_approval: false, approver: 'executive' };
  }

  // COO can handoff ops tasks
  if (from_dept === 'operations' && to_dept === 'executive') {
    return { allowed: true, reason: 'Operations escalation to executive', requires_approval: false, approver: 'executive' };
  }

  // Peer handoffs require executive approval
  if (reason && reason.length > 0) {
    return { allowed: true, reason: `Peer handoff with reason: ${reason}`, requires_approval: true, approver: 'executive' };
  }

  return { allowed: false, reason: 'Unauthorized cross-department handoff', requires_approval: true, approver: 'executive' };
}
