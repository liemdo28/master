import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GovernedOrchestrationService } from '../service';

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phase5h-restart-'));
}

function gmailPayload(subject: string) {
  return { to: ['owner@example.com'], subject, body: 'Draft body.', projectId: 'mi-core', reason: 'Restart test' };
}

/** Simulates a process restart: close the current service, open a fresh one against
 *  the same on-disk root — no in-memory state survives, only what's in the DB. */
function restart(root: string): GovernedOrchestrationService {
  return new GovernedOrchestrationService(root);
}

async function main() {
  const root = tempRoot();
  let service = new GovernedOrchestrationService(root);
  try {
    // ── restart at DRAFT ──
    const draftPlan = service.createPlan({
      title: 'x', objective: 'x', projectId: 'mi-core',
      steps: [{ key: 'a', type: 'LOCAL_COMPUTE', description: 'a' }],
    });
    service.close();
    service = restart(root);
    const afterDraft = service.get(draftPlan.id);
    assert.strictEqual(afterDraft.id, draftPlan.id);
    assert.strictEqual(afterDraft.planVersion, 1);
    assert.strictEqual(afterDraft.status, 'DRAFT');

    // ── restart at VALIDATED ──
    service.validate(draftPlan.id);
    service.close();
    service = restart(root);
    assert.strictEqual(service.get(draftPlan.id).status, 'VALIDATED');

    // ── restart after a local step completed (simulates "RUNNING local step" then
    // crash — the completed step must not be repeated) ──
    service.start(draftPlan.id);
    await service.advance(draftPlan.id);
    assert.strictEqual(service.get(draftPlan.id).status, 'COMPLETED');
    const completedEvidenceCountBefore = service.evidence(draftPlan.id).filter(e => e.eventType === 'STEP_EXECUTED').length;
    service.close();
    service = restart(root);
    await service.advance(draftPlan.id); // must be a no-op — plan already COMPLETED
    const completedEvidenceCountAfter = service.evidence(draftPlan.id).filter(e => e.eventType === 'STEP_EXECUTED').length;
    assert.strictEqual(completedEvidenceCountAfter, completedEvidenceCountBefore, 'completed step must not be repeated after restart');

    // ── restart at WAITING_APPROVAL — must remain WAITING_APPROVAL, no auto-execute ──
    const waitPlan = service.createPlan({
      title: 'x', objective: 'x', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'draft', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('restart-waiting') }],
    });
    service.validate(waitPlan.id);
    service.start(waitPlan.id);
    await service.advance(waitPlan.id);
    assert.strictEqual(service.get(waitPlan.id).status, 'WAITING_APPROVAL');
    const proposalId = service.detail(waitPlan.id).steps[0].proposalId!;
    service.close();
    service = restart(root);
    assert.strictEqual(service.get(waitPlan.id).status, 'WAITING_APPROVAL', 'restart must not auto-advance a waiting plan');
    assert.strictEqual(service.controlledActions.get(proposalId).status, 'WAITING_APPROVAL', 'restart must not auto-approve the underlying proposal');
    // advancing after restart, still unapproved, must not execute anything
    const noExec = await service.advance(waitPlan.id);
    assert.strictEqual(noExec.stepsAdvanced, 0);
    assert.strictEqual(service.get(waitPlan.id).status, 'WAITING_APPROVAL');

    // ── restart after Controlled Action execution — must not repeat the execution ──
    await service.controlledActions.approve(proposalId, { approver: 'test', source: 'test' });
    await service.advance(waitPlan.id);
    assert.strictEqual(service.get(waitPlan.id).status, 'COMPLETED');
    const executionsBefore = service.controlledActions.detail(proposalId).executions.length;
    service.close();
    service = restart(root);
    await service.advance(waitPlan.id); // no-op, plan already COMPLETED
    const executionsAfter = service.controlledActions.detail(proposalId).executions.length;
    assert.strictEqual(executionsAfter, executionsBefore, 'restart must not repeat a completed external execution');

    // ── restart while PAUSED (e.g. by kill switch) — must remain enforced ──
    const killPlan = service.createPlan({
      title: 'x', objective: 'x', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'draft', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('restart-killswitch') }],
    });
    service.validate(killPlan.id);
    service.start(killPlan.id);
    service.controlledActions.policyEngine.killSwitch.enable({ scope: 'GLOBAL', projectId: null, actionType: null, reason: 'restart test', activatedBy: 'test' });
    const killAdvance = await service.advance(killPlan.id);
    assert.strictEqual(service.detail(killPlan.id).steps[0].proposalId, null, 'kill switch must block proposal creation entirely');
    service.close();
    service = restart(root);
    // Kill switch state itself lives in the governance store (same DB) — confirm it is
    // still enforced after restart, not just "was enforced before".
    const stillKilled = service.controlledActions.policyEngine.killSwitch.state({ projectId: null, actionType: 'GMAIL_CREATE_DRAFT' });
    assert.strictEqual(stillKilled.blocked, true, 'kill switch must remain effective after restart');
    const killAdvance2 = await service.advance(killPlan.id);
    assert.strictEqual(service.detail(killPlan.id).steps[0].proposalId, null, 'kill switch must still block after restart');

    console.log('[orchestration-restart] PASS');
  } finally {
    service.close();
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (e) { console.error('cleanup warning:', e); }
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
