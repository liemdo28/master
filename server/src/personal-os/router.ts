import express, { Router } from 'express';
import { PersonalOsService } from './service';
import { assertPlainPayload } from './store';

export const personalOsJsonParser = express.json({ limit: '1mb' });

const router = Router();
const typedIdPattern = /^(pref|goal|brief|knowledge)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function withService<T>(fn: (service: PersonalOsService) => T): T {
  const service = new PersonalOsService();
  try { return fn(service); } finally { service.close(); }
}

function validId(id: string): boolean {
  return typedIdPattern.test(id);
}

function sanitizeBody(body: unknown): void {
  assertPlainPayload(body);
}

function handleError(res: express.Response, err: unknown, fallbackStatus = 400): void {
  const message = err instanceof Error ? err.message : String(err);
  const status = /not found/i.test(message) ? 404 : /already|duplicate|transition/i.test(message) ? 409 : fallbackStatus;
  res.status(status).json({ error: message });
}

router.get('/personal/preferences', (_req, res) => withService(service => res.json({ preferences: service.store.listPreferences() })));

router.post('/personal/preferences', (req, res) => withService(service => {
  try {
    sanitizeBody(req.body);
    res.status(201).json(service.createPreference(req.body ?? {}));
  } catch (err) { handleError(res, err); }
}));

router.patch('/personal/preferences/:id', (req, res) => withService(service => {
  if (!validId(req.params.id) || !req.params.id.startsWith('pref-')) return res.status(400).json({ error: 'invalid preference id' });
  try {
    sanitizeBody(req.body);
    res.json(service.store.updatePreference(req.params.id, req.body ?? {}));
  } catch (err) { handleError(res, err); }
}));

router.delete('/personal/preferences/:id', (req, res) => withService(service => {
  if (!validId(req.params.id) || !req.params.id.startsWith('pref-')) return res.status(400).json({ error: 'invalid preference id' });
  try { res.json(service.store.deletePreference(req.params.id)); }
  catch (err) { handleError(res, err); }
}));

router.get('/goals', (_req, res) => withService(service => res.json({ goals: service.store.listGoals() })));

router.post('/goals', (req, res) => withService(service => {
  try {
    sanitizeBody(req.body);
    res.status(201).json(service.store.createGoal(req.body ?? {}));
  } catch (err) { handleError(res, err); }
}));

router.get('/goals/:id', (req, res) => withService(service => {
  if (!validId(req.params.id) || !req.params.id.startsWith('goal-')) return res.status(400).json({ error: 'invalid goal id' });
  const goal = service.store.getGoal(req.params.id);
  return goal ? res.json(goal) : res.status(404).json({ error: 'goal not found' });
}));

router.patch('/goals/:id', (req, res) => withService(service => {
  if (!validId(req.params.id) || !req.params.id.startsWith('goal-')) return res.status(400).json({ error: 'invalid goal id' });
  try {
    sanitizeBody(req.body);
    if (typeof req.body?.status === 'string') return res.json(service.store.updateGoalStatus(req.params.id, req.body.status));
    return res.status(400).json({ error: 'only status patch is supported in Phase 5A' });
  } catch (err) { return handleError(res, err); }
}));

router.post('/goals/:id/plan', (req, res) => withService(service => {
  if (!validId(req.params.id) || !req.params.id.startsWith('goal-')) return res.status(400).json({ error: 'invalid goal id' });
  try {
    sanitizeBody(req.body ?? {});
    res.status(201).json(service.planGoal(req.params.id));
  } catch (err) { handleError(res, err); }
}));

router.post('/goals/:id/activate', (req, res) => withService(service => {
  if (!validId(req.params.id) || !req.params.id.startsWith('goal-')) return res.status(400).json({ error: 'invalid goal id' });
  try { res.json(service.activateGoal(req.params.id)); }
  catch (err) { handleError(res, err); }
}));

router.post('/goals/:id/pause', (req, res) => withService(service => {
  if (!validId(req.params.id) || !req.params.id.startsWith('goal-')) return res.status(400).json({ error: 'invalid goal id' });
  try { res.json(service.store.updateGoalStatus(req.params.id, 'PAUSED')); }
  catch (err) { handleError(res, err); }
}));

