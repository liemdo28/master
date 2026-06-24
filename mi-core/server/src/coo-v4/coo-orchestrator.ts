/**
 * COO V4 — Master Orchestrator
 * CEO says ONE thing. Mi understands, plans, executes, validates, reports.
 *
 * Flow:
 *   CEO input → NLP → Intent Engine → Plan → Governor → Council
 *   → Durable Workflow → Agent Execution → QA → CEO Report
 */

import type { WorkflowState, ExecutiveReport, AgentDomain } from './types';
import { parseIntent, humanize } from './nlp-engine';
import { decomposePlan, formatPlan, buildExecutionGraph, runGraph } from './intent-engine';
import { classify, requiresApproval, isBlocked } from './production-governor';
import { runCouncilV4 } from './agent-council-v4';
import {
  createWorkflow, updateWorkflowState, setWorkflowStatus,
  checkpointStep, startStep, sendSignal, waitForSignal,
  getWorkflowSummary, listWorkflows,
} from './durable-workflow';
import { flowOptimizer } from './flow-optimizer';
import { recordExecution, findSkills } from './skill-marketplace';
import type { PlanStep } from './types';

// ── Agent dispatch — routes step to the right agent ───────────────────────

async function dispatchStep(step: PlanStep, context: Record<string, unknown>): Promise<unknown> {
  const agents: Record<AgentDomain, () => Promise<unknown>> = {
    ai_developer: async () => {
      const { readSource } = require('./agents/ai-developer-agent');
      return readSource(String(context.file || 'server/src'), step.input.pattern as string);
    },
    swe_agent: async () => {
      const { diagnoseBug } = require('./agents/ai-developer-agent');
      return diagnoseBug(String(context.error || ''), String(step.description));
    },
    code_reviewer: async () => {
      const { reviewCode } = require('./agents/ai-developer-agent');
      return reviewCode(String(context.file || 'server/src'));
    },
    code_gate: async () => {
      const { productionGate } = require('./agents/ai-developer-agent');
      return productionGate(String(context.code || '// no code provided'));
    },
    browser: async () => {
      const { navigate } = require('./agents/browser-operator');
      return navigate(String(context.url || 'http://dashboard.bakudanramen.com'));
    },
    workspace: async () => {
      const { sheetsRead } = require('./agents/business-agents');
      return sheetsRead(String(context.sheet_id || ''), String(context.range || 'A1:Z100'));
    },
    bookkeeper: async () => {
      const { categorizeTransaction } = require('./agents/business-agents');
      return categorizeTransaction(Number(context.amount || 0), String(context.description || ''), new Date().toISOString().slice(0, 10));
    },
    accountant: async () => {
      const { generatePL } = require('./agents/business-agents');
      return generatePL(String(context.period || 'current month'));
    },
    cfo: async () => {
      const { storeAnalysis } = require('./agents/business-agents');
      return storeAnalysis(String(context.store || 'Stone Oak'), String(context.period || 'current month'));
    },
    tax: async () => {
      const { prepareTaxPackage } = require('./agents/business-agents');
      return prepareTaxPackage(String(context.year || new Date().getFullYear()), String(context.tax_type || 'federal'));
    },
    marketing: async () => {
      // Route to Restaurant Creative Engine V2 for image creatives
      const request = String(step.input.request || 'general');
      const brand = /bakudan|ramen/i.test(request) ? 'bakudan' : 'raw_sushi';
      const creativeType = /instagram/i.test(request) ? 'instagram_post'
        : /facebook/i.test(request) ? 'facebook_post'
        : /doordash|ubereats/i.test(request) ? 'doordash_promo'
        : /hero|website/i.test(request) ? 'website_hero'
        : /blog/i.test(request) ? 'blog_feature'
        : /google/i.test(request) ? 'google_business'
        : /season|promo|event/i.test(request) ? 'seasonal_promo'
        : 'blog_feature';
      const storeMatch = /(rim|stone oak|bandera)/i.exec(request);
      const { generateCreativePackage } = require('./agents/restaurant-creative-engine');
      const pkg = await generateCreativePackage({
        type: creativeType, brand,
        store: storeMatch ? storeMatch[1] : undefined,
        campaign_text: request,
      });
      return { success: true, output: pkg, agent: 'marketing', duration_ms: 0, metadata: { brand, creative_type: creativeType } };
    },
    website: async () => {
      const { seoOptimize } = require('./agents/creative-agents');
      return seoOptimize(String(context.url || 'https://bakudanramen.com'), ['ramen', 'san antonio']);
    },
    social: async () => {
      const { schedulePosts } = require('./agents/creative-agents');
      return schedulePosts([{ platform: 'facebook', content: String(step.input.request || ''), scheduled_at: new Date(Date.now() + 3_600_000).toISOString() }]);
    },
    council: async () => {
      const risk = context.risk_level as 'low' | 'medium' | 'high' | 'critical' || 'low';
      return runCouncilV4(String(step.input.request || step.description), risk);
    },
    governor: async () => {
      return { class: 'REQUIRES_APPROVAL', waiting: true, message: 'Workflow paused — awaiting CEO approval' };
    },
    executive: async () => {
      // Report back to CEO via WhatsApp
      const msg = String(context.report || `Step completed: ${step.name}`);
      try { const { queueToCeo } = require('../services/whatsapp-sender'); queueToCeo(msg); } catch { /* ok */ }
      return { sent: true, message: msg };
    },
    // Pass-through domains (handled by gstack or existing engines)
    gstack:      async () => ({ delegated: true, step: step.name }),
    jarvis:      async () => ({ delegated: true, step: step.name }),
    intent:      async () => ({ noop: true }),
    nlp:         async () => ({ noop: true }),
    skill_store: async () => ({ noop: true }),
    flow:        async () => ({ noop: true }),
    self_improve:async () => ({ noop: true }),
    orchestrator:async () => ({ noop: true }),
    computer:    async () => ({ noop: true, note: 'Computer Use requires manual activation' }),
  };

  const fn = agents[step.agent] || agents.gstack;
  return fn();
}

