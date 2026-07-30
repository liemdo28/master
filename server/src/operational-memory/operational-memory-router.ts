/**
 * Operational Memory REST Router — Phase 15.6
 *
 * GET /api/memory/incidents             — list/search incidents
 * GET /api/memory/incidents/:target     — incident history for a project
 * GET /api/memory/executions            — list executions
 * GET /api/memory/executions/:project   — execution stats for a project
 * GET /api/memory/owners                — owner activity ranking
 * GET /api/memory/owners/:role          — profile for a specific owner/role
 * GET /api/memory/trends                — system-wide trend snapshot
 * GET /api/memory/trends/:project       — trend for a specific project
 * GET /api/memory/history               — full operational history summary
 * POST /api/memory/sync                 — trigger memory sync from ledger
 */

import { Router, Request, Response } from 'express';
import { syncMemory, getMemoryStats } from './operational-memory-db';
import { getIncidentHistory, listIncidents, getTopIncidentProjects } from './incident-memory';
import { getProjectExecutionStats, listExecutions, getBestWorkflows, getExecutionCountByProject } from './execution-memory';
import { getOwnerProfile, getOwnerActivityRanking, getOverloadedOwners, getResolutionSpeedRanking } from './owner-memory';
import { getPeriodStats, getTrend, getTopBlockerProjectsRaw, getSystemHealthSnapshot } from './temporal-intelligence';

export const operationalMemoryRouter = Router();

function ok(res: Response, data: unknown) {
  res.json({ success: true, data, timestamp: new Date().toISOString() });
}
function err(res: Response, message: string, status = 400) {
  res.status(status).json({ success: false, error: message });
}

// ── Sync ──────────────────────────────────────────────────────────────────────

operationalMemoryRouter.post('/sync', (_req: Request, res: Response) => {
  try {
    const result = syncMemory();
    ok(res, { ...result, stats: getMemoryStats() });
  } catch (e: any) {
    err(res, e.message, 500);
  }
});

// ── Incidents ─────────────────────────────────────────────────────────────────

operationalMemoryRouter.get('/incidents', (req: Request, res: Response) => {
  try {
    const { target, role, from, limit } = req.query as Record<string, string>;
    if (target) {
      ok(res, getIncidentHistory(target));
    } else {
      const incidents = listIncidents({
        agent_role: role,
        from_date: from,
        limit: limit ? parseInt(limit) : 50,
      });
      const topProjects = getTopIncidentProjects(90, 10);
      ok(res, { incidents, top_incident_projects: topProjects });
    }
  } catch (e: any) { err(res, e.message, 500); }
});

operationalMemoryRouter.get('/incidents/:target', (req: Request, res: Response) => {
  try {
    ok(res, getIncidentHistory(req.params.target));
  } catch (e: any) { err(res, e.message, 500); }
});

// ── Executions ────────────────────────────────────────────────────────────────

operationalMemoryRouter.get('/executions', (req: Request, res: Response) => {
  try {
    const { project, intent, verdict, from, limit } = req.query as Record<string, string>;
    if (project) {
      ok(res, getProjectExecutionStats(project));
    } else {
      const executions = listExecutions({
        target_project: project,
        intent, verdict,
        from_date: from,
        limit: limit ? parseInt(limit) : 50,
      });
      const byProject = getExecutionCountByProject();
      const bestWorkflows = getBestWorkflows(5);
      ok(res, { executions, by_project: byProject, best_workflows: bestWorkflows });
    }
  } catch (e: any) { err(res, e.message, 500); }
});

operationalMemoryRouter.get('/executions/:project', (req: Request, res: Response) => {
  try {
    ok(res, getProjectExecutionStats(req.params.project));
  } catch (e: any) { err(res, e.message, 500); }
});

// ── Owners ────────────────────────────────────────────────────────────────────

operationalMemoryRouter.get('/owners', (req: Request, res: Response) => {
  try {
    const { days } = req.query as Record<string, string>;
    const ranking = getOwnerActivityRanking(days ? parseInt(days) : 30);
    const overloaded = getOverloadedOwners(50);
    const speed = getResolutionSpeedRanking();
    ok(res, { activity_ranking: ranking, overloaded, resolution_speed: speed });
  } catch (e: any) { err(res, e.message, 500); }
});

operationalMemoryRouter.get('/owners/:role', (req: Request, res: Response) => {
  try {
    ok(res, getOwnerProfile(req.params.role));
  } catch (e: any) { err(res, e.message, 500); }
});

// ── Trends ────────────────────────────────────────────────────────────────────

operationalMemoryRouter.get('/trends', (req: Request, res: Response) => {
  try {
    const { period } = req.query as Record<string, string>;
    const p = (period || 'quarter') as any;
    const validPeriods = ['week', 'month', 'quarter'];
    if (!validPeriods.includes(p)) return err(res, 'period must be week|month|quarter');

    const stats = getPeriodStats(p);
    const snapshot = getSystemHealthSnapshot();
    const topBlockers = getTopBlockerProjectsRaw(p === 'week' ? 7 : p === 'month' ? 30 : 90, 10);
    ok(res, { period: p, period_stats: stats, system_snapshot: snapshot, top_blockers: topBlockers });
  } catch (e: any) { err(res, e.message, 500); }
});

operationalMemoryRouter.get('/trends/:project', (req: Request, res: Response) => {
  try {
    ok(res, getTrend(req.params.project));
  } catch (e: any) { err(res, e.message, 500); }
});

// ── History ───────────────────────────────────────────────────────────────────

operationalMemoryRouter.get('/history', (_req: Request, res: Response) => {
  try {
    const stats = getMemoryStats();
    const snapshot = getSystemHealthSnapshot();
    const topBlockers90 = getTopBlockerProjectsRaw(90, 10);
    const byProject = getExecutionCountByProject();
    const ranking = getOwnerActivityRanking(90);

    ok(res, {
      memory_stats: stats,
      system_health: snapshot,
      top_blocker_projects_90d: topBlockers90,
      executions_by_project: byProject,
      owner_activity_90d: ranking,
    });
  } catch (e: any) { err(res, e.message, 500); }
});
