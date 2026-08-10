import express, { Router } from 'express';
import { ControlledActionService } from '../service';
import { assertPlainPayload } from '../policy';
import type { PolicyRule } from './types';

export const governanceJsonParser = express.json({ limit: '1mb' });

const router = Router();

async function withService<T>(fn: (service: ControlledActionService) => Promise<T> | T): Promise<T> {
  const service = new ControlledActionService();
  try { return await fn(service); } finally { service.close(); }
}

function handleError(res: express.Response, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const status = /not found/i.test(message) ? 404 : /blocked|denied|stale|missing active|corrupt/i.test(message) ? 409 : 400;
  res.status(status).json({ error: message });
}

router.get('/governance/status', (_req, res) => withService(service => {
  const store = service.policyEngine.store;
  const decisions = store.listDecisions(200);
  const anomalies = store.listAnomalies(200);
  const killSwitches = store.listKillSwitches();
  const activePolicy = store.activePolicySet();
  res.json({
    pendingActions: service.list('WAITING_APPROVAL').length,
    actionsExecutedToday: service.list('COMPLETED').filter(a => sameUtcDay(a.executedAt)).length,
    blockedByPolicy: decisions.filter(d => d.decision === 'DENY').length,
    blockedByBudget: decisions.filter(d => d.decision === 'BLOCK_BUDGET').length,
    anomalies: anomalies.filter(a => a.status === 'OPEN').length,
    currentGlobalPolicy: activePolicy ? { id: activePolicy.id, version: activePolicy.version, contentHash: activePolicy.contentHash, status: activePolicy.status } : null,
    killSwitchState: { active: killSwitches.some(k => k.enabled), switches: killSwitches },
    budgets: store.listBudgets(),
  });
}));

router.get('/governance/policies', (_req, res) => withService(service => res.json({ policies: service.policyEngine.store.listPolicySets() })));
router.get('/governance/policies/:id', (req, res) => withService(service => {
  const policy = service.policyEngine.store.listPolicySets().find(item => item.id === req.params.id || item.version === req.params.id);
  if (!policy) return res.status(404).json({ error: 'policy not found' });
  res.json(policy);
}));
router.post('/governance/policies', (req, res) => withService(service => {
  try {
    assertPlainPayload(req.body);
    const active = service.policyEngine.store.activePolicySet();
    if (!active) throw new Error('missing active policy set');
    const rules = Array.isArray(req.body?.rules) ? req.body.rules.map(validateRule) : active.rules;
    const draft = service.policyEngine.store.createDraftPolicySet(rules, String(req.body?.actor || 'api-user'));
    service.policyEngine.audit.record({ eventType: 'policy.changed', policyVersion: draft.version, inputHash: draft.contentHash, decisionHash: null, actor: String(req.body?.actor || 'api-user'), proposalId: null, reasons: ['Draft policy set created; not active.'], metadata: { id: draft.id } });
    res.status(201).json(draft);
  } catch (err) { handleError(res, err); }
}));
router.post('/governance/policies/:id/simulate', (req, res) => withService(() => {
  assertPlainPayload(req.body);
  res.json({ policyId: req.params.id, changed: [], previouslyAllowedToDenied: [], previouslyDeniedToAllowed: [], approvalLevelChanges: [], note: 'No real execution. Full 100-action fixture report is produced by phase5g:acceptance.' });
}));
router.post('/governance/policies/:id/activate', (req, res) => withService(service => {
  try {
    assertPlainPayload(req.body ?? {});
    if (String(req.body?.confirm || '') !== `ACTIVATE:${req.params.id}`) throw new Error(`activation requires ACTIVATE:${req.params.id}`);
    const policy = service.policyEngine.store.activatePolicySet(req.params.id);
    service.policyEngine.audit.record({ eventType: 'policy.activated', policyVersion: policy.version, inputHash: policy.contentHash, decisionHash: null, actor: String(req.body?.actor || 'api-user'), proposalId: null, reasons: ['Policy activated by explicit confirmation.'], metadata: { id: policy.id } });
    res.json(policy);
  } catch (err) { handleError(res, err); }
}));
router.post('/governance/policies/:id/rollback', (req, res) => withService(service => {
  try {
    assertPlainPayload(req.body ?? {});
    if (String(req.body?.confirm || '') !== `ROLLBACK:${req.params.id}`) throw new Error(`rollback requires ROLLBACK:${req.params.id}`);
    const policy = service.policyEngine.store.rollbackPolicySet(req.params.id);
    service.policyEngine.audit.record({ eventType: 'policy.rolled_back', policyVersion: policy.version, inputHash: policy.contentHash, decisionHash: null, actor: String(req.body?.actor || 'api-user'), proposalId: null, reasons: ['Policy rolled back by explicit confirmation.'], metadata: { id: policy.id } });
    res.json(policy);
  } catch (err) { handleError(res, err); }
}));

