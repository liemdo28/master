/**
 * SEO Agent Integration Router
 * Phase 7: File-backed persistence — state survives Mi-Core restarts.
 */
import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

export const seoRouter = Router();

// ── Persistence ─────────────────────────────────────────────────────────────
const PERSIST_DIR = path.join(process.cwd(), 'data', 'seo');
const PERSIST_FILE = path.join(PERSIST_DIR, 'seo-state.json');
const STALE_MS = 5 * 60 * 1000;

function ensureDir(d: string) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

// ── Data stores (declared first so persistState can reference them) ──────────
interface SeoAgentRecord {
  agentId: string; version: string; port: number; status: string;
  health: string; uptime_s: number; last_sync_at: string; registered_at: string;
  last_report?: any; error_state: string | null; tasks_completed: number; tasks_pending: number;
}

let seoAgents = new Map<string, SeoAgentRecord>();
let seoSyncLogs: any[] = [];
let seoTasks: any[] = [];
let seoReports: any[] = [];
let seoIssues: any[] = [];
let seoOpportunities: any[] = [];
let connectorResults: any = {};
let orchestratorJobs: any[] = [];
let orchestratorLog: any[] = [];

// ── Load persisted state ────────────────────────────────────────────────────
function loadState() {
  ensureDir(PERSIST_DIR);
  const defaults = { agents: {}, syncLogs: [] as any[], tasks: [] as any[], reports: [] as any[],
    issues: [] as any[], opportunities: [] as any[], connectorResults: {},
    orchestratorJobs: [] as any[], orchestratorLog: [] as any[] };
  try {
    if (fs.existsSync(PERSIST_FILE)) {
      const s = JSON.parse(fs.readFileSync(PERSIST_FILE, 'utf8'));
      const now = Date.now();
      for (const [, a] of Object.entries(s.agents || {})) {
        if (now - new Date((a as any).last_sync_at).getTime() > STALE_MS) (a as any).status = 'stale';
      }
      return { ...defaults, ...s, agents: s.agents || {} };
    }
  } catch { console.log('[SEO] load failed, using defaults'); }
  return defaults;
}

function saveState() {
  ensureDir(PERSIST_DIR);
  try {
    fs.writeFileSync(PERSIST_FILE, JSON.stringify({
      agents: Object.fromEntries(seoAgents),
      syncLogs: seoSyncLogs.slice(-500), tasks: seoTasks.slice(-200),
      reports: seoReports.slice(-200), issues: seoIssues.slice(-200),
      opportunities: seoOpportunities.slice(-200), connectorResults,
      orchestratorJobs: orchestratorJobs.slice(-100), orchestratorLog: orchestratorLog.slice(-200),
    }, null, 2));
  } catch (e) { console.log('[SEO] save failed:', (e as Error).message); }
}

const _p = loadState();
seoAgents = new Map(Object.entries(_p.agents) as [string, SeoAgentRecord][]);
seoSyncLogs = _p.syncLogs; seoTasks = _p.tasks; seoReports = _p.reports;
seoIssues = _p.issues; seoOpportunities = _p.opportunities;
connectorResults = _p.connectorResults;
orchestratorJobs = _p.orchestratorJobs; orchestratorLog = _p.orchestratorLog;

// ── Agent endpoints ─────────────────────────────────────────────────────────
seoRouter.post('/agents/register', (req: Request, res: Response) => {
  const { agent, version, port } = req.body;
  const agentId = agent || req.headers['x-agent-id'] as string;
  if (!agentId) return res.status(400).json({ ok: false, error: 'agent id required' });
  const now = new Date().toISOString();
  const ex = seoAgents.get(agentId);
  seoAgents.set(agentId, { agentId, version: version || ex?.version || '1.0.0', port: port || ex?.port || 0,
    status: 'online', health: 'healthy', uptime_s: 0, last_sync_at: now,
    registered_at: ex?.registered_at || now, error_state: null,
    tasks_completed: ex?.tasks_completed || 0, tasks_pending: ex?.tasks_pending || 0 });
  seoSyncLogs.push({ agent: agentId, action: 'register', ts: now });
  saveState();
  console.log(`[Mi][SEO] Agent registered: ${agentId}`);
  res.json({ ok: true, registered: agentId, ts: now });
});

