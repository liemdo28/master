import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GovernedOrchestrationService } from '../service';

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phase5h-security-'));
}

function gmailPayload(subject: string) {
  return { to: ['owner@example.com'], subject, body: 'Draft body.', projectId: 'mi-core', reason: 'Security test' };
}

async function main() {
  const root = tempRoot();
  const service = new GovernedOrchestrationService(root);
  try {
    // ── plan cannot contain unknown external action ──
    assert.throws(() => service.createPlan({
      title: 'x', objective: 'x', steps: [{ key: 's', type: 'CONTROLLED_ACTION', description: 'x', actionType: 'UNKNOWN_ACTION_TYPE' as any, actionPayload: {} }],
    }), /not an allowed Controlled Action type/);

    // ── Gmail SEND rejected ──
    assert.throws(() => service.createPlan({
      title: 'x', objective: 'x', steps: [{ key: 's', type: 'CONTROLLED_ACTION', description: 'x', actionType: 'GMAIL_SEND_DRAFT' as any, actionPayload: {} }],
    }), /not an allowed Controlled Action type/);

    // ── arbitrary connector action rejected ──
    assert.throws(() => service.createPlan({
      title: 'x', objective: 'x', steps: [{ key: 's', type: 'CONTROLLED_ACTION', description: 'x', actionType: 'SLACK_POST_MESSAGE' as any, actionPayload: {} }],
    }), /not an allowed Controlled Action type/);

    // ── arbitrary shell step rejected — there is no step `type` that permits it; only
    // READ_ONLY, LOCAL_COMPUTE, CONTROLLED_ACTION exist, and CONTROLLED_ACTION requires
    // an allow-listed actionType, so "shell" can never be expressed as a step at all ──
    assert.throws(() => service.createPlan({
      title: 'x', objective: 'x', steps: [{ key: 's', type: 'SHELL_EXECUTE' as any, description: 'x' }],
    }));

    // ── action cannot execute without required approval ──
    const noApprovalPlan = service.createPlan({
      title: 'x', objective: 'x', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'draft', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('no-approval-test') }],
    });
    service.validate(noApprovalPlan.id);
    service.start(noApprovalPlan.id);
    await service.advance(noApprovalPlan.id);
    const proposalId = service.detail(noApprovalPlan.id).steps[0].proposalId!;
    await assert.rejects(() => service.controlledActions.execute(proposalId), /missing approval/);
    // advancing again must not execute it either — still WAITING_APPROVAL
    await service.advance(noApprovalPlan.id);
    assert.strictEqual(service.detail(noApprovalPlan.id).steps[0].status, 'WAITING_APPROVAL');

    // ── approval cannot cross steps ──
    const twoStepPlan = service.createPlan({
      title: 'x', objective: 'x', projectId: 'mi-core',
      steps: [
        { key: 'draft1', type: 'CONTROLLED_ACTION', description: 'd1', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('cross-step-1') },
        { key: 'draft2', type: 'CONTROLLED_ACTION', description: 'd2', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('cross-step-2') },
      ],
    });
    service.validate(twoStepPlan.id);
    service.start(twoStepPlan.id);
    await service.advance(twoStepPlan.id);
    const [p1, p2] = service.detail(twoStepPlan.id).steps.map(s => s.proposalId!);
    await service.controlledActions.approve(p1, { approver: 'test', source: 'test' });
    // approving p1 must not make p2 approved — this is the exact approval-boundary
    // property the whole orchestration design exists to preserve
    assert.strictEqual(service.controlledActions.get(p2).status, 'WAITING_APPROVAL');
    await assert.rejects(() => service.controlledActions.execute(p2), /missing approval/);

    // ── approval cannot cross plan versions ──
    const v1 = service.createPlan({
      title: 'versioned', objective: 'v1', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'draft', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('version-boundary-v1') }],
    });
    service.validate(v1.id);
    service.start(v1.id);
    await service.advance(v1.id);
    const v1ProposalId = service.detail(v1.id).steps[0].proposalId!;
    await service.controlledActions.approve(v1ProposalId, { approver: 'test', source: 'test' });
    const v2 = service.createNewVersion(v1.id, {
      title: 'versioned', objective: 'v2', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'draft', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('version-boundary-v2') }],
    });
    assert.strictEqual(service.detail(v2.id).steps[0].proposalId, null); // v2's step has its own, unapproved proposal slot
    // The orphaned v1 proposal was already APPROVED (not just WAITING_APPROVAL) when v1
    // was superseded — versioning must not leave an approved-but-unexecuted proposal
    // from a cancelled plan version still executable. Regression test for a real defect
    // found during closure review: cancel() originally only rejected WAITING_APPROVAL
    // proposals, silently leaving already-APPROVED ones dangling and executable.
    assert.strictEqual(service.controlledActions.get(v1ProposalId).status, 'CANCELLED');
    await assert.rejects(() => service.controlledActions.execute(v1ProposalId), 'an approved proposal orphaned by plan versioning must never execute');
    service.validate(v2.id);
    service.start(v2.id);
    await service.advance(v2.id);
    const v2ProposalId = service.detail(v2.id).steps[0].proposalId!;
    assert.notStrictEqual(v2ProposalId, v1ProposalId);
    assert.strictEqual(service.controlledActions.get(v2ProposalId).status, 'WAITING_APPROVAL'); // v1's approval did not carry over

    // ── directly cancelling a plan whose Controlled Action step is already APPROVED
    // (not merely WAITING_APPROVAL) must terminate that proposal too, not just steps
    // still awaiting approval ──
    const cancelApprovedPlan = service.createPlan({
      title: 'x', objective: 'x', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'draft', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('cancel-approved-test') }],
    });
    service.validate(cancelApprovedPlan.id);
    service.start(cancelApprovedPlan.id);
    await service.advance(cancelApprovedPlan.id);
    const cancelApprovedProposalId = service.detail(cancelApprovedPlan.id).steps[0].proposalId!;
    await service.controlledActions.approve(cancelApprovedProposalId, { approver: 'test', source: 'test' });
    assert.strictEqual(service.controlledActions.get(cancelApprovedProposalId).status, 'APPROVED');
    service.cancel(cancelApprovedPlan.id, 'cancel while approved');
    assert.strictEqual(service.controlledActions.get(cancelApprovedProposalId).status, 'CANCELLED');
    await assert.rejects(() => service.controlledActions.execute(cancelApprovedProposalId), 'cancelling a plan must terminate an already-approved, not-yet-executed proposal');

    // ── payload mutation invalidates approval (enforced by the existing Controlled
    // Actions payload-hash check — verified reachable from the orchestration path) ──
    const mutPlan = service.createPlan({
      title: 'x', objective: 'x', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'draft', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('mutation-test') }],
    });
    service.validate(mutPlan.id);
    service.start(mutPlan.id);
    await service.advance(mutPlan.id);
    const mutProposalId = service.detail(mutPlan.id).steps[0].proposalId!;
    await service.controlledActions.approve(mutProposalId, { approver: 'test', source: 'test' });
    // directly corrupt the stored payload to simulate a mutation between approval and execution
    service.controlledActions.store.handle.prepare(`UPDATE action_proposals SET normalizedPayloadJson = ? WHERE id = ?`).run(JSON.stringify({ tampered: true }), mutProposalId);
    await assert.rejects(() => service.controlledActions.execute(mutProposalId), /payload hash mismatch/);
    // The mismatch check runs inside a transaction that rolls back on throw (existing
    // Phase 5F behavior) — the proposal's stored status is unaffected, but the
    // property that matters for Phase 5H is proven: execution is blocked and stays
    // blocked on retry, so a mutated payload can never reach a connector.
    await assert.rejects(() => service.controlledActions.execute(mutProposalId), /payload hash mismatch/);

    // ── expired approval rejected ──
    const expPlan = service.createPlan({
      title: 'x', objective: 'x', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'draft', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('expiry-test') }],
    });
    service.validate(expPlan.id);
    service.start(expPlan.id);
    await service.advance(expPlan.id);
    const expProposalId = service.detail(expPlan.id).steps[0].proposalId!;
    await service.controlledActions.approve(expProposalId, { approver: 'test', source: 'test' });
    service.controlledActions.store.handle.prepare(`UPDATE action_proposals SET expiresAt = ? WHERE id = ?`).run(new Date(Date.now() - 1000).toISOString(), expProposalId);
    service.controlledActions.store.handle.prepare(`UPDATE action_approvals SET expiresAt = ? WHERE proposalId = ?`).run(new Date(Date.now() - 1000).toISOString(), expProposalId);
    await assert.rejects(() => service.controlledActions.execute(expProposalId), /approval expired/);

    // ── cross-project leakage rejected at validation ──
    const crossProjectPlan = service.createPlan({
      title: 'x', objective: 'x', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'draft', projectId: 'other-project', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('cross-project') }],
    });
    const crossResult = service.validate(crossProjectPlan.id);
    assert.strictEqual(crossResult.valid, false);
    assert.ok(crossResult.issues.some(i => i.code === 'CROSS_PROJECT'));

    // ── cancelled plan cannot execute ──
    const cancelPlan = service.createPlan({
      title: 'x', objective: 'x', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'draft', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('cancel-test') }],
    });
    service.validate(cancelPlan.id);
    service.start(cancelPlan.id);
    service.cancel(cancelPlan.id, 'test cancellation');
    const cancelResult = await service.advance(cancelPlan.id);
    assert.strictEqual(cancelResult.stepsAdvanced, 0); // no-op on a terminal (CANCELLED) plan

    // ── failed dependency blocks child ──
    const failChainPlan = service.createPlan({
      title: 'x', objective: 'x', projectId: 'mi-core',
      steps: [
        { key: 'a', type: 'CONTROLLED_ACTION', description: 'forced-fail', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('fail-chain-a') },
        { key: 'b', type: 'LOCAL_COMPUTE', description: 'depends on a', dependsOnKeys: ['a'] },
      ],
    });
    service.validate(failChainPlan.id);
    service.start(failChainPlan.id);
    await service.advance(failChainPlan.id);
    const aStepId = service.detail(failChainPlan.id).steps.find(s => s.key === 'a')!.id;
    // force step 'a' to FAILED directly (simulating a real execution failure) and confirm 'b' never becomes eligible
    service.store.handle.prepare(`UPDATE action_plan_steps SET status = 'FAILED' WHERE id = ?`).run(aStepId);
    await service.advance(failChainPlan.id);
    assert.strictEqual(service.detail(failChainPlan.id).steps.find(s => s.key === 'b')!.status, 'FAILED');

    // ── secrets absent from evidence/API ──
    const evidence = service.evidence(twoStepPlan.id);
    const serialized = JSON.stringify(evidence);
    assert.ok(!/sk-[A-Za-z0-9]{20,}/.test(serialized));
    assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(serialized));
    assert.ok(!/-----BEGIN/.test(serialized));
    // detail() output must not include a raw proposal payload beyond what's already
    // safely exposed by the existing Controlled Actions detail() surface
    const detailSerialized = JSON.stringify(service.detail(twoStepPlan.id));
    assert.ok(!/password|client_secret|refresh_token/i.test(detailSerialized));

    console.log('[orchestration-security] PASS');
  } finally {
    service.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
