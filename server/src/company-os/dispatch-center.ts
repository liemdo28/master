/**
 * Mi Company OS — Dispatch Center
 * Single entry point for ALL CEO commands.
 * Routes through 12-step pipeline. No bypass allowed.
 */

import { DEPARTMENTS, findDeptForIntent, getDept, type Department } from './departments';
import { createPipelineRun, updatePipelineRun, recordStep, completeStep } from './evidence-store';

export interface DispatchContext {
  sender: string;
  raw_command: string;
  normalized?: string;
  session_id?: string;
  channel?: 'whatsapp' | 'api' | 'dashboard';
}

export interface DispatchResult {
  pipeline_id: string;
  intent: string;
  assigned_dept: Department;
  sub_tasks: SubTask[];
  requires_approval: boolean;
  blocked: boolean;
  blocked_reason?: string;
  context: DispatchContext;
}

export interface SubTask {
  id: string;
  dept_id: string;
  description: string;
  priority: 'high' | 'normal' | 'low';
  depends_on?: string[];
}

// Intent classification patterns (mirrors intent-router.ts patterns)
const INTENT_PATTERNS: Array<{ pattern: RegExp; intent: string }> = [
  { pattern: /query_personal_tasks|task|việc|viec|todo|remind/i, intent: 'query_personal_tasks' },
  { pattern: /check_status|pm2|status|dashboard|health/i, intent: 'check_status' },
  { pattern: /check_sales|sales|doanh thu|revenue|toast|doordash/i, intent: 'check_sales' },
  { pattern: /finance|p.?l|cash|expense|accounting|quickbooks/i, intent: 'check_finances' },
  { pattern: /create_creative|flyer|design|creative|poster|banner/i, intent: 'create_creative' },
  { pattern: /marketing|campaign|ad|quảng cáo|promo/i, intent: 'marketing_plan' },
  { pattern: /build_feature|build|tạo|create|code|develop/i, intent: 'build_feature' },
  { pattern: /fix|bug|error|lỗi/i, intent: 'fix_bug' },
  { pattern: /search_knowledge|tìm|find|search|doc|policy|sop/i, intent: 'search_knowledge' },
  { pattern: /send_message|nhắn|send|email|message/i, intent: 'send_message' },
  { pattern: /report|briefing|summary|báo cáo|kpi/i, intent: 'generate_report' },
  { pattern: /website|page|seo|blog|publish/i, intent: 'update_website' },
  { pattern: /video|promo video|walkthrough/i, intent: 'make_video' },
  { pattern: /competitor|market|pricing|thị trường/i, intent: 'competitor_check' },
  { pattern: /hr|employee|onboard|recruit|training/i, intent: 'hr_check' },
  // Infrastructure — "Mi ơi sao X chết/down/không trả lời"
  { pattern: /sao.*ch[eế]t|sao.*down|sao.*kh[oô]ng.*tr[aả].*l[oờ]i|ch[eế]t.*r[oồ]i|d[oị]ch.*v[uụ].*l[oỗ]i|pm2|docker|port.*check|service.*down|service.*health|log.*check|backup|tailscale/i, intent: 'service_down' },
];

// Commands that are ALWAYS blocked (BLOCKED autonomy policy)
const BLOCKED_COMMANDS = [
  /delete.*(data|database|record|file)/i,
  /drop.*(table|database)/i,
  /rm -rf/i,
  /payment|transfer.*money|wire.*transfer/i,
  /production.*deploy(?!.*approval)/i,
];

/**
 * Step 1-4 of the 12-step pipeline: command intake, context resolution,
 * intent classification, and department assignment.
 */
export function dispatch(ctx: DispatchContext): DispatchResult {
  const run = createPipelineRun(ctx.raw_command);

  // Step 1: Context Resolution
  const ctxStep = recordStep(run.id, 'dispatch', 'context_resolution', ctx);
  const normalized = normalizeCommand(ctx.raw_command);
  completeStep(ctxStep.id, { normalized, sender: ctx.sender }, 0.95);

  // Step 2: Intent Classification
  const intentStep = recordStep(run.id, 'dispatch', 'intent_classification', { normalized });
  const intent = classifyIntent(normalized);
  completeStep(intentStep.id, { intent }, 0.90);

  // Step 3: Check BLOCKED patterns
  const blocked = BLOCKED_COMMANDS.some(p => p.test(normalized));
  if (blocked) {
    const reason = 'Command matches BLOCKED policy. CEO manual action required.';
    updatePipelineRun(run.id, { status: 'failed', intent, ceo_response: reason });
    return {
      pipeline_id: run.id,
      intent,
      assigned_dept: getDept('dispatch')!,
      sub_tasks: [],
      requires_approval: false,
      blocked: true,
      blocked_reason: reason,
      context: ctx,
    };
  }

  // Step 4: Department Assignment
  const assignStep = recordStep(run.id, 'dispatch', 'dept_assignment', { intent });
  const dept = findDeptForIntent(intent) || getDept('dispatch')!;
  completeStep(assignStep.id, { dept_id: dept.id, dept_name: dept.name }, 0.92);

  // Step 5: Task Decomposition
  const decompStep = recordStep(run.id, 'dispatch', 'task_decomposition', { intent, dept: dept.id });
  const sub_tasks = decomposeToSubTasks(run.id, intent, dept, normalized);
  completeStep(decompStep.id, { sub_tasks }, 0.88);

  const requires_approval = dept.approval_required || dept.autonomy === 'REQUIRES_APPROVAL';

  updatePipelineRun(run.id, {
    intent,
    depts: dept.id,
    status: requires_approval ? 'pending_approval' : 'running',
    confidence: 0.90,
  });

  return {
    pipeline_id: run.id,
    intent,
    assigned_dept: dept,
    sub_tasks,
    requires_approval,
    blocked: false,
    context: ctx,
  };
}

function normalizeCommand(raw: string): string {
  // Normalize Vietnamese diacritics + lowercase
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function classifyIntent(normalized: string): string {
  for (const { pattern, intent } of INTENT_PATTERNS) {
    if (pattern.test(normalized)) return intent;
  }
  return 'general';
}

function decomposeToSubTasks(
  pipelineId: string,
  intent: string,
  dept: Department,
  command: string
): SubTask[] {
  const tasks: SubTask[] = [];

  // Every pipeline gets a source_truth_check
  tasks.push({
    id: `${pipelineId}_src`,
    dept_id: 'library',
    description: 'Source truth check — verify we have correct baseline data',
    priority: 'high',
  });

  // Main execution task
  tasks.push({
    id: `${pipelineId}_exec`,
    dept_id: dept.id,
    description: `Execute: ${intent} — "${command.substring(0, 80)}"`,
    priority: 'high',
    depends_on: [`${pipelineId}_src`],
  });

  // Evidence collection
  tasks.push({
    id: `${pipelineId}_ev`,
    dept_id: dept.id,
    description: 'Collect and store execution evidence',
    priority: 'normal',
    depends_on: [`${pipelineId}_exec`],
  });

  // QA verification (independent)
  tasks.push({
    id: `${pipelineId}_qa`,
    dept_id: 'qa',
    description: `Independent QA verification of ${dept.name} output`,
    priority: 'high',
    depends_on: [`${pipelineId}_ev`],
  });

  // Report center summary
  tasks.push({
    id: `${pipelineId}_rpt`,
    dept_id: 'report-center',
    description: 'Aggregate results into CEO-level summary',
    priority: 'normal',
    depends_on: [`${pipelineId}_qa`],
  });

  return tasks;
}