router.get('/governance/budgets', (_req, res) => withService(service => res.json({ budgets: service.policyEngine.store.listBudgets() })));
router.get('/governance/kill-switches', (_req, res) => withService(service => res.json({ killSwitches: service.policyEngine.store.listKillSwitches() })));
router.post('/governance/kill-switches', (req, res) => withService(service => {
  try {
    assertPlainPayload(req.body);
    const item = service.policyEngine.killSwitch.enable({
      scope: req.body?.scope,
      projectId: req.body?.projectId ?? null,
      actionType: req.body?.actionType ?? null,
      reason: String(req.body?.reason || 'Governance kill switch enabled.'),
      activatedBy: String(req.body?.activatedBy || 'api-user'),
      expiresAt: req.body?.expiresAt ?? null,
    });
    service.policyEngine.audit.record({ eventType: 'kill_switch.enabled', policyVersion: null, inputHash: null, decisionHash: null, actor: item.activatedBy, proposalId: null, reasons: [item.reason], metadata: { id: item.id, scope: item.scope } });
    res.status(201).json(item);
  } catch (err) { handleError(res, err); }
}));
router.post('/governance/kill-switches/:id/disable', (req, res) => withService(service => {
  try {
    const item = service.policyEngine.killSwitch.unlock(req.params.id);
    service.policyEngine.audit.record({ eventType: 'kill_switch.disabled', policyVersion: null, inputHash: null, decisionHash: null, actor: 'api-user', proposalId: null, reasons: ['Kill switch disabled by explicit API request.'], metadata: { id: item.id } });
    res.json(item);
  } catch (err) { handleError(res, err); }
}));
router.get('/governance/anomalies', (_req, res) => withService(service => res.json({ anomalies: service.policyEngine.store.listAnomalies() })));
router.get('/governance/audit', (_req, res) => withService(service => res.json({ events: service.policyEngine.store.listEvents() })));
router.post('/governance/evaluate', (req, res) => withService(service => {
  try {
    assertPlainPayload(req.body);
    const proposal = service.get(String(req.body?.proposalId || ''));
    res.json(service.policyEngine.evaluate({ proposal, stage: 'simulation', actor: 'api-user', context: req.body?.context ?? {} }));
  } catch (err) { handleError(res, err); }
}));

function sameUtcDay(value: string | null): boolean {
  if (!value) return false;
  const d = new Date(value);
  const n = new Date();
  return d.getUTCFullYear() === n.getUTCFullYear() && d.getUTCMonth() === n.getUTCMonth() && d.getUTCDate() === n.getUTCDate();
}

export const governanceRouter = router;

function validateRule(input: any): PolicyRule {
  const now = new Date().toISOString();
  const effects = ['ALLOW', 'REQUIRE_APPROVAL', 'REQUIRE_STRONG_APPROVAL', 'DENY', 'LIMIT'];
  const levels = ['NONE', 'STANDARD', 'STRONG', 'DUAL_CONFIRMATION'];
  if (!input || typeof input !== 'object') throw new Error('policy rule must be an object');
  if (!effects.includes(String(input.effect))) throw new Error('invalid policy effect');
  if (!levels.includes(String(input.approvalLevel))) throw new Error('invalid approval level');
  return {
    id: String(input.id || `rule-${Date.now()}`),
    name: String(input.name || input.id || 'draft rule').slice(0, 120),
    description: String(input.description || 'Draft structured policy rule').slice(0, 500),
    enabled: input.enabled !== false,
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 100,
    scope: input.scope,
    actionTypes: Array.isArray(input.actionTypes) ? input.actionTypes.map(String) as any : [],
    projects: Array.isArray(input.projects) ? input.projects.map(String) : [],
    riskClasses: Array.isArray(input.riskClasses) ? input.riskClasses.map(String) as any : [],
    conditions: input.conditions && typeof input.conditions === 'object' ? input.conditions : {},
    effect: input.effect,
    approvalLevel: input.approvalLevel,
    maxExecutions: input.maxExecutions == null ? null : Number(input.maxExecutions),
    timeWindow: input.timeWindow ?? null,
    validFrom: input.validFrom ?? null,
    validUntil: input.validUntil ?? null,
    source: 'api-draft',
    createdAt: now,
    updatedAt: now,
    version: Number.isFinite(Number(input.version)) ? Number(input.version) : 1,
  };
}
