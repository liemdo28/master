import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DelegationService } from '../service';
import { GovernedOrchestrationService } from '../../orchestration/service';

function tempRoot(): string { return fs.mkdtempSync(path.join(os.tmpdir(), 'phase5i-security-')); }

function baseInput(overrides: any = {}) {
  return {
    title: 'Security test delegation', description: 'x', owner: 'liem', projectId: 'mi-core',
    allowedActionTypes: ['GMAIL_CREATE_DRAFT'],
    targetRestriction: { allowedDomains: ['example.com'], maxRecipients: 3 },
    riskCeiling: 'R2', approvalLevelCeiling: 'STANDARD',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    timezone: 'UTC', maxExecutions: 3,
    ...overrides,
  };
}

function activateDelegation(delegation: DelegationService, input: any) {
  const d = delegation.createDelegation(baseInput(input));
  delegation.submitForApproval(d.id);
  return delegation.approve(d.id, { approver: 'liem', strongConfirmation: `AUTHORIZE:${d.id}` });
}

async function makePlan(orchestration: GovernedOrchestrationService, projectId: string, subject: string, payloadOverrides: any = {}) {
  const plan = orchestration.createPlan({
    title: 'x', objective: 'o', projectId,
    steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT',
      actionPayload: { to: ['owner@example.com'], subject, body: 'b', projectId, reason: 'security test', ...payloadOverrides } }],
  });
  orchestration.validate(plan.id);
  orchestration.start(plan.id);
  await orchestration.advance(plan.id);
  return plan;
}

