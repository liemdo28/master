/**
 * Graph API Routes — Phase 14.6
 *
 * GET /api/graph/project/:id        — full project profile (ownership + deps + risks)
 * GET /api/graph/dependencies/:id   — dependency tree (upstream + downstream)
 * GET /api/graph/ownership/:id      — ownership info for an entity
 * GET /api/graph/risks/:id          — risk chain simulation
 * GET /api/graph/impact/:id         — impact analysis if entity fails
 * GET /api/graph/spof               — single points of failure
 * GET /api/graph/summary            — ownership summary
 * GET /api/graph/system-risk        — full system risk report
 * GET /api/graph/search             — search entities by name
 * GET /api/graph/stats              — graph statistics
 */

import { Router, Request, Response } from 'express';
import { seedGraph } from './graph-seed';
import { getEntity, findEntities, getGraphStats } from './graph-db';
import { getOwnership, findUnownedEntities } from './ownership-graph';
import { getDependencyTree, analyzeImpact, findCriticalPaths } from './dependency-intelligence';
import { simulateFailure, generateSystemRiskReport } from './risk-propagation';
import { whoOwns, getOwnerWorkload, findOverloadedOwners, getBlockerOwnership, getOwnershipSummary } from './ownership-intelligence';
import { analyzeFileImpact, getDashboardImpactFiles, syncCodegraph } from './codegraph-intelligence';

// Seed the graph on first import
seedGraph();

export const graphRouter = Router();

const API_KEY = process.env.MI_CORE_API_KEY || '';

function requireKey(req: Request, res: Response, next: () => void) {
  if (!API_KEY) return res.status(503).json({ error: 'Server not configured — MI_CORE_API_KEY missing' });
  const key = (req.headers['x-api-key'] as string) || (req.query['api_key'] as string) || '';
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function handle(res: Response, fn: () => unknown) {
  try {
    const result = fn();
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (e: any) {
    res.status(404).json({ success: false, error: e.message });
  }
}

// ── Entity resolution helper ───────────────────────────────────────────────────
// Accepts ID (project:dashboard) or partial name (dashboard, mi-core)
function resolveEntityId(idOrName: string): string {
  // Try direct lookup first
  if (getEntity(idOrName)) return idOrName;

  // Try prefixed variants
  const prefixes = ['project:', 'service:', 'owner:', 'team:', 'store:', 'repo:'];
  for (const prefix of prefixes) {
    const candidate = `${prefix}${idOrName}`;
    if (getEntity(candidate)) return candidate;
  }

  // Try name search
  const matches = findEntities(undefined, idOrName);
  if (matches.length > 0) return matches[0].id;

  throw new Error(`Entity not found: ${idOrName}`);
}

// ── Routes ─────────────────────────────────────────────────────────────────────

// GET /api/graph/project/:id — full project context
graphRouter.get('/project/:id', requireKey, (req: Request, res: Response) => {
  handle(res, () => {
    const id = resolveEntityId(req.params.id);
    const entity = getEntity(id)!;
    const ownership = getOwnership(id);
    const deps = getDependencyTree(id);
    const impact = analyzeImpact(id);
    return { entity, ownership, dependencies: deps, impact };
  });
});

// GET /api/graph/dependencies/:id — dependency tree
graphRouter.get('/dependencies/:id', requireKey, (req: Request, res: Response) => {
  handle(res, () => getDependencyTree(resolveEntityId(req.params.id)));
});

// GET /api/graph/ownership/:id — ownership info
graphRouter.get('/ownership/:id', requireKey, (req: Request, res: Response) => {
  handle(res, () => whoOwns(resolveEntityId(req.params.id)));
});

// GET /api/graph/risks/:id — risk propagation chain
graphRouter.get('/risks/:id', requireKey, (req: Request, res: Response) => {
  handle(res, () => {
    const severity = (req.query.severity as string) || 'OFFLINE';
    return simulateFailure(resolveEntityId(req.params.id), severity as any);
  });
});

// GET /api/graph/impact/:id — impact analysis
graphRouter.get('/impact/:id', requireKey, (req: Request, res: Response) => {
  handle(res, () => analyzeImpact(resolveEntityId(req.params.id)));
});

// GET /api/graph/spof — single points of failure
graphRouter.get('/spof', requireKey, (_req: Request, res: Response) => {
  handle(res, () => findCriticalPaths().filter(c => c.is_spof));
});

// GET /api/graph/summary — ownership summary
graphRouter.get('/summary', requireKey, (_req: Request, res: Response) => {
  handle(res, () => getOwnershipSummary());
});

// GET /api/graph/system-risk — full system risk report
graphRouter.get('/system-risk', requireKey, (_req: Request, res: Response) => {
  handle(res, () => generateSystemRiskReport());
});

// GET /api/graph/search?q=name — entity search
graphRouter.get('/search', requireKey, (req: Request, res: Response) => {
  handle(res, () => {
    const q = (req.query.q as string) || '';
    return findEntities(undefined, q);
  });
});

// GET /api/graph/stats — graph statistics
graphRouter.get('/stats', requireKey, (_req: Request, res: Response) => {
  handle(res, () => getGraphStats());
});

// GET /api/graph/codegraph/sync — scan code and upsert into existing graph
graphRouter.get('/codegraph/sync', requireKey, (_req: Request, res: Response) => {
  handle(res, () => syncCodegraph());
});

// GET /api/graph/codegraph/dashboard-impact — files likely affecting Dashboard
graphRouter.get('/codegraph/dashboard-impact', requireKey, (req: Request, res: Response) => {
  handle(res, () => getDashboardImpactFiles(parseInt(String(req.query.limit || '20'), 10)));
});

// GET /api/graph/codegraph/file-impact?path=server/src/routes/chat.ts
graphRouter.get('/codegraph/file-impact', requireKey, (req: Request, res: Response) => {
  handle(res, () => {
    const p = String(req.query.path || '');
    if (!p) throw new Error('Missing path query');
    const result = analyzeFileImpact(p);
    if (!result) throw new Error(`File not found in codegraph: ${p}`);
    return result;
  });
});

// GET /api/graph/owner/:id/workload — owner workload
graphRouter.get('/owner/:id/workload', requireKey, (req: Request, res: Response) => {
  handle(res, () => getOwnerWorkload(resolveEntityId(req.params.id)));
});

// GET /api/graph/blocker/:id — who owns this blocker
graphRouter.get('/blocker/:id', requireKey, (req: Request, res: Response) => {
  handle(res, () => getBlockerOwnership(resolveEntityId(req.params.id)));
});
