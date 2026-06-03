// ============================================================
// Agent OS - Agent Commander
// Turns CEO chat into intent, plan, executor strategy, and QA policy.
// ============================================================

import { TaskPriority, TaskType } from '../types';
import { ParsedIntent } from './intentEngine';

export type CommanderIntent = 'build' | 'fix' | 'audit' | 'qa' | 'deploy' | 'research' | 'status' | 'unknown';
export type ExecutionStrategy = 'local_agent' | 'cline' | 'antigravity' | 'multi_agent' | 'qa_agent' | 'none';
export type TaskSize = 'small' | 'medium' | 'large';

export interface CommanderPlan {
  recognized: boolean;
  intent: CommanderIntent;
  project: string;
  projectLabel: string;
  taskSize: TaskSize;
  strategy: ExecutionStrategy;
  reason: string;
  taskType: TaskType | 'query' | 'plan_only';
  priority: TaskPriority;
  requiresApproval: boolean;
  riskLevel: 'safe' | 'elevated' | 'dangerous' | 'critical';
  plan: string[];
  qa: string[];
  handoffPrompt?: string;
  canExecuteNow: boolean;
  payload: Record<string, unknown>;
  nextActions: string[];
}

const PROJECT_ALIASES: Array<{ aliases: string[]; path: string; label: string }> = [
  {
    aliases: ['dashboard', 'dashboard.bakudanramen.com', 'bakudan dashboard'],
    path: 'Bakudan/dashboard.bakudanramen.com',
    label: 'dashboard.bakudanramen.com',
  },
  {
    aliases: ['bakudan website', 'bakudanramen.com', 'website'],
    path: 'Bakudan/bakudanramen.com-current',
    label: 'bakudanramen.com',
  },
  {
    aliases: ['packing', 'packing list', 'packing-list'],
    path: 'Bakudan/packing-list',
    label: 'packing-list',
  },
  {
    aliases: ['payroll'],
    path: 'apps/payroll',
    label: 'payroll',
  },
  {
    aliases: ['master', 'all'],
    path: 'E:\\Project\\Master',
    label: 'Master',
  },
  {
    aliases: ['agent os', 'agent-os'],
    path: 'agent-os',
    label: 'Agent OS',
  },
];

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

function classifyIntent(message: string): CommanderIntent {
  const lower = normalize(message);
  if (/^(audit|scan|review|kiểm tra|kiem tra)\b/.test(lower)) return 'audit';
  if (/^(build|create|implement|make|xây|lam|làm)\b/.test(lower)) return 'build';
  if (/^(fix|repair|debug|sửa|sua)\b/.test(lower)) return 'fix';
  if (/^(qa|test|run qa|kiểm thử|kiem thu)\b/.test(lower)) return 'qa';
  if (/^(deploy|release)\b/.test(lower)) return 'deploy';
  if (/^(research|find|look up|nghiên cứu|nghien cuu)\b/.test(lower)) return 'research';
  if (/^(git status|status|health|port scan|worker status)\b/.test(lower)) return 'status';
  return 'unknown';
}

function resolveProject(message: string, fallbackProject: string): { path: string; label: string } {
  const lower = normalize(message);
  const match = PROJECT_ALIASES.find(project => project.aliases.some(alias => lower.includes(alias)));
  if (match) return { path: match.path, label: match.label };
  return { path: fallbackProject, label: fallbackProject };
}

function inferTaskSize(intent: CommanderIntent, message: string): TaskSize {
  const lower = normalize(message);
  if (/(all|toàn bộ|whole|system|module|multi|nhiều file|large|payroll)/.test(lower)) return 'large';
  if (intent === 'audit' || intent === 'research' || intent === 'deploy') return 'large';
  if (intent === 'build' && /(module|app|feature|payroll|dashboard)/.test(lower)) return 'large';
  if (intent === 'fix' && /(one file|1 file|small|nhỏ|nho)/.test(lower)) return 'small';
  if (intent === 'status') return 'small';
  return 'medium';
}

