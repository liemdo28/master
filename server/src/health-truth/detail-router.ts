/**
 * Phase 7B — authenticated detailed health routes.
 *
 * `healthDetailRouter` is mounted at both `/api/command-center`
 * (requireRemoteAuth, matching the Command Center's own auth boundary, per
 * the dual-mount convention already used by every other Command
 * Center-facing router) and `/api` (requireTaskRuntimeAuth, for direct
 * API-key consumers):
 *   GET /health/detail        — full structured model.
 *   GET /health/dependencies  — dependencies array only.
 *
 * Split into its own file (one router per file) so the authority-control-plane
 * scanner's per-file route discovery cannot attribute `public-router.ts`'s
 * `/api/health` route to this router, or vice versa.
 *
 * No route here starts, stops, restarts, or mutates anything.
 */
import { Router, Request, Response } from 'express';
import { getSystemHealth } from './aggregate';

export const healthDetailRouter = Router();

// GET /health/detail — full structured model. Auth is applied by whichever
// index.ts mount is used (requireRemoteAuth for Command Center, requireTaskRuntimeAuth
// for direct API-key callers) — this router assumes it is never mounted publicly.
healthDetailRouter.get('/health/detail', async (_req: Request, res: Response) => {
  const health = await getSystemHealth();
  res.json(health);
});

// GET /health/dependencies — dependencies array only.
healthDetailRouter.get('/health/dependencies', async (_req: Request, res: Response) => {
  const health = await getSystemHealth();
  res.json({ generatedAt: health.generatedAt, dependencies: health.dependencies });
});