router.get('/goals/:id/progress', (req, res) => withService(service => {
  if (!validId(req.params.id) || !req.params.id.startsWith('goal-')) return res.status(400).json({ error: 'invalid goal id' });
  try { res.json(service.goalProgress(req.params.id)); }
  catch (err) { handleError(res, err); }
}));

router.get('/daily-brief', (req, res) => withService(service => {
  try {
    const brief = service.store.latestDailyBrief(typeof req.query.date === 'string' ? req.query.date : undefined);
    return brief ? res.json(brief) : res.status(404).json({ error: 'daily brief not found' });
  } catch (err) { return handleError(res, err); }
}));

router.get('/daily-brief/:id', (req, res) => withService(service => {
  if (!validId(req.params.id) || !req.params.id.startsWith('brief-')) return res.status(400).json({ error: 'invalid brief id' });
  const brief = service.store.getDailyBrief(req.params.id);
  return brief ? res.json(brief) : res.status(404).json({ error: 'daily brief not found' });
}));

router.post('/daily-brief/generate', (_req, res) => withService(service => {
  try { res.status(201).json(service.generateDailyBrief()); }
  catch (err) { handleError(res, err); }
}));

router.get('/personal/integrity', (_req, res) => withService(service => res.json(service.store.integrity())));

router.get('/knowledge', (req, res) => withService(service => {
  res.json({ knowledge: service.store.listKnowledge(req.query.includeInactive === 'true') });
}));

router.post('/knowledge', (req, res) => withService(service => {
  try {
    sanitizeBody(req.body);
    res.status(201).json(service.createKnowledge(req.body ?? {}));
  } catch (err) { handleError(res, err); }
}));

router.get('/knowledge/conflicts', (_req, res) => withService(service => res.json({ conflicts: service.store.listKnowledgeConflicts() })));

router.get('/knowledge/:id', (req, res) => withService(service => {
  if (!validId(req.params.id) || !req.params.id.startsWith('knowledge-')) return res.status(400).json({ error: 'invalid knowledge id' });
  const record = service.store.getKnowledge(req.params.id);
  return record ? res.json(record) : res.status(404).json({ error: 'knowledge not found' });
}));

router.patch('/knowledge/:id', (req, res) => withService(service => {
  if (!validId(req.params.id) || !req.params.id.startsWith('knowledge-')) return res.status(400).json({ error: 'invalid knowledge id' });
  try {
    sanitizeBody(req.body);
    res.json(service.store.updateKnowledge(req.params.id, req.body ?? {}));
  } catch (err) { handleError(res, err); }
}));

router.delete('/knowledge/:id', (req, res) => withService(service => {
  if (!validId(req.params.id) || !req.params.id.startsWith('knowledge-')) return res.status(400).json({ error: 'invalid knowledge id' });
  try { res.json(service.store.deleteKnowledge(req.params.id)); }
  catch (err) { handleError(res, err); }
}));

router.post('/knowledge/search', (req, res) => withService(service => {
  try {
    sanitizeBody(req.body);
    res.json({ results: service.searchKnowledge(req.body ?? {}) });
  } catch (err) { handleError(res, err); }
}));

router.post('/knowledge/:id/confirm', (req, res) => withService(service => {
  if (!validId(req.params.id) || !req.params.id.startsWith('knowledge-')) return res.status(400).json({ error: 'invalid knowledge id' });
  try { res.json(service.store.confirmKnowledge(req.params.id)); }
  catch (err) { handleError(res, err); }
}));

router.post('/knowledge/:id/supersede', (req, res) => withService(service => {
  if (!validId(req.params.id) || !req.params.id.startsWith('knowledge-')) return res.status(400).json({ error: 'invalid knowledge id' });
  try {
    sanitizeBody(req.body);
    res.status(201).json(service.store.supersedeKnowledge(req.params.id, req.body ?? {}));
  } catch (err) { handleError(res, err); }
}));

router.post('/knowledge/extract/task/:taskId', (req, res) => withService(service => {
  try {
    sanitizeBody(req.body ?? {});
    res.status(201).json(service.extractKnowledgeFromTask(req.params.taskId));
  } catch (err) { handleError(res, err); }
}));

router.post('/knowledge/memory-pack', (req, res) => withService(service => {
  try {
    sanitizeBody(req.body);
    res.status(201).json(service.buildMemoryPack(req.body ?? {}));
  } catch (err) { handleError(res, err); }
}));

export const personalOsRouter = router;
