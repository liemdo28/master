import express, { Router } from 'express';
import { GovernedOrchestrationService } from './service';
import { assertPlainPayload } from '../actions/policy';
import type { ActionPlanStepInput } from './types';

export const orchestrationJsonParser = express.json({ limit: '2mb' });

const router = Router();

async function withService<T>(fn: (service: GovernedOrchestrationService) => Promise<T> | T): Promise<T> {
  const service = new GovernedOrchestrationService();
  try { return await fn(service); } finally { service.close(); }
}

function handleError(res: express.Response, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const status = /not found/i.test(message) ? 404 : /cannot transition|cannot be advanced|cannot version/i.test(message) ? 409 : 400;
  res.status(status).json({ error: message });
}

function parseSteps(body: any): ActionPlanStepInput[] {
  if (!Array.isArray(body?.steps) || body.steps.length === 0) throw new Error('steps must be a non-empty array');
  return body.steps.map((s: any, i: number) => {
    if (!s || typeof s !== 'object') throw new Error(`step ${i} must be an object`);
    if (!['READ_ONLY', 'LOCAL_COMPUTE', 'CONTROLLED_ACTION'].includes(s.type)) throw new Error(`step ${i}: invalid type "${s.type}"`);
    if (s.actionPayload) assertPlainPayload(s.actionPayload);
    return {
      key: String(s.key || `step-${i}`),
      type: s.type,
      description: String(s.description || ''),
      projectId: s.projectId ?? null,
      dependsOnKeys: Array.isArray(s.dependsOnKeys) ? s.dependsOnKeys.map(String) : [],
      inputs: s.inputs && typeof s.inputs === 'object' ? s.inputs : {},
      expectedOutputs: s.expectedOutputs && typeof s.expectedOutputs === 'object' ? s.expectedOutputs : {},
      actionType: s.actionType ?? null,
      actionPayload: s.actionPayload ?? null,
    } as ActionPlanStepInput;
  });
}

router.post('/orchestration/plans', (req, res) => withService(service => {
  try {
    assertPlainPayload(req.body);
    const plan = service.createPlan({
      title: String(req.body?.title || ''),
      objective: String(req.body?.objective || ''),
      goalId: req.body?.goalId ?? null,
      projectId: req.body?.projectId ?? null,
      steps: parseSteps(req.body),
    });
    res.status(201).json(plan);
  } catch (err) { handleError(res, err); }
}));

router.post('/orchestration/plans/:id/version', (req, res) => withService(service => {
  try {
    assertPlainPayload(req.body);
    const plan = service.createNewVersion(req.params.id, {
      title: String(req.body?.title || ''),
      objective: String(req.body?.objective || ''),
      goalId: req.body?.goalId ?? null,
      projectId: req.body?.projectId ?? null,
      steps: parseSteps(req.body),
    });
    res.status(201).json(plan);
  } catch (err) { handleError(res, err); }
}));

router.get('/orchestration/plans', (req, res) => withService(service => {
  res.json({ plans: service.list(req.query.status as any) });
}));

router.get('/orchestration/plans/:id', (req, res) => withService(service => {
  try { res.json(service.detail(req.params.id)); } catch (err) { handleError(res, err); }
}));

router.post('/orchestration/plans/:id/validate', (req, res) => withService(service => {
  try { res.json(service.validate(req.params.id)); } catch (err) { handleError(res, err); }
}));

router.post('/orchestration/plans/:id/start', (req, res) => withService(service => {
  try { res.json(service.start(req.params.id)); } catch (err) { handleError(res, err); }
}));

// This endpoint advances PLAN STRUCTURE only — it never approves a Controlled Action.
// Any step's underlying proposal must be approved through the existing
// /api/actions/:id/approve surface; this endpoint only observes and reacts to that.
router.post('/orchestration/plans/:id/advance', (req, res) => withService(async service => {
  try {
    assertPlainPayload(req.body ?? {});
    const result = await service.advance(req.params.id, {
      triggeredBy: String(req.body?.triggeredBy || 'api-user'),
      idempotencyKey: req.body?.idempotencyKey ? String(req.body.idempotencyKey) : undefined,
    });
    res.json(result);
  } catch (err) { handleError(res, err); }
}));

router.post('/orchestration/plans/:id/pause', (req, res) => withService(service => {
  try { res.json(service.pause(req.params.id, String(req.body?.reason || 'paused by user'))); } catch (err) { handleError(res, err); }
}));

router.post('/orchestration/plans/:id/resume', (req, res) => withService(service => {
  try { res.json(service.resume(req.params.id)); } catch (err) { handleError(res, err); }
}));

router.post('/orchestration/plans/:id/cancel', (req, res) => withService(service => {
  try { res.json(service.cancel(req.params.id, String(req.body?.reason || 'cancelled by user'))); } catch (err) { handleError(res, err); }
}));

router.get('/orchestration/plans/:id/evidence', (req, res) => withService(service => {
  try { res.json({ evidence: service.evidence(req.params.id) }); } catch (err) { handleError(res, err); }
}));

export const orchestrationRouter = router;
