/**
 * Phase 7B — public health liveness route.
 *
 * Mounted at `/api/health` only:
 *   GET /api/health — public, unchanged legacy shape (+ one cheap `overall`
 *   field computed only from the two dependencies this route already
 *   probes; no authority-manifest scan or DB check here — that stays behind
 *   auth, see `detail-router.ts`).
 *
 * Split into its own file (one router per file) so the authority-control-plane
 * scanner's per-file route discovery cannot attribute `detail-router.ts`'s
 * routes to this mount, or vice versa.
 *
 * No route here starts, stops, restarts, or mutates anything.
 */
import { Router, Request, Response } from 'express';

export const healthPublicRouter = Router();

const AI_SERVICE_URL = () => process.env.AI_SERVICE_URL || 'http://localhost:4002';
const OLLAMA_URL = () => process.env.OLLAMA_URL || 'http://localhost:11434';

async function probeOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

// GET /api/health — public liveness, backward-compatible shape preserved
// byte-for-byte (server/python_ai_service/ollama/timestamp), plus a cheap
// `overall` summary. The original handler had no timeout on either fetch —
// a hung dependency could hang this request forever; both probes here now
// use the same 5s AbortSignal.timeout pattern already used elsewhere in this
// codebase (self-healing-monitor.ts, ollama-router.ts, etc.).
healthPublicRouter.get('/', async (_req: Request, res: Response) => {
  const [aiOk, ollamaOk] = await Promise.all([
    probeOk(`${AI_SERVICE_URL()}/health`),
    probeOk(`${OLLAMA_URL()}/api/tags`),
  ]);
  // CORE is always healthy here (this handler executing is proof); PYTHON_AI is
  // FEATURE_SCOPED (no canonical path depends on it); LOCAL_MODEL is
  // OPTIONAL_DEGRADED — so this cheap summary can only ever be HEALTHY or
  // DEGRADED, never UNAVAILABLE/BLOCKED, matching the full model's own
  // criticality rules without needing to run the expensive checks here.
  const overall = ollamaOk && aiOk ? 'HEALTHY' : 'DEGRADED';

  res.json({
    server: 'ok',
    python_ai_service: aiOk ? 'ok' : 'down',
    ollama: ollamaOk ? 'ok' : 'down',
    timestamp: new Date().toISOString(),
    overall,
  });
});
