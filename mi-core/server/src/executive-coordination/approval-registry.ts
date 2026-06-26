/**
 * Phase 0I — Approval Registry
 *
 * Centralize ALL approvals. Every sensitive action goes through here.
 *
 * Types: code_merge | production_deploy | credential_use | financial_action |
 *        payroll_action | marketing_publish | review_response |
 *        doordash_campaign_change | website_content_publish | data_export
 *
 * Status: REQUESTED → APPROVED / REJECTED / EXPIRED / CANCELLED
 *
 * Security:
 *   - Financial tasks require approval
 *   - Production deploy tasks require approval
 *   - Payroll tasks require approval
 *   - Credential tasks require approval
 */
import {
  ApprovalRecord, ApprovalType, ApprovalStatus, Task,
} from './types';
import {
  loadCollection, saveRecord, loadRecord, genId, nowIso,
} from './persistence';

const SUBDIR = 'approvals';

export interface CreateApprovalInput {
  objectiveId?: string | null;
  taskId?: string | null;
  requestedBy?: string;
  approvalType: ApprovalType;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
}

const HIGH_RISK_TYPES = new Set([
  'production_deploy', 'financial_action', 'payroll_action',
  'credential_use', 'data_export',
]);

export function createApproval(input: CreateApprovalInput): ApprovalRecord {
  const riskLevel = input.riskLevel
    ?? (HIGH_RISK_TYPES.has(input.approvalType) ? 'high' : 'medium');

  const now = nowIso();
  const rec: ApprovalRecord = {
    id: genId('APR'),
    objectiveId: input.objectiveId ?? null,
    taskId: input.taskId ?? null,
    requestedBy: input.requestedBy ?? 'system',
    approvalType: input.approvalType,
    riskLevel,
    status: 'REQUESTED',
    approver: null,
    reason: input.reason,
    evidenceIds: [],
    createdAt: now,
    approvedAt: null,
    rejectedAt: null,
    expiresAt: null,
  };
  saveRecord(SUBDIR, rec);
  return rec;
}

export function getApproval(id: string): ApprovalRecord | null {
  return loadRecord<ApprovalRecord>(SUBDIR, id);
}

export function getAllApprovals(filter?: {
  status?: ApprovalStatus; taskId?: string;
  objectiveId?: string; approvalType?: ApprovalType;
}): ApprovalRecord[] {
  const all = loadCollection<ApprovalRecord>(SUBDIR);
  return all.filter(a => {
    if (filter?.status && a.status !== filter.status) return false;
    if (filter?.taskId && a.taskId !== filter.taskId) return false;
    if (filter?.objectiveId && a.objectiveId !== filter.objectiveId) return false;
    if (filter?.approvalType && a.approvalType !== filter.approvalType) return false;
    return true;
  });
}

export function approveApproval(id: string, approver: string = 'ceo'): ApprovalRecord | null {
  const rec = getApproval(id);
  if (!rec || rec.status !== 'REQUESTED') return null;
  rec.status = 'APPROVED';
  rec.approver = approver;
  rec.approvedAt = nowIso();
  saveRecord(SUBDIR, rec);
  return rec;
}

export function rejectApproval(id: string, approver: string = 'ceo', reason: string = ''): ApprovalRecord | null {
  const rec = getApproval(id);
  if (!rec || rec.status !== 'REQUESTED') return null;
  rec.status = 'REJECTED';
  rec.approver = approver;
  rec.rejectedAt = nowIso();
  rec.reason = `${rec.reason} | REJECTED: ${reason}`;
  saveRecord(SUBDIR, rec);
  return rec;
}

export function cancelApproval(id: string): ApprovalRecord | null {
  const rec = getApproval(id);
  if (!rec || rec.status !== 'REQUESTED') return null;
  rec.status = 'CANCELLED';
  saveRecord(SUBDIR, rec);
  return rec;
}

export function getPendingApprovals(): ApprovalRecord[] {
  return getAllApprovals({ status: 'REQUESTED' });
}

export function getApprovalSummary(): {
  total: number;
  requested: number;
  approved: number;
  rejected: number;
  cancelled: number;
  byType: Record<string, number>;
} {
  const all = loadCollection<ApprovalRecord>(SUBDIR);
  const byType: Record<string, number> = {};
  let requested = 0;
  let approved = 0;
  let rejected = 0;
  let cancelled = 0;
  for (const a of all) {
    if (a.status === 'REQUESTED') requested++;
    if (a.status === 'APPROVED') approved++;
    if (a.status === 'REJECTED') rejected++;
    if (a.status === 'CANCELLED') cancelled++;
    byType[a.approvalType] = (byType[a.approvalType] ?? 0) + 1;
  }
  return { total: all.length, requested, approved, rejected, cancelled, byType };
}

export function linkEvidenceToApproval(approvalId: string, evidenceId: string): ApprovalRecord | null {
  const rec = getApproval(approvalId);
  if (!rec) return null;
  if (!rec.evidenceIds.includes(evidenceId)) rec.evidenceIds.push(evidenceId);
  saveRecord(SUBDIR, rec);
  return rec;
}