/**
 * COO V4 — Express Router
 *
 * POST /api/coo-v4/execute          — CEO issues one instruction; Mi plans + executes
 * POST /api/coo-v4/plan             — parse intent + decompose plan (dry run)
 * GET  /api/coo-v4/workflows        — list active/recent workflows
 * GET  /api/coo-v4/workflows/:id    — get workflow status + steps
 * POST /api/coo-v4/workflows/:id/signal — send signal (approval/cancel/resume)
 * GET  /api/coo-v4/skills           — skill marketplace listing
 * GET  /api/coo-v4/skills/stats     — skill reliability stats
 * POST /api/coo-v4/council          — run council vote on a request
 * GET  /api/coo-v4/nlp              — parse NLP intent (debug)
 * GET  /api/coo-v4/governor         — classify request risk
 * GET  /api/coo-v4/self-improve     — generate self-improvement report
 * GET  /api/coo-v4/status           — COO system status
 */

import { Router, Request, Response } from 'express';

export const cooV4Router = Router();

function ok(res: Response, data: unknown) {
  res.json({ success: true, data, timestamp: new Date().toISOString() });
}
function err(res: Response, message: string, status = 500) {
  res.status(status).json({ success: false, error: message });
}

// ── POST /execute ──────────────────────────────────────────────────────────

cooV4Router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { request, auto_run = true } = req.body;
    if (!request) return err(res, 'request is required', 400);
    const { cooExecute } = require('../coo-v4/coo-orchestrator');
    const result = await cooExecute(request, { auto_run });
    ok(res, result);
  } catch (e: any) { err(res, e.message); }
});

// ── POST /plan ─────────────────────────────────────────────────────────────

cooV4Router.post('/plan', (req: Request, res: Response) => {
  try {
    const { request } = req.body;
    if (!request) return err(res, 'request is required', 400);
    const { decomposePlan, formatPlan } = require('../coo-v4/intent-engine');
    const { classify } = require('../coo-v4/production-governor');
    const { runCouncilV4 } = require('../coo-v4/agent-council-v4');
    const { parseIntent } = require('../coo-v4/nlp-engine');

    const parsed   = parseIntent(request);
    const { goal, steps } = decomposePlan(request);
    const gov      = classify(request, steps.map((s: any) => s.agent));
    const council  = runCouncilV4(request, gov.class === 'SAFE' ? 'low' : 'medium');
    const planText = formatPlan(goal, steps);

    ok(res, { parsed, goal, steps, plan_text: planText, governor: gov, council_preview: council.outcome });
  } catch (e: any) { err(res, e.message); }
});

// ── GET /workflows ─────────────────────────────────────────────────────────

cooV4Router.get('/workflows', (req: Request, res: Response) => {
  try {
    const { listWorkflows } = require('../coo-v4/durable-workflow');
    const status = req.query.status as string | undefined;
    const limit  = parseInt(String(req.query.limit || '20'));
    ok(res, listWorkflows(status as any, limit));
  } catch (e: any) { err(res, e.message); }
});

// ── GET /workflows/:id ─────────────────────────────────────────────────────

cooV4Router.get('/workflows/:id', (req: Request, res: Response) => {
  try {
    const { getWorkflowSummary, getWorkflow, getWorkflowSteps } = require('../coo-v4/durable-workflow');
    const id = req.params.id;
    const summary = getWorkflowSummary(id);
    if (!summary) return err(res, `Workflow ${id} not found`, 404);
    const state = getWorkflow(id);
    const steps = getWorkflowSteps(id);
    ok(res, { ...summary, state, steps });
  } catch (e: any) { err(res, e.message); }
});

// ── POST /workflows/:id/signal ─────────────────────────────────────────────

