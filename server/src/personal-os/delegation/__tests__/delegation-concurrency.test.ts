import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DelegationService } from '../service';
import { GovernedOrchestrationService } from '../../orchestration/service';

function tempRoot(): string { return fs.mkdtempSync(path.join(os.tmpdir(), 'phase5i-concurrency-')); }

function baseInput(overrides: any = {}) {
  return {
    title: 'Concurrency test', description: 'x', owner: 'liem', projectId: 'mi-core',
    allowedActionTypes: ['GMAIL_CREATE_DRAFT'],
    targetRestriction: { allowedDomains: ['example.com'], maxRecipients: 3 },
    riskCeiling: 'R2', approvalLevelCeiling: 'STANDARD',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    timezone: 'UTC', maxExecutions: 1,
    ...overrides,
  };
}

function activate(delegation: DelegationService, overrides: any = {}) {
  const d = delegation.createDelegation(baseInput(overrides));
  delegation.submitForApproval(d.id);
  return delegation.approve(d.id, { approver: 'liem', strongConfirmation: `AUTHORIZE:${d.id}` });
}

async function main() {
  const root = tempRoot();
  const delegation = new DelegationService(root);
  const orchestration = new GovernedOrchestrationService(root, delegation);
  try {
    // ── remaining=1, two concurrent evaluations race for the last quota slot ──
    const d1 = activate(delegation, { title: 'race-quota', maxExecutions: 1 });
    const controlledActions = delegation.controlledActions;

    function gmailPayload(subject: string) {
      return { to: ['owner@example.com'], subject, body: 'b', projectId: 'mi-core', reason: 'r' };
    }
    const proposalA = controlledActions.propose({ actionType: 'GMAIL_CREATE_DRAFT', reason: 'race-a', projectId: 'mi-core', normalizedPayload: gmailPayload('race-a') });
    const proposalB = controlledActions.propose({ actionType: 'GMAIL_CREATE_DRAFT', reason: 'race-b', projectId: 'mi-core', normalizedPayload: gmailPayload('race-b') });

    const results = await Promise.all([
      delegation.tryAuthorize(controlledActions.get(proposalA.id)),
      delegation.tryAuthorize(controlledActions.get(proposalB.id)),
    ]);
    const authorizedCount = results.filter(Boolean).length;
    assert.strictEqual(authorizedCount, 1, 'exactly one concurrent authorization must succeed when only one quota slot remains');
    const finalQuota = delegation.get(d1.id);
    assert.strictEqual(finalQuota.usedExecutions, 1, 'usedExecutions must never exceed maxExecutions under a race');
    assert.strictEqual(finalQuota.status, 'EXHAUSTED');
    console.log('PASS: concurrent final-quota-slot race — exactly one authorized');

    // ── revoke race: execution prepares, delegation revoked before dispatch boundary ──
    const d2 = activate(delegation, { title: 'race-revoke', maxExecutions: 5 });
    const proposalRevokeRace = controlledActions.propose({ actionType: 'GMAIL_CREATE_DRAFT', reason: 'revoke-race', projectId: 'mi-core', normalizedPayload: gmailPayload('revoke-race') });
    // Revoke BEFORE calling tryAuthorize — simulates revocation landing before the
    // dispatch boundary; tryAuthorize must observe the now-REVOKED status and refuse.
    delegation.revoke(d2.id, 'liem', 'race test');
    const authorizedAfterRevoke = await delegation.tryAuthorize(controlledActions.get(proposalRevokeRace.id));
    assert.strictEqual(authorizedAfterRevoke, false, 'a revoked delegation must never authorize, even mid-race');
    const executionCountRevoke = controlledActions.store.handle.prepare('SELECT COUNT(*) c FROM action_executions WHERE proposalId = ?').get(proposalRevokeRace.id) as { c: number };
    assert.strictEqual(executionCountRevoke.c, 0, 'provider dispatch must be zero if revocation occurred before the dispatch boundary');
    console.log('PASS: revoke race — zero provider dispatch');

    // ── expiry race: delegation expires between eligibility pass and dispatch ──
    const d3 = activate(delegation, { title: 'race-expiry', maxExecutions: 5, expiresAt: new Date(Date.now() + 500).toISOString() });
    const proposalExpiryRace = controlledActions.propose({ actionType: 'GMAIL_CREATE_DRAFT', reason: 'expiry-race', projectId: 'mi-core', normalizedPayload: gmailPayload('expiry-race') });
    await new Promise(r => setTimeout(r, 600)); // let it genuinely expire
    const authorizedAfterExpiry = await delegation.tryAuthorize(controlledActions.get(proposalExpiryRace.id));
    assert.strictEqual(authorizedAfterExpiry, false, 're-evaluation must catch an expiry that occurred before dispatch');
    const executionCountExpiry = controlledActions.store.handle.prepare('SELECT COUNT(*) c FROM action_executions WHERE proposalId = ?').get(proposalExpiryRace.id) as { c: number };
    assert.strictEqual(executionCountExpiry.c, 0);
    console.log('PASS: expiry race — re-evaluation blocks dispatch');

    // ── kill-switch race: kill switch enabled between eligibility pass and dispatch ──
    const d4 = activate(delegation, { title: 'race-killswitch', maxExecutions: 5 });
    const proposalKillRace = controlledActions.propose({ actionType: 'GMAIL_CREATE_DRAFT', reason: 'kill-race', projectId: 'mi-core', normalizedPayload: gmailPayload('kill-race') });
    const sw = controlledActions.policyEngine.killSwitch.enable({ scope: 'GLOBAL', projectId: null, actionType: null, reason: 'race test', activatedBy: 'test' });
    const authorizedAfterKill = await delegation.tryAuthorize(controlledActions.get(proposalKillRace.id));
    assert.strictEqual(authorizedAfterKill, false);
    const executionCountKill = controlledActions.store.handle.prepare('SELECT COUNT(*) c FROM action_executions WHERE proposalId = ?').get(proposalKillRace.id) as { c: number };
    assert.strictEqual(executionCountKill.c, 0);
    console.log('PASS: kill-switch race — re-evaluation blocks dispatch');
    controlledActions.policyEngine.killSwitch.unlock(sw.id);

    // ── orchestration-level concurrent advance() calls never double-authorize ──
    const d5 = activate(delegation, { title: 'race-orchestration', maxExecutions: 1 });
    const plan = orchestration.createPlan({
      title: 'x', objective: 'o', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('orchestration-race') }],
    });
    orchestration.validate(plan.id);
    orchestration.start(plan.id);
    const advanceResults = await Promise.all([
      orchestration.advance(plan.id, { idempotencyKey: 'race-1' }),
      orchestration.advance(plan.id, { idempotencyKey: 'race-2' }),
      orchestration.advance(plan.id, { idempotencyKey: 'race-3' }),
    ]);
    assert.strictEqual(advanceResults.length, 3);
    const proposalCount = controlledActions.store.handle.prepare('SELECT COUNT(*) c FROM action_proposals WHERE sourcePlanId = ?').get(plan.id) as { c: number };
    assert.strictEqual(proposalCount.c, 1, 'concurrent advance() calls must never create two proposals for the same step');
    const finalD5 = delegation.get(d5.id);
    assert.ok(finalD5.usedExecutions <= 1, 'delegation quota must never be double-consumed by concurrent advance() calls');
    console.log('PASS: concurrent orchestration advance() calls never double-authorize or double-consume quota');

    console.log('[delegation-concurrency] PASS');
  } finally {
    orchestration.close();
    delegation.close();
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (e) { console.error('cleanup warning:', e); }
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
