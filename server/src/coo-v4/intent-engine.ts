/**
 * Domain A — Intent Engine (LangGraph-style)
 * Intent → Goal → Plan → Execute → Validate → Report
 *
 * Directed execution graph: nodes transform WorkflowState.
 * Conditional edges route based on state values.
 */

import type { WorkflowState, PlanStep, AgentDomain, GovernorClass } from './types';
import { parseIntent } from './nlp-engine';
import { classify } from './production-governor';

// ── Execution Graph Node ───────────────────────────────────────────────────

export type NodeFn = (state: WorkflowState) => Promise<WorkflowState>;
export type EdgeFn = (state: WorkflowState) => string;  // returns next node name

export interface ExecutionGraph {
  nodes:  Map<string, NodeFn>;
  edges:  Map<string, EdgeFn>;
  entry:  string;
  exits:  Set<string>;
}

// ── Goal decomposition ─────────────────────────────────────────────────────

interface GoalTemplate {
  action:   string;
  target:   string;
  goal:     string;
  steps:    Array<{
    name:     string;
    desc:     string;
    agent:    AgentDomain;
    parallel: boolean;
    deps:     string[];
  }>;
}

const GOAL_TEMPLATES: GoalTemplate[] = [
  // Audit → Fix → Test → QA → Certify → Report (Domain T pattern)
  {
    action: 'audit', target: 'dashboard',
    goal: 'Audit dashboard.bakudanramen.com, fix safe issues, run tests, QA, certify, report to CEO',
    steps: [
      { name: 'audit_source',   desc: 'Read dashboard source code and scan for issues',        agent: 'ai_developer', parallel: false, deps: [] },
      { name: 'code_review',    desc: 'Run Aider-style code review for quality issues',         agent: 'code_reviewer', parallel: false, deps: ['audit_source'] },
      { name: 'security_gate',  desc: 'Run production gate security check',                    agent: 'code_gate', parallel: true, deps: ['audit_source'] },
      { name: 'fix_issues',     desc: 'Apply safe fixes from review findings',                  agent: 'ai_developer', parallel: false, deps: ['code_review', 'security_gate'] },
      { name: 'run_tests',      desc: 'Execute test suite to verify fixes',                    agent: 'ai_developer', parallel: false, deps: ['fix_issues'] },
      { name: 'qa_certification','desc': 'Run QA regression and certification',                 agent: 'council', parallel: false, deps: ['run_tests'] },
      { name: 'ceo_report',     desc: 'Generate and send CEO audit report via WhatsApp',       agent: 'executive', parallel: false, deps: ['qa_certification'] },
    ],
  },
  {
    action: 'create', target: 'seo',
    goal: 'Write SEO article, optimize, publish to WordPress, report to CEO',
    steps: [
      { name: 'write_article',  desc: 'Write SEO-optimized article with keywords',             agent: 'marketing', parallel: false, deps: [] },
      { name: 'seo_optimize',   desc: 'Optimize article for search engines',                   agent: 'website', parallel: false, deps: ['write_article'] },
      { name: 'council_review', desc: 'Marketing agent reviews content and brand fit',         agent: 'council', parallel: false, deps: ['write_article'] },
      { name: 'publish_wait',   desc: 'Wait for CEO approval before publishing',               agent: 'governor', parallel: false, deps: ['council_review'] },
      { name: 'publish_post',   desc: 'Publish approved article to WordPress',                 agent: 'website', parallel: false, deps: ['publish_wait'] },
      { name: 'ceo_report',     desc: 'Send published article URL to CEO via WhatsApp',        agent: 'executive', parallel: false, deps: ['publish_post'] },
    ],
  },
  {
    action: 'create', target: 'video',
    goal: 'Generate marketing video/reel, add voiceover, schedule for social media',
    steps: [
      { name: 'write_script',   desc: 'Write video script in Vietnamese',                      agent: 'marketing', parallel: false, deps: [] },
      { name: 'create_video',   desc: 'Generate video with AI (Wan/Hunyuan)',                  agent: 'marketing', parallel: false, deps: ['write_script'] },
      { name: 'add_voiceover',  desc: 'Add Vietnamese voiceover (OpenVoice)',                  agent: 'marketing', parallel: true,  deps: ['write_script'] },
      { name: 'council_review', desc: 'Marketing agent reviews video and brand fit',           agent: 'council', parallel: false, deps: ['create_video', 'add_voiceover'] },
      { name: 'schedule_posts', desc: 'Schedule video to FB, IG, TikTok, YouTube',             agent: 'social', parallel: false, deps: ['council_review'] },
      { name: 'ceo_report',     desc: 'Send video preview URL and schedule to CEO',            agent: 'executive', parallel: false, deps: ['schedule_posts'] },
    ],
  },
  {
    action: 'analyze', target: 'doordash',
    goal: 'Analyze DoorDash campaign performance, generate report, send to CEO',
    steps: [
      { name: 'fetch_data',     desc: 'Fetch DoorDash campaign metrics via browser/API',       agent: 'browser', parallel: false, deps: [] },
      { name: 'store_analysis', desc: 'CFO agent analyzes store performance',                  agent: 'cfo', parallel: false, deps: ['fetch_data'] },
      { name: 'generate_report','desc': 'Generate formatted performance report',               agent: 'accountant', parallel: false, deps: ['store_analysis'] },
      { name: 'ceo_report',     desc: 'Send DoorDash analysis to CEO via WhatsApp',            agent: 'executive', parallel: false, deps: ['generate_report'] },
    ],
  },
  {
    action: 'prepare', target: 'tax',
    goal: 'Compile tax package with all required documents, REQUIRES CEO APPROVAL before submission',
    steps: [
      { name: 'gather_docs',    desc: 'Gather P&L, balance sheet, payroll records',            agent: 'accountant', parallel: false, deps: [] },
      { name: 'prepare_package','desc': 'Compile tax package (1099s, W-2s, receipts)',         agent: 'tax', parallel: false, deps: ['gather_docs'] },
      { name: 'cfo_review',     desc: 'CFO agent reviews package completeness',                agent: 'cfo', parallel: false, deps: ['prepare_package'] },
      { name: 'ceo_approval',   desc: '⚠️ HALT — CEO must approve before any submission',      agent: 'governor', parallel: false, deps: ['cfo_review'] },
      { name: 'ceo_report',     desc: 'Send tax package summary to CEO for approval',          agent: 'executive', parallel: false, deps: ['ceo_approval'] },
    ],
  },
  {
    action: 'analyze', target: 'report',
    goal: 'Generate P&L report with analysis and CFO recommendations',
    steps: [
      { name: 'generate_pl',    desc: 'Generate P&L statement from QuickBooks',                agent: 'accountant', parallel: false, deps: [] },
      { name: 'balance_sheet',  desc: 'Pull balance sheet data',                               agent: 'accountant', parallel: true,  deps: [] },
      { name: 'cfo_analysis',   desc: 'CFO analysis: trends, recommendations, risks',          agent: 'cfo', parallel: false, deps: ['generate_pl', 'balance_sheet'] },
      { name: 'ceo_report',     desc: 'Send complete financial report to CEO',                 agent: 'executive', parallel: false, deps: ['cfo_analysis'] },
    ],
  },
  {
    action: 'create', target: 'campaign',
    goal: 'Create full DoorDash/social campaign: flyer, video, post, schedule',
    steps: [
      { name: 'create_flyer',   desc: 'Design marketing flyer (ComfyUI)',                      agent: 'marketing', parallel: false, deps: [] },
      { name: 'write_copy',     desc: 'Write campaign copy for each platform',                 agent: 'marketing', parallel: false, deps: [] },
      { name: 'council_review', desc: 'Marketing + CFO council reviews campaign',              agent: 'council', parallel: false, deps: ['create_flyer', 'write_copy'] },
      { name: 'ceo_approval',   desc: 'CEO approves campaign content before publishing',       agent: 'governor', parallel: false, deps: ['council_review'] },
      { name: 'post_social',    desc: 'Post to FB, IG, TikTok',                               agent: 'social', parallel: false, deps: ['ceo_approval'] },
      { name: 'update_dd',      desc: 'Update DoorDash campaign via browser automation',       agent: 'browser', parallel: true,  deps: ['ceo_approval'] },
      { name: 'ceo_report',     desc: 'Send campaign launch report to CEO',                   agent: 'executive', parallel: false, deps: ['post_social', 'update_dd'] },
    ],
  },
  {
    action: 'send', target: 'report',
    goal: 'Generate and send comprehensive business report to CEO',
    steps: [
      { name: 'collect_data',   desc: 'Collect metrics from all connected systems',            agent: 'executive', parallel: false, deps: [] },
      { name: 'format_report',  desc: 'Format report with insights and recommendations',       agent: 'cfo', parallel: false, deps: ['collect_data'] },
      { name: 'ceo_report',     desc: 'Send report via WhatsApp',                             agent: 'executive', parallel: false, deps: ['format_report'] },
    ],
  },
  // Generic fallback
  {
    action: 'execute', target: 'system',
    goal: 'Execute requested task with council review and CEO reporting',
    steps: [
      { name: 'council_review', desc: 'Council reviews the request and classifies risk',       agent: 'council', parallel: false, deps: [] },
      { name: 'execute_task',   desc: 'Execute the task using appropriate agent',              agent: 'gstack', parallel: false, deps: ['council_review'] },
      { name: 'ceo_report',     desc: 'Report outcome to CEO via WhatsApp',                   agent: 'executive', parallel: false, deps: ['execute_task'] },
    ],
  },
];

