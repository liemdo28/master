/**
 * GStack Work Order Engine
 * Every CEO request becomes a structured Work Order.
 * Tracks lifecycle: created → assigned → executing → qa → delivered
 */

import fs from 'fs';
import path from 'path';

import { classifyIntent, IntentResult } from './intent-router';


const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core';
const WO_DIR = path.join(MI_CORE_ROOT, '.local-agent-global/work-orders');

export type WoStatus =
  | 'created'
  | 'assigned'
  | 'executing'
  | 'qa_pending'
  | 'approval_pending'
  | 'delivered'
  | 'rejected'
  | 'cancelled';

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export interface WorkOrder {
  request_id: string;
  created_at: string;
  updated_at: string;
  source: 'whatsapp' | 'api' | 'dashboard';
  requested_by: string;
  raw_request: string;
  intent: IntentResult;
  priority: Priority;
  target_project?: string;
  assigned_role: RoleName;
  acceptance_criteria: string[];
  evidence_required: string[];
  execution_plan: ExecutionStep[];
  qa_plan: QaCheck[];
  status: WoStatus;
  execution_log: LogEntry[];
  result?: WorkOrderResult;
}

export type RoleName =
  | 'ceo_interpreter'
  | 'product_manager'
  | 'engineering_manager'
  | 'developer_agent'
  | 'qa_agent'
  | 'release_agent'
  | 'auditor_agent';

export interface ExecutionStep {
  step_id: string;
  role: RoleName;
  action: string;
  target?: string;
  risk_level: 1 | 2 | 3;
  requires_approval: boolean;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  result?: string;
  started_at?: string;
  completed_at?: string;
}

export interface QaCheck {
  check_id: string;
  name: string;
  type: 'test' | 'regression' | 'audit' | 'manual';
  status: 'pending' | 'pass' | 'fail' | 'skip';
  evidence?: string;
}

export interface LogEntry {
  ts: string;
  level: 'info' | 'warn' | 'error' | 'action' | 'qa' | 'approval';
  role: RoleName | 'system';
  message: string;
  detail?: string;
}

export interface WorkOrderResult {
  verdict: 'DELIVERED' | 'PARTIAL' | 'FAILED' | 'APPROVAL_REQUIRED';
  summary: string;
  findings: string[];
  fixed: string[];
  tested: string[];
  needs_approval: string[];
  confidence_score: number;
  report_path?: string;
}

// ── Storage ──────────────────────────────────────────────────────────────────

function ensureDir() {
  fs.mkdirSync(WO_DIR, { recursive: true });
}

function woPath(id: string) {
  return path.join(WO_DIR, `${id}.json`);
}

function saveWo(wo: WorkOrder) {
  ensureDir();
  wo.updated_at = new Date().toISOString();
  fs.writeFileSync(woPath(wo.request_id), JSON.stringify(wo, null, 2));
}

function loadWo(id: string): WorkOrder | null {
  try { return JSON.parse(fs.readFileSync(woPath(id), 'utf8')); } catch { return null; }
}

function listWos(): WorkOrder[] {
  ensureDir();
  return fs.readdirSync(WO_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => { try { return JSON.parse(fs.readFileSync(path.join(WO_DIR, f), 'utf8')); } catch { return null; } })
    .filter(Boolean)
    .sort((a: WorkOrder, b: WorkOrder) => b.created_at.localeCompare(a.created_at));
}

// ── ID generation ─────────────────────────────────────────────────────────────

function genId(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const existing = listWos().filter(w => w.request_id.includes(date));
  const seq = String(existing.length + 1).padStart(3, '0');
  return `WO-${date}-${seq}`;
}

// ── Priority inference ────────────────────────────────────────────────────────

function inferPriority(intent: IntentResult, raw: string): Priority {
  const n = raw.toLowerCase();
  if (/khan cap|urgent|p0|critical|san xuat bi loi|production.*crash/.test(n)) return 'P0';
  if (intent.intent === 'fix_bug' && intent.risk_level >= 2) return 'P1';
  if (intent.intent === 'deploy_release' || intent.intent === 'rollback') return 'P1';
  if (intent.intent === 'build_feature') return 'P2';
  return 'P3';
}

// ── Role assignment ───────────────────────────────────────────────────────────