// ── Main COO execute function ──────────────────────────────────────────────

export async function cooExecute(
  rawRequest: string,
  options: { auto_run?: boolean; ceo_chat_id?: string } = {},
): Promise<{ workflow_id: string; status: string; plan: string; reply: string }> {

  const parsed    = parseIntent(rawRequest);
  const humanized = humanize(parsed);
  const { goal, steps } = decomposePlan(rawRequest);

  // Governor pre-check
  const gov = classify(rawRequest, steps.map(s => s.agent));
  if (isBlocked(rawRequest)) {
    return {
      workflow_id: 'blocked',
      status: 'blocked',
      plan: '',
      reply: `⛔ *BLOCKED*\n\n"${rawRequest.slice(0, 80)}"\n\nReason: ${gov.reason}\n\nMi không thể thực hiện tác vụ này. Nếu anh chắc chắn muốn tiến hành, hãy liên hệ trực tiếp.`,
    };
  }

  // Run council for risk assessment
  const riskLevel = gov.class === 'SAFE' ? 'low' : gov.class === 'REQUIRES_APPROVAL' ? 'medium' : 'high';
  const council = runCouncilV4(rawRequest, riskLevel as any);

  if (council.outcome === 'BLOCK') {
    return {
      workflow_id: 'council_blocked',
      status: 'blocked',
      plan: '',
      reply: `🛑 *Council BLOCK*\n\n${council.votes.filter(v => v.stance === 'BLOCK').map(v => `${v.name_vi}: ${v.reasoning}`).join('\n')}\n\nLý do: ${council.summary_vi}`,
    };
  }

  // Create durable workflow
  const workflowId = createWorkflow(humanized, { intent: rawRequest, goal, parsed_intent: parsed }, steps);

  // Build plan summary for WhatsApp
  const planText = formatPlan(goal, steps);

  // If needs CEO approval (REQUIRES_APPROVAL or council says ESCALATE)
  if (requiresApproval(rawRequest) || council.outcome === 'ESCALATE_TO_CEO') {
    setWorkflowStatus(workflowId, 'waiting_approval');
    const approvalMsg = [
      `🟠 *Mi — Cần Duyệt*`,
      ``,
      `📋 "${humanized}"`,
      ``,
      planText,
      ``,
      `🏛 Council: ${council.summary_vi}`,
      ``,
      `Để chạy: reply *APPROVE ${workflowId}*`,
      `Để hủy: reply *CANCEL ${workflowId}*`,
    ].join('\n');
    try { const { queueToCeo } = require('../services/whatsapp-sender'); queueToCeo(approvalMsg); } catch { /* ok */ }
    return { workflow_id: workflowId, status: 'waiting_approval', plan: planText, reply: approvalMsg };
  }

  // SAFE — send plan + kick off async execution
  const safeReply = [
    `🟢 *Mi đang thực hiện:*`,
    ``,
    `📋 "${humanized}"`,
    ``,
    planText,
    ``,
    `Workflow ID: \`${workflowId}\``,
    `Em sẽ báo cáo khi hoàn tất.`,
  ].join('\n');

  // Async execution (don't await — return immediately to WhatsApp)
  setImmediate(() => runWorkflowAsync(workflowId, steps, { request: rawRequest, goal }).catch(console.error));

  return { workflow_id: workflowId, status: 'running', plan: planText, reply: safeReply };
}

