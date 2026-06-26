/**
 * DEV5 — Phase E2: Workflow Creation Layer
 * 
 * Turns ActionIntent into real, persisted workflow records.
 * No fake workflows. Every workflow has an ID, file, and audit trail.
 */

import fs from 'fs';
import path from 'path';
import type { ActionIntent, WorkflowType } from './action-intent-engine';

// ── Types ──────────────────────────────────────────────────────────────────

export type WorkflowStatus =
  | 'created'
  | 'drafting'
  | 'draft_created'
  | 'approval_pending'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'failed';

export interface WorkflowStep {
  step_id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  output_path?: string;
  started_at?: string;
  completed_at?: string;
}

export interface ExecutionWorkflow {
  workflow_id: string;
  source_message_id: string;
  sender: string;
  intent: {
    message_class: string;
    domain: string;
    confidence: number;
    action_verbs: string[];
  };
  workflow_types: WorkflowType[];
  target_entity: string | undefined;
  domain: string;
  steps: WorkflowStep[];
  approval_required: boolean;
  status: WorkflowStatus;
  created_at: string;
  updated_at: string;
  evidence_path: string;
  result?: {
    verdict: string;
    summary: string;
    deliverables: string[];
  };
}

// ── Storage ────────────────────────────────────────────────────────────────

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const WF_DIR = path.join(MI_CORE_ROOT, '.local-agent-global', 'workflows');

function ensureDir() {
  fs.mkdirSync(WF_DIR, { recursive: true });
}

function wfPath(id: string) {
  return path.join(WF_DIR, `${id}.json`);
}

function saveWf(wf: ExecutionWorkflow) {
  ensureDir();
  wf.updated_at = new Date().toISOString();
  fs.writeFileSync(wfPath(wf.workflow_id), JSON.stringify(wf, null, 2));
}

function loadWf(id: string): ExecutionWorkflow | null {
  try { return JSON.parse(fs.readFileSync(wfPath(id), 'utf8')); } catch { return null; }
}

function listWfs(): ExecutionWorkflow[] {
  ensureDir();
  return fs.readdirSync(WF_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(WF_DIR, f), 'utf8')); } catch { return null; } })
    .filter(Boolean)
    .sort((a: ExecutionWorkflow, b: ExecutionWorkflow) => b.created_at.localeCompare(a.created_at));
}

// ── ID generation ──────────────────────────────────────────────────────────

function genWorkflowId(type: WorkflowType): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const prefix = type.replace(/_/g, '-');
  const existing = listWfs().filter(w => w.workflow_id.includes(`${prefix}-${date}`));
  const seq = String(existing.length + 1).padStart(3, '0');
  return `${prefix}-${date}-${seq}`;
}

// ── Step builders per workflow type ────────────────────────────────────────

