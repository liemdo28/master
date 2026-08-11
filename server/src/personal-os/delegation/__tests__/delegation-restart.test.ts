import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DelegationService } from '../service';
import { GovernedOrchestrationService } from '../../orchestration/service';

function tempRoot(): string { return fs.mkdtempSync(path.join(os.tmpdir(), 'phase5i-restart-')); }

function restart(root: string): DelegationService { return new DelegationService(root); }

function baseInput(overrides: any = {}) {
  return {
    title: 'Restart test', description: 'x', owner: 'liem', projectId: 'mi-core',
    allowedActionTypes: ['GMAIL_CREATE_DRAFT'],
    targetRestriction: { allowedDomains: ['example.com'], maxRecipients: 3 },
    riskCeiling: 'R2', approvalLevelCeiling: 'STANDARD',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    timezone: 'UTC', maxExecutions: 2,
    ...overrides,
  };
}

async function main() {
  const root = tempRoot();
  let delegation = new DelegationService(root);
  try {
    // ── restart at DRAFT ──
    const draft = delegation.createDelegation(baseInput({ title: 'draft-restart' }));
    delegation.close();
    delegation = restart(root);
    assert.strictEqual(delegation.get(draft.id).status, 'DRAFT');
    assert.strictEqual(delegation.get(draft.id).delegationVersion, 1);

    // ── restart at WAITING_APPROVAL ──
    delegation.submitForApproval(draft.id);
    delegation.close();
    delegation = restart(root);
    assert.strictEqual(delegation.get(draft.id).status, 'WAITING_APPROVAL', 'restart must never auto-approve');

    // ── restart at ACTIVE ──
    delegation.approve(draft.id, { approver: 'liem', strongConfirmation: `AUTHORIZE:${draft.id}` });
    delegation.close();
    delegation = restart(root);
    const activeAfterRestart = delegation.get(draft.id);
    assert.strictEqual(activeAfterRestart.status, 'ACTIVE');
    assert.ok(activeAfterRestart.activatedAt);

    // ── restart after quota reservation (via a real orchestration execution) ──
    let orchestration = new GovernedOrchestrationService(root, delegation);
    const plan = orchestration.createPlan({
      title: 'x', objective: 'o', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT',
        actionPayload: { to: ['owner@example.com'], subject: 'restart-quota', body: 'b', projectId: 'mi-core', reason: 'r' } }],
    });
    orchestration.validate(plan.id);
    orchestration.start(plan.id);
    await orchestration.advance(plan.id);
    assert.strictEqual(orchestration.detail(plan.id).steps[0].status, 'COMPLETED');
    const usedBeforeRestart = delegation.get(draft.id).usedExecutions;
    assert.strictEqual(usedBeforeRestart, 1);

    orchestration.close();
    delegation.close();
    delegation = restart(root);
    orchestration = new GovernedOrchestrationService(root, delegation);
    assert.strictEqual(delegation.get(draft.id).usedExecutions, 1, 'quota usage must persist across restart');

    // ── restart after successful execution: replaying advance() must not repeat it ──
    const noop = await orchestration.advance(plan.id);
    assert.strictEqual(noop.stepsAdvanced, 0);
    assert.strictEqual(delegation.get(draft.id).usedExecutions, 1, 'completed execution must not repeat after restart');
    orchestration.close();

    // ── restart near expiry: still correctly evaluated as expired once past the boundary ──
    const nearExpiry = delegation.createDelegation(baseInput({ title: 'near-expiry', expiresAt: new Date(Date.now() + 300).toISOString() }));
    delegation.submitForApproval(nearExpiry.id);
    delegation.approve(nearExpiry.id, { approver: 'liem', strongConfirmation: `AUTHORIZE:${nearExpiry.id}` });
    await new Promise(r => setTimeout(r, 400));
    delegation.close();
    delegation = restart(root);
    assert.strictEqual(delegation.get(nearExpiry.id).status, 'EXPIRED', 'restart must correctly evaluate an authority that expired while the process was down');

    // ── restart at PAUSED ──
    const pausable = delegation.createDelegation(baseInput({ title: 'pausable' }));
    delegation.submitForApproval(pausable.id);
    delegation.approve(pausable.id, { approver: 'liem', strongConfirmation: `AUTHORIZE:${pausable.id}` });
    delegation.pause(pausable.id, 'liem', 'manual pause for restart test');
    delegation.close();
    delegation = restart(root);
    assert.strictEqual(delegation.get(pausable.id).status, 'PAUSED', 'restart must preserve PAUSED, never silently resume');

    // ── restart at REVOKED — must remain revoked, cannot reactivate ──
    const revocable = delegation.createDelegation(baseInput({ title: 'revocable' }));
    delegation.submitForApproval(revocable.id);
    delegation.approve(revocable.id, { approver: 'liem', strongConfirmation: `AUTHORIZE:${revocable.id}` });
    delegation.revoke(revocable.id, 'liem', 'restart test revoke');
    delegation.close();
    delegation = restart(root);
    assert.strictEqual(delegation.get(revocable.id).status, 'REVOKED');
    assert.throws(() => delegation.approve(revocable.id, { approver: 'liem', strongConfirmation: `AUTHORIZE:${revocable.id}` }), /cannot transition/, 'a revoked delegation must never be reactivatable, even after restart');

    // ── no authority expansion across restart: quota/window/scope identical ──
    const finalState = delegation.get(draft.id);
    assert.strictEqual(finalState.maxExecutions, 2);
    assert.strictEqual(finalState.riskCeiling, 'R2');
    assert.deepStrictEqual(finalState.targetRestriction, { allowedDomains: ['example.com'], maxRecipients: 3 });

    console.log('[delegation-restart] PASS');
  } finally {
    delegation.close();
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (e) { console.error('cleanup warning:', e); }
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
