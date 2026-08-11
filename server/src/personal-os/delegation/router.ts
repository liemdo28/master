import express, { Router } from 'express';
import { DelegationService } from './service';
import { assertPlainPayload } from '../actions/policy';
import { ControlledActionService } from '../actions/service';
import type { CreateDelegationInput } from './types';

export const delegationJsonParser = express.json({ limit: '2mb' });

const router = Router();

async function withService<T>(fn: (service: DelegationService) => Promise<T> | T): Promise<T> {
  const service = new DelegationService();
  try { return await fn(service); } finally { service.close(); }
}

function handleError(res: express.Response, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const status = /not found/i.test(message) ? 404
    : /cannot transition|human approver|deliberate confirmation|not eligible for delegation|must always expire|positive integer/i.test(message) ? 409
    : 400;
  res.status(status).json({ error: message });
}

function parseCreateInput(body: any): CreateDelegationInput {
  assertPlainPayload(body);
  if (!Array.isArray(body?.allowedActionTypes) || body.allowedActionTypes.length === 0) {
    throw new Error('allowedActionTypes must be a non-empty array');
  }
  return {
    title: String(body.title || ''),
    description: String(body.description || ''),
    owner: String(body.owner || ''),
    projectId: String(body.projectId || ''),
    allowedActionTypes: body.allowedActionTypes,
    deniedActionTypes: Array.isArray(body.deniedActionTypes) ? body.deniedActionTypes : [],
    targetRestriction: body.targetRestriction && typeof body.targetRestriction === 'object' ? body.targetRestriction : {},
    riskCeiling: body.riskCeiling || 'R1',
    approvalLevelCeiling: body.approvalLevelCeiling || 'STANDARD',
    startsAt: String(body.startsAt || ''),
    expiresAt: String(body.expiresAt || ''),
    timezone: String(body.timezone || 'UTC'),
    maxExecutions: Number(body.maxExecutions),
    maxTargets: body.maxTargets != null ? Number(body.maxTargets) : null,
    actionBudgets: Array.isArray(body.actionBudgets) ? body.actionBudgets : [],
    sourceGoalId: body.sourceGoalId ?? null,
    sourcePlanId: body.sourcePlanId ?? null,
  };
}

// No approve-all / activate-all / bulk endpoint exists anywhere in this router —
// every mutating route requires an exact :id and (for approve/activate) an explicit
// human approver + deliberate strong confirmation string.

router.get('/delegations', (req, res) => withService(service => {
  res.json({ delegations: service.list(req.query.status as any) });
}));

router.post('/delegations', (req, res) => withService(service => {
  try { res.status(201).json(service.createDelegation(parseCreateInput(req.body))); } catch (err) { handleError(res, err); }
}));

router.get('/delegations/:id', (req, res) => withService(service => {
  try { res.json({ delegation: service.get(req.params.id), evidence: service.evidence(req.params.id) }); } catch (err) { handleError(res, err); }
}));

router.post('/delegations/:id/submit', (req, res) => withService(service => {
  try { res.json(service.submitForApproval(req.params.id)); } catch (err) { handleError(res, err); }
}));

// Strong approval only. No approve-all. No --yes/--force equivalent — approver and
// strongConfirmation (must literally contain "AUTHORIZE:<id>") are both required.
router.post('/delegations/:id/approve', (req, res) => withService(service => {
  try {
    assertPlainPayload(req.body ?? {});
    res.json(service.approve(req.params.id, { approver: String(req.body?.approver || ''), strongConfirmation: String(req.body?.strongConfirmation || '') }));
  } catch (err) { handleError(res, err); }
}));

// Alias of /approve for callers that conceptually separate "approve" from "activate" —
// this state machine has no distinct approved-but-not-active state, so both routes
// perform the identical strong-approval-and-activate operation; idempotent if already ACTIVE.
router.post('/delegations/:id/activate', (req, res) => withService(service => {
  try {
    const current = service.get(req.params.id);
    if (current.status === 'ACTIVE') { res.json(current); return; }
    assertPlainPayload(req.body ?? {});
    res.json(service.approve(req.params.id, { approver: String(req.body?.approver || ''), strongConfirmation: String(req.body?.strongConfirmation || '') }));
  } catch (err) { handleError(res, err); }
}));

router.post('/delegations/:id/revoke', (req, res) => withService(service => {
  try { res.json(service.revoke(req.params.id, String(req.body?.actor || 'api-user'), String(req.body?.reason || 'revoked by user'))); } catch (err) { handleError(res, err); }
}));

router.post('/delegations/:id/cancel', (req, res) => withService(service => {
  try { res.json(service.cancel(req.params.id, String(req.body?.actor || 'api-user'), String(req.body?.reason || 'cancelled by user'))); } catch (err) { handleError(res, err); }
}));

router.get('/delegations/:id/evidence', (req, res) => withService(service => {
  try { res.json(service.evidence(req.params.id)); } catch (err) { handleError(res, err); }
}));

// Read-only: evaluates eligibility for an existing Controlled Action proposal without
// authorizing anything. Useful for the Command Center to preview what would happen.
router.post('/delegations/evaluate', (req, res) => withService(service => {
  const proposalId = String(req.body?.proposalId || '');
  if (!proposalId) { res.status(400).json({ error: 'proposalId is required' }); return; }
  const controlledActions = new ControlledActionService();
  try {
    const proposal = controlledActions.get(proposalId);
    res.json(service.evaluate(proposal));
  } catch (err) { handleError(res, err); }
  finally { controlledActions.close(); }
}));

export const delegationRouter = router;
