import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DelegationService } from '../service';
import { GovernedOrchestrationService } from '../../orchestration/service';

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phase5i-'));
}

function baseInput(overrides: any = {}) {
  return {
    title: 'Test delegation', description: 'x', owner: 'liem', projectId: 'mi-core',
    allowedActionTypes: ['GMAIL_CREATE_DRAFT'],
    targetRestriction: { allowedDomains: ['example.com'], maxRecipients: 3 },
    riskCeiling: 'R2', approvalLevelCeiling: 'STANDARD',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    timezone: 'UTC', maxExecutions: 3,
    ...overrides,
  };
}

async function main() {
  const root = tempRoot();
  const delegation = new DelegationService(root);
  const orchestration = new GovernedOrchestrationService(root, delegation);
  try {
    // ── create -> submit -> approve -> ACTIVE ──
    const d = delegation.createDelegation(baseInput());
    assert.strictEqual(d.status, 'DRAFT');
    assert.strictEqual(d.delegationVersion, 1);
    assert.ok(d.delegationPayloadHash);

    delegation.submitForApproval(d.id);
    assert.strictEqual(delegation.get(d.id).status, 'WAITING_APPROVAL');

    // Mi cannot self-approve
    for (const badApprover of ['mi', 'system', 'automation', 'delegation', 'ai', '']) {
      assert.throws(() => delegation.approve(d.id, { approver: badApprover, strongConfirmation: `AUTHORIZE:${d.id}` }));
    }

    // deliberate confirmation required — no shortcut
    assert.throws(() => delegation.approve(d.id, { approver: 'liem', strongConfirmation: '' }));
    assert.throws(() => delegation.approve(d.id, { approver: 'liem', strongConfirmation: 'yes' }));
    assert.throws(() => delegation.approve(d.id, { approver: 'liem', strongConfirmation: 'AUTHORIZE:wrong-id' }));

    const active = delegation.approve(d.id, { approver: 'liem', strongConfirmation: `AUTHORIZE:${d.id}` });
    assert.strictEqual(active.status, 'ACTIVE');
    assert.ok(active.approvedAt);
    assert.ok(active.activatedAt);

    const snapshot = delegation.store.getVersionSnapshot(d.id, 1);
    assert.ok(snapshot, 'immutable version snapshot must exist after strong approval');
    assert.strictEqual(snapshot.approver, 'liem');

    // ── orchestration integration: delegated action auto-executes ──
    const plan = orchestration.createPlan({
      title: 'x', objective: 'o', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT',
        actionPayload: { to: ['owner@example.com'], subject: 'delegated-1', body: 'b', projectId: 'mi-core', reason: 'r' } }],
    });
    orchestration.validate(plan.id);
    orchestration.start(plan.id);
    await orchestration.advance(plan.id);
    assert.strictEqual(orchestration.detail(plan.id).steps[0].status, 'COMPLETED');
    assert.strictEqual(orchestration.get(plan.id).status, 'COMPLETED');

    const proposalId = orchestration.detail(plan.id).steps[0].proposalId!;
    const approvalRow = delegation.controlledActions.get(proposalId);
    assert.ok(approvalRow.status === 'COMPLETED');
    const latestApproval = delegation.controlledActions.store.latestApproval(proposalId);
    assert.ok(latestApproval && latestApproval.approver.startsWith('delegation:'), 'approver identity must show which delegation authorized it');

    assert.strictEqual(delegation.get(d.id).usedExecutions, 1);

    // ── evidence trail is complete ──
    const evidence = delegation.evidence(d.id);
    const eventTypes = evidence.events.map(e => e.eventType);
    assert.ok(eventTypes.includes('delegation.created'));
    assert.ok(eventTypes.includes('delegation.approved'));
    assert.ok(eventTypes.includes('delegation.activated'));
    assert.ok(eventTypes.includes('delegation.evaluated'));
    assert.ok(eventTypes.includes('delegation.quota.reserved'));
    assert.ok(eventTypes.includes('delegation.execution.authorized'));
    assert.ok(evidence.decisions.length >= 1);
    assert.ok(evidence.decisions[0].eligible);

    // ── revoke blocks further execution ──
    const d2 = delegation.createDelegation(baseInput({ title: 'to be revoked' }));
    delegation.submitForApproval(d2.id);
    delegation.approve(d2.id, { approver: 'liem', strongConfirmation: `AUTHORIZE:${d2.id}` });
    delegation.revoke(d2.id, 'liem', 'no longer needed');
    assert.strictEqual(delegation.get(d2.id).status, 'REVOKED');
    assert.throws(() => delegation.revoke(d2.id, 'liem', 'again'), /cannot transition/);

    const planAfterRevoke = orchestration.createPlan({
      title: 'x', objective: 'o', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT',
        actionPayload: { to: ['owner@example.com'], subject: 'after-revoke-of-d2-but-d-still-active', body: 'b', projectId: 'mi-core', reason: 'r' } }],
    });
    orchestration.validate(planAfterRevoke.id);
    orchestration.start(planAfterRevoke.id);
    await orchestration.advance(planAfterRevoke.id);
    // d (the OTHER, still-ACTIVE delegation) should still authorize — revoking d2 must not affect d
    assert.strictEqual(orchestration.get(planAfterRevoke.id).status, 'COMPLETED');

    // ── cancel a DRAFT delegation before activation ──
    const d3 = delegation.createDelegation(baseInput({ title: 'to be cancelled' }));
    delegation.cancel(d3.id, 'liem', 'changed my mind');
    assert.strictEqual(delegation.get(d3.id).status, 'CANCELLED');

    console.log('[delegation] PASS');
  } finally {
    orchestration.close();
    delegation.close();
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (e) { console.error('cleanup warning:', e); }
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
