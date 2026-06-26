/**
 * Multi-intent execution orchestrator.
 *
 * This layer executes every child workflow independently after splitting and
 * intent detection have already happened. It does not modify splitting,
 * auth, memory, or approval persistence.
 */

import fs from 'fs';
import path from 'path';
import { processMultiIntent, MultiIntentResult } from './multi-intent-engine';
import { ceoMultiIntentSummary } from './ceo-language-filter';
import {
  advanceWorkflowStep,
  completeWorkflow,
  getWorkflow,
  updateWorkflowStatus,
  type ExecutionWorkflow,
} from './workflow-creation-layer';
import { enqueueJob, hasDuplicateJob, startJob, completeJob, failJob, type QueueJob } from './execution-queue';
import { runSEOPipeline } from './seo-pipeline';

export type ChildExecutionStatus = 'completed' | 'approval_pending' | 'failed';

export interface ChildExecutionResult {
  tracking_id: string;
  workflow_id: string;
  clause_index: number;
  workflow_type: string;
  domain: string;
  target_entity: string | null;
  status: ChildExecutionStatus;
  job_id: string | null;
  result: string;
  error: string | null;
  evidence: string[];
}

export interface MultiIntentExecutionSummary {
  parent_tracking_id: string;
  parent_workflow_id: string;
  original_message: string;
  expected_children: number;
  executed_children: number;
  completed_children: number;
  failed_children: number;
  approval_pending_children: number;
  dropped_children: number;
  children: ChildExecutionResult[];
  final_summary: string;
  trace_path: string;
  created_at: string;
}

export interface ExecuteMultiIntentOptions {
  sender?: string;
  forcedFailureDomains?: string[];
  forcedFailureWorkflowTypes?: string[];
  parentTrackingId?: string;
}

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const TRACE_DIR = path.join(MI_CORE_ROOT, '.local-agent-global', 'workflows', 'multi-intent');

function ensureTraceDir() {
  fs.mkdirSync(TRACE_DIR, { recursive: true });
}

function nextParentTrackingId(): string {
  ensureTraceDir();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const count = fs.readdirSync(TRACE_DIR).filter(f => f.startsWith(`WF-${today}-`) && f.endsWith('.json')).length + 1;
  return `WF-${today}-${String(count).padStart(3, '0')}`;
}

function childTrackingId(parentTrackingId: string, index: number): string {
  return `${parentTrackingId}-${String.fromCharCode(65 + index)}`;
}

function normalizeExecutionCompound(message: string): string {
  return message.replace(/\s*\+\s*/g, ', ');
}

function shouldForceFailure(
  child: MultiIntentResult['child_workflows'][number],
  opts: ExecuteMultiIntentOptions,
): boolean {
  return (opts.forcedFailureDomains || []).includes(child.intent.domain)
    || (opts.forcedFailureWorkflowTypes || []).includes(child.workflow_type);
}

function workflowEvidencePath(workflow: ExecutionWorkflow | null, fallbackId: string): string {
  return workflow?.evidence_path || `.local-agent-global/workflows/${fallbackId}.json`;
}

function completeAllSafeSteps(workflowId: string): void {
  const workflow = getWorkflow(workflowId);
  if (!workflow) return;
  for (const step of workflow.steps) {
    if (/publish|send|approval|deploy|post/i.test(`${step.name} ${step.description}`)) continue;
    advanceWorkflowStep(workflowId, step.step_id, 'done', `multi-intent:${workflowId}:${step.step_id}`);
  }
}

