import express, { Router } from 'express';
import { PersonalOsService } from './service';

export const personalOsJsonParser = express.json({ limit: '1mb' });

const router = Router();
const idPattern = /^[a-z]+-[0-9a-f-]{36}$/i;

function withService<T>(fn: (service: PersonalOsService) => T): T {
  const service = new PersonalOsService();
  try { return fn(service); } finally { service.close(); }
}

function validId(id: string): boolean {
  return idPattern.test(id);
}

router.get('/personal/preferences', (_req, res) => withService(service => res.json({ preferences: service.store.listPreferences() })));

router.post('/personal/preferences', (req, res) => withService(service => {
  try { res.status(201).json(service.createPreference(req.body ?? {})); }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : String(err) }); }
}));

router.patch('/personal/preferences/:id', (req, res) => withService(service => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'invalid preference id' });
  try { res.json(service.store.updatePreference(req.params.id, req.body ?? {})); }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : String(err) }); }
}));

router.delete('/personal/preferences/:id', (req, res) => withService(service => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'invalid preference id' });
  try { res.json(service.store.deletePreference(req.params.id)); }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : String(err) }); }
}));

router.get('/goals', (_req, res) => withService(service => res.json({ goals: service.store.listGoals() })));

router.post('/goals', (req, res) => withService(service => {
  try { res.status(201).json(service.store.createGoal(req.body ?? {})); }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : String(err) }); }
}));

router.get('/goals/:id', (req, res) => withService(service => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'invalid goal id' });
  const goal = service.store.getGoal(req.params.id);
  return goal ? res.json(goal) : res.status(404).json({ error: 'goal not found' });
}));

router.patch('/goals/:id', (req, res) => withService(service => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'invalid goal id' });
  try {
    if (typeof req.body?.status === 'string') return res.json(service.store.updateGoalStatus(req.params.id, req.body.status));
    return res.status(400).json({ error: 'only status patch is supported in Phase 5A' });
  } catch (err) { return res.status(400).json({ error: err instanceof Error ? err.message : String(err) }); }
}));

router.post('/goals/:id/plan', (req, res) => withService(service => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'invalid goal id' });
  try { res.status(201).json(service.planGoal(req.params.id)); }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : String(err) }); }
}));

router.post('/goals/:id/activate', (req, res) => withService(service => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'invalid goal id' });
  try { res.json(service.store.updateGoalStatus(req.params.id, 'ACTIVE')); }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : String(err) }); }
}));

router.post('/goals/:id/pause', (req, res) => withService(service => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'invalid goal id' });
  try { res.json(service.store.updateGoalStatus(req.params.id, 'PAUSED')); }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : String(err) }); }
}));

router.get('/goals/:id/progress', (req, res) => withService(service => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'invalid goal id' });
  try { res.json(service.goalProgress(req.params.id)); }
  catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : String(err) }); }
}));

router.get('/daily-brief', (req, res) => withService(service => {
  const brief = service.store.latestDailyBrief(typeof req.query.date === 'string' ? req.query.date : undefined);
  return brief ? res.json(brief) : res.status(404).json({ error: 'daily brief not found' });
}));

router.post('/daily-brief/generate', (_req, res) => withService(service => res.status(201).json(service.generateDailyBrief())));

export const personalOsRouter = router;
