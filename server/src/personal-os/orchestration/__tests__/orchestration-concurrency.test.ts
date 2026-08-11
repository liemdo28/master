import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GovernedOrchestrationService } from '../service';

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phase5h-concurrency-'));
}

function gmailPayload(subject: string) {
  return { to: ['owner@example.com'], subject, body: 'Draft body.', projectId: 'mi-core', reason: 'Concurrency test' };
}

async function main() {
  const root = tempRoot();
  const service = new GovernedOrchestrationService(root);
  try {
    // ── concurrent duplicate advance() calls on the same plan must not double-execute
    // any step or create two proposals for the same controlled-action step ──
    const plan = service.createPlan({
      title: 'x', objective: 'x', projectId: 'mi-core',
      steps: [
        { key: 'a', type: 'LOCAL_COMPUTE', description: 'a' },
        { key: 'draft', type: 'CONTROLLED_ACTION', description: 'draft', dependsOnKeys: ['a'], actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('concurrency-test') },
      ],
    });
    service.validate(plan.id);
    service.start(plan.id);

    // Fire several advance() calls "concurrently" (same event loop tick, no shared
    // idempotencyKey) — this is what two racing HTTP requests hitting /advance would
    // look like. claimStep()'s conditional UPDATE (WHERE status = fromStatus) is the
    // actual concurrency guard; only one of these should ever claim+advance any given
    // step past its current state on a given call.
    const results = await Promise.all([
      service.advance(plan.id, { idempotencyKey: 'concurrent-1' }),
      service.advance(plan.id, { idempotencyKey: 'concurrent-2' }),
      service.advance(plan.id, { idempotencyKey: 'concurrent-3' }),
    ]);
    assert.strictEqual(results.length, 3);

    const steps = service.detail(plan.id).steps;
    const draftStep = steps.find(s => s.key === 'draft')!;
    assert.ok(draftStep.proposalId, 'exactly one proposal must exist for the draft step');
    // Only one proposal should ever have been created for this step, regardless of how
    // many concurrent advance() calls raced — confirmed by the action_proposals table
    // itself having exactly one row sourced from this plan for this step key.
    const proposalCount = (service.controlledActions.store.handle
      .prepare(`SELECT COUNT(*) AS c FROM action_proposals WHERE sourcePlanId = ?`).get(plan.id) as { c: number }).c;
    assert.strictEqual(proposalCount, 1, 'concurrent advance calls must never create two proposals for the same step');

    const proposalId = draftStep.proposalId!;
    await service.controlledActions.approve(proposalId, { approver: 'test', source: 'test' });

    // ── concurrent duplicate execution attempts must not duplicate the external side
    // effect — this is enforced by the existing ControlledActionService's
    // idempotencyKey UNIQUE constraint on action_executions, reached identically
    // whether triggered by orchestration's advance() or a direct execute() call ──
    const executions = await Promise.all([
      service.controlledActions.execute(proposalId),
      service.controlledActions.execute(proposalId),
      service.controlledActions.execute(proposalId),
    ]);
    const executionIds = new Set(executions.map(e => e.id));
    assert.strictEqual(executionIds.size, 1, 'concurrent execute() calls on the same proposal must all resolve to the same single execution record');
    const executionCount = (service.controlledActions.store.handle
      .prepare(`SELECT COUNT(*) AS c FROM action_executions WHERE proposalId = ?`).get(proposalId) as { c: number }).c;
    assert.strictEqual(executionCount, 1, 'exactly one execution row must exist regardless of concurrent execute() calls');

    console.log('[orchestration-concurrency] PASS');
  } finally {
    service.close();
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (e) { console.error('cleanup warning:', e); }
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