seoRouter.post('/agents/:id/health', (req: Request, res: Response) => {
  const agentId = req.params.id;
  const r = seoAgents.get(agentId);
  if (!r) return res.status(404).json({ ok: false, error: 'agent not registered' });
  const now = new Date().toISOString();
  r.health = req.body.health || 'healthy'; r.uptime_s = req.body.uptime_s || r.uptime_s;
  r.error_state = req.body.error_state || null; r.last_sync_at = now;
  seoSyncLogs.push({ agent: agentId, action: 'health', ts: now });
  saveState();
  res.json({ ok: true, agent: agentId, health: r.health });
});

seoRouter.post('/agents/:id/status', (req: Request, res: Response) => {
  const agentId = req.params.id;
  const r = seoAgents.get(agentId);
  const now = new Date().toISOString();
  if (!r) {
    const s = req.body.status || {};
    seoAgents.set(agentId, { agentId, version: s.version || '1.0.0', port: s.port || 0,
      status: 'online', health: 'healthy', uptime_s: s.uptime_s || 0, last_sync_at: now,
      registered_at: now, error_state: null, tasks_completed: 0, tasks_pending: 0 });
    seoSyncLogs.push({ agent: agentId, action: 'auto-register+status', ts: now });
    saveState();
    return res.json({ ok: true, agent: agentId, auto_registered: true });
  }
  const s = req.body.status || req.body;
  r.status = 'online'; r.uptime_s = s.uptime_s || r.uptime_s; r.port = s.port || r.port;
  r.version = s.version || r.version; r.error_state = s.error_state || null; r.last_sync_at = now;
  seoSyncLogs.push({ agent: agentId, action: 'status', ts: now });
  saveState();
  res.json({ ok: true, agent: agentId, status: r.status });
});

seoRouter.post('/agents/:id/reports', (req: Request, res: Response) => {
  const agentId = req.params.id; const now = new Date().toISOString();
  const report = { agent: agentId, ts: now, ...req.body };
  seoReports.push(report);
  const r = seoAgents.get(agentId);
  if (r) { r.last_report = report; r.last_sync_at = now; }
  seoSyncLogs.push({ agent: agentId, action: 'report', ts: now });
  saveState();
  res.json({ ok: true, agent: agentId, report_received: true });
});

seoRouter.post('/dashboard/:id', (req: Request, res: Response) => {
  const agentId = req.params.id; const now = new Date().toISOString();
  const r = seoAgents.get(agentId); if (r) r.last_sync_at = now;
  seoSyncLogs.push({ agent: agentId, action: 'dashboard', ts: now, payload: req.body });
  saveState();
  res.json({ ok: true, agent: agentId, dashboard_updated: true });
});

seoRouter.get('/agents/:id/tasks', (req: Request, res: Response) => {
  const pending = seoTasks.filter(t => t.assignee === req.params.id && t.status === 'pending');
  res.json({ ok: true, agent: req.params.id, tasks: pending });
});

seoRouter.get('/agents/:id/config', (req: Request, res: Response) => {
  res.json({ ok: true, agent: req.params.id, config: { sync_interval_s: 30, audit_cron: '0 3 * * *' } });
});

seoRouter.get('/agents/:id/status', (req: Request, res: Response) => {
  const r = seoAgents.get(req.params.id);
  if (!r) return res.status(404).json({ ok: false, error: 'agent not found' });
  res.json({ ok: true, ...r });
});

seoRouter.get('/agents', (_req: Request, res: Response) => {
  const agents = Array.from(seoAgents.values());
  res.json({ ok: true, total: agents.length, online: agents.filter(a => a.status === 'online').length, agents });
});

seoRouter.post('/agents/:id/sync', (req: Request, res: Response) => {
  const agentId = req.params.id; const now = new Date().toISOString();
  const r = seoAgents.get(agentId); if (r) r.last_sync_at = now;
  seoSyncLogs.push({ agent: agentId, action: 'sync', ts: now });
  saveState();
  res.json({ ok: true, agent: agentId, synced_at: now });
});

seoRouter.post('/tasks', (req: Request, res: Response) => {
  const { assignee, type, payload } = req.body;
  if (!assignee || !type) return res.status(400).json({ ok: false, error: 'assignee and type required' });
  const now = new Date().toISOString();
  const task = { id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    assignee, type, payload, status: 'pending', created_at: now, completed_at: null, result: null };
  seoTasks.push(task);
  const r = seoAgents.get(assignee); if (r) r.tasks_pending++;
  saveState();
  res.json({ ok: true, task });
});

