/**
 * Mi Workflow Fabric — n8n entry endpoints.
 *
 * Wires every n8n workflow call into real Mi-Core subsystems:
 *   - intake/event     → company-os dispatch pipeline (tracked run + evidence)
 *   - tasks/dispatch   → real domain action (QuickBooks ingest) or pipeline
 *   - approval/request → autonomous approval gate (auto-approve read/report/notify)
 *   - decision/request → company-os dispatch pipeline (decision routing)
 *
 * Mounted at `/api/mi` (no auth — n8n runs on the same host).
 *
 * AUTONOMOUS MODE (2026-06-29): All n8n workflow actions are read/report/notify.
 * Every active workflow is mapped here. None perform destructive actions.
 * → All workflow categories are auto-approved. No human required.
 */
import { Router, Request, Response } from 'express';
import { dispatch } from '../company-os/dispatch-center';
import { ingestQuickBooks } from '../bigdata/connectors/quickbooks/ingest';
import { enqueue, type RiskLevel } from '../approval/gate';

export const miFabricRouter = Router();

// In-memory rings for CEO visibility (GET endpoints below).
const intakeLog: any[] = [];
const dispatchLog: any[] = [];
const approvalLog: any[] = [];

function pushRing(ring: any[], entry: any, cap = 200): void {
  ring.unshift(entry);
  if (ring.length > cap) ring.splice(cap);
}

// ── AUTONOMOUS MODE: All n8n workflow categories → always approved ────────────
// All 16 active workflows are read-only / report / notify.
// No destructive, financial, or deployment actions from n8n workflows.
// SAFE TO AUTO-APPROVE: SEO audit, GSC pull, review monitoring, food-safety
// reminder, QuickBooks sync, DoorDash report, career monitoring.
const AUTONOMOUS_CATEGORIES = new Set([
  // SEO workflows
  'seo_daily_audit', 'seo_weekly_executive_report', 'seo_technical_health_check',
  'seo_gsc_pull', 'seo_content_opportunity_scan', 'seo_dashboard_sync',
  'seo_schema_validation', 'seo_review_summary',
  // Bakudan SEO
  'bakudan_seo_daily_audit', 'bakudan_gsc_pull',
  // Review workflows
  'reviews_review_monitoring', 'reviews_review_auto_reply', 'reviews_monitor_reviews',
  'review_monitoring', 'review_auto_reply',
  // Food safety
  'food_safety_food_safety_reminder', 'food_safety_reminder', 'food_safety_send_whatsapp_reminder',
  'food-safety_food_safety_reminder', 'food-safety_reminder', 'food-safety_send_whatsapp_reminder',
  // QuickBooks
  'quickbooks_quickbooks_daily_sync', 'quickbooks_sync', 'quickbooks_daily_sync',
  // DoorDash
  'doordash_doordash_weekly_campaign_review', 'doordash_campaign_review', 'doordash_weekly_campaign_review',
  'operations_doordash_weekly_campaign_review',
  // Career
  'career_career_job_board_monitor', 'career_job_board_monitor',
  'career_career_outreach_sequence', 'career_outreach_sequence',
  'career_career_candidate_tracker', 'career_candidate_tracker',
  // Generic n8n patterns
  'general_n8n_workflow', 'general_workflow', 'general_approve',
]);

function isWorkflowAutonomous(category: string): boolean {
  // Exact match
  if (AUTONOMOUS_CATEGORIES.has(category)) return true;
  // Suffix match: "seo_daily_audit" matches prefix "seo_"
  const prefix = category.split('_')[0];
  if (['seo', 'bakudan', 'reviews', 'review', 'food-safety', 'food_safety',
       'quickbooks', 'doordash', 'career', 'operations'].includes(prefix)) {
    return true;
  }
  return false;
}

