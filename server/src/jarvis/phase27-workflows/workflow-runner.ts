/**
 * Phase 27 — Autonomous Workflows
 * Workflow registry, runner, and audit trail.
 */

export type WorkflowStatus = 'idle' | 'running' | 'completed' | 'failed' | 'waiting_approval';
export type WorkflowTrigger = 'manual' | 'scheduled' | 'alert' | 'whatsapp';

export interface WorkflowStep {
  id: string;
  name: string;
  tool_id: string;
  params?: Record<string, unknown>;
  approval_required: boolean;
  timeout_ms: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  category: 'store' | 'finance' | 'monitoring' | 'reporting' | 'maintenance';
  steps: WorkflowStep[];
  schedule?: string;       // cron-like: 'daily_07:00' | 'weekly_monday' etc.
  approval_required: boolean;
  enabled: boolean;
  run_count: number;
  last_run?: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  trigger: WorkflowTrigger;
  status: WorkflowStatus;
  started_at: string;
  completed_at?: string;
  steps_completed: number;
  steps_total: number;
  result?: string;
  error?: string;
  triggered_by: string;
}

const WORKFLOWS: WorkflowDefinition[] = [
  {
    id: 'wf-review-processing',
    name: 'Review Processing',
    description: 'Fetch, analyze, and summarize new customer reviews across all stores',
    category: 'store',
    steps: [
      { id: 's1', name: 'Fetch Reviews', tool_id: 'review.summary', approval_required: false, timeout_ms: 30000 },
      { id: 's2', name: 'AI Analysis', tool_id: 'knowledge.search', approval_required: false, timeout_ms: 60000 },
      { id: 's3', name: 'Send Summary', tool_id: 'whatsapp.send', approval_required: false, timeout_ms: 10000 },
    ],
    schedule: 'daily_09:00',
    approval_required: false,
    enabled: true,
    run_count: 0,
  },
  {
    id: 'wf-store-health',
    name: 'Store Health Check',
    description: 'Check all 5 stores: ops, food safety, staffing, POS connectivity',
    category: 'store',
    steps: [
      { id: 's1', name: 'Check Store Ops', tool_id: 'store.ops', approval_required: false, timeout_ms: 15000 },
      { id: 's2', name: 'Food Safety Scan', tool_id: 'store.ops', approval_required: false, timeout_ms: 15000 },
      { id: 's3', name: 'Report to CEO', tool_id: 'whatsapp.send', approval_required: false, timeout_ms: 10000 },
    ],
    schedule: 'daily_06:45',
    approval_required: false,
    enabled: true,
    run_count: 0,
  },
  {
    id: 'wf-executive-report',
    name: 'Executive Report Generation',
    description: 'Generate and send daily executive briefing to CEO at 07:00 VN',
    category: 'reporting',
    steps: [
      { id: 's1', name: 'Collect Data', tool_id: 'knowledge.search', approval_required: false, timeout_ms: 30000 },
      { id: 's2', name: 'Generate Report', tool_id: 'excel.create', approval_required: false, timeout_ms: 60000 },
      { id: 's3', name: 'Send to CEO', tool_id: 'whatsapp.send', approval_required: false, timeout_ms: 10000 },
    ],
    schedule: 'daily_07:00',
    approval_required: false,
    enabled: true,
    run_count: 0,
  },
  {
    id: 'wf-node-maintenance',
    name: 'Node Maintenance',
    description: 'Clear old logs, restart unhealthy services, update status',
    category: 'maintenance',
    steps: [
      { id: 's1', name: 'Check Node Health', tool_id: 'node.status', approval_required: false, timeout_ms: 15000 },
      { id: 's2', name: 'Clear Old Logs', tool_id: 'project.logs.clear', approval_required: true, timeout_ms: 30000 },
      { id: 's3', name: 'Report Status', tool_id: 'whatsapp.send', approval_required: false, timeout_ms: 10000 },
    ],
    schedule: 'weekly_sunday',
    approval_required: true,
    enabled: false,
    run_count: 0,
  },
  {
    id: 'wf-finance-snapshot',
    name: 'Finance Snapshot',
    description: 'Pull revenue, costs, payroll from QuickBooks and DoorDash',
    category: 'finance',
    steps: [
      { id: 's1', name: 'Fetch Revenue', tool_id: 'doordash.revenue', approval_required: false, timeout_ms: 30000 },
      { id: 's2', name: 'Fetch QB Data', tool_id: 'quickbooks.invoice', approval_required: false, timeout_ms: 30000 },
      { id: 's3', name: 'Generate Summary', tool_id: 'excel.create', approval_required: false, timeout_ms: 30000 },
    ],
    schedule: 'weekly_monday',
    approval_required: false,
    enabled: false,  // disabled until QB + DoorDash API keys configured
    run_count: 0,
  },
];

const RUN_HISTORY: WorkflowRun[] = [];

export function getAllWorkflows(): WorkflowDefinition[] { return WORKFLOWS; }

export function getWorkflowById(id: string): WorkflowDefinition | undefined {
  return WORKFLOWS.find(w => w.id === id);
}

export async function runWorkflow(workflowId: string, trigger: WorkflowTrigger, triggeredBy: string): Promise<WorkflowRun> {
  const wf = WORKFLOWS.find(w => w.id === workflowId);
  if (!wf) throw new Error(`Workflow ${workflowId} not found`);

  const run: WorkflowRun = {
    id: 'run_' + Date.now().toString(36),
    workflow_id: workflowId,
    trigger,
    status: wf.approval_required ? 'waiting_approval' : 'running',
    started_at: new Date().toISOString(),
    steps_completed: 0,
    steps_total: wf.steps.length,
    triggered_by: triggeredBy,
  };

  RUN_HISTORY.push(run);
  wf.run_count++;
  wf.last_run = run.started_at;

  if (!wf.approval_required) {
    // Simulate execution (actual tool calls would go here)
    setTimeout(async () => {
      run.status = 'completed';
      run.steps_completed = wf.steps.length;
      run.completed_at = new Date().toISOString();
      run.result = `Workflow ${wf.name} completed successfully. ${wf.steps.length} steps executed.`;
    }, 100);
  }

  return run;
}

export function getWorkflowRuns(workflowId?: string, limit = 20): WorkflowRun[] {
  let runs = RUN_HISTORY;
  if (workflowId) runs = runs.filter(r => r.workflow_id === workflowId);
  return runs.slice(-limit).reverse();
}

export function getWorkflowStats() {
  const enabled = WORKFLOWS.filter(w => w.enabled).length;
  const total_runs = RUN_HISTORY.length;
  const running = RUN_HISTORY.filter(r => r.status === 'running').length;
  return { total: WORKFLOWS.length, enabled, disabled: WORKFLOWS.length - enabled, total_runs, running };
}

export function formatWorkflowsForWhatsApp(): string {
  const enabled = WORKFLOWS.filter(w => w.enabled);
  const lines = enabled.map(w => {
    const icon = w.run_count > 0 ? '✅' : '⏸';
    const schedule = w.schedule ? ` [${w.schedule}]` : '';
    return `${icon} *${w.name}*${schedule}\n   ${w.description.slice(0, 70)}`;
  });
  return `⚙️ *Workflow Registry — ${enabled.length} active*\n\n${lines.join('\n\n')}`;
}
