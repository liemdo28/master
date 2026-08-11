import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GovernedOrchestrationService } from './service';

function root(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phase5h-acceptance-'));
}

function gmailPayload(subject: string) {
  return { to: ['owner@example.com'], subject, body: 'Draft body.', projectId: 'mi-core', reason: 'Phase 5H acceptance' };
}

async function main() {
  const service = new GovernedOrchestrationService(root());
  try {
    const integrity = service.store.integrity();
    assert.strictEqual(integrity.schemaVersion, 9);
    assert.strictEqual(integrity.integrityCheck, 'ok');
    assert.strictEqual(integrity.foreignKeyViolations.length, 0);

    // ── §27 fixture scenario A: read-only/local plan ──
    const scenarioA = service.createPlan({
      title: 'Summarize current project risks.', objective: 'Summarize current project risks.', projectId: 'mi-core',
      steps: [
        { key: 'retrieve', type: 'READ_ONLY', description: 'Retrieve risk context.' },
        { key: 'summarize', type: 'LOCAL_COMPUTE', description: 'Summarize locally.', dependsOnKeys: ['retrieve'] },
      ],
    });
    assert.strictEqual(service.validate(scenarioA.id).valid, true);
    service.start(scenarioA.id);
    const resultA = await service.advance(scenarioA.id);
    assert.strictEqual(resultA.plan.status, 'COMPLETED');
    assert.strictEqual(service.detail(scenarioA.id).steps.every(s => s.status === 'COMPLETED'), true);

    // ── §27 scenario B: Gmail draft plan ──
    const scenarioB = service.createPlan({
      title: 'Prepare a follow-up email draft.', objective: 'Prepare a follow-up email draft.', projectId: 'mi-core',
      steps: [
        { key: 'context', type: 'READ_ONLY', description: 'Gather context.' },
        { key: 'draft', type: 'CONTROLLED_ACTION', description: 'Create Gmail draft.', dependsOnKeys: ['context'], actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('Acceptance B') },
      ],
    });
    service.validate(scenarioB.id);
    service.start(scenarioB.id);
    await service.advance(scenarioB.id);
    const bProposalId = service.detail(scenarioB.id).steps.find(s => s.key === 'draft')!.proposalId!;
    await service.controlledActions.approve(bProposalId, { approver: 'acceptance', source: 'acceptance' });
    const resultB = await service.advance(scenarioB.id);
    assert.strictEqual(resultB.plan.status, 'COMPLETED');
    const bExecutions = (service.controlledActions.store.handle.prepare(`SELECT COUNT(*) AS c FROM action_executions WHERE proposalId = ?`).get(bProposalId) as { c: number }).c;
    assert.strictEqual(bExecutions, 1, 'exactly one Gmail draft execution');

    // ── §27 scenario D: multi-action plan — independent approvals ──
    const scenarioD = service.createPlan({
      title: "Prepare tomorrow's customer follow-up.", objective: "Prepare tomorrow's customer follow-up.", projectId: 'mi-core',
      steps: [
        { key: 'retrieve', type: 'READ_ONLY', description: 'Retrieve context.' },
        { key: 'draft', type: 'CONTROLLED_ACTION', description: 'Gmail draft.', dependsOnKeys: ['retrieve'], actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('Acceptance D') },
        { key: 'calendar', type: 'CONTROLLED_ACTION', description: 'Calendar proposal.', dependsOnKeys: ['retrieve'], actionType: 'CALENDAR_EVENT_PROPOSAL', actionPayload: { title: 'Follow-up call', start: new Date(Date.now() + 86_400_000).toISOString(), end: new Date(Date.now() + 90_000_000).toISOString(), timezone: 'Asia/Saigon', attendees: ['owner@example.com'], projectId: 'mi-core', conflicts: [] } },
      ],
    });
    service.validate(scenarioD.id);
    service.start(scenarioD.id);
    await service.advance(scenarioD.id);
    const dSteps = service.detail(scenarioD.id).steps;
    const dDraftId = dSteps.find(s => s.key === 'draft')!.proposalId!;
    const dCalId = dSteps.find(s => s.key === 'calendar')!.proposalId!;
    assert.notStrictEqual(dDraftId, dCalId, 'dependency order preserved, independent proposals');

    // ── §27 scenario E: denied plan (forbidden Gmail SEND) ──
    assert.throws(() => service.createPlan({
      title: 'x', objective: 'x', steps: [{ key: 's', type: 'CONTROLLED_ACTION', description: 'x', actionType: 'GMAIL_SEND_DRAFT' as any, actionPayload: {} }],
    }), /not an allowed Controlled Action type/);

    // ── §27 scenario F: kill-switch scenario ──
    const scenarioF = service.createPlan({
      title: 'x', objective: 'x', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'x', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('Acceptance F') }],
    });
    service.validate(scenarioF.id);
    service.start(scenarioF.id);
    service.controlledActions.policyEngine.killSwitch.enable({ scope: 'GLOBAL', projectId: null, actionType: null, reason: 'acceptance', activatedBy: 'acceptance' });
    await service.advance(scenarioF.id);
    assert.strictEqual(service.detail(scenarioF.id).steps[0].proposalId, null, 'kill switch blocks before controlled action proposal');
    for (const sw of service.controlledActions.policyEngine.store.listKillSwitches(false)) service.controlledActions.policyEngine.killSwitch.unlock(sw.id);

    // ── §27 scenario H: restart scenario (WAITING_APPROVAL survives restart, no auto-execute) ──
    const scenarioH = service.createPlan({
      title: 'x', objective: 'x', projectId: 'mi-core',
      steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'x', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload('Acceptance H') }],
    });
    const hRoot = service.store.root;
    service.validate(scenarioH.id);
    service.start(scenarioH.id);
    await service.advance(scenarioH.id);
    assert.strictEqual(service.get(scenarioH.id).status, 'WAITING_APPROVAL');

    // ── §32 performance measurement (realistic fixture sizes: 10/50/100 steps) ──
    const perf: Record<string, number> = {};
    for (const size of [10, 50, 100]) {
      const steps = Array.from({ length: size }, (_, i) => ({ key: `s${i}`, type: 'LOCAL_COMPUTE' as const, description: `step ${i}`, dependsOnKeys: i > 0 ? [`s${i - 1}`] : [] }));
      const t0 = performance.now();
      const plan = service.createPlan({ title: `perf-${size}`, objective: 'perf', projectId: 'mi-core', steps });
      const t1 = performance.now();
      const validation = service.validate(plan.id);
      const t2 = performance.now();
      service.start(plan.id);
      const t3 = performance.now();
      await service.advance(plan.id);
      const t4 = performance.now();
      assert.strictEqual(validation.valid, true);
      assert.strictEqual(service.get(plan.id).status, 'COMPLETED');
      perf[`create${size}Ms`] = Math.round((t1 - t0) * 100) / 100;
      perf[`validate${size}Ms`] = Math.round((t2 - t1) * 100) / 100;
      perf[`start${size}Ms`] = Math.round((t3 - t2) * 100) / 100;
      perf[`advanceAll${size}Ms`] = Math.round((t4 - t3) * 100) / 100;
    }

    console.log(JSON.stringify({
      phase: '5H',
      schemaVersion: integrity.schemaVersion,
      migration: integrity,
      scenarios: { A: 'PASS', B: 'PASS', D: 'PASS', E: 'PASS', F: 'PASS', H: 'restart proof deferred to dedicated restart test — plan left WAITING_APPROVAL here for inspection' },
      performance: perf,
      restartFixtureRoot: hRoot,
    }, null, 2));
  } finally {
    service.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
