/**
 * DEV5 — Phase E8: Workflow Reality Proof
 * 
 * When Mi says "Em da tao workflow" -> verify actual workflow exists.
 * When Mi says "Em da tao draft" -> verify file exists.
 * When Mi says "Dang cho duyet" -> verify approval exists.
 * 
 * No fake claims. Every claim must have evidence.
 */

import fs from 'fs';
import path from 'path';
import { getWorkflow, listWorkflows } from './workflow-creation-layer';
import { getApproval, getPendingApprovals } from './approval-orchestrator';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';

// ── Types ──────────────────────────────────────────────────────────────────

export type ClaimType = 'workflow_created' | 'draft_created' | 'approval_pending' | 'step_completed' | 'queue_job_created';

export interface RealityCheck {
  claim_type: ClaimType;
  claim_detail: string;
  is_real: boolean;
  evidence: string;
  checked_at: string;
}

// ── Checkers ───────────────────────────────────────────────────────────────

function checkWorkflowClaim(workflowId: string): RealityCheck {
  const wf = getWorkflow(workflowId);
  const now = new Date().toISOString();
  
  if (wf) {
    return {
      claim_type: 'workflow_created',
      claim_detail: `Workflow ${workflowId} exists with status ${wf.status}`,
      is_real: true,
      evidence: `File: .local-agent-global/workflows/${workflowId}.json | Status: ${wf.status} | Steps: ${wf.steps.length}`,
      checked_at: now,
    };
  }
  
  return {
    claim_type: 'workflow_created',
    claim_detail: `Workflow ${workflowId} NOT FOUND`,
    is_real: false,
    evidence: `No file found for workflow ${workflowId}`,
    checked_at: now,
  };
}

function checkDraftClaim(workflowId: string, draftPath?: string): RealityCheck {
  const now = new Date().toISOString();
  
  if (draftPath) {
    const fullPath = path.join(MI_CORE_ROOT, draftPath);
    if (fs.existsSync(fullPath)) {
      const stat = fs.statSync(fullPath);
      return {
        claim_type: 'draft_created',
        claim_detail: `Draft file exists at ${draftPath}`,
        is_real: true,
        evidence: `File: ${draftPath} | Size: ${stat.size} bytes | Modified: ${stat.mtime.toISOString()}`,
        checked_at: now,
      };
    }
  }
  
  // Check workflow for draft status
  const wf = getWorkflow(workflowId);
  if (wf && (wf.status === 'draft_created' || wf.status === 'drafting')) {
    return {
      claim_type: 'draft_created',
      claim_detail: `Workflow ${workflowId} is in draft status`,
      is_real: true,
      evidence: `Workflow status: ${wf.status}`,
      checked_at: now,
    };
  }
  
  return {
    claim_type: 'draft_created',
    claim_detail: `No draft found for ${workflowId}`,
    is_real: false,
    evidence: `Workflow not found or not in draft status`,
    checked_at: now,
  };
}

function checkApprovalClaim(workflowId?: string): RealityCheck {
  const now = new Date().toISOString();
  
  if (workflowId) {
    const approvals = getPendingApprovals().filter(a => a.workflow_id === workflowId);
    if (approvals.length > 0) {
      return {
        claim_type: 'approval_pending',
        claim_detail: `Approval ${approvals[0].approval_id} pending for workflow ${workflowId}`,
        is_real: true,
        evidence: `Approval ID: ${approvals[0].approval_id} | Status: ${approvals[0].status}`,
        checked_at: now,
      };
    }
  } else {
    const pending = getPendingApprovals();
    if (pending.length > 0) {
      return {
        claim_type: 'approval_pending',
        claim_detail: `${pending.length} pending approvals found`,
        is_real: true,
        evidence: `Pending: ${pending.map(a => a.approval_id).join(', ')}`,
        checked_at: now,
      };
    }
  }
  
  return {
    claim_type: 'approval_pending',
    claim_detail: 'No pending approvals found',
    is_real: false,
    evidence: 'No pending approvals in system',
    checked_at: now,
  };
}

function checkStepClaim(workflowId: string, stepId: string): RealityCheck {
  const now = new Date().toISOString();
  const wf = getWorkflow(workflowId);
  
  if (!wf) {
    return {
      claim_type: 'step_completed',
      claim_detail: `Workflow ${workflowId} not found`,
      is_real: false,
      evidence: 'Workflow does not exist',
      checked_at: now,
    };
  }
  
  const step = wf.steps.find(s => s.step_id === stepId);
  if (step && (step.status === 'done' || step.status === 'running')) {
    return {
      claim_type: 'step_completed',
      claim_detail: `Step ${stepId} (${step.name}) is ${step.status}`,
      is_real: true,
      evidence: `Step: ${step.name} | Status: ${step.status} | Output: ${step.output_path || 'N/A'}`,
      checked_at: now,
    };
  }
  
  return {
    claim_type: 'step_completed',
    claim_detail: `Step ${stepId} not completed`,
    is_real: false,
    evidence: `Step not found or still pending`,
    checked_at: now,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

export function verifyWorkflowClaim(workflowId: string): RealityCheck {
  return checkWorkflowClaim(workflowId);
}

export function verifyDraftClaim(workflowId: string, draftPath?: string): RealityCheck {
  return checkDraftClaim(workflowId, draftPath);
}

export function verifyApprovalClaim(workflowId?: string): RealityCheck {
  return checkApprovalClaim(workflowId);
}

export function verifyStepClaim(workflowId: string, stepId: string): RealityCheck {
  return checkStepClaim(workflowId, stepId);
}

export function verifyAllClaims(claims: Array<{ type: ClaimType; workflowId?: string; stepId?: string; draftPath?: string }>): RealityCheck[] {
  return claims.map(c => {
    switch (c.type) {
      case 'workflow_created': return checkWorkflowClaim(c.workflowId || '');
      case 'draft_created': return checkDraftClaim(c.workflowId || '', c.draftPath);
      case 'approval_pending': return checkApprovalClaim(c.workflowId);
      case 'step_completed': return checkStepClaim(c.workflowId || '', c.stepId || '');
      default: return {
        claim_type: c.type as ClaimType,
        claim_detail: 'Unknown claim type',
        is_real: false,
        evidence: 'Unsupported claim type',
        checked_at: new Date().toISOString(),
      };
    }
  });
}

export function formatRealityReport(checks: RealityCheck[]): string {
  const lines: string[] = [];
  lines.push('=== WORKFLOW REALITY PROOF ===');
  lines.push('');
  
  let allReal = true;
  for (const check of checks) {
    const icon = check.is_real ? '[VERIFIED]' : '[FAKE CLAIM]';
    if (!check.is_real) allReal = false;
    lines.push(`${icon} ${check.claim_type}: ${check.claim_detail}`);
    lines.push(`  Evidence: ${check.evidence}`);
    lines.push('');
  }
  
  lines.push(allReal ? 'RESULT: All claims verified.' : 'RESULT: FAKE CLAIMS DETECTED.');
  return lines.join('\n');
}