// ── Intent → Goal decomposition ────────────────────────────────────────────

export function decomposePlan(rawRequest: string): { goal: string; steps: PlanStep[] } {
  const parsed = parseIntent(rawRequest);
  const template = GOAL_TEMPLATES.find(t => t.action === parsed.action && t.target === parsed.target)
    || GOAL_TEMPLATES.find(t => t.action === parsed.action)
    || GOAL_TEMPLATES[GOAL_TEMPLATES.length - 1]; // generic fallback

  const steps: PlanStep[] = template.steps.map((s, i) => {
    const desc = `${s.desc} [${rawRequest.slice(0, 50)}]`;
    const gov = classify(desc, [s.agent]);
    return {
      id:          s.name,
      name:        s.name.replace(/_/g, ' '),
      description: desc,
      agent:       s.agent,
      input:       { request: rawRequest, step_index: i },
      depends_on:  s.deps,
      parallel:    s.parallel,
      status:      'pending' as const,
      governor:    gov.class,
    };
  });

  return {
    goal: template.goal.replace('{request}', rawRequest),
    steps,
  };
}

// ── Build LangGraph-style execution graph ──────────────────────────────────

export function buildExecutionGraph(): ExecutionGraph {
  const nodes = new Map<string, NodeFn>();
  const edges = new Map<string, EdgeFn>();

  // Node: parse_intent
  nodes.set('parse_intent', async (state) => {
    const parsed = parseIntent(state.intent);
    return { ...state, status: 'planning', context: { ...state.context, parsed_intent: parsed } };
  });

  // Node: decompose_goal
  nodes.set('decompose_goal', async (state) => {
    const { goal, steps } = decomposePlan(state.intent);
    return { ...state, goal, plan: steps, status: 'planning' };
  });

  // Node: governor_check
  nodes.set('governor_check', async (state) => {
    const blockedSteps = state.plan.filter(s => s.governor === 'BLOCKED');
    if (blockedSteps.length > 0) {
      return { ...state, status: 'blocked', errors: [...state.errors, `BLOCKED steps: ${blockedSteps.map(s => s.name).join(', ')}`] };
    }
    const needsApproval = state.plan.some(s => s.governor === 'REQUIRES_APPROVAL' || s.governor === 'DANGEROUS');
    if (needsApproval) {
      return { ...state, status: 'waiting_approval', context: { ...state.context, approval_needed: true } };
    }
    return { ...state, status: 'running' };
  });

  // Node: execute
  nodes.set('execute', async (state) => {
    return { ...state, status: 'running', current_step: 0 };
  });

  // Node: validate
  nodes.set('validate', async (state) => {
    const failedSteps = state.plan.filter(s => s.status === 'failed');
    if (failedSteps.length === 0) return { ...state, status: 'completed' };
    if (failedSteps.length === state.plan.length) return { ...state, status: 'failed' };
    return { ...state, status: 'completed' }; // partial success
  });

  // Node: report
  nodes.set('report', async (state) => {
    return { ...state, status: 'completed', updated_at: new Date().toISOString() };
  });

  // Edges (conditional routing)
  edges.set('parse_intent', () => 'decompose_goal');
  edges.set('decompose_goal', () => 'governor_check');
  edges.set('governor_check', (state) => {
    if (state.status === 'blocked') return 'END';
    if (state.status === 'waiting_approval') return 'WAIT_APPROVAL';
    return 'execute';
  });
  edges.set('execute', () => 'validate');
  edges.set('validate', () => 'report');
  edges.set('report', () => 'END');

  return {
    nodes, edges,
    entry: 'parse_intent',
    exits: new Set(['END', 'WAIT_APPROVAL']),
  };
}