function assignRole(intent: IntentResult): RoleName {
  switch (intent.intent) {
    case 'fix_bug':       return 'engineering_manager';
    case 'audit_project': return 'qa_agent';
    case 'build_feature': return 'engineering_manager';
    case 'deploy_release':return 'release_agent';
    case 'rollback':      return 'release_agent';
    case 'check_status':  return 'qa_agent';
    case 'monitor_runtime': return 'qa_agent';
    case 'create_report': return 'product_manager';
    case 'search_knowledge': return 'ceo_interpreter';
    case 'send_message':  return 'product_manager';
    default:              return 'ceo_interpreter';
  }
}

// ── Execution plan builder ────────────────────────────────────────────────────

function buildExecutionPlan(intent: IntentResult, raw: string): ExecutionStep[] {
  const steps: ExecutionStep[] = [];
  const target = intent.target_project;

  const step = (id: string, role: RoleName, action: string, risk: 1|2|3 = 1, approval = false): ExecutionStep => ({
    step_id: id, role, action, target, risk_level: risk,
    requires_approval: approval, status: 'pending',
  });

  switch (intent.intent) {
    case 'audit_project':
    case 'fix_bug':
      steps.push(step('S1', 'ceo_interpreter',    'Interpret and scope CEO request'));
      steps.push(step('S2', 'product_manager',    'Define acceptance criteria and scope'));
      steps.push(step('S3', 'engineering_manager','Scan project source for issues'));
      steps.push(step('S4', 'developer_agent',    'Apply safe fixes (level 1)', 1, false));
      steps.push(step('S5', 'qa_agent',           'Run regression suite and QA checks'));
      steps.push(step('S6', 'auditor_agent',      'Verify evidence and certify findings'));
      steps.push(step('S7', 'product_manager',    'Compile final report for CEO'));
      if (intent.intent === 'fix_bug') {
        steps.push(step('S8', 'release_agent',    'Stage deployment (CEO approval required)', 3, true));
      }
      break;

    case 'deploy_release':
      steps.push(step('S1', 'ceo_interpreter',    'Parse deployment scope'));
      steps.push(step('S2', 'release_agent',      'Verify QA gate is clear'));
      steps.push(step('S3', 'auditor_agent',      'Confirm no P0 open issues'));
      steps.push(step('S4', 'release_agent',      'Prepare rollback plan'));
      steps.push(step('S5', 'release_agent',      'Execute deployment', 3, true));
      steps.push(step('S6', 'qa_agent',           'Post-deploy health check'));
      break;

    case 'check_status':
    case 'monitor_runtime':
      steps.push(step('S1', 'qa_agent',           'Run health sweep on all services'));
      steps.push(step('S2', 'qa_agent',           'Check PM2 process list'));
      steps.push(step('S3', 'qa_agent',           'Collect runtime metrics'));
      steps.push(step('S4', 'product_manager',    'Format status report for CEO'));
      break;

    case 'build_feature':
      steps.push(step('S1', 'ceo_interpreter',    'Define feature scope from CEO request'));
      steps.push(step('S2', 'product_manager',    'Write acceptance criteria'));
      steps.push(step('S3', 'engineering_manager','Break into technical tasks'));
      steps.push(step('S4', 'developer_agent',    'Implement feature', 2, false));
      steps.push(step('S5', 'qa_agent',           'Test and validate'));
      steps.push(step('S6', 'release_agent',      'Stage for CEO review', 2, true));
      break;

    case 'create_report':
      steps.push(step('S1', 'ceo_interpreter',    'Identify report scope'));
      steps.push(step('S2', 'product_manager',    'Gather data from Knowledge Universe'));
      steps.push(step('S3', 'product_manager',    'Compile and format report'));
      break;

    default:
      steps.push(step('S1', 'ceo_interpreter',    'Process CEO request'));
      steps.push(step('S2', 'product_manager',    'Prepare response'));
      break;
  }

  return steps;
}

function buildQaPlan(intent: IntentResult): QaCheck[] {
  const base: QaCheck[] = [
    { check_id: 'QA1', name: 'Regression suite (10 CEO cases)', type: 'regression', status: 'pending' },
    { check_id: 'QA2', name: 'No P0 open issues', type: 'audit', status: 'pending' },
    { check_id: 'QA3', name: 'Service health check', type: 'test', status: 'pending' },
  ];

  if (intent.intent === 'fix_bug' || intent.intent === 'deploy_release') {
    base.push({ check_id: 'QA4', name: 'Rollback plan verified', type: 'audit', status: 'pending' });
    base.push({ check_id: 'QA5', name: 'Build compiles cleanly', type: 'test', status: 'pending' });
  }

  return base;
}

