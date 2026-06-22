/**
 * /api/doordash-agent — MI package distribution for DoorDash Agent runtimes.
 *
 * GET  /api/doordash-agent/package/latest        — latest MI package (agent polls this)
 * GET  /api/doordash-agent/package/:version       — specific version
 * GET  /api/doordash-agent/package/versions       — list all versions
 * POST /api/doordash-agent/package                — publish new package (CEO only)
 * POST /api/doordash-agent/machines/checkin       — agent reports sync event
 * GET  /api/doordash-agent/machines               — CEO: see all runtime machines
 * GET  /api/doordash-agent/machines/history       — CEO: full sync history
 */
import { Router, Request, Response } from 'express';
import {
  getLatestPackage, getPackage, listVersions, publishPackage,
  recordMachineSyncEvent, getMachineStates, getMachineSyncHistory,
  type MachineSyncEvent,
} from '../intelligence/doordash-package-service';

export const doordashAgentRouter = Router();

function requireAuth(req: Request, res: Response, next: Function): void {
  const apiKey = process.env.MI_CORE_API_KEY || '';
  const auth   = req.headers.authorization || '';
  if (!apiKey || auth === `Bearer ${apiKey}`) { next(); return; }
  res.status(401).json({ error: 'Unauthorized' });
}

// ── GET /api/doordash-agent/package/latest ────────────────────────────────────
doordashAgentRouter.get('/package/latest', (_req: Request, res: Response) => {
  const pkg = getLatestPackage();
  if (!pkg) { res.status(404).json({ error: 'No MI package published yet' }); return; }
  res.json(pkg);
});

// ── GET /api/doordash-agent/package/versions ─────────────────────────────────
doordashAgentRouter.get('/package/versions', (_req: Request, res: Response) => {
  res.json({ versions: listVersions() });
});

// ── GET /api/doordash-agent/package/:version ──────────────────────────────────
doordashAgentRouter.get('/package/:version', (req: Request, res: Response) => {
  const pkg = getPackage(req.params.version);
  if (!pkg) { res.status(404).json({ error: `Version ${req.params.version} not found` }); return; }
  res.json(pkg);
});

// ── POST /api/doordash-agent/package ─────────────────────────────────────────
doordashAgentRouter.post('/package', requireAuth, (req: Request, res: Response) => {
  const body = req.body;
  if (!body.mi_version) { res.status(400).json({ error: 'mi_version required' }); return; }
  const result = publishPackage(body);
  res.json(result);
});

// ── POST /api/doordash-agent/machines/checkin ────────────────────────────────
doordashAgentRouter.post('/machines/checkin', (req: Request, res: Response) => {
  const event = req.body as MachineSyncEvent;
  if (!event.machine_id || !event.event_type) {
    res.status(400).json({ error: 'machine_id and event_type required' });
    return;
  }
  event.timestamp = event.timestamp || new Date().toISOString();
  recordMachineSyncEvent(event);
  res.json({ ok: true });
});

// ── GET /api/doordash-agent/machines ─────────────────────────────────────────
doordashAgentRouter.get('/machines', requireAuth, (_req: Request, res: Response) => {
  res.json(getMachineStates());
});

// ── GET /api/doordash-agent/machines/history ─────────────────────────────────
doordashAgentRouter.get('/machines/history', requireAuth, (req: Request, res: Response) => {
  const { machine_id, limit } = req.query as Record<string, string>;
  res.json(getMachineSyncHistory(machine_id, limit ? parseInt(limit) : 50));
});
