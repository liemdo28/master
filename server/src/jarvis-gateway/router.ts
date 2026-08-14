/**
 * Phase 7C — canonical Jarvis Gateway HTTP surface (directive §30).
 *
 * `jarvisGatewayRouter` is mounted twice in index.ts, matching the dual-mount
 * convention every other Command-Center/API-key-gated router in this codebase
 * uses (see automation-simulation/router.ts, health-truth/detail-router.ts):
 *   - `/api/command-center` behind `requireRemoteAuth` (Command Center's PIN session)
 *   - `/api` behind `requireTaskRuntimeAuth` (raw API key)
 * No generic `/execute` route exists (§30) — only `/jarvis/request`.
 */
import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { handleGatewayRequest } from './gateway';
import { getRequest } from './request-store';
import { peekSession } from './session-store';
import { resolveSessionId } from './session-resolver';
import type { CallerIdentity, RequestType } from './types';

export const jarvisGatewayJsonParser = express.json({ limit: '64kb' });

export const jarvisGatewayRouter = Router();

const VALID_REQUEST_TYPES = new Set<RequestType>([
  'INFORMATION', 'KNOWLEDGE_SEARCH', 'TASK_QUERY', 'PROJECT_QUERY', 'GOAL_QUERY',
  'PLANNING', 'SIMULATION', 'ACTION_PROPOSAL', 'CODING', 'SYSTEM_STATUS', 'OPERATOR_QUERY',
]);
const MAX_TEXT_LENGTH = 4000;

function callerIdentity(req: Request): CallerIdentity {
  const deviceId = (req as Request & { device_id?: string }).device_id;
  return deviceId ? { source: 'remote_session', deviceId } : { source: 'api_key' };
}

export function jarvisGatewayJsonErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    res.status(400).json({ error: 'Malformed JSON body' });
    return;
  }
  next(err);
}

const MAX_SESSION_ID_LENGTH = 128;

jarvisGatewayRouter.post('/jarvis/request', async (req: Request, res: Response) => {
  const body = req.body as { text?: unknown; projectId?: unknown; requestType?: unknown; sessionId?: unknown };

  if (typeof body?.text !== 'string' || body.text.trim().length === 0) {
    res.status(400).json({ error: 'text is required and must be a non-empty string' });
    return;
  }
  if (body.text.length > MAX_TEXT_LENGTH) {
    res.status(400).json({ error: `text must be at most ${MAX_TEXT_LENGTH} characters` });
    return;
  }
  if (body.projectId !== undefined && body.projectId !== null && typeof body.projectId !== 'string') {
    res.status(400).json({ error: 'projectId must be a string or null' });
    return;
  }
  if (body.requestType !== undefined && !VALID_REQUEST_TYPES.has(body.requestType as RequestType)) {
    res.status(400).json({ error: 'requestType, if provided, must be one of the known request types' });
    return;
  }
  if (body.sessionId !== undefined && (typeof body.sessionId !== 'string' || body.sessionId.length > MAX_SESSION_ID_LENGTH)) {
    res.status(400).json({ error: `sessionId, if provided, must be a string of at most ${MAX_SESSION_ID_LENGTH} characters` });
    return;
  }

  try {
    const response = await handleGatewayRequest(
      {
        text: body.text,
        projectId: body.projectId as string | null | undefined,
        requestType: body.requestType as RequestType | undefined,
        sessionId: body.sessionId as string | undefined,
      },
      callerIdentity(req),
    );
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: 'Internal error handling Jarvis request', detail: err instanceof Error ? err.message : undefined });
  }
});

jarvisGatewayRouter.get('/jarvis/request/:id', (req: Request, res: Response) => {
  const entry = getRequest(req.params.id);
  if (!entry) {
    res.status(404).json({ error: 'Request not found (expired or never existed)' });
    return;
  }
  res.json(entry.response);
});

// No `:id` path param on purpose — a caller can only ever read the session
// that resolveSessionId() derives from ITS OWN identity (server-computed
// device_id for remote_session, or its own explicit sessionId query param
// for api_key), never an arbitrary session by guessing another caller's key.
// This is the read counterpart to POST's session resolution — same function,
// same rules, so there is no second, divergent access-control path to audit.
jarvisGatewayRouter.get('/jarvis/session/current', (req: Request, res: Response) => {
  const explicitSessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;
  const sessionId = resolveSessionId(callerIdentity(req), explicitSessionId);
  if (!sessionId) {
    res.status(404).json({ error: 'No session identity resolvable for this caller (remote_session callers always have one; api_key callers must pass ?sessionId=)' });
    return;
  }
  const session = peekSession(sessionId);
  if (!session) {
    res.status(404).json({ error: 'No session found (never created, or expired)' });
    return;
  }
  res.json(session);
});