function buildAcceptanceCriteria(intent: IntentResult, raw: string): string[] {
  switch (intent.intent) {
    case 'audit_project':
      return [
        'All issues categorized by severity',
        'Safe fixes applied without breaking changes',
        'No new errors introduced',
        'Evidence provided for each finding',
      ];
    case 'fix_bug':
      return [
        'Root cause identified',
        'Fix applied and tested',
        'Regression suite passes',
        'No new P0 issues',
      ];
    case 'deploy_release':
      return [
        'QA gate cleared',
        'Rollback plan ready',
        'CEO approval received',
        'Post-deploy health check passes',
      ];
    case 'check_status':
      return ['All services health status reported', 'Runtime metrics collected'];
    default:
      return ['CEO request fulfilled', 'Evidence provided'];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createWorkOrder(params: {
  raw_request: string;
  requested_by: string;
  source: 'whatsapp' | 'api' | 'dashboard';
}): WorkOrder {
  const intent = classifyIntent(params.raw_request);
  const id = genId();
  const now = new Date().toISOString();

  const wo: WorkOrder = {
    request_id: id,
    created_at: now,
    updated_at: now,
    source: params.source,
    requested_by: params.requested_by,
    raw_request: params.raw_request,
    intent,
    priority: inferPriority(intent, params.raw_request),
    target_project: intent.target_project,
    assigned_role: assignRole(intent),
    acceptance_criteria: buildAcceptanceCriteria(intent, params.raw_request),
    evidence_required: ['test_results', 'health_check_output', 'error_log_scan'],
    execution_plan: buildExecutionPlan(intent, params.raw_request),
    qa_plan: buildQaPlan(intent),
    status: 'created',
    execution_log: [{
      ts: now, level: 'info', role: 'system',
      message: `Work order created`,
      detail: `Intent: ${intent.intent} | Target: ${intent.target_project || 'general'} | Priority: ${inferPriority(intent, params.raw_request)}`,
    }],
  };

  saveWo(wo);
  return wo;
}

export function updateWoStatus(id: string, status: WoStatus, entry?: Omit<LogEntry, 'ts'>): WorkOrder | null {
  const wo = loadWo(id);
  if (!wo) return null;
  wo.status = status;
  if (entry) wo.execution_log.push({ ...entry, ts: new Date().toISOString() });
  saveWo(wo);
  return wo;
}

export function updateWoStep(id: string, stepId: string, status: ExecutionStep['status'], result?: string): WorkOrder | null {
  const wo = loadWo(id);
  if (!wo) return null;
  const step = wo.execution_plan.find(s => s.step_id === stepId);
  if (step) {
    step.status = status;
    if (result) step.result = result;
    if (status === 'running') step.started_at = new Date().toISOString();
    if (status === 'done' || status === 'failed') step.completed_at = new Date().toISOString();
  }
  saveWo(wo);
  return wo;
}

export function updateQaCheck(id: string, checkId: string, status: QaCheck['status'], evidence?: string): WorkOrder | null {
  const wo = loadWo(id);
  if (!wo) return null;
  const check = wo.qa_plan.find(c => c.check_id === checkId);
  if (check) { check.status = status; if (evidence) check.evidence = evidence; }
  saveWo(wo);
  return wo;
}

export function deliverWorkOrder(id: string, result: WorkOrderResult): WorkOrder | null {
  const wo = loadWo(id);
  if (!wo) return null;
  wo.result = result;
  wo.status = result.verdict === 'APPROVAL_REQUIRED' ? 'approval_pending' : 'delivered';
  wo.execution_log.push({
    ts: new Date().toISOString(), level: 'info', role: 'system',
    message: `Work order ${wo.status}`,
    detail: result.summary,
  });
  saveWo(wo);
  return wo;
}

export function getWorkOrder(id: string): WorkOrder | null {
  return loadWo(id);
}

export function listWorkOrders(limit = 20): WorkOrder[] {
  return listWos().slice(0, limit);
}

export function getActiveWorkOrders(): WorkOrder[] {
  return listWos().filter(w => !['delivered', 'rejected', 'cancelled'].includes(w.status));
}