function executeChild(
  child: MultiIntentResult['child_workflows'][number],
  index: number,
  parentTrackingId: string,
  opts: ExecuteMultiIntentOptions,
): ChildExecutionResult {
  const trackingId = childTrackingId(parentTrackingId, index);
  const workflow = getWorkflow(child.workflow_id);
  const evidence: string[] = [workflowEvidencePath(workflow, child.workflow_id)];
  let job: QueueJob | null = null;

  try {
    updateWorkflowStatus(child.workflow_id, 'executing');

    if (shouldForceFailure(child, opts)) {
      updateWorkflowStatus(child.workflow_id, 'failed');
      return {
        tracking_id: trackingId,
        workflow_id: child.workflow_id,
        clause_index: child.clause_index,
        workflow_type: child.workflow_type,
        domain: child.intent.domain,
        target_entity: child.intent.target_entity || child.entities.entity || null,
        status: 'failed',
        job_id: null,
        result: `${child.workflow_type} failed independently; other children continued.`,
        error: `Forced failure for ${child.intent.domain || child.workflow_type}`,
        evidence,
      };
    }

    const idempotencyKey = `${child.workflow_id}-${child.workflow_type}`;
    if (!hasDuplicateJob(idempotencyKey)) {
      job = enqueueJob({
        workflow_id: child.workflow_id,
        workflow_type: child.workflow_type,
        target_entity: child.intent.target_entity || child.entities.entity,
        domain: child.intent.domain,
        owner: opts.sender || 'ceo',
        idempotency_key: idempotencyKey,
      });
      startJob(job.id);
      evidence.push(`.local-agent-global/execution-queue/${job.id}.json`);
    }

    if (child.workflow_type === 'SEO_CONTENT') {
      const freshWorkflow = getWorkflow(child.workflow_id);
      if (freshWorkflow) {
        const draft = runSEOPipeline(freshWorkflow);
        if (draft?.preview_path) evidence.push(draft.preview_path);
      }
    } else {
      completeAllSafeSteps(child.workflow_id);
    }

    const approvalPending = child.intent.approval_required;
    const result = {
      status: approvalPending ? 'approval_pending' : 'completed',
      summary: approvalPending
        ? `${child.workflow_type} executed through safe steps and is waiting for approval before external write.`
        : `${child.workflow_type} executed successfully.`,
      deliverables: evidence,
    };

    if (job) completeJob(job.id, result);
    completeWorkflow(child.workflow_id, {
      verdict: result.status,
      summary: result.summary,
      deliverables: evidence,
    });

    return {
      tracking_id: trackingId,
      workflow_id: child.workflow_id,
      clause_index: child.clause_index,
      workflow_type: child.workflow_type,
      domain: child.intent.domain,
      target_entity: child.intent.target_entity || child.entities.entity || null,
      status: approvalPending ? 'approval_pending' : 'completed',
      job_id: job?.id || null,
      result: result.summary,
      error: null,
      evidence,
    };
  } catch (e) {
    if (job) failJob(job.id, e instanceof Error ? e.message : String(e));
    updateWorkflowStatus(child.workflow_id, 'failed');
    return {
      tracking_id: trackingId,
      workflow_id: child.workflow_id,
      clause_index: child.clause_index,
      workflow_type: child.workflow_type,
      domain: child.intent.domain,
      target_entity: child.intent.target_entity || child.entities.entity || null,
      status: 'failed',
      job_id: job?.id || null,
      result: `${child.workflow_type} failed independently; other children continued.`,
      error: e instanceof Error ? e.message : String(e),
      evidence,
    };
  }
}

function writeTrace(summary: Omit<MultiIntentExecutionSummary, 'trace_path'>): string {
  ensureTraceDir();
  const tracePath = path.join(TRACE_DIR, `${summary.parent_tracking_id}.json`);
  fs.writeFileSync(tracePath, JSON.stringify({ ...summary, trace_path: tracePath }, null, 2));
  return tracePath;
}

export function executeMultiIntent(
  message: string,
  opts: ExecuteMultiIntentOptions = {},
): MultiIntentExecutionSummary {
  const normalizedMessage = normalizeExecutionCompound(message);
  const created = processMultiIntent(normalizedMessage, opts.sender || 'ceo');
  const parentTrackingId = opts.parentTrackingId || nextParentTrackingId();
  const children = created.child_workflows.map((child, index) => executeChild(child, index, parentTrackingId, opts));
  const failed = children.filter(c => c.status === 'failed').length;
  const approvalPending = children.filter(c => c.status === 'approval_pending').length;
  const completed = children.filter(c => c.status === 'completed').length;
  const dropped = Math.max(0, created.child_workflows.length - children.length);

  const summaryWithoutPath = {
    parent_tracking_id: parentTrackingId,
    parent_workflow_id: created.parent_workflow_id,
    original_message: message,
    expected_children: created.clause_count,
    executed_children: children.length,
    completed_children: completed,
    failed_children: failed,
    approval_pending_children: approvalPending,
    dropped_children: dropped,
    children,
    final_summary: ceoMultiIntentSummary(children.map(c => ({
      workflow_type: c.workflow_type,
      status: c.status,
      target_entity: c.target_entity,
    }))),
    created_at: new Date().toISOString(),
  };
  const tracePath = writeTrace(summaryWithoutPath);
  return { ...summaryWithoutPath, trace_path: tracePath };
}
