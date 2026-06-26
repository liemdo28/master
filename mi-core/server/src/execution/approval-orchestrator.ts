/**
 * DEV5 — Phase E3: Approval Orchestrator
 * 
 * For any action that publishes, sends, deploys, deletes, submits, or pays:
 *   approval_required = true
 * 
 * Approval format:
 *   Summary -> What Mi will do
 *   Risk    -> What could go wrong
 *   Preview -> What will be published/sent/deployed
 *   Action  -> Reply APPROVE / EDIT / CANCEL
 */

import fs from 'fs';
import path from 'path';
import type { ExecutionWorkflow } from './workflow-creation-layer';

// ── Types ──────────────────────────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
export type ApprovalAction = 'approve' | 'edit' | 'cancel';

export interface ApprovalRequest {
  approval_id: string;
  workflow_id: string;
  created_at: string;
  updated_at: string;
  status: ApprovalStatus;
  summary: string;
  risk_description: string;
  preview: string;
  action_options: ApprovalAction[];
  responded_at?: string;
  response_action?: ApprovalAction;
  response_detail?: string;
}

// ── Storage ────────────────────────────────────────────────────────────────

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const APPROVAL_DIR = path.join(MI_CORE_ROOT, '.local-agent-global', 'approvals');

function ensureDir() {
  fs.mkdirSync(APPROVAL_DIR, { recursive: true });
}

function approvalPath(id: string) {
  return path.join(APPROVAL_DIR, `${id}.json`);
}

function saveApproval(a: ApprovalRequest) {
  ensureDir();
  a.updated_at = new Date().toISOString();
  fs.writeFileSync(approvalPath(a.approval_id), JSON.stringify(a, null, 2));
}

function loadApproval(id: string): ApprovalRequest | null {
  try { return JSON.parse(fs.readFileSync(approvalPath(id), 'utf8')); } catch { return null; }
}

function listApprovals(): ApprovalRequest[] {
  ensureDir();
  return fs.readdirSync(APPROVAL_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(APPROVAL_DIR, f), 'utf8')); } catch { return null; } })
    .filter(Boolean)
    .sort((a: ApprovalRequest, b: ApprovalRequest) => b.created_at.localeCompare(a.created_at));
}

function genApprovalId(): string {
  return `APPR-${Date.now().toString(36)}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;
}

// ── Message builders ───────────────────────────────────────────────────────

function buildSummary(wf: ExecutionWorkflow): string {
  const types = wf.workflow_types.join(' + ');
  const entity = wf.target_entity || 'general';
  return `Mi se thuc hien workflow *${types}* cho *${entity}*.\n` +
    `Domain: ${wf.domain}.\n` +
    `Cac buoc: ${wf.steps.map(s => s.name).join(' -> ')}.`;
}

function buildRiskDescription(wf: ExecutionWorkflow): string {
  const risks: string[] = [];
  if (wf.workflow_types.includes('SEO_CONTENT') || wf.workflow_types.includes('WEBSITE_POST')) {
    risks.push('Bai viet se duoc dang len website — can CEO xac nhan noi dung.');
  }
  if (wf.workflow_types.includes('SOCIAL_POST')) {
    risks.push('Bai viet se duoc dang len mang xa hoi — khoang thu hoi de dang.');
  }
  if (wf.workflow_types.includes('EMAIL_DRAFT')) {
    risks.push('Email se duoc gui den nguoi nhan — khoang thu hoi.');
  }
  if (wf.workflow_types.includes('CAMPAIGN')) {
    risks.push('Campaign se chay tren nhieu nen tang — anh huong den budget.');
  }
  if (wf.workflow_types.includes('FLYER')) {
    risks.push('Flyer se duoc phan phoi — can CEO xac nhan design.');
  }
  if (risks.length === 0) {
    risks.push('Hanh dong nay co the anh huong den he thong hoac du lieu.');
  }
  return risks.join('\n');
}

function buildPreview(wf: ExecutionWorkflow): string {
  const lines: string[] = [];
  lines.push(`Workflow ID: ${wf.workflow_id}`);
  lines.push(`Target: ${wf.target_entity || 'general'}`);
  lines.push(`Domain: ${wf.domain}`);
  lines.push('');
  lines.push('Cac buoc thuc hien:');
  wf.steps.forEach((s, i) => {
    const icon = s.status === 'done' ? '[DONE]' : s.status === 'failed' ? '[FAIL]' : '[...]';
    lines.push(`${i + 1}. ${icon} ${s.name} — ${s.description}`);
    if (s.output_path && /Images:|featured-|og-|social-/i.test(s.output_path)) {
      lines.push(`   Preview evidence: ${s.output_path}`);
    }
  });
  return lines.join('\n');
}

// ── Public API ─────────────────────────────────────────────────────────────

export function createApprovalRequest(wf: ExecutionWorkflow): ApprovalRequest {
  const id = genApprovalId();
  const now = new Date().toISOString();
  const approval: ApprovalRequest = {
    approval_id: id,
    workflow_id: wf.workflow_id,
    created_at: now,
    updated_at: now,
    status: 'pending',
    summary: buildSummary(wf),
    risk_description: buildRiskDescription(wf),
    preview: buildPreview(wf),
    action_options: ['approve', 'edit', 'cancel'],
  };
  saveApproval(approval);
  return approval;
}

export function resolveApproval(approvalId: string, action: ApprovalAction, detail?: string): ApprovalRequest | null {
  const approval = loadApproval(approvalId);
  if (!approval || approval.status !== 'pending') return null;
  approval.status = action === 'approve' ? 'approved' : action === 'cancel' ? 'cancelled' : 'rejected';
  approval.responded_at = new Date().toISOString();
  approval.response_action = action;
  approval.response_detail = detail;
  saveApproval(approval);
  return approval;
}

export function formatApprovalMessage(approval: ApprovalRequest): string {
  const lines: string[] = [];
  lines.push('*--- APPROVAL REQUIRED ---*');
  lines.push('');
  lines.push('*Summary:*');
  lines.push(approval.summary);
  lines.push('');
  lines.push('*Risk:*');
  lines.push(approval.risk_description);
  lines.push('');
  lines.push('*Preview:*');
  lines.push(approval.preview);
  lines.push('');
  lines.push('*Action:* Reply APPROVE / EDIT / CANCEL');
  return lines.join('\n');
}

export function getApproval(id: string): ApprovalRequest | null {
  return loadApproval(id);
}

export function getPendingApprovals(): ApprovalRequest[] {
  return listApprovals().filter(a => a.status === 'pending');
}

export function findPendingByWorkflow(workflowId: string): ApprovalRequest | null {
  return listApprovals().find(a => a.workflow_id === workflowId && a.status === 'pending') || null;
}

export function getLatestPendingApproval(): ApprovalRequest | null {
  const pending = getPendingApprovals();
  return pending.length > 0 ? pending[0] : null;
}