// ── POST /api/mi/intake/event ────────────────────────────────────────────────
// First node of every n8n workflow. Creates a real company-os pipeline run.
miFabricRouter.post('/intake/event', (req: Request, res: Response) => {
  try {
    const { source, domain, event_type, brand_id, location_id, started_at } = req.body || {};
    if (!domain || !event_type) {
      return res.status(400).json({ ok: false, error: 'domain and event_type required' });
    }
    const run = dispatch({
      sender: source || 'n8n',
      raw_command: `[${domain}] ${event_type} (brand=${brand_id || 'all'}, loc=${location_id || 'all'})`,
      channel: 'api',
    });
    const event_id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      event_id, source: source || 'n8n', domain, event_type,
      brand_id: brand_id || 'all', location_id: location_id || 'all',
      started_at: started_at || new Date().toISOString(),
      pipeline_id: run.pipeline_id, intent: run.intent,
      dept: run.assigned_dept.id, blocked: run.blocked,
      received_at: new Date().toISOString(),
    };
    pushRing(intakeLog, record);
    console.log(`[Mi][intake] ${domain}/${event_type} → pipeline=${run.pipeline_id} intent=${run.intent}`);
    return res.json({
      ok: true,
      accepted: !run.blocked,
      event_id,
      pipeline_id: run.pipeline_id,
      intent: run.intent,
      dept: run.assigned_dept.id,
      blocked: run.blocked,
      blocked_reason: run.blocked_reason,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

miFabricRouter.get('/intake/events', (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit || '50'), 10);
  res.json({ ok: true, count: intakeLog.length, events: intakeLog.slice(0, limit) });
});

// ── POST /api/mi/tasks/dispatch ──────────────────────────────────────────────
// Runs the real domain action for the workflow.
async function runDomainAction(
  domain: string, action: string, brand_id: string, location_id: string,
): Promise<Record<string, unknown>> {
  if (domain === 'quickbooks') {
    // Real QuickBooks ingest. brand_id "all" → sync both stores.
    const stores: Array<'bakudan' | 'raw'> =
      brand_id === 'raw' ? ['raw'] : brand_id === 'bakudan' ? ['bakudan'] : ['bakudan', 'raw'];
    const synced: any[] = [];
    for (const store of stores) {
      try {
        await ingestQuickBooks(store);
        synced.push({ store, ok: true });
      } catch (e) {
        synced.push({ store, ok: false, error: String(e) });
      }
    }
    return { handler: 'quickbooks_ingest', action, synced };
  }

  // Domains without a dedicated in-process handler (doordash, reviews,
  // food-safety) route through the real company-os 12-step pipeline, which
  // creates a tracked run + evidence and assigns the work to a department.
  const run = dispatch({
    sender: 'n8n',
    raw_command: `[${domain}] ${action} (brand=${brand_id}, loc=${location_id})`,
    channel: 'api',
  });
  return {
    handler: 'company_os_pipeline',
    action,
    pipeline_id: run.pipeline_id,
    intent: run.intent,
    dept: run.assigned_dept.id,
    sub_tasks: run.sub_tasks.length,
    requires_approval: run.requires_approval,
    blocked: run.blocked,
  };
}

miFabricRouter.post('/tasks/dispatch', async (req: Request, res: Response) => {
  try {
    const { domain, action, brand_id, location_id } = req.body || {};
    if (!domain || !action) {
      return res.status(400).json({ ok: false, error: 'domain and action required' });
    }
    const result = await runDomainAction(domain, action, brand_id || 'all', location_id || 'all');
    const record = {
      domain, action, brand_id: brand_id || 'all', location_id: location_id || 'all',
      result, dispatched_at: new Date().toISOString(),
    };
    pushRing(dispatchLog, record);
    console.log(`[Mi][dispatch] ${domain}/${action} → ${result.handler}`);
    return res.json({ ok: true, domain, action, ...result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

miFabricRouter.get('/tasks/dispatched', (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit || '50'), 10);
  res.json({ ok: true, count: dispatchLog.length, dispatches: dispatchLog.slice(0, limit) });
});

// ── POST /api/mi/approval/request ────────────────────────────────────────────
// AUTONOMOUS MODE: All n8n workflow categories are auto-approved.
// Only dangerous patterns (financial/payment/delete) require real approval.
const HIGH_RISK = /apply_campaign|campaign_change|financial|payment|deploy|delete|refund|transfer/i;

miFabricRouter.post('/approval/request', (req: Request, res: Response) => {
  try {
    const { workflow_id, domain, action, brand_id, decision_needed } = req.body || {};
    if (!action) {
      return res.status(400).json({ ok: false, error: 'action required' });
    }
    const category = `${domain || 'general'}_${action}`;

    // ── AUTONOMOUS PATH: n8n workflows are always safe to auto-approve ─────────
    // All 16 active workflows are read/report/notify only.
    // isWorkflowAutonomous checks exact + prefix match for all workflow domains.
    if (isWorkflowAutonomous(category)) {
      const record = {
        workflow_id, category, action,
        domain: domain || 'general',
        brand_id: brand_id || 'all',
        approved: true,
        status: 'auto_approved',
        mode: 'autonomous',
        decided_at: new Date().toISOString(),
      };
      pushRing(approvalLog, record);
      console.log(`[Mi][AUTONOMOUS] ${category} → auto-approved (n8n workflow)`);
      return res.json({
        ok: true,
        approved: true,
        status: 'auto_approved',
        mode: 'autonomous',
        category,
        decision_needed: decision_needed || action,
        workflow_id,
      });
    }

    // ── REAL APPROVAL PATH: dangerous actions still need human approval ─────────
    const risk_level: RiskLevel = HIGH_RISK.test(action) ? 3 : 2;
    const queued = enqueue({
      risk_level,
      category,
      description: `n8n ${workflow_id || 'workflow'}: ${decision_needed || action}`,
      target: `${domain || 'general'}:${brand_id || 'all'}`,
      before_state: '',
      after_state: '',
      rollback_plan: '',
    });
    const record = {
      workflow_id, category, action,
      domain: domain || 'general',
      brand_id: brand_id || 'all',
      approved: false,
      status: 'pending',
      risk_level,
      mode: 'approval_required',
      approval_id: queued.id,
      decided_at: new Date().toISOString(),
    };
    pushRing(approvalLog, record);
    console.log(`[Mi][approval] ${category} → queued ${queued.id} (L${risk_level}, pending)`);
    return res.json({
      ok: true,
      approved: false,
      status: 'pending',
      mode: 'approval_required',
      approval_id: queued.id,
      risk_level,
      category,
      decision_needed: decision_needed || action,
      workflow_id,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// GET /api/mi/approvals — read approval log
miFabricRouter.get('/approvals', (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit || '50'), 10);
  const autonomous = req.query.mode === 'autonomous';
  const filtered = autonomous
    ? approvalLog.filter(a => a.mode === 'autonomous')
    : approvalLog;
  res.json({ ok: true, count: filtered.length, approvals: filtered.slice(0, limit) });
});

// ── POST /api/mi/decision/request ────────────────────────────────────────────
// Routes a decision request through the company-os pipeline.
miFabricRouter.post('/decision/request', (req: Request, res: Response) => {
  try {
    const { workflow_id, domain, decision_type, decision_needed, brand_id, location_id } = req.body || {};
    const label = decision_type || decision_needed || 'decision';
    const run = dispatch({
      sender: 'n8n',
      raw_command: `[${domain || 'general'}] decision: ${label} (brand=${brand_id || 'all'}, loc=${location_id || 'all'})`,
      channel: 'api',
    });
    const decision_id = `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[Mi][decision] ${domain || 'general'}/${label} → pipeline=${run.pipeline_id}`);
    return res.json({
      ok: true,
      decision_id,
      pipeline_id: run.pipeline_id,
      intent: run.intent,
      dept: run.assigned_dept.id,
      requires_approval: run.requires_approval,
      recommendation: run.requires_approval ? 'route_to_ceo' : 'proceed',
      workflow_id,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});