seoRouter.post('/tasks/:taskId/complete', (req: Request, res: Response) => {
  const task = seoTasks.find(t => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ ok: false, error: 'task not found' });
  task.status = 'completed'; task.completed_at = new Date().toISOString(); task.result = req.body.result || null;
  const r = seoAgents.get(task.assignee);
  if (r) { r.tasks_pending = Math.max(0, r.tasks_pending - 1); r.tasks_completed++; }
  saveState();
  res.json({ ok: true, task });
});

// ── Dashboard ───────────────────────────────────────────────────────────────
seoRouter.get('/reports/latest', (_req: Request, res: Response) => {
  const agents = Array.from(seoAgents.values());
  res.json({ ok: true, reports: agents.map(a => ({ agent: a.agentId, last_report: a.last_report || null, last_sync_at: a.last_sync_at })), total: seoReports.length });
});

seoRouter.get('/dashboard', (_req: Request, res: Response) => {
  const agents = Array.from(seoAgents.values());
  const online = agents.filter(a => a.status === 'online').length;
  const totalIssues = seoReports.reduce((s, r) => s + (r.issues_count || 0), 0);
  res.json({ ok: true, agents_total: agents.length, agents_online: online, agents_target: 7, all_online: online === 7,
    last_sync: agents.length ? agents.sort((a, b) => b.last_sync_at.localeCompare(a.last_sync_at))[0].last_sync_at : null,
    agents: agents.map(a => ({ id: a.agentId, status: a.status, health: a.health, port: a.port,
      uptime_s: a.uptime_s, last_sync_at: a.last_sync_at, error_state: a.error_state,
      tasks_completed: a.tasks_completed, tasks_pending: a.tasks_pending })),
    seo_score_summary: { overall: agents.length === 7 ? 'operational' : 'degraded', agents_reporting: agents.length },
    open_issues_count: totalIssues, ranking_opportunities: seoReports.filter(r => r.type === 'ranking').length,
    citation_issues: seoReports.filter(r => r.type === 'citation').length,
    technical_issues: seoReports.filter(r => r.type === 'technical').length,
    sync_logs_count: seoSyncLogs.length, tasks_total: seoTasks.length,
    tasks_completed: seoTasks.filter(t => t.status === 'completed').length,
    tasks_pending: seoTasks.filter(t => t.status === 'pending').length });
});

seoRouter.get('/sync-logs', (_req: Request, res: Response) => {
  res.json({ ok: true, logs: seoSyncLogs.slice(-100) });
});

// ── Connectors ──────────────────────────────────────────────────────────────
seoRouter.get('/connectors/status', (_req: Request, res: Response) => {
  res.json({ ok: true, connectors: Object.values(connectorResults).length ? Object.values(connectorResults) : getDefaultConnectorStatus() });
});

seoRouter.post('/connectors/run', async (req: Request, res: Response) => {
  const connectorId = req.body?.connector;
  try {
    const runUrl = `http://localhost:4011/run/connectors${connectorId ? `?connector=${connectorId}` : ''}`;
    const http = require('http');
    const result: any = await new Promise((resolve) => {
      const r = http.get(runUrl, { timeout: 120000 }, (response: any) => {
        let body = '';
        response.on('data', (d: string) => body += d);
        response.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({ ok: false, error: 'parse_error' }); } });
      });
      r.on('error', (e: Error) => resolve({ ok: false, error: e.message }));
      r.on('timeout', () => { r.destroy(); resolve({ ok: false, error: 'timeout' }); });
    });
    if (result.ok && result.results) {
      for (const [k, v] of Object.entries(result.results as Record<string, any>)) connectorResults[k] = v;
    }
    saveState();
    res.json({ ok: true, ...result });
  } catch (e: any) { res.json({ ok: false, error: e.message }); }
});

seoRouter.get('/connectors/latest', (_req: Request, res: Response) => {
  res.json({ ok: true, connectors: connectorResults });
});

