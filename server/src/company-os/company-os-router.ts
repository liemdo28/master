/**
 * Mi Company OS — Express Router
 * Mounts all Company OS endpoints on /api/company-os
 */

import { Router, type Request, type Response } from 'express';
import { runPipeline } from './execution-pipeline';
import { getDeptExecutors } from './dept-executors';
import { recentPipelineRuns, getPipelineRun, getStepsForPipeline } from './evidence-store';
import { DEPARTMENTS, getActiveDepts, getDeptsByPhase } from './departments';
import { SOURCE_INVENTORY, getRemoveCandidates, sourceInventorySummary } from './source-inventory';
import { listBrainAssignments, verifyBrain } from './brain-registry';
import { getToolsForDept } from './tool-registry';
import { checkBrainHealth } from './department-runtime';
import { PROJECTS, getActiveProjects, getProjectsByDept, getCriticalProjects, getProjectSummary } from './project-registry';
import { SERVICES, getServicesByDept, getPm2Services, getServicesSummary, checkAllServicesHealth, checkServiceHealth } from './service-registry';
import { DATA_SOURCES, getSourcesByDept, dataSourceSummary, getMissingSources } from './data-source-registry';
import { runMoneyWorkflow, runAllMoneyWorkflows, formatMoneyResultForCeo, type MoneyWorkflowId } from './money-operations';
import { runHealthScan, getMonitoredServices } from './self-healing-monitor';

const router = Router();

// POST /api/company-os/command — CEO sends a command
router.post('/command', async (req: Request, res: Response) => {
  const { command, sender = 'CEO', channel = 'api' } = req.body as {
    command?: string;
    sender?: string;
    channel?: string;
  };

  if (!command || typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({ error: 'command is required' });
  }

  try {
    const result = await runPipeline(
      { raw_command: command.trim(), sender, channel: channel as 'whatsapp' | 'api' | 'dashboard' },
      getDeptExecutors()
    );
    return res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: `Pipeline error: ${msg}` });
  }
});

// GET /api/company-os/pipelines — recent pipeline runs
router.get('/pipelines', (_req: Request, res: Response) => {
  const runs = recentPipelineRuns(50);
  return res.json({ runs, count: runs.length });
});

// GET /api/company-os/pipelines/:id — single pipeline run
router.get('/pipelines/:id', (req: Request, res: Response) => {
  const run = getPipelineRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'Pipeline not found' });
  return res.json(run);
});

// GET /api/company-os/departments — department registry
router.get('/departments', (_req: Request, res: Response) => {
  return res.json({
    total: DEPARTMENTS.length,
    active: getActiveDepts().length,
    by_phase: [1, 2, 3, 4, 5].map(p => ({
      phase: p,
      depts: getDeptsByPhase(p).map(d => ({
        id: d.id, name: d.name, status: d.status,
        autonomy: d.autonomy, approval_required: d.approval_required,
      })),
    })),
  });
});

// GET /api/company-os/sources — source inventory
router.get('/sources', (_req: Request, res: Response) => {
  return res.json({
    summary: sourceInventorySummary(),
    inventory: SOURCE_INVENTORY,
    remove_candidates: getRemoveCandidates(),
  });
});

// GET /api/company-os/pipelines/:id/steps — evidence steps for a pipeline
router.get('/pipelines/:id/steps', (req: Request, res: Response) => {
  const steps = getStepsForPipeline(req.params.id);
  return res.json({ steps, count: steps.length });
});

// GET /api/company-os/brains — brain assignment report
router.get('/brains', (_req: Request, res: Response) => {
  const assignments = listBrainAssignments();
  return res.json({
    total: assignments.length,
    assignments: assignments.map(a => ({
      dept_id: a.dept_id,
      brain_name: a.brain_name,
      model: a.model,
      temperature: a.temperature,
      timeout_ms: a.timeout_ms,
    })),
  });
});

// GET /api/company-os/brains/verify — verify all brains are online
router.get('/brains/verify', async (_req: Request, res: Response) => {
  const assignments = listBrainAssignments();
  const results = await Promise.all(
    assignments.map(async a => ({
      dept_id: a.dept_id,
      model: a.model,
      online: await verifyBrain(a),
    }))
  );
  const allOnline = results.every(r => r.online);
  return res.json({ all_online: allOnline, results });
});

// GET /api/company-os/tools/:dept_id — tools for a department
router.get('/tools/:dept_id', (req: Request, res: Response) => {
  const tools = getToolsForDept(req.params.dept_id);
  return res.json({
    dept_id: req.params.dept_id,
    tool_count: tools.length,
    tools: tools.map(t => ({ id: t.id, name: t.name, description: t.description })),
  });
});

// POST /api/company-os/departments/:id/health — check brain + tools for one dept
router.get('/departments/:id/health', async (req: Request, res: Response) => {
  const deptId = req.params.id;
  const brainHealth = await checkBrainHealth(deptId);
  const tools = getToolsForDept(deptId);
  return res.json({
    dept_id: deptId,
    brain: brainHealth,
    tool_count: tools.length,
    tools: tools.map(t => t.id),
    ready: brainHealth.online,
  });
});