cooV4Router.post('/workflows/:id/signal', (req: Request, res: Response) => {
  try {
    const { sendSignal, setWorkflowStatus } = require('../coo-v4/durable-workflow');
    const { id } = req.params;
    const { type, payload = {} } = req.body;
    if (!['approval', 'rejection', 'cancel', 'resume', 'input'].includes(type)) {
      return err(res, 'type must be: approval | rejection | cancel | resume | input', 400);
    }
    sendSignal(id, type, payload);
    if (type === 'approval') setWorkflowStatus(id, 'running');
    if (type === 'cancel')   setWorkflowStatus(id, 'failed');
    ok(res, { workflow_id: id, signal_sent: type });
  } catch (e: any) { err(res, e.message); }
});

// ── GET /skills ────────────────────────────────────────────────────────────

cooV4Router.get('/skills', (req: Request, res: Response) => {
  try {
    const { getAllSkills, findSkills } = require('../coo-v4/skill-marketplace');
    const { q, agent, enabled } = req.query;
    let skills = q ? findSkills(String(q), agent as any) : getAllSkills();
    if (enabled === 'true') skills = skills.filter((s: any) => s.enabled);
    ok(res, { total: skills.length, skills });
  } catch (e: any) { err(res, e.message); }
});

// ── GET /skills/stats ──────────────────────────────────────────────────────

cooV4Router.get('/skills/stats', (_req: Request, res: Response) => {
  try {
    const { getSkillStats } = require('../coo-v4/skill-marketplace');
    ok(res, getSkillStats());
  } catch (e: any) { err(res, e.message); }
});

// ── POST /council ──────────────────────────────────────────────────────────

cooV4Router.post('/council', (req: Request, res: Response) => {
  try {
    const { request, risk_level = 'low' } = req.body;
    if (!request) return err(res, 'request is required', 400);
    const { runCouncilV4, formatCouncilReport } = require('../coo-v4/agent-council-v4');
    const decision = runCouncilV4(request, risk_level);
    ok(res, { decision, report: formatCouncilReport(decision) });
  } catch (e: any) { err(res, e.message); }
});

// ── GET /nlp ───────────────────────────────────────────────────────────────

cooV4Router.get('/nlp', (req: Request, res: Response) => {
  try {
    const text = String(req.query.text || '');
    if (!text) return err(res, 'text query param required', 400);
    const { parseIntent, humanize } = require('../coo-v4/nlp-engine');
    const parsed = parseIntent(text);
    ok(res, { parsed, humanized: humanize(parsed) });
  } catch (e: any) { err(res, e.message); }
});

// ── GET /governor ──────────────────────────────────────────────────────────

cooV4Router.get('/governor', (req: Request, res: Response) => {
  try {
    const text = String(req.query.text || '');
    if (!text) return err(res, 'text query param required', 400);
    const { classify, formatGovernorDecision } = require('../coo-v4/production-governor');
    const decision = classify(text);
    ok(res, { decision, formatted: formatGovernorDecision(decision) });
  } catch (e: any) { err(res, e.message); }
});

// ── GET /self-improve ──────────────────────────────────────────────────────

cooV4Router.get('/self-improve', (_req: Request, res: Response) => {
  try {
    const { generateSelfImprovementReportV4, formatSelfImprovementReport } = require('../coo-v4/self-improvement-v4');
    const report = generateSelfImprovementReportV4(30);
    ok(res, { report, formatted: formatSelfImprovementReport(report) });
  } catch (e: any) { err(res, e.message); }
});

// ── GET /status ────────────────────────────────────────────────────────────