seoRouter.get('/data-sources', (_req: Request, res: Response) => {
  const agents = Array.from(seoAgents.values());
  const seeded = agents.length * 3;
  const real = Object.values(connectorResults).reduce((s: number, c: any) => s + (c?.records || 0), 0);
  res.json({ ok: true, sources: [
    { type: 'seeded', record_count: seeded },
    { type: 'crawler', record_count: (connectorResults as any).crawler?.records || 0, status: (connectorResults as any).crawler?.status || 'not_run' },
    { type: 'gsc', record_count: (connectorResults as any).gsc?.records || 0, status: (connectorResults as any).gsc?.status || 'not_run' },
    { type: 'gbp', record_count: (connectorResults as any).gbp?.records || 0, status: (connectorResults as any).gbp?.status || 'not_run' },
    { type: 'ga4', record_count: (connectorResults as any).ga4?.records || 0, status: (connectorResults as any).ga4?.status || 'not_run' },
    { type: 'citation_scan', record_count: (connectorResults as any).citation_scan?.records || 0, status: (connectorResults as any).citation_scan?.status || 'not_run' },
  ], real_vs_seeded: { real, seeded, ratio: real > 0 ? `${Math.round(real / (real + seeded) * 100)}% real` : '0% real' } });
});

function getDefaultConnectorStatus() {
  return [
    { id: 'crawler', name: 'Website Crawler', status: 'idle', credentials_configured: true, last_success: null, last_error: null },
    { id: 'gsc', name: 'Google Search Console', status: 'idle', credentials_configured: false, last_success: null, last_error: null },
    { id: 'gbp', name: 'Google Business Profile', status: 'idle', credentials_configured: false, last_success: null, last_error: null },
    { id: 'ga4', name: 'Google Analytics 4', status: 'idle', credentials_configured: false, last_success: null, last_error: null },
    { id: 'citation_scan', name: 'Citation Checker', status: 'idle', credentials_configured: true, last_success: null, last_error: null },
  ];
}

// ── Issues & Opportunities ──────────────────────────────────────────────────
seoRouter.post('/issues', (req: Request, res: Response) => {
  const issue = { id: `issue_${Date.now()}`, ts: new Date().toISOString(), ...req.body };
  seoIssues.push(issue); saveState();
  res.json({ ok: true, issue });
});

seoRouter.get('/issues', (_req: Request, res: Response) => {
  const reportIssues = seoReports.filter(r => r.payload?.issues || r.issues).flatMap(r => r.payload?.issues || r.issues || []);
  res.json({ ok: true, issues: [...seoIssues, ...reportIssues].slice(-200), total: seoIssues.length + reportIssues.length });
});

seoRouter.post('/opportunities', (req: Request, res: Response) => {
  const opp = { id: `opp_${Date.now()}`, ts: new Date().toISOString(), ...req.body };
  seoOpportunities.push(opp); saveState();
  res.json({ ok: true, opportunity: opp });
});

seoRouter.get('/opportunities', (_req: Request, res: Response) => {
  const reportOpps = seoReports.filter(r => r.payload?.opportunities || r.opportunities).flatMap(r => r.payload?.opportunities || r.opportunities || []);
  res.json({ ok: true, opportunities: [...seoOpportunities, ...reportOpps].slice(-200), total: seoOpportunities.length + reportOpps.length });
});

seoRouter.get('/locations', (_req: Request, res: Response) => {
  res.json({ ok: true, locations: [
    { id: 'bandera', name: 'Bakudan Ramen - Bandera', status: 'active' },
    { id: 'stone-oak', name: 'Bakudan Ramen - Stone Oak', status: 'active' },
    { id: 'the-rim', name: 'Bakudan Ramen - The Rim', status: 'active' },
  ] });
});

seoRouter.get('/kpis', (_req: Request, res: Response) => {
  const agents = Array.from(seoAgents.values());
  const online = agents.filter(a => a.status === 'online').length;
  const cd = (connectorResults as any).crawler; const ci = (connectorResults as any).citation_scan; const gs = (connectorResults as any).gsc;
  res.json({ ok: true, kpis: {
    agents_online: online, agents_total: 7, seo_health: online === 7 ? 'healthy' : online >= 5 ? 'degraded' : 'critical',
    pages_crawled: cd?.records || 0, broken_links: cd?.broken_links_found || 0,
    citations_confirmed: ci?.confirmed_listings || 0, citations_total: ci?.records || 0, nap_consistent: ci?.nap_consistent_count || 0,
    gsc_keywords: gs?.records || 0,
    connector_status: { crawler: cd?.status || 'not_run', gsc: gs?.status || 'not_run', gbp: (connectorResults as any).gbp?.status || 'not_run', ga4: (connectorResults as any).ga4?.status || 'not_run', citation_scan: ci?.status || 'not_run' },
    last_crawl: cd?.data?.[0]?.fetched_at || null, last_citation_scan: ci?.data?.[0]?.fetched_at || null,
    tasks_completed: seoTasks.filter(t => t.status === 'completed').length, tasks_pending: seoTasks.filter(t => t.status === 'pending').length,
    reports_total: seoReports.length } });
});

