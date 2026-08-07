import express, { Router } from 'express';
import { ControlledActionService } from './service';
import { assertPlainPayload } from './policy';
import type { ActionProposalStatus } from './types';

export const controlledActionsJsonParser = express.json({ limit: '1mb' });

const router = Router();
const actionIdPattern = /^action-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function withService<T>(fn: (service: ControlledActionService) => T): T {
  const service = new ControlledActionService();
  try { return fn(service); } finally { service.close(); }
}

function validActionId(id: string): boolean {
  return actionIdPattern.test(id);
}

function handleError(res: express.Response, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const status = /not found/i.test(message) ? 404 : /expired|mismatch|missing approval|forbidden|unsupported|not implemented/i.test(message) ? 409 : 400;
  res.status(status).json({ error: message });
}

router.get('/actions', (req, res) => withService(service => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status as ActionProposalStatus : undefined;
    res.json({ actions: service.list(status) });
  } catch (err) { handleError(res, err); }
}));

router.post('/actions/propose', (req, res) => withService(service => {
  try {
    assertPlainPayload(req.body);
    res.status(201).json(service.propose(req.body ?? {}));
  } catch (err) { handleError(res, err); }
}));

router.post('/actions/gmail/draft/propose', (req, res) => withService(service => {
  try {
    assertPlainPayload(req.body);
    res.status(201).json(service.proposeGmailDraft(req.body ?? {}));
  } catch (err) { handleError(res, err); }
}));

router.post('/actions/calendar/event/propose', (req, res) => withService(service => {
  try {
    assertPlainPayload(req.body);
    res.status(201).json(service.proposeCalendarEvent(req.body ?? {}, req.body?.createExternal === true));
  } catch (err) { handleError(res, err); }
}));

router.get('/actions/:id', (req, res) => withService(service => {
  if (!validActionId(req.params.id)) return res.status(400).json({ error: 'invalid action id' });
  try { res.json(service.detail(req.params.id)); } catch (err) { handleError(res, err); }
}));

router.post('/actions/:id/approve', (req, res) => withService(service => {
  if (!validActionId(req.params.id)) return res.status(400).json({ error: 'invalid action id' });
  try {
    assertPlainPayload(req.body ?? {});
    res.json(service.approve(req.params.id, req.body ?? {}));
  } catch (err) { handleError(res, err); }
}));

router.post('/actions/:id/reject', (req, res) => withService(service => {
  if (!validActionId(req.params.id)) return res.status(400).json({ error: 'invalid action id' });
  try {
    assertPlainPayload(req.body ?? {});
    res.json(service.reject(req.params.id, req.body ?? {}));
  } catch (err) { handleError(res, err); }
}));

router.post('/actions/:id/cancel', (req, res) => withService(service => {
  if (!validActionId(req.params.id)) return res.status(400).json({ error: 'invalid action id' });
  try { res.json(service.cancel(req.params.id)); } catch (err) { handleError(res, err); }
}));

router.post('/actions/:id/execute', (req, res) => withService(service => {
  if (!validActionId(req.params.id)) return res.status(400).json({ error: 'invalid action id' });
  try { res.json(service.execute(req.params.id)); } catch (err) { handleError(res, err); }
}));

router.get('/actions/:id/evidence', (req, res) => withService(service => {
  if (!validActionId(req.params.id)) return res.status(400).json({ error: 'invalid action id' });
  try {
    const detail = service.detail(req.params.id);
    res.json({ evidence: detail.evidence, executions: detail.executions, compensations: detail.compensations });
  } catch (err) { handleError(res, err); }
}));

export const controlledActionsRouter = router;
