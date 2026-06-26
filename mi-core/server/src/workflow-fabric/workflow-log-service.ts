import { recordWorkflowStart, recordWorkflowStatus } from '../execution/workflow-execution-ledger';
import { checkAndRegisterWorkflowRun } from './workflow-dedup-engine';
import { buildWorkflowEvidenceRecord, writeWorkflowEvidence } from './workflow-evidence-model';
import { requiresWorkflowApproval } from './workflow-governance';
import type { WorkflowEvidenceRecord, WorkflowFingerprintInput, WorkflowRisk } from './types';

export interface WorkflowLogRequest extends WorkflowFingerprintInput {
  workflow_id: string;
  status?: string;
  risk?: WorkflowRisk;
  approved?: boolean;
  start_time?: string;
  end_time?: string;
  input?: unknown;
  output?: unknown;
  errors?: string[];
  evidence?: string[];
  owner?: string;
}

function toLedgerStatus(status: string): 'completed' | 'failed' | 'cancelled' | 'running' {
  const normalized = status.toLowerCase();
  if (['success', 'completed', 'done'].includes(normalized)) return 'completed';
  if (['failed', 'error'].includes(normalized)) return 'failed';
  if (['blocked', 'cancelled'].includes(normalized)) return 'cancelled';
  return 'running';
}

export function logWorkflowExecution(request: WorkflowLogRequest) {
  const required = ['workflow_id', 'project', 'entity', 'action', 'time_window'] as const;
  const missing = required.filter((key) => !request[key]);
  if (missing.length) {
    return { ok: false as const, statusCode: 400, error: `Missing required fields: ${missing.join(', ')}` };
  }

  const risk = request.risk ?? 'READ_ONLY';
  if (requiresWorkflowApproval(risk) && !request.approved) {
    return { ok: false as const, statusCode: 403, error: `${risk} workflow requires approval before execution.` };
  }

  const dedup = checkAndRegisterWorkflowRun({
    project: request.project,
    entity: request.entity,
    action: request.action,
    time_window: request.time_window,
  });

  const now = new Date().toISOString();
  const evidenceRecord: WorkflowEvidenceRecord = buildWorkflowEvidenceRecord({
    workflow_id: request.workflow_id,
    start_time: request.start_time ?? now,
    end_time: request.end_time ?? now,
    duration: request.start_time ? Math.max(0, new Date(request.end_time ?? now).getTime() - new Date(request.start_time).getTime()) : 0,
    status: dedup.status === 'SKIP_DUPLICATE' ? 'SKIP_DUPLICATE' : request.status ?? 'SUCCESS',
    input: request.input ?? {
      project: request.project,
      entity: request.entity,
      action: request.action,
      time_window: request.time_window,
    },
    output: request.output ?? { dedup },
    errors: request.errors ?? [],
    evidence: request.evidence ?? [],
  });
  const evidencePath = writeWorkflowEvidence(evidenceRecord);

  if (dedup.status === 'SKIP_DUPLICATE') {
    return { ok: true as const, duplicate: true, dedup, evidence_path: evidencePath, evidence: evidenceRecord };
  }

  let ledgerEntry = null;
  try {
    recordWorkflowStart({
      workflow_id: request.workflow_id,
      domain: request.project,
      category: request.action,
      target_entity: request.entity,
      owner: request.owner,
      source_message: request.time_window,
    });
    ledgerEntry = recordWorkflowStatus(request.workflow_id, toLedgerStatus(request.status ?? 'SUCCESS'), request.errors?.join('; '));
  } catch (error) {
    evidenceRecord.errors.push(String(error));
  }

  return { ok: true as const, duplicate: false, dedup, evidence_path: evidencePath, evidence: evidenceRecord, ledger: ledgerEntry };
}