// ── Orchestrator ────────────────────────────────────────────────────────────
seoRouter.post('/orchestrator/run/:jobId', async (req: Request, res: Response) => {
  const jobId = req.params.jobId; const now = new Date().toISOString();
  const running = orchestratorJobs.find(j => j.job_id === jobId && j.status === 'running');
  if (running) return res.json({ ok: false, error: 'job_already_running', job: running });
  const job = { id: `job_${Date.now()}`, job_id: jobId, status: 'running', started_at: now, completed_at: null, result: null, error: null };
  orchestratorJobs.push(job); orchestratorLog.push({ job_id: jobId, action: 'started', ts: now });
  const agentMap: Record<string, { port: number; endpoint: string }> = {
    'daily-website-crawl': { port: 4011, endpoint: '/run/connectors?connector=crawler' },
    'daily-gbp-sync': { port: 4011, endpoint: '/run/connectors?connector=gbp' },
    'daily-gsc-sync': { port: 4011, endpoint: '/run/connectors?connector=gsc' },
    'daily-ga4-sync': { port: 4011, endpoint: '/run/connectors?connector=ga4' },
    'daily-schema-validation': { port: 4014, endpoint: '/run/audit' },
    'daily-technical-audit': { port: 4012, endpoint: '/run/audit' },
    'weekly-citation-scan': { port: 4011, endpoint: '/run/connectors?connector=citation_scan' },
    'weekly-content-plan': { port: 4015, endpoint: '/run/audit' },
    'weekly-executive-seo-report': { port: 4017, endpoint: '/run/audit' },
    'monthly-full-seo-audit': { port: 4012, endpoint: '/run/audit' },
  };
  const target = agentMap[jobId];
  if (!target) { job.status = 'failed'; job.error = `Unknown job: ${jobId}`; job.completed_at = new Date().toISOString(); saveState(); return res.json({ ok: false, error: job.error, job }); }
  try {
    const http = require('http');
    const method = target.endpoint.startsWith('/run/connectors') ? 'GET' : 'POST';
    const result: any = await new Promise((resolve) => {
      const r = http.request({ hostname: 'localhost', port: target.port, path: target.endpoint, method, timeout: 120000 }, (response: any) => {
        let body = ''; response.on('data', (d: string) => body += d);
        response.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({ ok: false, raw: body }); } });
      });
      r.on('error', (e: Error) => resolve({ ok: false, error: e.message }));
      r.on('timeout', () => { r.destroy(); resolve({ ok: false, error: 'timeout' }); }); r.end();
    });
    job.status = result.ok ? 'completed' : 'failed'; job.result = result; job.error = result.error || null;
    job.completed_at = new Date().toISOString(); orchestratorLog.push({ job_id: jobId, action: job.status, ts: job.completed_at });
    // Merge connector results so KPIs/dashboard reflect latest data
    if (result?.ok && result?.result?.results) {
      for (const [k, v] of Object.entries(result.result.results as Record<string, any>)) connectorResults[k] = v;
    }
    saveState(); res.json({ ok: true, job });
  } catch (e: any) { job.status = 'failed'; job.error = e.message; job.completed_at = new Date().toISOString(); saveState(); res.json({ ok: false, error: e.message, job }); }
});

seoRouter.get('/orchestrator/status', (_req: Request, res: Response) => {
  res.json({ ok: true, jobs_total: orchestratorJobs.length,
    jobs_running: orchestratorJobs.filter(j => j.status === 'running').length,
    jobs_completed: orchestratorJobs.filter(j => j.status === 'completed').length,
    jobs_failed: orchestratorJobs.filter(j => j.status === 'failed').length,
    recent_jobs: orchestratorJobs.slice(-20), log: orchestratorLog.slice(-50) });
});

seoRouter.get('/orchestrator/jobs', (_req: Request, res: Response) => {
  res.json({ ok: true, jobs: orchestratorJobs });
});
