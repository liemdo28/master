import type { ApprovalDecision, EngineeringTask } from './types';

const APPROVAL_PATTERNS: Array<[RegExp, string]> = [
  [/approval/i, 'approval workflow'],
  [/production|deploy|release/i, 'production deploy'],
  [/database|schema|migration|db/i, 'database change'],
  [/credential|secret|token|api key/i, 'credential change'],
  [/payment|stripe|billing/i, 'payment system'],
  [/quickbooks|qb/i, 'QuickBooks'],
  [/payroll/i, 'payroll'],
  [/security|auth|permission/i, 'security change'],
];

export function evaluateApprovalRequirement(input: string): ApprovalDecision {
  const reasons = APPROVAL_PATTERNS.filter(([pattern]) => pattern.test(input)).map(([, reason]) => reason);
  return {
    required: reasons.length > 0,
    reasons,
    gate: reasons.length > 0 ? 'APPROVAL_REQUIRED' : 'NO_APPROVAL_REQUIRED',
  };
}

export function canMerge(task: EngineeringTask): boolean {
  if (task.approval.required && task.status === 'APPROVAL_REQUIRED') return false;
  return task.status === 'PR_READY' && Boolean(task.PR);
}