function chooseStrategy(intent: CommanderIntent, size: TaskSize): { strategy: ExecutionStrategy; reason: string } {
  if (intent === 'status') {
    return { strategy: 'local_agent', reason: 'Read-only local system check.' };
  }
  if (intent === 'fix') {
    if (size === 'large') {
      return { strategy: 'antigravity', reason: 'Large fix needs broad multi-file IDE context.' };
    }
    return { strategy: 'cline', reason: 'Scoped code fix fits Cline extension handoff.' };
  }
  if (intent === 'qa') {
    return { strategy: 'qa_agent', reason: 'QA should run as a separate validation lane.' };
  }
  if (intent === 'audit' || (intent === 'build' && size === 'large')) {
    return { strategy: 'antigravity', reason: 'Large source audit/build needs broad multi-file context.' };
  }
  if (intent === 'research' || intent === 'deploy') {
    return { strategy: 'multi_agent', reason: 'Requires separate research/execution/approval lanes.' };
  }
  return { strategy: 'local_agent', reason: 'Task is safe to run on the local worker.' };
}

function planSteps(intent: CommanderIntent, projectLabel: string): string[] {
  switch (intent) {
    case 'audit':
      return [
        `Scan ${projectLabel} source tree`,
        'Scan routes/API surface',
        'Scan UI workflows',
        'Scan tests and QA gaps',
        'Return P0/P1/P2 report without modifying code',
      ];
    case 'build':
      return [
        `Clarify module boundaries for ${projectLabel}`,
        'Create implementation plan',
        'Execute through selected coding agent',
        'Run QA queue',
        'Return build report and approval gate',
      ];
    case 'fix':
      return [
        `Reproduce issue in ${projectLabel}`,
        'Patch smallest safe scope',
        'Run targeted tests',
        'Return diff and residual risk',
      ];
    case 'qa':
      return [
        `Run QA layers for ${projectLabel}`,
        'Collect artifacts',
        'Score P0/P1/P2',
        'Return pass/fail decision',
      ];
    case 'deploy':
      return [
        'Verify source and QA status',
        'Prepare deploy plan',
        'Wait for CEO approval',
        'Deploy only after approval',
      ];
    case 'research':
      return [
        `Research options for ${projectLabel}`,
        'Separate known facts from known unknowns',
        'Return recommendation and decision points',
      ];
    default:
      return ['No executable plan produced.'];
  }
}

function qaLayers(): string[] {
  return [
    'Layer 1: static scan',
    'Layer 2: unit tests',
    'Layer 3: integration tests',
    'Layer 4: Playwright UI workflow',
    'Layer 5: stress test',
    'Layer 6: security checks',
  ];
}

function buildHandoffPrompt(intent: CommanderIntent, projectLabel: string, projectPath: string): string | undefined {
  if (intent === 'audit') {
    return [
      `Audit ${projectLabel} at ${projectPath}.`,
      'Scan source, routes, UI, tests, and dependency risk.',
      'Return P0/P1/P2 findings.',
      'Do not modify code.',
    ].join('\n');
  }
  if (intent === 'build') {
    return [
      `Build requested module for ${projectLabel} at ${projectPath}.`,
      'Create implementation plan first.',
      'Execute only safe source changes.',
      'Return build summary and QA evidence.',
    ].join('\n');
  }
  if (intent === 'fix') {
    return [
      `Fix requested issue in ${projectLabel} at ${projectPath}.`,
      'Reproduce the issue from source evidence first.',
      'Patch the smallest safe scope.',
      'Run targeted validation and return residual risk.',
    ].join('\n');
  }
  if (intent === 'qa') {
    return [
      `Run QA for ${projectLabel} at ${projectPath}.`,
      'Execute static, unit, integration, UI, stress, and security checks where available.',
      'Return P0/P1/P2 report with evidence artifacts.',
    ].join('\n');
  }
  return undefined;
}

function taskTypeForPlan(intent: CommanderIntent, strategy: ExecutionStrategy): TaskType | 'query' | 'plan_only' {
  if (strategy === 'antigravity') return TaskType.LAUNCH;
  if (intent === 'audit') return TaskType.AUDIT;
  if (intent === 'build') return TaskType.BUILD;
  if (intent === 'fix') return TaskType.CLINE;
  if (intent === 'qa') return TaskType.QA;
  if (intent === 'deploy') return TaskType.DEPLOY;
  if (intent === 'status') return 'query';
  return 'plan_only';
}

