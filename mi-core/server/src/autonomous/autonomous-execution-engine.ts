/**
 * Autonomous Execution Engine — Phase 20
 * Defines which tasks Mi can execute without any CEO prompt.
 * SAFE tasks run automatically. REQUIRES_APPROVAL tasks queue for CEO.
 *
 * SAFE (auto-execute): audit, qa, reporting, monitoring, log analysis, documentation, testing
 * BLOCKED (never auto): deploy, delete, payment, credential change, customer reply, DB mutation
 */

export type AutonomyLevel = 'FULL_AUTO' | 'NOTIFY_AFTER' | 'REQUIRES_APPROVAL' | 'BLOCKED';

export interface AutonomyDecision {
  level: AutonomyLevel;
  reason: string;
  category: string;
  can_run_now: boolean;
  notify_ceo: boolean;
  ceo_message_vi?: string;
}

export interface AutonomousTask {
  task_id: string;
  task_type: string;
  target: string;
  description: string;
  scheduled_at?: string;
  trigger: 'scheduled' | 'threshold' | 'ceo_request' | 'incident';
}

// ── Classification table ──────────────────────────────────────────────────────

const FULL_AUTO_PATTERNS: Array<{ category: string; matchers: RegExp[] }> = [
  { category: 'health_monitoring',   matchers: [/health.*check|pm2.*status|service.*monitor|uptime/] },
  { category: 'log_analysis',        matchers: [/log.*scan|error.*log|analyze.*log/] },
  { category: 'audit_read',          matchers: [/audit|scan.*source|read.*source|source.*scan/] },
  { category: 'qa_regression',       matchers: [/regression.*suite|qa.*sweep|run.*test|test.*suite/] },
  { category: 'documentation',       matchers: [/generate.*doc|create.*doc|update.*readme|write.*report/] },
  { category: 'reporting',           matchers: [/daily.*report|weekly.*report|briefing|summary.*report/] },
  { category: 'knowledge_search',    matchers: [/search.*knowledge|query.*knowledge|find.*doc/] },
  { category: 'memory_sync',         matchers: [/sync.*memory|sync.*ledger|update.*memory/] },
  { category: 'graph_refresh',       matchers: [/refresh.*graph|update.*graph|rebuild.*graph/] },
];

const NOTIFY_AFTER_PATTERNS: Array<{ category: string; matchers: RegExp[] }> = [
  { category: 'auto_fix_safe',  matchers: [/fix.*comment|fix.*typo|fix.*whitespace|update.*readme/] },
  { category: 'skill_execution', matchers: [/run.*skill|execute.*skill/] },
  { category: 'certification',  matchers: [/certify|promote.*skill|skill.*certification/] },
];

const BLOCKED_PATTERNS: Array<{ category: string; reason: string; matchers: RegExp[] }> = [
  { category: 'production_deploy', reason: 'Production deployment requires CEO approval',
    matchers: [/deploy.*prod|release.*prod|push.*prod|go.*live/] },
  { category: 'data_delete',      reason: 'Deletion is irreversible — CEO approval required',
    matchers: [/delete|drop.*table|truncate|rm -rf|remove.*all/] },
  { category: 'payment',          reason: 'Payment actions are never automated',
    matchers: [/payment|charge|invoice.*send|billing|stripe.*create/] },
  { category: 'credential_change', reason: 'Credential changes require CEO approval',
    matchers: [/change.*password|rotate.*key|update.*secret|reset.*credential/] },
  { category: 'customer_reply',   reason: 'External customer communications require CEO approval',
    matchers: [/reply.*customer|send.*customer|email.*customer|message.*customer/] },
  { category: 'db_mutation',      reason: 'Database mutations require CEO approval',
    matchers: [/insert.*prod|update.*prod.*table|alter.*table.*prod/] },
];

export function classifyAutonomy(task: Pick<AutonomousTask, 'task_type' | 'description'>): AutonomyDecision {
  const text = `${task.task_type} ${task.description}`.toLowerCase();

  // Check BLOCKED first — hard stop
  for (const rule of BLOCKED_PATTERNS) {
    if (rule.matchers.some(p => p.test(text))) {
      return {
        level: 'BLOCKED', reason: rule.reason, category: rule.category,
        can_run_now: false, notify_ceo: true,
        ceo_message_vi: `🚫 Em không thể tự thực hiện: ${rule.reason}\n→ Hành động: ${task.description.slice(0, 60)}`,
      };
    }
  }

  // Full auto
  for (const rule of FULL_AUTO_PATTERNS) {
    if (rule.matchers.some(p => p.test(text))) {
      return {
        level: 'FULL_AUTO', reason: `Category "${rule.category}" is pre-approved for autonomous execution`,
        category: rule.category, can_run_now: true, notify_ceo: false,
      };
    }
  }

  // Notify after
  for (const rule of NOTIFY_AFTER_PATTERNS) {
    if (rule.matchers.some(p => p.test(text))) {
      return {
        level: 'NOTIFY_AFTER', reason: `Safe action — will notify CEO after completion`,
        category: rule.category, can_run_now: true, notify_ceo: true,
        ceo_message_vi: `✅ Em đã tự xử lý: ${task.description.slice(0, 60)}`,
      };
    }
  }

  // Default: requires approval
  return {
    level: 'REQUIRES_APPROVAL', reason: 'Task not in pre-approved autonomous categories',
    category: 'unclassified', can_run_now: false, notify_ceo: true,
    ceo_message_vi: `⏳ Em cần anh duyệt trước khi thực hiện:\n→ ${task.description.slice(0, 60)}`,
  };
}

// ── Scheduled autonomous tasks ─────────────────────────────────────────────────

export const SCHEDULED_AUTONOMOUS_TASKS: AutonomousTask[] = [
  { task_id: 'auto-health-15m',   task_type: 'health_check',    target: 'all_services',
    description: 'Health check all PM2 processes', trigger: 'scheduled', scheduled_at: 'every 15m' },
  { task_id: 'auto-log-1h',       task_type: 'log_analysis',    target: 'mi-core',
    description: 'Scan error logs for anomalies', trigger: 'scheduled', scheduled_at: 'every 1h' },
  { task_id: 'auto-memory-sync',  task_type: 'memory_sync',     target: 'memory.db',
    description: 'Sync execution ledger to operational memory', trigger: 'scheduled', scheduled_at: 'every 6h' },
  { task_id: 'auto-graph-nightly',task_type: 'graph_refresh',   target: 'graph.db',
    description: 'Rebuild dependency graph from project state', trigger: 'scheduled', scheduled_at: 'daily 02:00 ICT' },
  { task_id: 'auto-briefing-7am', task_type: 'reporting',       target: 'ceo',
    description: 'Generate and send daily executive briefing', trigger: 'scheduled', scheduled_at: 'daily 07:00 ICT' },
  { task_id: 'auto-qa-incident',  task_type: 'qa_regression',   target: 'affected_project',
    description: 'Run QA suite when incident detected', trigger: 'incident' },
];

export function getAutonomousTaskList(): Array<AutonomousTask & { autonomy: AutonomyDecision }> {
  return SCHEDULED_AUTONOMOUS_TASKS.map(t => ({
    ...t,
    autonomy: classifyAutonomy(t),
  }));
}
