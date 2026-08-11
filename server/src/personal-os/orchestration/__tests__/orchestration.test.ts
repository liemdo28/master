import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GovernedOrchestrationService } from '../service';

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phase5h-orchestration-'));
}

function gmailPayload(subject = 'Follow-up') {
  // Payload must differ per scenario — ControlledActionService derives idempotencyKey
  // deterministically from {actionType, targetSystem, requestedOperation,
  // normalizedPayload}, so identical payloads across scenarios collide by design (the
  // same idempotency guarantee this test suite is verifying elsewhere).
  return { to: ['owner@example.com'], subject, body: 'Draft body.', projectId: 'mi-core', reason: 'Customer follow-up' };
}

async function main() {
  const root = tempRoot();
  const service = new GovernedOrchestrationService(root);
  try {
    // ── A: read-only/local plan completes with zero external side effect ──
    const readPlan = service.createPlan({
      title: 'Summarize project risks', objective: 'Summarize current project risks.', projectId: 'mi-core',
      steps: [
        { key: 'retrieve', type: 'READ_ONLY', description: 'Retrieve risk context.' },
        { key: 'summarize', type: 'LOCAL_COMPUTE', description: 'Summarize locally.', dependsOnKeys: ['retrieve'] },
      ],
    });
    assert.strictEqual(readPlan.status, 'DRAFT');
    const readValidation = service.validate(readPlan.id);
    assert.strictEqual(readValidation.valid, true);
    assert.deepStrictEqual(readValidation.topologicalOrder.length, 2);
    service.start(readPlan.id);
    const readAdvance = await service.advance(readPlan.id);
    assert.strictEqual(readAdvance.plan.status, 'COMPLETED');
    assert.strictEqual(readAdvance.stepsAdvanced, 2);

    // ── B: Gmail draft plan reaches WAITING_APPROVAL, never auto-executes ──
    const mailPlan = service.createPlan({
      title: 'Prepare a follow-up email draft', objective: 'Prepare a follow-up email draft.', projectId: 'mi-core',
      steps: [
        { key: 'context', type: 'READ_ONLY', description: 'Gather context.' },
        { key: 'draft', type: 'CONTROLLED_ACTION', description: 'Create Gmail draft.', dependsOnKeys: ['context'], actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('Scenario B follow-up') },
      ],
    });
    assert.strictEqual(service.validate(mailPlan.id).valid, true);
    service.start(mailPlan.id);
    const firstAdvance = await service.advance(mailPlan.id);
    assert.strictEqual(firstAdvance.plan.status, 'WAITING_APPROVAL');
    const mailSteps = service.detail(mailPlan.id).steps;
    const draftStep = mailSteps.find(s => s.key === 'draft')!;
    assert.strictEqual(draftStep.status, 'WAITING_APPROVAL');
    assert.ok(draftStep.proposalId);

    // duplicate advance before approval must not change anything or duplicate a proposal
    const dup = await service.advance(mailPlan.id);
    assert.strictEqual(dup.plan.status, 'WAITING_APPROVAL');
    const proposalId = draftStep.proposalId!;
    assert.strictEqual(service.detail(mailPlan.id).steps.find(s => s.key === 'draft')!.proposalId, proposalId);

    // Approval happens through the EXISTING Controlled Actions surface, never through
    // the orchestration service — this is the whole point of the approval boundary.
    await service.controlledActions.approve(proposalId, { approver: 'test', source: 'test' });
    const afterApproval = await service.advance(mailPlan.id);
    assert.strictEqual(afterApproval.plan.status, 'COMPLETED');
    assert.strictEqual(service.detail(mailPlan.id).steps.find(s => s.key === 'draft')!.status, 'COMPLETED');

    // duplicate advance after completion must not re-execute or error
    const afterCompletion = await service.advance(mailPlan.id);
    assert.strictEqual(afterCompletion.stepsAdvanced, 0);
    assert.strictEqual(afterCompletion.plan.status, 'COMPLETED');

    // ── D: multi-action plan — independent approvals, one cannot authorize the other ──
    const multiPlan = service.createPlan({
      title: 'Prepare tomorrow customer follow-up', objective: 'Prepare tomorrow\'s customer follow-up.', projectId: 'mi-core',
      steps: [
        { key: 'retrieve', type: 'READ_ONLY', description: 'Retrieve context.' },
        { key: 'draft', type: 'CONTROLLED_ACTION', description: 'Gmail draft.', dependsOnKeys: ['retrieve'], actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('Scenario D follow-up') },
        {
          key: 'calendar', type: 'CONTROLLED_ACTION', description: 'Calendar proposal.', dependsOnKeys: ['retrieve'], actionType: 'CALENDAR_EVENT_PROPOSAL',
          actionPayload: { title: 'Follow-up call', start: new Date(Date.now() + 86_400_000).toISOString(), end: new Date(Date.now() + 90_000_000).toISOString(), timezone: 'Asia/Saigon', attendees: ['owner@example.com'], projectId: 'mi-core', conflicts: [] },
        },
      ],
    });
    assert.strictEqual(service.validate(multiPlan.id).valid, true);
    service.start(multiPlan.id);
    await service.advance(multiPlan.id);
    const multiSteps = service.detail(multiPlan.id).steps;
    const draftId = multiSteps.find(s => s.key === 'draft')!.proposalId!;
    const calId = multiSteps.find(s => s.key === 'calendar')!.proposalId!;
    assert.notStrictEqual(draftId, calId);
    // approve ONLY the draft — the calendar step must remain untouched
    await service.controlledActions.approve(draftId, { approver: 'test', source: 'test' });
    await service.advance(multiPlan.id);
    const afterOneApproval = service.detail(multiPlan.id).steps;
    assert.strictEqual(afterOneApproval.find(s => s.key === 'draft')!.status, 'COMPLETED');
    assert.strictEqual(afterOneApproval.find(s => s.key === 'calendar')!.status, 'WAITING_APPROVAL');
    assert.strictEqual(service.controlledActions.get(calId).status, 'WAITING_APPROVAL'); // never auto-approved by draft's approval

    // ── E: forbidden Gmail SEND rejected before execution ──
    assert.throws(() => service.createPlan({
      title: 'x', objective: 'x', steps: [{ key: 's', type: 'CONTROLLED_ACTION', description: 'x', actionType: 'GMAIL_SEND_DRAFT' as any, actionPayload: {} }],
    }), /not an allowed Controlled Action type/);

    // ── cycle rejected ──
    const cyclePlan = service.createPlan({
      title: 'cycle', objective: 'cycle', steps: [
        { key: 'a', type: 'LOCAL_COMPUTE', description: 'a', dependsOnKeys: ['b'] },
        { key: 'b', type: 'LOCAL_COMPUTE', description: 'b', dependsOnKeys: ['a'] },
      ],
    });
    const cycleResult = service.validate(cyclePlan.id);
    assert.strictEqual(cycleResult.valid, false);
    assert.ok(cycleResult.issues.some(i => i.code === 'CYCLE'));

    // ── plan versioning: material change creates a new version, old approvals do not carry ──
    const v1 = service.createPlan({
      title: 'versioned', objective: 'v1', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'draft', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('Versioning scenario v1') }],
    });
    service.validate(v1.id);
    service.start(v1.id);
    await service.advance(v1.id);
    const v1ProposalId = service.detail(v1.id).steps[0].proposalId!;
    const v2 = service.createNewVersion(v1.id, {
      title: 'versioned', objective: 'v2 — changed payload', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'draft v2', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: { ...gmailPayload(), subject: 'Changed subject' } }],
    });
    assert.strictEqual(v2.planVersion, 2);
    assert.strictEqual(v2.previousVersionId, v1.id);
    assert.strictEqual(service.get(v1.id).status, 'CANCELLED');
    assert.strictEqual(service.controlledActions.get(v1ProposalId).status, 'REJECTED'); // old proposal must not remain WAITING_APPROVAL
    assert.strictEqual(service.detail(v2.id).steps[0].proposalId, null); // fresh, no carried-over approval

    console.log('[orchestration] PASS');
  } finally {
    service.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