// ── Async workflow runner ──────────────────────────────────────────────────

async function runWorkflowAsync(workflowId: string, steps: PlanStep[], context: Record<string, unknown>): Promise<void> {
  setWorkflowStatus(workflowId, 'running');
  const outputs: Record<string, unknown> = {};

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Check if deps are satisfied
    if (step.depends_on.length > 0) {
      const depStates = step.depends_on.map(dep => steps.find(s => s.id === dep)?.status);
      if (depStates.some(s => s === 'failed')) {
        step.status = 'skipped';
        checkpointStep(workflowId, i, 'skipped', null, 'Dependency failed');
        continue;
      }
    }

    // Check if this step requires approval wait
    if (step.governor === 'REQUIRES_APPROVAL' || step.agent === 'governor') {
      setWorkflowStatus(workflowId, 'waiting_approval');
      // Wait for signal (poll every 5s, max 24h)
      const maxWait = 24 * 60 * 60 * 1000;
      const start   = Date.now();
      let approved  = false;
      while (Date.now() - start < maxWait) {
        await new Promise(r => setTimeout(r, 5000));
        const sig = waitForSignal(workflowId, 'approval');
        if (sig) { approved = true; break; }
        const cancel = waitForSignal(workflowId, 'cancel');
        if (cancel) {
          setWorkflowStatus(workflowId, 'failed');
          try { const { queueToCeo } = require('../services/whatsapp-sender'); queueToCeo(`❌ Workflow \`${workflowId}\` đã bị hủy.`); } catch { /* ok */ }
          return;
        }
      }
      if (!approved) {
        setWorkflowStatus(workflowId, 'failed');
        return;
      }
      setWorkflowStatus(workflowId, 'running');
    }

    startStep(workflowId, i);
    step.status = 'running';
    const t0 = Date.now();

    try {
      const output = await dispatchStep(step, { ...context, ...outputs });
      step.status = 'completed';
      step.output = output;
      outputs[step.id] = output;
      checkpointStep(workflowId, i, 'completed', output);
      recordExecution({ skill_id: step.agent, input: step.input as any, output, success: true, duration_ms: Date.now() - t0, timestamp: new Date().toISOString() });
    } catch (e: any) {
      step.status = 'failed';
      step.error  = e.message;
      checkpointStep(workflowId, i, 'failed', null, e.message);
      recordExecution({ skill_id: step.agent, input: step.input as any, success: false, error: e.message, duration_ms: Date.now() - t0, timestamp: new Date().toISOString() });
    }
  }

  // Final status
  const failed = steps.filter(s => s.status === 'failed').length;
  const done   = steps.filter(s => s.status === 'completed').length;
  setWorkflowStatus(workflowId, failed === 0 ? 'completed' : 'failed');

  // CEO report
  const summary = getWorkflowSummary(workflowId);
  const report = generateReport(workflowId, context.goal as string || 'Task', steps, done, failed);
  try { const { queueToCeo } = require('../services/whatsapp-sender'); queueToCeo(report.report_text); } catch { /* ok */ }
}