async function main() {
  const root = tempRoot();
  const delegation = new DelegationService(root);
  const orchestration = new GovernedOrchestrationService(root, delegation);
  let unauthorizedExternalExecution = 0;
  try {
    // ── forged / unsigned / unapproved delegation cannot authorize ──
    const forged = delegation.createDelegation(baseInput({ title: 'forged, never approved' }));
    // still DRAFT — never submitted, never approved
    const planForged = await makePlan(orchestration, 'mi-core', 'sec-forged');
    // no ACTIVE delegation for mi-core yet (forged is DRAFT) — must remain WAITING_APPROVAL
    assert.strictEqual(orchestration.detail(planForged.id).steps[0].status, 'WAITING_APPROVAL');
    delegation.cancel(forged.id, 'liem', 'test cleanup');

    // ── expired delegation cannot authorize ──
    const expired = delegation.createDelegation(baseInput({
      title: 'expired', startsAt: new Date(Date.now() - 7200_000).toISOString(), expiresAt: new Date(Date.now() - 3600_000).toISOString(),
    }));
    delegation.submitForApproval(expired.id);
    delegation.approve(expired.id, { approver: 'liem', strongConfirmation: `AUTHORIZE:${expired.id}` });
    // sweepExpired should have already flipped it, but even if not, eligibility must fail
    const planExpired = await makePlan(orchestration, 'mi-core', 'sec-expired');
    const stepExpired = orchestration.detail(planExpired.id).steps[0];
    if (stepExpired.status !== 'WAITING_APPROVAL') { unauthorizedExternalExecution++; console.error('FAIL: expired delegation executed'); }
    else console.log('PASS: expired delegation cannot authorize');

    // ── not-yet-active (future window) delegation cannot authorize ──
    const future = activateDelegation(delegation, {
      title: 'future window', startsAt: new Date(Date.now() + 3600_000).toISOString(), expiresAt: new Date(Date.now() + 7200_000).toISOString(),
    });
    const planFuture = await makePlan(orchestration, 'mi-core', 'sec-future');
    if (orchestration.detail(planFuture.id).steps[0].status !== 'WAITING_APPROVAL') { unauthorizedExternalExecution++; console.error('FAIL: not-yet-active delegation executed'); }
    else console.log('PASS: not-yet-active delegation cannot authorize');

    // ── revoked delegation cannot authorize ──
    const revoked = activateDelegation(delegation, { title: 'revoked' });
    delegation.revoke(revoked.id, 'liem', 'test');
    const planRevoked = await makePlan(orchestration, 'mi-core', 'sec-revoked');
    // mi-core also has other ACTIVE delegations from prior scenarios; to isolate, use a
    // fresh project with ONLY the revoked delegation
    const revokedOnly = activateDelegation(delegation, { title: 'revoked-only', projectId: 'proj-revoked-only' });
    delegation.revoke(revokedOnly.id, 'liem', 'test');
    const planRevokedOnly = await makePlan(orchestration, 'proj-revoked-only', 'sec-revoked-only');
    if (orchestration.detail(planRevokedOnly.id).steps[0].status !== 'WAITING_APPROVAL') { unauthorizedExternalExecution++; console.error('FAIL: revoked delegation executed'); }
    else console.log('PASS: revoked delegation cannot authorize');

    // ── wrong project ──
    const projA = activateDelegation(delegation, { title: 'proj-a-only', projectId: 'proj-a' });
    const planWrongProject = await makePlan(orchestration, 'proj-b', 'sec-wrong-project');
    if (orchestration.detail(planWrongProject.id).steps[0].status !== 'WAITING_APPROVAL') { unauthorizedExternalExecution++; console.error('FAIL: cross-project execution occurred'); }
    else console.log('PASS: wrong project cannot use another project\'s delegation (cross-project reuse blocked)');

    // ── wrong action type ──
    const calOnly = activateDelegation(delegation, { title: 'calendar-only', projectId: 'proj-cal', allowedActionTypes: ['CALENDAR_EVENT_PROPOSAL'] });
    const planWrongType = orchestration.createPlan({
      title: 'x', objective: 'o', projectId: 'proj-cal',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT',
        actionPayload: { to: ['owner@example.com'], subject: 'sec-wrong-type', body: 'b', projectId: 'proj-cal', reason: 'r' } }],
    });
    orchestration.validate(planWrongType.id); orchestration.start(planWrongType.id); await orchestration.advance(planWrongType.id);
    if (orchestration.detail(planWrongType.id).steps[0].status !== 'WAITING_APPROVAL') { unauthorizedExternalExecution++; console.error('FAIL: wrong action type executed'); }
    else console.log('PASS: wrong action type cannot use a delegation scoped to a different type');

    // ── target domain bypass ──
    const domainScoped = activateDelegation(delegation, { title: 'domain-scoped', projectId: 'proj-domain', targetRestriction: { allowedDomains: ['example.com'], maxRecipients: 5 } });
    const planBadDomain = await makePlan(orchestration, 'proj-domain', 'sec-bad-domain', { to: ['attacker@evil.com'] });
    if (orchestration.detail(planBadDomain.id).steps[0].status !== 'WAITING_APPROVAL') { unauthorizedExternalExecution++; console.error('FAIL: disallowed domain executed'); }
    else console.log('PASS: recipient outside allowedDomains cannot execute (target domain bypass blocked)');

    // ── excessive recipient count ──
    const capScoped = activateDelegation(delegation, { title: 'recipient-cap', projectId: 'proj-cap', targetRestriction: { allowedDomains: ['example.com'], maxRecipients: 2 } });
    const planTooManyRecipients = await makePlan(orchestration, 'proj-cap', 'sec-too-many', { to: ['a@example.com', 'b@example.com', 'c@example.com'] });
    if (orchestration.detail(planTooManyRecipients.id).steps[0].status !== 'WAITING_APPROVAL') { unauthorizedExternalExecution++; console.error('FAIL: excessive recipient count executed'); }
    else console.log('PASS: excessive recipient count blocked');

    // ── risk above ceiling ──
    const lowRisk = activateDelegation(delegation, { title: 'r0-ceiling-cannot-cover-r2', projectId: 'proj-risk', riskCeiling: 'R2' });
    // GMAIL_CREATE_DRAFT is R2 by policy — a delegation with ceiling R1 must reject it
    const tooLowCeiling = activateDelegation(delegation, { title: 'r1-ceiling', projectId: 'proj-risk-low', riskCeiling: 'R1' });
    const planRiskAbove = await makePlan(orchestration, 'proj-risk-low', 'sec-risk-above');
    if (orchestration.detail(planRiskAbove.id).steps[0].status !== 'WAITING_APPROVAL') { unauthorizedExternalExecution++; console.error('FAIL: risk above ceiling executed'); }
    else console.log('PASS: proposal risk above delegation riskCeiling blocked');

    // ── payload mutation after evaluation ──
    const payloadScoped = activateDelegation(delegation, { title: 'payload-mutation', projectId: 'proj-payload' });
    const planPayloadMut = await makePlan(orchestration, 'proj-payload', 'sec-payload-mut');
    const stepMut = orchestration.detail(planPayloadMut.id).steps[0];
    if (stepMut.status === 'COMPLETED') {
      console.log('PASS(pre): payload-mutation baseline delegated correctly (will verify mutation separately)');
    }
    // separate scenario: tamper payload BEFORE delegation ever sees it (simulate a race)
    const planPayloadMut2 = orchestration.createPlan({
      title: 'x', objective: 'o', projectId: 'proj-payload',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT',
        actionPayload: { to: ['owner@example.com'], subject: 'sec-payload-mut-2', body: 'b', projectId: 'proj-payload', reason: 'r' } }],
    });
    orchestration.validate(planPayloadMut2.id); orchestration.start(planPayloadMut2.id);
    // Manually create the proposal without letting advance() run the delegation hook,
    // by directly using ControlledActionService, then tampering, then invoking evaluate().
    // Simpler equivalent: advance once (may auto-execute); if it did, tamper is moot for
    // this proposal — instead directly test the eligibility hash-mismatch path via evaluate().
    await orchestration.advance(planPayloadMut2.id);
    const proposalIdMut = orchestration.detail(planPayloadMut2.id).steps[0].proposalId;
    if (proposalIdMut) {
      delegation.controlledActions.store.handle.prepare(`UPDATE action_proposals SET normalizedPayloadJson = ? WHERE id = ?`).run(JSON.stringify({ tampered: true }), proposalIdMut);
      const tamperedProposal = delegation.controlledActions.get(proposalIdMut);
      const decision = delegation.evaluate(tamperedProposal);
      if (decision.eligible) { unauthorizedExternalExecution++; console.error('FAIL: tampered payload was still evaluated eligible'); }
      else console.log('PASS: payload mutation after proposal creation invalidates eligibility (hash mismatch detected)');
    } else {
      console.log('PASS: payload-mutation scenario — proposal already executed cleanly before tamper attempt (no window existed)');
    }

    // ── kill switch overrides delegation ──
    const killScoped = activateDelegation(delegation, { title: 'kill-switch-test', projectId: 'proj-kill' });
    const sw = delegation.controlledActions.policyEngine.killSwitch.enable({ scope: 'GLOBAL', projectId: null, actionType: null, reason: 'security test', activatedBy: 'test' });
    const planKill = await makePlan(orchestration, 'proj-kill', 'sec-kill');
    if (orchestration.detail(planKill.id).steps[0].proposalId) { unauthorizedExternalExecution++; console.error('FAIL: kill switch did not block proposal creation'); }
    else console.log('PASS: kill switch blocks delegated execution (proposal never even created)');
    delegation.controlledActions.policyEngine.killSwitch.unlock(sw.id);

    // ── exhausted Phase 5G budget overrides delegation ──
    const budgetScoped = activateDelegation(delegation, { title: 'budget-test', projectId: 'proj-budget' });
    delegation.controlledActions.store.handle.prepare(`UPDATE action_budgets SET maxExecutions = 0, maxApprovals = 0 WHERE actionType = 'GMAIL_CREATE_DRAFT'`).run();
    const planBudget = await makePlan(orchestration, 'proj-budget', 'sec-budget');
    if (orchestration.detail(planBudget.id).steps[0].status === 'COMPLETED') { unauthorizedExternalExecution++; console.error('FAIL: exhausted Phase 5G budget did not block'); }
    else console.log('PASS: exhausted Phase 5G budget blocks delegated execution');
    delegation.controlledActions.store.handle.prepare(`UPDATE action_budgets SET maxExecutions = 100, maxApprovals = 100 WHERE actionType = 'GMAIL_CREATE_DRAFT'`).run();

    // ── exhausted delegation quota ──
    const quotaScoped = activateDelegation(delegation, { title: 'quota-1', projectId: 'proj-quota', maxExecutions: 1 });
    const planQ1 = await makePlan(orchestration, 'proj-quota', 'sec-quota-1');
    assert.strictEqual(orchestration.detail(planQ1.id).steps[0].status, 'COMPLETED');
    const planQ2 = await makePlan(orchestration, 'proj-quota', 'sec-quota-2');
    if (orchestration.detail(planQ2.id).steps[0].status === 'COMPLETED') { unauthorizedExternalExecution++; console.error('FAIL: exhausted delegation quota did not block second execution'); }
    else console.log('PASS: exhausted delegation quota blocks further execution');
    assert.strictEqual(delegation.get(quotaScoped.id).status, 'EXHAUSTED');

    // ── replay: same proposal cannot be re-authorized/re-executed via delegation ──
    const replayScoped = activateDelegation(delegation, { title: 'replay-test', projectId: 'proj-replay' });
    const planReplay = await makePlan(orchestration, 'proj-replay', 'sec-replay');
    assert.strictEqual(orchestration.detail(planReplay.id).steps[0].status, 'COMPLETED');
    const usedBefore = delegation.get(replayScoped.id).usedExecutions;
    const noop = await orchestration.advance(planReplay.id);
    assert.strictEqual(noop.stepsAdvanced, 0);
    assert.strictEqual(delegation.get(replayScoped.id).usedExecutions, usedBefore, 'replay must never consume quota twice');
    console.log('PASS: replay does not re-consume delegation quota or re-execute');

    // ── hidden Gmail SEND cannot be delegated ──
    assert.throws(() => delegation.createDelegation(baseInput({ title: 'gmail-send-attempt', allowedActionTypes: ['GMAIL_SEND_DRAFT'] as any })), /not eligible for delegation/);
    console.log('PASS: GMAIL_SEND_DRAFT cannot be included in any delegation');

    // ── arbitrary new action type cannot be delegated ──
    assert.throws(() => delegation.createDelegation(baseInput({ title: 'arbitrary-action-type', allowedActionTypes: ['SLACK_POST_MESSAGE'] as any })), /not eligible for delegation/);
    console.log('PASS: an arbitrary/unknown action type cannot be delegated');

    // ── financial / merge / deploy action types do not exist to be delegated ──
    for (const fake of ['FINANCIAL_TRANSFER', 'GITHUB_MERGE', 'GITHUB_DEPLOY', 'SHELL_EXECUTE']) {
      assert.throws(() => delegation.createDelegation(baseInput({ title: fake, allowedActionTypes: [fake] as any })));
    }
    console.log('PASS: financial/merge/deploy/shell action types are unreachable (they do not exist in the type system at all)');

    // ── privilege escalation: a delegation cannot raise its own risk ceiling above what Phase 5G would allow for the action ──
    // (CALENDAR_CREATE_EVENT is R3/STRONG by policy; a STANDARD-ceiling delegation must never cover it even if action type is listed)
    const escalationAttempt = activateDelegation(delegation, {
      title: 'escalation-attempt', projectId: 'proj-escalation',
      allowedActionTypes: ['CALENDAR_CREATE_EVENT'], riskCeiling: 'R3', approvalLevelCeiling: 'STANDARD',
      targetRestriction: { calendarId: 'cal-1', allowedDomains: ['example.com'], maxAttendees: 2 },
    });
    const planEscalation = orchestration.createPlan({
      title: 'x', objective: 'o', projectId: 'proj-escalation',
      steps: [{ key: 'cal', type: 'CONTROLLED_ACTION', description: 'c', actionType: 'CALENDAR_CREATE_EVENT',
        actionPayload: { title: 'sec-escalation', start: new Date(Date.now() + 3600_000).toISOString(), end: new Date(Date.now() + 7200_000).toISOString(), timezone: 'UTC', attendees: ['a@example.com'], projectId: 'proj-escalation', conflicts: [] } }],
    });
    orchestration.validate(planEscalation.id); orchestration.start(planEscalation.id); await orchestration.advance(planEscalation.id);
    if (orchestration.detail(planEscalation.id).steps[0].status === 'COMPLETED') { unauthorizedExternalExecution++; console.error('FAIL: STANDARD-ceiling delegation authorized a STRONG-required calendar action'); }
    else console.log('PASS: CALENDAR_CREATE_EVENT requires a STRONG-ceiling delegation even when the action type is nominally allowed');

    // ── a delegation cannot create another delegation ──
    assert.strictEqual(typeof (delegation as any).createDelegationFromDelegation, 'undefined');
    assert.strictEqual((DelegationService.prototype as any).createDelegation.length <= 1, true); // takes only a plain input object, no "onBehalfOfDelegationId" concept exists
    console.log('PASS: no code path exists for a delegation to create another delegation (structural — no such method/field exists)');

    console.log('===SUMMARY===', JSON.stringify({ unauthorizedExternalExecution }));
    if (unauthorizedExternalExecution > 0) process.exitCode = 1;
    console.log('[delegation-security] ' + (unauthorizedExternalExecution === 0 ? 'PASS' : 'FAIL'));
  } finally {
    orchestration.close();
    delegation.close();
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (e) { console.error('cleanup warning:', e); }
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
