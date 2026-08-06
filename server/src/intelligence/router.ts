/**
 * Phase 5C API — read-only.
 *
 * There is no route here that mutates Gmail or Calendar. The POST routes generate Mi's
 * own derived records locally; they never call a provider write. Auth, rate limiting
 * and the IP guard are applied at the mount point in index.ts, as with Personal OS.
 */

import express, { Router } from 'express';
import { assertPlainPayload } from '../personal-os/store';
import { IntelligenceService } from './service';
import { GoogleReadClient, inspectToken } from './google-read-client';
import { createFixtureTransport, createLiveTransport, defaultTokenFile } from './transports';
import { today, weekStartOf } from './service';

export const intelligenceJsonParser = express.json({ limit: '1mb' });

const router = Router();

function buildService(): IntelligenceService {
  const tokenState = inspectToken();
  // With no usable credential the connector reports NOT_CONFIGURED rather than
  // fabricating data; a fixture transport keeps the shape identical for callers.
  const transport = tokenState.status === 'READY'
    ? createLiveTransport(defaultTokenFile())
    : createFixtureTransport({});
  return new IntelligenceService({ capabilities: new GoogleReadClient(transport, tokenState) });
}

async function withService<T>(fn: (service: IntelligenceService) => Promise<T> | T): Promise<T> {
  const service = buildService();
  try { return await fn(service); } finally { service.close(); }
}

function handleError(res: express.Response, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const status = /not found/i.test(message) ? 404 : /invalid|must be|required/i.test(message) ? 400 : 400;
  // Provider payloads and tokens never reach the client.
  res.status(status).json({ error: message.slice(0, 200) });
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

router.get('/intelligence/status', async (_req, res) => {
  try {
    const state = inspectToken();
    // Scope names are configuration, not secrets; no token value is included.
    res.json({ status: state.status, detail: state.detail, grantedScopes: state.grantedScopes });
  } catch (err) { handleError(res, err); }
});

router.get('/intelligence/calendar/events', async (req, res) => {
  try {
    const timeMin = typeof req.query.timeMin === 'string' ? req.query.timeMin : `${today()}T00:00:00.000Z`;
    const timeMax = typeof req.query.timeMax === 'string' ? req.query.timeMax : `${today()}T23:59:59.999Z`;
    const events = await withService(s => s.calendarEvents(timeMin, timeMax));
    res.json({ events });
  } catch (err) { handleError(res, err); }
});

router.get('/intelligence/calendar/today', async (_req, res) => {
  try {
    const date = today();
    const events = await withService(s => s.calendarEvents(`${date}T00:00:00.000Z`, `${date}T23:59:59.999Z`));
    res.json({ date, events });
  } catch (err) { handleError(res, err); }
});

router.get('/intelligence/calendar/week', async (_req, res) => {
  try {
    const start = weekStartOf(today());
    const end = new Date(`${start}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 7);
    const events = await withService(s => s.calendarEvents(`${start}T00:00:00.000Z`, end.toISOString()));
    res.json({ weekStart: start, events });
  } catch (err) { handleError(res, err); }
});

router.post('/intelligence/email/search', async (req, res) => {
  try {
    assertPlainPayload(req.body);
    const query = typeof req.body?.query === 'string' ? req.body.query : '';
    if (!query.trim()) return res.status(400).json({ error: 'query is required' });
    const maxResults = Number(req.body?.maxResults) || 10;
    const results = await withService(s => s.searchEmail(query, maxResults));
    return res.json({ results });
  } catch (err) { return handleError(res, err); }
});

router.get('/intelligence/email/thread/:id', async (req, res) => {
  try {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(req.params.id)) return res.status(400).json({ error: 'invalid thread id' });
    const messages = await withService(s => s.emailThread(req.params.id));
    if (!messages.length) return res.status(404).json({ error: 'thread not found' });
    return res.json({ threadId: req.params.id, messages });
  } catch (err) { return handleError(res, err); }
});

router.get('/intelligence/agenda/today', async (_req, res) => {
  try {
    const agenda = await withService(s => s.store.getAgendaByDate(today()));
    return agenda ? res.json(agenda) : res.status(404).json({ error: 'daily agenda not found' });
  } catch (err) { return handleError(res, err); }
});

router.post('/intelligence/agenda/generate', async (req, res) => {
  try {
    assertPlainPayload(req.body ?? {});
    const date = isIsoDate(req.body?.date) ? req.body.date : today();
    const agenda = await withService(s => s.generateDailyAgenda(date));
    return res.status(201).json(agenda);
  } catch (err) { return handleError(res, err); }
});

router.get('/intelligence/weekly-review', async (req, res) => {
  try {
    const weekStart = isIsoDate(req.query.weekStart) ? req.query.weekStart : weekStartOf(today());
    const review = await withService(s => s.store.getWeeklyReview(weekStart));
    return review ? res.json(review) : res.status(404).json({ error: 'weekly review not found' });
  } catch (err) { return handleError(res, err); }
});

router.post('/intelligence/weekly-review/generate', async (req, res) => {
  try {
    assertPlainPayload(req.body ?? {});
    const weekStart = isIsoDate(req.body?.weekStart) ? req.body.weekStart : weekStartOf(today());
    const review = await withService(s => s.generateWeeklyReview(weekStart));
    return res.status(201).json(review);
  } catch (err) { return handleError(res, err); }
});

router.get('/intelligence/follow-ups', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 50;
    const followUps = await withService(s => s.listFollowUps(limit));
    res.json({ followUps });
  } catch (err) { handleError(res, err); }
});

export const intelligenceRouter = router;