// ── Report generator ───────────────────────────────────────────────────────

export function generateReport(workflowId: string, title: string, steps: PlanStep[], done: number, failed: number): ExecutiveReport {
  const total    = steps.length;
  const outcome  = failed === 0 ? 'SUCCESS' : done === 0 ? 'FAILED' : 'PARTIAL';
  const icons    = { SUCCESS: '✅', PARTIAL: '🟡', FAILED: '❌', BLOCKED: '⛔' };

  const stepLines = steps.map(s => {
    const icon = s.status === 'completed' ? '✅' : s.status === 'failed' ? '❌' : s.status === 'skipped' ? '⏭' : '⏳';
    return `${icon} ${s.name.replace(/_/g, ' ')}${s.error ? ` — ${s.error.slice(0, 60)}` : ''}`;
  }).join('\n');

  const report_text = [
    `${icons[outcome]} *Mi COO Report*`,
    ``,
    `📋 *${title.slice(0, 80)}*`,
    ``,
    `${stepLines}`,
    ``,
    `📊 Kết quả: ${done}/${total} hoàn thành${failed > 0 ? ` (${failed} lỗi)` : ''}`,
    `🆔 Workflow: \`${workflowId}\``,
    ``,
    outcome === 'SUCCESS' ? '✅ Hoàn tất thành công.' : outcome === 'PARTIAL' ? '🟡 Hoàn tất một phần — một số bước cần xem lại.' : '❌ Thất bại — kiểm tra lại workflow.',
  ].join('\n');

  return {
    workflow_id: workflowId, title, summary_vi: report_text,
    steps_total: total, steps_done: done, steps_failed: failed,
    outcome, duration_ms: 0, report_text,
    artifacts: [], generated_at: new Date().toISOString(),
  };
}

// ── Workflow signal handling (CEO approval via WhatsApp) ───────────────────

export function handleCeoSignal(message: string): { handled: boolean; reply: string } {
  const approveMatch = message.match(/^APPROVE\s+(wf_\S+)/i);
  const cancelMatch  = message.match(/^CANCEL\s+(wf_\S+)/i);

  if (approveMatch) {
    const wfId = approveMatch[1];
    sendSignal(wfId, 'approval', { approved_by: 'CEO', at: new Date().toISOString() });
    setWorkflowStatus(wfId, 'running');
    return { handled: true, reply: `✅ Workflow \`${wfId}\` đã được duyệt. Mi tiếp tục thực hiện...` };
  }
  if (cancelMatch) {
    const wfId = cancelMatch[1];
    sendSignal(wfId, 'cancel', { cancelled_by: 'CEO', at: new Date().toISOString() });
    setWorkflowStatus(wfId, 'failed');
    return { handled: true, reply: `❌ Workflow \`${wfId}\` đã bị hủy.` };
  }
  return { handled: false, reply: '' };
}

// ── Status queries ─────────────────────────────────────────────────────────

export function getRunningWorkflows(): string {
  const workflows = listWorkflows(undefined, 10);
  if (workflows.length === 0) return '📋 Không có workflow nào đang chạy.';
  const lines = workflows.map(wf => {
    const icon = wf.status === 'completed' ? '✅' : wf.status === 'running' ? '⚙️' : wf.status === 'waiting_approval' ? '⏳' : wf.status === 'failed' ? '❌' : '🔘';
    const age = Math.round((Date.now() - new Date(wf.created_at).getTime()) / 60_000);
    return `${icon} \`${wf.id.slice(0, 20)}\` [${wf.status}] ${age}m ago — step ${wf.checkpoint + 1}`;
  });
  return `⚙️ *COO Workflows*\n\n${lines.join('\n')}`;
}
