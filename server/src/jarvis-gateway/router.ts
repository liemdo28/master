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
import { handleVoiceRequest, MAX_VOICE_TRANSCRIPT_LENGTH } from './voice/voice-gateway';
import type { VoiceSource } from './voice/types';
import { audioUpload, transcribeUploadedAudio, cleanupUploadedAudio } from './voice/audio-transcribe';
import { synthesizeVoiceOutput } from './voice/synthesize';

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

// Phase 7D — independent review of PR #103 noted GET /jarvis/request/:id
// (Phase 7C) had no caller-ownership check, and that Phase 7D increased
// what it exposes by adding `sessionId` to every stored JarvisResponse. A
// remote_session caller must only ever read back a request THEY created;
// api_key callers share fate the same way explicit sessions already do
// (there is no stronger per-api_key identity anywhere in this codebase —
// see PHASE7D_UNIFIED_CONTEXT.md).
function sameCaller(a: CallerIdentity, b: CallerIdentity): boolean {
  if (a.source !== b.source) return false;
  if (a.source === 'remote_session') return a.deviceId === b.deviceId;
  return true;
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
  // Same 404 for "not found" and "not yours" — never confirm existence of
  // a request id to a caller who isn't its creator.
  if (!entry || !sameCaller(callerIdentity(req), entry.request.caller)) {
    res.status(404).json({ error: 'Request not found (expired, never existed, or not owned by this caller)' });
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
  const rawSessionId = req.query.sessionId;
  if (rawSessionId !== undefined && (typeof rawSessionId !== 'string' || rawSessionId.length > MAX_SESSION_ID_LENGTH)) {
    res.status(400).json({ error: `sessionId, if provided, must be a string of at most ${MAX_SESSION_ID_LENGTH} characters` });
    return;
  }
  const explicitSessionId = typeof rawSessionId === 'string' ? rawSessionId : undefined;
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

// ── Phase 7F — Voice Experience, read/propose only ──────────────────────────
// Voice is a second input/output modality over this exact same Gateway —
// no separate router, no separate mount, no separate auth pattern. See
// docs/architecture/PHASE7F_VOICE_ARCHITECTURE.md.

const VALID_VOICE_SOURCES = new Set<VoiceSource>(['web_speech', 'server_stt', 'typed']);

jarvisGatewayRouter.post('/jarvis/voice/transcript', async (req: Request, res: Response) => {
  const body = req.body as {
    transcript?: unknown; sessionId?: unknown; projectId?: unknown; language?: unknown;
    confidence?: unknown; source?: unknown; capturedAt?: unknown; isWakeWordTriggered?: unknown;
  };

  if (typeof body?.transcript !== 'string' || body.transcript.trim().length === 0) {
    res.status(400).json({ error: 'transcript is required and must be a non-empty string' });
    return;
  }
  if (body.transcript.length > MAX_VOICE_TRANSCRIPT_LENGTH) {
    res.status(400).json({ error: `transcript must be at most ${MAX_VOICE_TRANSCRIPT_LENGTH} characters` });
    return;
  }
  if (typeof body.source !== 'string' || !VALID_VOICE_SOURCES.has(body.source as VoiceSource)) {
    res.status(400).json({ error: 'source is required and must be one of: web_speech, server_stt, typed' });
    return;
  }
  if (body.projectId !== undefined && body.projectId !== null && typeof body.projectId !== 'string') {
    res.status(400).json({ error: 'projectId must be a string or null' });
    return;
  }
  if (body.sessionId !== undefined && (typeof body.sessionId !== 'string' || body.sessionId.length > MAX_SESSION_ID_LENGTH)) {
    res.status(400).json({ error: `sessionId, if provided, must be a string of at most ${MAX_SESSION_ID_LENGTH} characters` });
    return;
  }
  if (body.confidence !== undefined && (typeof body.confidence !== 'number' || body.confidence < 0 || body.confidence > 1)) {
    res.status(400).json({ error: 'confidence, if provided, must be a number between 0 and 1' });
    return;
  }

  try {
    const response = await handleVoiceRequest(
      {
        transcript: body.transcript,
        sessionId: body.sessionId as string | undefined,
        projectId: body.projectId as string | null | undefined,
        language: typeof body.language === 'string' ? body.language : undefined,
        confidence: body.confidence as number | undefined,
        source: body.source as VoiceSource,
        capturedAt: typeof body.capturedAt === 'string' ? body.capturedAt : undefined,
        isWakeWordTriggered: body.isWakeWordTriggered === true,
      },
      callerIdentity(req),
    );
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: 'Internal error handling voice request', detail: err instanceof Error ? err.message : undefined });
  }
});

// Secondary, optional path for browsers without a usable client-side
// speech-recognition API — uploads audio, returns ONLY a transcript. Never
// calls handleVoiceRequest()/handleGatewayRequest() itself; the caller
// must show the transcript and let the user explicitly submit it via
// POST /jarvis/voice/transcript as a separate step (§22/§23).
jarvisGatewayRouter.post('/jarvis/voice/audio-transcribe', (req: Request, res: Response) => {
  audioUpload.single('audio')(req, res, async (uploadErr: unknown) => {
    if (uploadErr) {
      res.status(400).json({ error: uploadErr instanceof Error ? uploadErr.message : 'Audio upload failed' });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'audio file is required (multipart field "audio")' });
      return;
    }
    try {
      const result = await transcribeUploadedAudio(file.path);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Internal error transcribing audio', detail: err instanceof Error ? err.message : undefined });
    } finally {
      cleanupUploadedAudio(file.path);
    }
  });
});

jarvisGatewayRouter.post('/jarvis/voice/synthesize', async (req: Request, res: Response) => {
  const body = req.body as { text?: unknown };
  if (typeof body?.text !== 'string' || body.text.trim().length === 0) {
    res.status(400).json({ error: 'text is required and must be a non-empty string' });
    return;
  }
  try {
    const result = await synthesizeVoiceOutput(body.text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Internal error synthesizing speech', detail: err instanceof Error ? err.message : undefined });
  }
});
