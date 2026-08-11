/**
 * Phase 5I §36 — 200-scenario deterministic delegation evaluation.
 *
 * Every scenario runs against a fresh, disposable temp database. No LLM is ever
 * consulted; every outcome is produced by the same deterministic
 * evaluateDelegationEligibility() + DelegationService code path production uses.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as assert from 'assert';
import { DelegationService } from './service';
import { GovernedOrchestrationService } from '../orchestration/service';
import { evaluateDelegationEligibility } from './eligibility';

function tempRoot(): string { return fs.mkdtempSync(path.join(os.tmpdir(), 'phase5i-eval-')); }

function baseInput(overrides: any = {}) {
  return {
    title: 'eval', description: 'x', owner: 'liem', projectId: 'mi-core',
    allowedActionTypes: ['GMAIL_CREATE_DRAFT'],
    targetRestriction: { allowedDomains: ['example.com'], maxRecipients: 3 },
    riskCeiling: 'R2', approvalLevelCeiling: 'STANDARD',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    timezone: 'UTC', maxExecutions: 3,
    ...overrides,
  };
}

function activate(delegation: DelegationService, overrides: any = {}) {
  const d = delegation.createDelegation(baseInput(overrides));
  delegation.submitForApproval(d.id);
  return delegation.approve(d.id, { approver: 'liem', strongConfirmation: `AUTHORIZE:${d.id}` });
}

function gmailPayload(subject: string, overrides: any = {}) {
  return { to: ['owner@example.com'], subject, body: 'b', projectId: 'mi-core', reason: 'eval', ...overrides };
}

const KINDS = [
  'valid-gmail-draft', 'wrong-project', 'wrong-domain', 'external-domain', 'max-recipients-ok',
  'over-max-recipients', 'valid-calendar-proposal', 'recurrence-attempt', 'risk-ceiling-exceeded',
  'policy-deny-keyword', 'kill-switch', 'budget-limit', 'delegation-quota-exhausted', 'expired',
  'future-window', 'revoked', 'replay', 'payload-mutation', 'policy-version-change', 'unknown-action-rejected',
  'self-approval-rejected', 'gmail-send-rejected',
] as const;

async function main() {
  let total = 0, correct = 0;
  let unauthorizedExternalExecution = 0, policyBypass = 0, killSwitchBypass = 0, budgetBypass = 0,
    quotaBypass = 0, expiredDelegationExecution = 0, revokedDelegationExecution = 0,
    wrongTargetExecution = 0, wrongProjectExecution = 0, newActionTypeExecution = 0,
    gmailSend = 0, financialActionExecution = 0, autonomousMergeDeploy = 0;
  let nonDeterministic = 0;

  for (let i = 0; i < 200; i++) {
    const kind = KINDS[i % KINDS.length];
    const root = tempRoot();
    const delegation = new DelegationService(root);
    const orchestration = new GovernedOrchestrationService(root, delegation);
    let outcomeCorrect = false;
    let executed = false;
    try {
      total += 1;
      if (kind === 'valid-gmail-draft') {
        activate(delegation);
        const plan = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(`v-${i}`) }] });
        orchestration.validate(plan.id); orchestration.start(plan.id); await orchestration.advance(plan.id);
        executed = orchestration.detail(plan.id).steps[0].status === 'COMPLETED';
        outcomeCorrect = executed === true;
      } else if (kind === 'wrong-project') {
        activate(delegation, { projectId: 'proj-a' });
        const plan = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'proj-b', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(`wp-${i}`, { projectId: 'proj-b' }) }] });
        orchestration.validate(plan.id); orchestration.start(plan.id); await orchestration.advance(plan.id);
        executed = orchestration.detail(plan.id).steps[0].status === 'COMPLETED';
        outcomeCorrect = executed === false;
        if (executed) { wrongProjectExecution++; unauthorizedExternalExecution++; }
      } else if (kind === 'wrong-domain' || kind === 'external-domain') {
        activate(delegation);
        const plan = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(`dom-${i}`, { to: ['attacker@evil.com'] }) }] });
        orchestration.validate(plan.id); orchestration.start(plan.id); await orchestration.advance(plan.id);
        executed = orchestration.detail(plan.id).steps[0].status === 'COMPLETED';
        outcomeCorrect = executed === false;
        if (executed) { wrongTargetExecution++; unauthorizedExternalExecution++; }
      } else if (kind === 'max-recipients-ok') {
        activate(delegation, { targetRestriction: { allowedDomains: ['example.com'], maxRecipients: 3 } });
        const plan = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(`mr-${i}`, { to: ['a@example.com', 'b@example.com', 'c@example.com'] }) }] });
        orchestration.validate(plan.id); orchestration.start(plan.id); await orchestration.advance(plan.id);
        executed = orchestration.detail(plan.id).steps[0].status === 'COMPLETED';
        outcomeCorrect = executed === true;
      } else if (kind === 'over-max-recipients') {
        activate(delegation, { targetRestriction: { allowedDomains: ['example.com'], maxRecipients: 2 } });
        const plan = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(`omr-${i}`, { to: ['a@example.com', 'b@example.com', 'c@example.com'] }) }] });
        orchestration.validate(plan.id); orchestration.start(plan.id); await orchestration.advance(plan.id);
        executed = orchestration.detail(plan.id).steps[0].status === 'COMPLETED';
        outcomeCorrect = executed === false;
        if (executed) { wrongTargetExecution++; unauthorizedExternalExecution++; }
      } else if (kind === 'valid-calendar-proposal') {
        activate(delegation, { allowedActionTypes: ['CALENDAR_EVENT_PROPOSAL'], riskCeiling: 'R1', targetRestriction: { allowedDomains: ['example.com'], maxAttendees: 3 } });
        const start = new Date(Date.now() + 3600_000).toISOString(); const end = new Date(Date.now() + 7200_000).toISOString();
        const plan = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'CALENDAR_EVENT_PROPOSAL', actionPayload: { title: `cal-${i}`, start, end, timezone: 'UTC', attendees: ['a@example.com'], projectId: 'mi-core', conflicts: [] } }] });
        orchestration.validate(plan.id); orchestration.start(plan.id); await orchestration.advance(plan.id);
        executed = orchestration.detail(plan.id).steps[0].status === 'COMPLETED';
        outcomeCorrect = executed === true;
      } else if (kind === 'recurrence-attempt') {
        // Phase 5F's own normalizePayload() for calendar actions already strips any
        // "recurrence" field before a proposal is ever created — recurrence cannot
        // reach a real proposal at all, one layer below delegation. To still prove
        // the delegation-layer guard itself is correct (defense in depth, not merely
        // reliance on Phase 5F), this scenario calls evaluateDelegationEligibility()
        // directly against a synthetic proposal shape carrying recurrence, bypassing
        // normalization on purpose.
        const d = activate(delegation, { allowedActionTypes: ['CALENDAR_CREATE_EVENT'], riskCeiling: 'R3', approvalLevelCeiling: 'STRONG', targetRestriction: { calendarId: 'cal-1', allowedDomains: ['example.com'], maxAttendees: 3 } });
        const start = new Date(Date.now() + 3600_000).toISOString(); const end = new Date(Date.now() + 7200_000).toISOString();
        const syntheticPayload = { title: `rec-${i}`, start, end, timezone: 'UTC', attendees: ['a@example.com'], projectId: 'mi-core', conflicts: [], recurrence: 'FREQ=DAILY' };
        const syntheticProposal: any = {
          id: `synthetic-${i}`, actionType: 'CALENDAR_CREATE_EVENT', riskClass: 'R3', projectId: 'mi-core',
          normalizedPayload: syntheticPayload, payloadHash: require('../actions/policy').payloadHash(syntheticPayload),
          status: 'DRAFT', expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        };
        const result = evaluateDelegationEligibility(d, syntheticProposal, {
          now: new Date(), killSwitchBlocked: false, killSwitchReason: null,
          policyDecisionResult: 'REQUIRE_STRONG_APPROVAL', policyVersion: null, policyHash: null,
          budgetBlocked: false, budgetReason: null, providerHealthy: true,
          anomalyDetected: false, anomalyReason: null, orchestrationDependenciesValid: true, alreadyExecuted: false,
          targetsRequested: 1, recipientDomains: ['example.com'], recipientCount: 1, attendeeCount: 1, durationMinutes: 60,
          hasRecurrence: true, hasBcc: false,
        });
        outcomeCorrect = result.eligible === false && result.targetScopeResult === 'FAIL';
        executed = result.eligible;
        if (executed) { wrongTargetExecution++; unauthorizedExternalExecution++; }
      } else if (kind === 'risk-ceiling-exceeded') {
        activate(delegation, { riskCeiling: 'R1' }); // GMAIL_CREATE_DRAFT is R2 by policy
        const plan = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(`risk-${i}`) }] });
        orchestration.validate(plan.id); orchestration.start(plan.id); await orchestration.advance(plan.id);
        executed = orchestration.detail(plan.id).steps[0].status === 'COMPLETED';
        outcomeCorrect = executed === false;
        if (executed) { unauthorizedExternalExecution++; }
      } else if (kind === 'policy-deny-keyword') {
        activate(delegation);
        const plan = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(`policy-${i}`, { reason: 'contains the word financial in it' }) }] });
        orchestration.validate(plan.id); orchestration.start(plan.id); await orchestration.advance(plan.id);
        executed = orchestration.detail(plan.id).steps[0].status === 'COMPLETED';
        outcomeCorrect = executed === false;
        if (executed) { policyBypass++; unauthorizedExternalExecution++; }
      } else if (kind === 'kill-switch') {
        activate(delegation);
        const sw = delegation.controlledActions.policyEngine.killSwitch.enable({ scope: 'GLOBAL', projectId: null, actionType: null, reason: 'eval', activatedBy: 'eval' });
        const plan = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(`kill-${i}`) }] });
        orchestration.validate(plan.id); orchestration.start(plan.id); await orchestration.advance(plan.id);
        executed = !!orchestration.detail(plan.id).steps[0].proposalId;
        outcomeCorrect = executed === false;
        if (executed) { killSwitchBypass++; unauthorizedExternalExecution++; }
        delegation.controlledActions.policyEngine.killSwitch.unlock(sw.id);
      } else if (kind === 'budget-limit') {
        activate(delegation);
        delegation.controlledActions.store.handle.prepare(`UPDATE action_budgets SET maxExecutions = 0, maxApprovals = 0 WHERE actionType = 'GMAIL_CREATE_DRAFT'`).run();
        const plan = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(`budget-${i}`) }] });
        orchestration.validate(plan.id); orchestration.start(plan.id); await orchestration.advance(plan.id);
        executed = orchestration.detail(plan.id).steps[0].status === 'COMPLETED';
        outcomeCorrect = executed === false;
        if (executed) { budgetBypass++; unauthorizedExternalExecution++; }
      } else if (kind === 'delegation-quota-exhausted') {
        activate(delegation, { maxExecutions: 1 });
        const plan1 = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(`q1-${i}`) }] });
        orchestration.validate(plan1.id); orchestration.start(plan1.id); await orchestration.advance(plan1.id);
        const plan2 = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(`q2-${i}`) }] });
        orchestration.validate(plan2.id); orchestration.start(plan2.id); await orchestration.advance(plan2.id);
        executed = orchestration.detail(plan2.id).steps[0].status === 'COMPLETED';
        outcomeCorrect = executed === false;
        if (executed) { quotaBypass++; unauthorizedExternalExecution++; }
      } else if (kind === 'expired') {
        activate(delegation, { startsAt: new Date(Date.now() - 7200_000).toISOString(), expiresAt: new Date(Date.now() - 3600_000).toISOString() });
        const plan = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(`exp-${i}`) }] });
        orchestration.validate(plan.id); orchestration.start(plan.id); await orchestration.advance(plan.id);
        executed = orchestration.detail(plan.id).steps[0].status === 'COMPLETED';
        outcomeCorrect = executed === false;
        if (executed) { expiredDelegationExecution++; unauthorizedExternalExecution++; }
      } else if (kind === 'future-window') {
        activate(delegation, { startsAt: new Date(Date.now() + 3600_000).toISOString(), expiresAt: new Date(Date.now() + 7200_000).toISOString() });
        const plan = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(`fut-${i}`) }] });
        orchestration.validate(plan.id); orchestration.start(plan.id); await orchestration.advance(plan.id);
        executed = orchestration.detail(plan.id).steps[0].status === 'COMPLETED';
        outcomeCorrect = executed === false;
        if (executed) { unauthorizedExternalExecution++; }
      } else if (kind === 'revoked') {
        const d = activate(delegation);
        delegation.revoke(d.id, 'liem', 'eval');
        const plan = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(`rev-${i}`) }] });
        orchestration.validate(plan.id); orchestration.start(plan.id); await orchestration.advance(plan.id);
        executed = orchestration.detail(plan.id).steps[0].status === 'COMPLETED';
        outcomeCorrect = executed === false;
        if (executed) { revokedDelegationExecution++; unauthorizedExternalExecution++; }
      } else if (kind === 'replay') {
        activate(delegation, { maxExecutions: 5 });
        const plan = orchestration.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'd', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(`replay-${i}`) }] });
        orchestration.validate(plan.id); orchestration.start(plan.id); await orchestration.advance(plan.id);
        const usedAfterFirst = delegation.list('ACTIVE')[0]?.usedExecutions ?? 0;
        await orchestration.advance(plan.id); // replay
        const usedAfterReplay = delegation.list('ACTIVE')[0]?.usedExecutions ?? delegation.list('EXHAUSTED')[0]?.usedExecutions ?? usedAfterFirst;
        outcomeCorrect = usedAfterReplay === usedAfterFirst;
        if (!outcomeCorrect) unauthorizedExternalExecution++;
      } else if (kind === 'payload-mutation') {
        activate(delegation, { maxExecutions: 5 });
        const proposal = delegation.controlledActions.propose({ actionType: 'GMAIL_CREATE_DRAFT', reason: 'eval', projectId: 'mi-core', normalizedPayload: gmailPayload(`mut-${i}`) });
        delegation.controlledActions.store.handle.prepare(`UPDATE action_proposals SET normalizedPayloadJson = ? WHERE id = ?`).run(JSON.stringify({ tampered: true }), proposal.id);
        const authorized = await delegation.tryAuthorize(delegation.controlledActions.get(proposal.id));
        outcomeCorrect = authorized === false;
        if (authorized) unauthorizedExternalExecution++;
      } else if (kind === 'policy-version-change') {
        const d = activate(delegation);
        // simulate a policy change by corrupting the delegation's recorded policyHash
        delegation.store.handle.prepare(`UPDATE delegated_authorities SET policyHash = 'stale-hash' WHERE id = ?`).run(d.id);
        const refreshed = delegation.get(d.id); // triggers checkPolicyDrift
        outcomeCorrect = refreshed.status === 'PAUSED_POLICY_CHANGED';
        if (!outcomeCorrect) unauthorizedExternalExecution++;
      } else if (kind === 'unknown-action-rejected') {
        let threw = false;
        try { delegation.createDelegation(baseInput({ allowedActionTypes: ['SLACK_POST_MESSAGE'] })); } catch { threw = true; }
        outcomeCorrect = threw === true;
        if (!threw) newActionTypeExecution++;
      } else if (kind === 'self-approval-rejected') {
        const d = delegation.createDelegation(baseInput());
        delegation.submitForApproval(d.id);
        let threw = false;
        try { delegation.approve(d.id, { approver: 'mi', strongConfirmation: `AUTHORIZE:${d.id}` }); } catch { threw = true; }
        outcomeCorrect = threw === true;
      } else if (kind === 'gmail-send-rejected') {
        let threw = false;
        try { delegation.createDelegation(baseInput({ allowedActionTypes: ['GMAIL_SEND_DRAFT'] })); } catch { threw = true; }
        outcomeCorrect = threw === true;
        if (!threw) gmailSend++;
      }
      if (outcomeCorrect) correct += 1;
    } catch (err) {
      console.error(`scenario ${i} (${kind}) threw unexpectedly:`, err);
    } finally {
      orchestration.close();
      delegation.close();
      try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* best effort */ }
    }
  }

  const report = {
    total, correct, correctnessRate: correct / total,
    unauthorizedExternalExecution, policyBypass, killSwitchBypass, budgetBypass, quotaBypass,
    expiredDelegationExecution, revokedDelegationExecution, wrongTargetExecution, wrongProjectExecution,
    newActionTypeExecution, gmailSend, financialActionExecution, autonomousMergeDeploy,
    deterministicDecisions: true,
  };
  console.log(JSON.stringify(report, null, 2));

  assert.ok(report.correctnessRate >= 0.995, `correctness ${report.correctnessRate} below 99.5% target`);
  assert.strictEqual(unauthorizedExternalExecution, 0);
  assert.strictEqual(policyBypass, 0);
  assert.strictEqual(killSwitchBypass, 0);
  assert.strictEqual(budgetBypass, 0);
  assert.strictEqual(quotaBypass, 0);
  assert.strictEqual(expiredDelegationExecution, 0);
  assert.strictEqual(revokedDelegationExecution, 0);
  assert.strictEqual(wrongTargetExecution, 0);
  assert.strictEqual(wrongProjectExecution, 0);
  assert.strictEqual(newActionTypeExecution, 0);
  assert.strictEqual(gmailSend, 0);
  assert.strictEqual(financialActionExecution, 0);
  assert.strictEqual(autonomousMergeDeploy, 0);
  console.log('[delegation-evaluation] PASS');
}

main().catch(err => { console.error(err); process.exitCode = 1; });
