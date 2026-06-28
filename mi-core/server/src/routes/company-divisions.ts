/**
 * Company Divisions Route — exposes the Phase 5–9 division engines.
 *
 *   Phase 5 — IT Operations          (/api/divisions/it)
 *   Phase 6 — Creative Division      (/api/divisions/creative)
 *   Phase 7 — Company Data Platform  (/api/divisions/data-platform)
 *   Phase 8 — Company Intelligence   (/api/divisions/intelligence)
 *   Phase 9 — Company Autonomy       (/api/divisions/autonomy)
 *
 * Each division already ships a deterministic dashboard + bootstrap (which
 * registers an objective + task + evidence via Executive Coordination). This
 * router makes them reachable over HTTP — read-only dashboards plus an explicit
 * bootstrap action. No production system is touched.
 */

import { Router, Request, Response } from 'express';
import { buildITDashboard, runITOperationsBootstrap } from '../it-operations';
import { buildCreativeDashboard, runCreativeBootstrap } from '../creative-division';
import { buildDataPlatformDashboard, runDataPlatformBootstrap } from '../company-data-platform';
import {
  buildIntelligenceDashboard,
  answerCrossDivisionQuestion,
  runIntelligenceBootstrap,
} from '../company-intelligence';
import { buildAutonomyDashboard, runAutonomyBootstrap } from '../company-autonomy';

export const companyDivisionsRouter = Router();

// ── Division registry (single source of truth for the overview) ───────────────
const DIVISIONS = {
  it: { phase: 5, name: 'IT Operations', dashboard: buildITDashboard, bootstrap: runITOperationsBootstrap },
  creative: { phase: 6, name: 'Creative Division', dashboard: buildCreativeDashboard, bootstrap: runCreativeBootstrap },
  'data-platform': { phase: 7, name: 'Company Data Platform', dashboard: buildDataPlatformDashboard, bootstrap: runDataPlatformBootstrap },
  intelligence: { phase: 8, name: 'Company Intelligence', dashboard: buildIntelligenceDashboard, bootstrap: runIntelligenceBootstrap },
  autonomy: { phase: 9, name: 'Company Autonomy', dashboard: buildAutonomyDashboard, bootstrap: runAutonomyBootstrap },
} as const;

type DivisionKey = keyof typeof DIVISIONS;

function isDivision(key: string): key is DivisionKey {
  return Object.prototype.hasOwnProperty.call(DIVISIONS, key);
}

// ── Overview: one call, every division's headline status ──────────────────────
companyDivisionsRouter.get('/', (_req: Request, res: Response) => {
  const divisions = (Object.keys(DIVISIONS) as DivisionKey[]).map((key) => {
    const d = DIVISIONS[key];
    const dash = d.dashboard() as { status: string; warnings?: string[] };
    return {
      key,
      phase: d.phase,
      name: d.name,
      status: dash.status,
      warnings: dash.warnings?.length ?? 0,
    };
  });
  res.json({
    track: 'Company OS — Phase 5–9 Divisions',
    count: divisions.length,
    divisions,
  });
});

// ── Cross-division intelligence question (Phase 8) ────────────────────────────
companyDivisionsRouter.get('/intelligence/ask', (req: Request, res: Response) => {
  const question = String(req.query.q || '').trim();
  if (!question) return res.status(400).json({ error: 'query param q (question) is required' });
  return res.json(answerCrossDivisionQuestion(question));
});

// ── Per-division dashboard ────────────────────────────────────────────────────
companyDivisionsRouter.get('/:division', (req: Request, res: Response) => {
  const key = req.params.division;
  if (!isDivision(key)) {
    return res.status(404).json({ error: `Unknown division '${key}'`, available: Object.keys(DIVISIONS) });
  }
  const d = DIVISIONS[key];
  return res.json({ phase: d.phase, name: d.name, ...d.dashboard() });
});

// ── Explicit bootstrap (registers objective + task + evidence) ────────────────
companyDivisionsRouter.post('/:division/bootstrap', (req: Request, res: Response) => {
  const key = req.params.division;
  if (!isDivision(key)) {
    return res.status(404).json({ error: `Unknown division '${key}'`, available: Object.keys(DIVISIONS) });
  }
  const d = DIVISIONS[key];
  return res.json({ phase: d.phase, name: d.name, ...d.bootstrap() });
});