// ── ASSET REGISTRY ENDPOINTS ─────────────────────────────────────────────────

// GET /api/company-os/assets — full company asset snapshot
router.get('/assets', (_req: Request, res: Response) => {
  return res.json({
    departments: { total: DEPARTMENTS.length, active: getActiveDepts().length },
    projects: { total: PROJECTS.length, active: getActiveProjects().length, critical: getCriticalProjects().length },
    services: { total: SERVICES.length, pm2: getPm2Services().length },
    data_sources: { total: DATA_SOURCES.length, missing_credentials: getMissingSources().length },
    summary: {
      projects: getProjectSummary(),
      services: getServicesSummary(),
      sources: dataSourceSummary(),
    },
  });
});

// GET /api/company-os/projects — project registry
router.get('/projects', (_req: Request, res: Response) => {
  return res.json({
    total: PROJECTS.length,
    active: getActiveProjects().length,
    critical: getCriticalProjects(),
    projects: PROJECTS,
  });
});

// GET /api/company-os/projects/:id — single project
router.get('/projects/:id', (req: Request, res: Response) => {
  const p = PROJECTS.find(p => p.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  const services = getServicesByDept(p.owner_dept);
  const sources = getSourcesByDept(p.owner_dept);
  return res.json({ project: p, services, sources });
});

// GET /api/company-os/services — service registry
router.get('/services', (_req: Request, res: Response) => {
  return res.json({ total: SERVICES.length, services: SERVICES, summary: getServicesSummary() });
});

// GET /api/company-os/services/health — live health check all services
router.get('/services/health', async (_req: Request, res: Response) => {
  const results = await checkAllServicesHealth();
  const healthy = results.filter(r => r.healthy).length;
  return res.json({ total: results.length, healthy, unhealthy: results.length - healthy, results });
});

// GET /api/company-os/services/:id/health — single service health
router.get('/services/:id/health', async (req: Request, res: Response) => {
  const result = await checkServiceHealth(req.params.id);
  return res.status(result.healthy ? 200 : 503).json(result);
});

// GET /api/company-os/sources — data source registry
router.get('/data-sources', (_req: Request, res: Response) => {
  return res.json({ total: DATA_SOURCES.length, sources: DATA_SOURCES, summary: dataSourceSummary() });
});

// ── MONEY OPERATIONS — Phase 7 ───────────────────────────────────────────────

// POST /api/company-os/money/:workflow_id — run a specific money workflow
router.post('/money/:workflow_id', async (req: Request, res: Response) => {
  const workflowId = req.params.workflow_id as MoneyWorkflowId;
  try {
    const result = await runMoneyWorkflow(workflowId);
    return res.status(result.status === 'FAIL' ? 500 : 200).json({
      result,
      ceo_message: formatMoneyResultForCeo(result),
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: `Money workflow error: ${err instanceof Error ? err.message : String(err)}` });
  }
});

// GET /api/company-os/money — run all 6 money workflows
router.get('/money', async (_req: Request, res: Response) => {
  const results = await runAllMoneyWorkflows();
  const pass    = results.filter(r => r.status === 'PASS').length;
  const pending = results.filter(r => r.status === 'PENDING_APPROVAL').length;
  const fail    = results.filter(r => r.status === 'FAIL').length;
  const missing = results.filter(r => r.status === 'DATA_MISSING').length;
  return res.json({
    summary: { pass, pending_approval: pending, fail, data_missing: missing },
    results,
    ceo_messages: results.map(formatMoneyResultForCeo),
  });
});

// ── SELF-HEALING MONITOR — Phase 12 ─────────────────────────────────────────

// GET /api/company-os/monitor — run health scan of all 11 services
router.get('/monitor', async (_req: Request, res: Response) => {
  const results = await runHealthScan();
  const healthy  = results.filter(r => r.healthy).length;
  const down     = results.filter(r => !r.healthy);
  return res.json({
    status: down.length === 0 ? 'ALL_HEALTHY' : 'DEGRADED',
    healthy, down: down.length, total: results.length,
    services: results,
    monitored_config: getMonitoredServices().map(s => ({ id: s.id, name: s.name, type: s.type, critical: s.critical })),
  });
});

// GET /api/company-os/health — system health
router.get('/health', (_req: Request, res: Response) => {
  const activeDepts = getActiveDepts();
  const brainAssignments = listBrainAssignments();
  return res.json({
    status: 'OK',
    version: '2.0.0',
    phase: 2,
    departments: { total: DEPARTMENTS.length, active: activeDepts.length },
    brains: { configured: brainAssignments.length },
    pipeline: 'WORKING_DEPARTMENTS_READY',
    qa: 'INDEPENDENT',
    evidence: 'SQLITE_WAL',
    certification_target: 'WORKING_DEPARTMENTS_READY',
  });
});

export default router;