export function createCommanderPlan(message: string, parsedIntent: ParsedIntent): CommanderPlan {
  const dynamicIntent = classifyIntent(message);
  const intent = parsedIntent.supported
    ? intentFromRegistry(parsedIntent.intent, parsedIntent.type)
    : dynamicIntent;

  if (intent === 'unknown') {
    return {
      recognized: false,
      intent,
      project: parsedIntent.project,
      projectLabel: parsedIntent.project,
      taskSize: 'small',
      strategy: 'none',
      reason: 'Message did not map to a known Agent Commander intent.',
      taskType: 'plan_only',
      priority: parsedIntent.priority,
      requiresApproval: false,
      riskLevel: 'safe',
      plan: [],
      qa: [],
      canExecuteNow: false,
      payload: {},
      nextActions: ['Try Audit Master', 'Git Status', 'Run QA', 'Open Antigravity', 'Start API Proxy'],
    };
  }

  const project = resolveProject(message, parsedIntent.project);
  const size = inferTaskSize(intent, message);
  const { strategy, reason } = chooseStrategy(intent, size);
  const taskType = parsedIntent.supported ? parsedIntent.type : taskTypeForPlan(intent, strategy);
  const approvalRequired = parsedIntent.requiresApproval || intent === 'deploy';
  const riskLevel = approvalRequired ? 'elevated' : parsedIntent.riskLevel;
  const handoffPrompt = buildHandoffPrompt(intent, project.label, project.path);

  return {
    recognized: true,
    intent,
    project: project.path,
    projectLabel: project.label,
    taskSize: size,
    strategy,
    reason,
    taskType,
    priority: parsedIntent.priority,
    requiresApproval: approvalRequired,
    riskLevel,
    plan: planSteps(intent, project.label),
    qa: qaLayers(),
    handoffPrompt,
    canExecuteNow: taskType !== 'plan_only' && taskType !== 'query',
    payload: {
      ...(strategy === 'antigravity' ? { registryIntent: 'open_antigravity', app: 'antigravity', action: 'open_app' } : {}),
      commanderIntent: intent,
      executionStrategy: strategy,
      taskSize: size,
      projectLabel: project.label,
      projectPath: project.path,
      adapter: strategy === 'antigravity' || strategy === 'cline' ? strategy : undefined,
      prompt: handoffPrompt,
      handoffPrompt,
      qaRequired: intent !== 'status',
    },
    nextActions: intent === 'deploy' ? ['Approve', 'Reject'] : ['Fix', 'Report', 'Ignore'],
  };
}

function intentFromRegistry(intent: string, type: TaskType | 'query'): CommanderIntent {
  if (intent.includes('audit')) return 'audit';
  if (intent.includes('build')) return 'build';
  if (intent.includes('qa')) return 'qa';
  if (intent.includes('deploy')) return 'deploy';
  if (type === TaskType.GIT_SYNC || type === 'query' || intent.includes('status')) return 'status';
  return 'status';
}

export function formatCommanderPlan(plan: CommanderPlan): string {
  if (!plan.recognized) {
    return [
      'I received your message, but Agent Commander does not know how to plan it yet.',
      '',
      'Try:',
      ...plan.nextActions.map(action => `- ${action}`),
    ].join('\n');
  }

  return [
    `Agent Commander`,
    '',
    `Intent: ${plan.intent}`,
    `Project: ${plan.projectLabel}`,
    `Task size: ${plan.taskSize}`,
    `Strategy: ${plan.strategy}`,
    `Reason: ${plan.reason}`,
    '',
    'Plan:',
    ...plan.plan.map(step => `- ${step}`),
    '',
    'QA policy:',
    ...plan.qa.map(layer => `- ${layer}`),
    '',
    `Next: ${plan.nextActions.join(' / ')}`,
  ].join('\n');
}