// ── Graph runner ───────────────────────────────────────────────────────────

export async function runGraph(graph: ExecutionGraph, initialState: WorkflowState): Promise<WorkflowState> {
  let state = { ...initialState };
  let current = graph.entry;
  const visited = new Set<string>();

  while (!graph.exits.has(current) && !visited.has(current)) {
    visited.add(current);
    const node = graph.nodes.get(current);
    if (!node) { console.error(`[IntentEngine] Node not found: ${current}`); break; }

    state = await node(state);
    state.updated_at = new Date().toISOString();

    const edgeFn = graph.edges.get(current);
    if (!edgeFn) break;
    current = edgeFn(state);
  }

  return state;
}

// ── Quick plan builder (for Jarvis WhatsApp integration) ──────────────────

export function quickPlan(request: string): { goal: string; steps: PlanStep[]; risk: GovernorClass } {
  const { goal, steps } = decomposePlan(request);
  const hasBlocked   = steps.some(s => s.governor === 'BLOCKED');
  const hasApproval  = steps.some(s => s.governor === 'REQUIRES_APPROVAL');
  const risk: GovernorClass = hasBlocked ? 'BLOCKED' : hasApproval ? 'REQUIRES_APPROVAL' : 'SAFE';
  return { goal, steps, risk };
}

export function formatPlan(goal: string, steps: PlanStep[]): string {
  const icons: Record<string, string> = { SAFE: '🟢', REQUIRES_APPROVAL: '🟠', DANGEROUS: '🔴', BLOCKED: '⛔' };
  return [
    `🎯 *Goal:* ${goal.slice(0, 120)}`,
    ``,
    `📋 *Execution Plan (${steps.length} steps):*`,
    ...steps.map((s, i) =>
      `${i + 1}. ${icons[s.governor] || '⚪'} *${s.name.replace(/_/g, ' ')}*\n   └ ${s.description.slice(0, 80)}`
    ),
  ].join('\n');
}