cooV4Router.get('/status', (_req: Request, res: Response) => {
  try {
    const { listWorkflows } = require('../coo-v4/durable-workflow');
    const { getSkillStats } = require('../coo-v4/skill-marketplace');
    const { flowOptimizer } = require('../coo-v4/flow-optimizer');

    const workflows = listWorkflows(undefined, 100);
    const skills    = getSkillStats();
    const flow      = flowOptimizer.getStats();

    const byStatus: Record<string, number> = {};
    for (const wf of workflows) byStatus[wf.status] = (byStatus[wf.status] || 0) + 1;

    ok(res, {
      coo_version: 'V4',
      status: 'OPERATIONAL',
      workflows: { total: workflows.length, by_status: byStatus },
      skills: { total: skills.total, enabled: skills.enabled, avg_trust: skills.avg_trust },
      flow_queues: Object.keys(flow).length,
      domains: 24,
      capabilities: [
        'intent_engine (A)', 'durable_workflow (B)', 'nlp_engine (C)',
        'ai_developer (D)', 'swe_agent (E)', 'code_reviewer (F)', 'production_gate (G)',
        'skill_marketplace (H)', 'agent_council_v4 (I)', 'browser_operator (J)',
        'computer_use (K)', 'google_workspace (L)', 'bookkeeper (M)',
        'accountant (N)', 'cfo (O)', 'tax (P)', 'marketing_factory (Q)',
        'website (R)', 'social_media (S)', 'execution_autonomy (T)',
        'executive_assistant (U)', 'flow_optimizer (V)', 'production_governor (W)',
        'self_improvement (X)',
      ],
    });
  } catch (e: any) { err(res, e.message); }
});

// ── GET /burnin ────────────────────────────────────────────────────────────

cooV4Router.get('/burnin', (_req: Request, res: Response) => {
  try {
    const fs   = require('fs');
    const path = require('path');
    const GLOBAL = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
    const DB_PATH = path.join(GLOBAL, 'coo-v4', 'burn-in.db');
    const METRICS_DIR = path.join(GLOBAL, 'coo-v4', 'metrics');

    const Database = require('better-sqlite3');
    const db = new Database(DB_PATH, { readonly: true });

    const total = db.prepare("SELECT COUNT(*) as n, SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as ok, SUM(CASE WHEN status='failure' THEN 1 ELSE 0 END) as fail, SUM(CASE WHEN status='retry' THEN 1 ELSE 0 END) as retry, AVG(duration_ms) as avg_ms FROM events").get() as any;
    const byDomain = db.prepare("SELECT domain, COUNT(*) as total, SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as ok, SUM(CASE WHEN status='failure' THEN 1 ELSE 0 END) as fail FROM events GROUP BY domain").all() as any[];
    const meta = db.prepare('SELECT * FROM burn_in_meta').get() as any;
    const recent = db.prepare("SELECT domain, action, status, duration_ms, recorded_at FROM events ORDER BY id DESC LIMIT 10").all() as any[];
    db.close();

    const startDate = meta?.start_date || new Date().toISOString();
    const daysElapsed = Math.max(1, Math.ceil((Date.now() - new Date(startDate).getTime()) / 86400000));
    const successRate = total.n > 0 ? total.ok / total.n : 1;

    let latestMetrics: any = null;
    if (fs.existsSync(METRICS_DIR)) {
      const files = fs.readdirSync(METRICS_DIR).filter((f: string) => f.endsWith('.json')).sort();
      if (files.length > 0) {
        try { latestMetrics = JSON.parse(fs.readFileSync(path.join(METRICS_DIR, files[files.length - 1]), 'utf8')); } catch {}
      }
    }

    ok(res, {
      start_date: startDate,
      days_elapsed: daysElapsed,
      days_total: 7,
      total_events: total.n,
      success_rate: successRate,
      failure_rate: total.n > 0 ? total.fail / total.n : 0,
      retry_rate: total.n > 0 ? total.retry / total.n : 0,
      avg_runtime_ms: Math.round(total.avg_ms || 0),
      burn_in_score: latestMetrics?.burn_in_score ?? Math.round(successRate * 100),
      burn_in_status: successRate >= 0.95 ? 'HEALTHY' : successRate >= 0.80 ? 'DEGRADED' : 'CRITICAL',
      flow_gaps: latestMetrics?.flow_gaps ?? 0,
      orphan_workflows: latestMetrics?.orphan_workflows ?? 0,
      missing_evidence: latestMetrics?.missing_evidence ?? 0,
      by_domain: Object.fromEntries(byDomain.map((d: any) => [d.domain, { total: d.total, success: d.ok, failure: d.fail, rate: d.total > 0 ? d.ok / d.total : 1 }])),
      recent_events: recent,
    });
  } catch (e: any) { err(res, e.message); }
});