function buildStepsForType(type: WorkflowType, entity: string | undefined): WorkflowStep[] {
  const entityLabel = entity || 'general';
  const step = (id: string, name: string, desc: string): WorkflowStep => ({
    step_id: id, name, description: desc, status: 'pending',
  });

  switch (type) {
    case 'SEO_CONTENT':
      return [
        step('SEO-1', 'Resolve entity', `Identify target entity and website for ${entityLabel}`),
        step('SEO-2', 'Pick SEO topic', 'Auto-select SEO topic based on trending and relevance'),
        step('SEO-3', 'Generate article', 'Write SEO-optimized article content'),
        step('SEO-4', 'Generate metadata', 'Create meta title, meta description, slug'),
        step('SEO-5', 'Generate internal links', 'Add internal linking suggestions'),
        step('SEO-6', 'Create preview file', 'Generate preview markdown/HTML for review'),
        step('SEO-7', 'Request approval', 'Send preview to CEO for approve/edit/cancel'),
        step('SEO-8', 'Publish', 'On approval: commit to CMS/source and sync'),
      ];

    case 'WEBSITE_POST':
      return [
        step('WP-1', 'Resolve entity', `Identify target website for ${entityLabel}`),
        step('WP-2', 'Prepare content', 'Format content for website post'),
        step('WP-3', 'Create draft', 'Generate post draft file'),
        step('WP-4', 'Request approval', 'Send draft to CEO for approve/edit/cancel'),
        step('WP-5', 'Publish', 'On approval: publish to website'),
      ];

    case 'SOCIAL_POST':
      return [
        step('SP-1', 'Resolve entity', `Identify social platforms for ${entityLabel}`),
        step('SP-2', 'Create content', 'Write social media post content'),
        step('SP-3', 'Request approval', 'Send to CEO for review'),
        step('SP-4', 'Post', 'On approval: publish to social platforms'),
      ];

    case 'EMAIL_DRAFT':
      return [
        step('ED-1', 'Resolve recipient', `Identify email recipient for ${entityLabel}`),
        step('ED-2', 'Draft email', 'Compose email content'),
        step('ED-3', 'Request approval', 'Send draft to CEO for review'),
        step('ED-4', 'Send', 'On approval: send email'),
      ];

    case 'CAMPAIGN':
      return [
        step('CP-1', 'Resolve entity', `Identify campaign target for ${entityLabel}`),
        step('CP-2', 'Design creative', 'Create campaign visuals and copy'),
        step('CP-3', 'Review', 'Council review of campaign materials'),
        step('CP-4', 'Request approval', 'Send to CEO for approve/edit/cancel'),
        step('CP-5', 'Launch', 'On approval: launch campaign across platforms'),
      ];

    case 'FLYER':
      return [
        step('FL-1', 'Resolve entity', `Identify flyer target for ${entityLabel}`),
        step('FL-2', 'Design flyer', 'Generate flyer design'),
        step('FL-3', 'Request approval', 'Send preview to CEO for review'),
        step('FL-4', 'Publish', 'On approval: export and distribute'),
      ];

    case 'VIDEO':
      return [
        step('VD-1', 'Resolve entity', `Identify video target for ${entityLabel}`),
        step('VD-2', 'Write script', 'Create video script'),
        step('VD-3', 'Produce', 'Generate video content'),
        step('VD-4', 'Request approval', 'Send preview to CEO'),
        step('VD-5', 'Publish', 'On approval: publish to platforms'),
      ];

    case 'DASHBOARD_AUDIT':
      return [
        step('DA-1', 'Scan dashboard', 'Check dashboard health and data'),
        step('DA-2', 'Analyze issues', 'Identify issues and anomalies'),
        step('DA-3', 'Report', 'Generate audit report for CEO'),
      ];

    case 'BUG_FIX':
      return [
        step('BF-1', 'Identify bug', 'Locate and reproduce the bug'),
        step('BF-2', 'Fix', 'Apply safe fix'),
        step('BF-3', 'Test', 'Run regression tests'),
        step('BF-4', 'Request approval', 'Get CEO approval for deployment'),
      ];

    case 'FINANCE_REPORT':
      return [
        step('FR-1', 'Gather data', 'Collect financial data'),
        step('FR-2', 'Analyze', 'Generate P&L and analysis'),
        step('FR-3', 'Report', 'Format and send report to CEO'),
      ];

    case 'QB_CHECK':
      return [
        step('QB-1', 'Connect', 'Connect to QuickBooks'),
        step('QB-2', 'Check status', 'Run sync health check'),
        step('QB-3', 'Report', 'Report status to CEO'),
      ];

    case 'GOOGLE_SHEET_UPDATE':
      return [
        step('GS-1', 'Resolve sheet', 'Identify target Google Sheet'),
        step('GS-2', 'Update', 'Apply requested changes'),
        step('GS-3', 'Confirm', 'Report changes to CEO'),
      ];

    default:
      return [
        step('T-1', 'Process request', 'Understand and scope the request'),
        step('T-2', 'Execute', 'Carry out the task'),
        step('T-3', 'Report', 'Report results to CEO'),
      ];
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export function createWorkflow(params: {
  intent: ActionIntent;
  source_message_id: string;
  sender: string;
  raw_message: string;
}): ExecutionWorkflow {
  const primaryType = params.intent.workflow_types[0] || 'GENERAL_TASK';
  const id = genWorkflowId(primaryType);
  const now = new Date().toISOString();

  const wf: ExecutionWorkflow = {
    workflow_id: id,
    source_message_id: params.source_message_id,
    sender: params.sender,
    intent: {
      message_class: params.intent.message_class,
      domain: params.intent.domain,
      confidence: params.intent.confidence,
      action_verbs: params.intent.action_verbs,
    },
    workflow_types: params.intent.workflow_types,
    target_entity: params.intent.target_entity,
    domain: params.intent.domain,
    steps: buildStepsForType(primaryType, params.intent.target_entity),
    approval_required: params.intent.approval_required,
    status: 'created',
    created_at: now,
    updated_at: now,
    evidence_path: `.local-agent-global/workflows/${id}.json`,
  };

  saveWf(wf);
  return wf;
}

export function updateWorkflowStatus(id: string, status: WorkflowStatus): ExecutionWorkflow | null {
  const wf = loadWf(id);
  if (!wf) return null;
  wf.status = status;
  saveWf(wf);
  return wf;
}

export function advanceWorkflowStep(id: string, stepId: string, status: WorkflowStep['status'], outputPath?: string): ExecutionWorkflow | null {
  const wf = loadWf(id);
  if (!wf) return null;
  const step = wf.steps.find(s => s.step_id === stepId);
  if (!step) return null;
  step.status = status;
  if (outputPath) step.output_path = outputPath;
  if (status === 'running') step.started_at = new Date().toISOString();
  if (status === 'done' || status === 'failed') step.completed_at = new Date().toISOString();
  saveWf(wf);
  return wf;
}

export function completeWorkflow(id: string, result: { verdict: string; summary: string; deliverables: string[] }): ExecutionWorkflow | null {
  const wf = loadWf(id);
  if (!wf) return null;
  wf.result = result;
  wf.status = wf.approval_required ? 'approval_pending' : 'completed';
  saveWf(wf);
  return wf;
}

export function getWorkflow(id: string): ExecutionWorkflow | null {
  return loadWf(id);
}

export function listWorkflows(limit = 20): ExecutionWorkflow[] {
  return listWfs().slice(0, limit);
}

export function getActiveWorkflows(): ExecutionWorkflow[] {
  return listWfs().filter(w => ['created', 'drafting', 'draft_created', 'approval_pending', 'executing'].includes(w.status));
}

export function findPendingWorkflowByEntity(entity: string): ExecutionWorkflow | null {
  return listWfs().find(w =>
    w.target_entity === entity &&
    ['created', 'drafting', 'draft_created', 'approval_pending'].includes(w.status)
  ) || null;
}
