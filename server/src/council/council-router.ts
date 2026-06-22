/**
 * Multi-Agent Council Router — Phase 21
 *
 * POST /api/council/session  — run a council session {request, agents?}
 * GET  /api/council/agents   — list all agents + their concerns
 */

import { Router, Request, Response } from 'express';
import { runCouncilSession, needsCouncil, AGENT_PROFILES } from './multi-agent-council';

// Export AGENT_PROFILES for router use
const PROFILES: Record<string, { name_vi: string }> = {
  pm: { name_vi: 'PM Agent' }, qa: { name_vi: 'QA Agent' }, dev: { name_vi: 'Dev Agent' },
  security: { name_vi: 'Security Agent' }, ops: { name_vi: 'Ops Agent' }, knowledge: { name_vi: 'Knowledge Agent' },
};

export const councilRouter = Router();

function ok(res: Response, data: unknown) {
  res.json({ success: true, data, timestamp: new Date().toISOString() });
}

councilRouter.post('/session', (req: Request, res: Response) => {
  const { request, agents } = req.body || {};
  if (!request) return res.status(400).json({ success: false, error: 'body.request required' });
  const skipCouncil = !needsCouncil(request);
  if (skipCouncil) {
    return ok(res, { skipped: true, reason: 'Simple read-only task — no council needed', consensus: 'PROCEED', confidence: 100 });
  }
  ok(res, runCouncilSession(request, agents));
});

councilRouter.get('/agents', (_req: Request, res: Response) => {
  ok(res, Object.entries(PROFILES).map(([id, p]) => ({ id, ...p })));
});
