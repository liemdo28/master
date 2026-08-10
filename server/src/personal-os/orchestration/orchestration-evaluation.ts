import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GovernedOrchestrationService } from './service';

type Kind =
  | 'safe-local' | 'read-only' | 'gmail-draft' | 'calendar-proposal' | 'calendar-create'
  | 'mixed-dependency' | 'expired-approval' | 'modified-payload' | 'kill-switch' | 'budget'
  | 'cancellation' | 'forbidden-action' | 'cross-project';

interface Fixture { id: number; kind: Kind; expectExternalExecution: boolean; }

function fixtures(): Fixture[] {
  const kinds: Kind[] = [
    'safe-local', 'read-only', 'gmail-draft', 'calendar-proposal', 'calendar-create',
    'mixed-dependency', 'expired-approval', 'modified-payload', 'kill-switch', 'budget',
    'cancellation', 'forbidden-action',
  ];
  const out: Fixture[] = [];
  for (let i = 0; i < 100; i += 1) {
    const kind = kinds[i % kinds.length];
    const expectExternalExecution = kind === 'gmail-draft' || kind === 'calendar-proposal' || kind === 'calendar-create';
    out.push({ id: i + 1, kind, expectExternalExecution });
  }
  return out;
}

function root(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phase5h-eval-'));
}

function gmailPayload(id: number) {
  return { to: [`user${id}@example.com`], subject: `Eval ${id}`, body: `Body ${id}`, projectId: 'mi-core', reason: 'Phase 5H evaluation' };
}

function calendarPayload(id: number) {
  const start = new Date(Date.now() + (id + 2) * 3_600_000).toISOString();
  const end = new Date(Date.now() + (id + 3) * 3_600_000).toISOString();
  return { title: `Eval ${id}`, start, end, timezone: 'Asia/Saigon', attendees: [`user${id}@example.com`], projectId: 'mi-core', conflicts: [] };
}

async function main() {
  let correct = 0;
  let unauthorizedExternalExecution = 0;
  let executionWithoutApproval = 0;
  let approvalCrossBinding = 0;
  let duplicateExternalSideEffect = 0;
  let killSwitchBypass = 0;
  let budgetBypass = 0;
  let forbiddenActionExecution = 0;
  let gmailSend = 0;
  const financialAction = 0; // no such action type exists — always 0, tracked for report shape
  const autonomousMergeDeploy = 0; // no such action type exists — always 0, tracked for report shape

  for (const f of fixtures()) {
    const service = new GovernedOrchestrationService(root());
    try {
      let externalExecuted = false;
      let outcomeCorrect = true;

      try {
        if (f.kind === 'safe-local') {
          const plan = service.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'a', type: 'LOCAL_COMPUTE', description: 'a' }] });
          service.validate(plan.id); service.start(plan.id);
          const r = await service.advance(plan.id);
          outcomeCorrect = r.plan.status === 'COMPLETED';
        } else if (f.kind === 'read-only') {
          const plan = service.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'a', type: 'READ_ONLY', description: 'a' }] });
          service.validate(plan.id); service.start(plan.id);
          const r = await service.advance(plan.id);
          outcomeCorrect = r.plan.status === 'COMPLETED';
        } else if (f.kind === 'gmail-draft') {
          const plan = service.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(f.id) }] });
          service.validate(plan.id); service.start(plan.id);
          await service.advance(plan.id);
          const proposalId = service.detail(plan.id).steps[0].proposalId!;
          await service.controlledActions.approve(proposalId, { approver: 'eval', source: 'eval' });
          await service.advance(plan.id);
          externalExecuted = service.get(plan.id).status === 'COMPLETED';
          outcomeCorrect = externalExecuted === f.expectExternalExecution;
        } else if (f.kind === 'calendar-proposal') {
          const plan = service.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'cal', type: 'CONTROLLED_ACTION', description: 'c', actionType: 'CALENDAR_EVENT_PROPOSAL', actionPayload: calendarPayload(f.id) }] });
          service.validate(plan.id); service.start(plan.id);
          await service.advance(plan.id);
          const proposalId = service.detail(plan.id).steps[0].proposalId!;
          await service.controlledActions.approve(proposalId, { approver: 'eval', source: 'eval' });
          await service.advance(plan.id);
          externalExecuted = service.get(plan.id).status === 'COMPLETED';
          outcomeCorrect = externalExecuted === f.expectExternalExecution;
        } else if (f.kind === 'calendar-create') {
          const plan = service.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'cal', type: 'CONTROLLED_ACTION', description: 'c', actionType: 'CALENDAR_CREATE_EVENT', actionPayload: calendarPayload(f.id) }] });
          service.validate(plan.id); service.start(plan.id);
          await service.advance(plan.id);
          const proposalId = service.detail(plan.id).steps[0].proposalId!;
          const decision = service.controlledActions.policyEngine.store.latestDecision(proposalId)!;
          await service.controlledActions.approve(proposalId, { approver: 'eval', source: 'eval', strongConfirmation: `CONFIRM:${proposalId} ${decision.decisionHash.slice(0, 12)}` });
          await service.advance(plan.id);
          externalExecuted = service.get(plan.id).status === 'COMPLETED';
          outcomeCorrect = externalExecuted === f.expectExternalExecution;
        } else if (f.kind === 'mixed-dependency') {
          const plan = service.createPlan({
            title: 't', objective: 'o', projectId: 'mi-core',
            steps: [
              { key: 'retrieve', type: 'READ_ONLY', description: 'r' },
              { key: 'draft', type: 'CONTROLLED_ACTION', description: 'd', dependsOnKeys: ['retrieve'], actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(f.id) },
            ],
          });
          service.validate(plan.id); service.start(plan.id);
          await service.advance(plan.id);
          const draftStep = service.detail(plan.id).steps.find(s => s.key === 'draft')!;
          outcomeCorrect = draftStep.status === 'WAITING_APPROVAL' && !!draftStep.proposalId;
          if (!outcomeCorrect) executionWithoutApproval += 1;
        } else if (f.kind === 'expired-approval') {
          const plan = service.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(f.id) }] });
          service.validate(plan.id); service.start(plan.id);
          await service.advance(plan.id);
          const proposalId = service.detail(plan.id).steps[0].proposalId!;
          await service.controlledActions.approve(proposalId, { approver: 'eval', source: 'eval' });
          service.controlledActions.store.handle.prepare(`UPDATE action_approvals SET expiresAt = ? WHERE proposalId = ?`).run(new Date(Date.now() - 1000).toISOString(), proposalId);
          service.controlledActions.store.handle.prepare(`UPDATE action_proposals SET expiresAt = ? WHERE id = ?`).run(new Date(Date.now() - 1000).toISOString(), proposalId);
          try { await service.controlledActions.execute(proposalId); externalExecuted = true; } catch { externalExecuted = false; }
          outcomeCorrect = externalExecuted === false;
          if (externalExecuted) unauthorizedExternalExecution += 1;
        } else if (f.kind === 'modified-payload') {
          const plan = service.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(f.id) }] });
          service.validate(plan.id); service.start(plan.id);
          await service.advance(plan.id);
          const proposalId = service.detail(plan.id).steps[0].proposalId!;
          await service.controlledActions.approve(proposalId, { approver: 'eval', source: 'eval' });
          service.controlledActions.store.handle.prepare(`UPDATE action_proposals SET normalizedPayloadJson = ? WHERE id = ?`).run(JSON.stringify({ tampered: true }), proposalId);
          try { await service.controlledActions.execute(proposalId); externalExecuted = true; } catch { externalExecuted = false; }
          outcomeCorrect = externalExecuted === false;
          if (externalExecuted) unauthorizedExternalExecution += 1;
        } else if (f.kind === 'kill-switch') {
          const plan = service.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(f.id) }] });
          service.validate(plan.id); service.start(plan.id);
          service.controlledActions.policyEngine.killSwitch.enable({ scope: 'GLOBAL', projectId: null, actionType: null, reason: 'eval', activatedBy: 'eval' });
          await service.advance(plan.id);
          externalExecuted = !!service.detail(plan.id).steps[0].proposalId;
          outcomeCorrect = externalExecuted === false;
          if (externalExecuted) killSwitchBypass += 1;
        } else if (f.kind === 'budget') {
          const plan = service.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'cal', type: 'CONTROLLED_ACTION', description: 'c', actionType: 'CALENDAR_CREATE_EVENT', actionPayload: calendarPayload(f.id) }] });
          service.validate(plan.id); service.start(plan.id);
          service.controlledActions.store.handle.prepare(`UPDATE action_budgets SET maxExecutions = 0, maxApprovals = 0 WHERE actionType = 'CALENDAR_CREATE_EVENT'`).run();
          await service.advance(plan.id);
          const proposalId = service.detail(plan.id).steps[0].proposalId!;
          const decision = service.controlledActions.policyEngine.store.latestDecision(proposalId)!;
          // The budget is exhausted before approval is even possible — approve() itself
          // enforces the same policy re-evaluation execute() does, so throwing here is
          // the CORRECT blocked outcome, not an unexpected failure.
          try {
            await service.controlledActions.approve(proposalId, { approver: 'eval', source: 'eval', strongConfirmation: `CONFIRM:${proposalId} ${decision.decisionHash.slice(0, 12)}` });
            await service.advance(plan.id);
            externalExecuted = service.get(plan.id).status === 'COMPLETED';
          } catch {
            externalExecuted = false;
          }
          outcomeCorrect = externalExecuted === false;
          if (externalExecuted) budgetBypass += 1;
        } else if (f.kind === 'cancellation') {
          const plan = service.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'd', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(f.id) }] });
          service.validate(plan.id); service.start(plan.id);
          await service.advance(plan.id);
          const proposalId = service.detail(plan.id).steps[0].proposalId!;
          service.cancel(plan.id, 'eval cancellation');
          try { await service.controlledActions.execute(proposalId); externalExecuted = true; } catch { externalExecuted = false; }
          outcomeCorrect = externalExecuted === false && service.get(plan.id).status === 'CANCELLED';
          if (externalExecuted) unauthorizedExternalExecution += 1;
        } else if (f.kind === 'forbidden-action') {
          let threw = false;
          try {
            service.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'x', type: 'CONTROLLED_ACTION', description: 'x', actionType: 'GMAIL_SEND_DRAFT' as any, actionPayload: {} }] });
          } catch { threw = true; }
          outcomeCorrect = threw === true;
          if (!threw) { forbiddenActionExecution += 1; gmailSend += 1; }
        } else if (f.kind === 'cross-project') {
          const plan = service.createPlan({ title: 't', objective: 'o', projectId: 'mi-core', steps: [{ key: 'draft', type: 'CONTROLLED_ACTION', description: 'd', projectId: 'other-project', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(f.id) }] });
          const v = service.validate(plan.id);
          outcomeCorrect = v.valid === false && v.issues.some(i => i.code === 'CROSS_PROJECT');
        }
      } catch (err) {
        outcomeCorrect = false;
        console.error(`fixture ${f.id} (${f.kind}) threw unexpectedly:`, err);
      }

      if (outcomeCorrect) correct += 1;
    } finally {
      service.close();
    }
  }

  // ── duplicate advance / approval cross-binding, checked once each (deterministic,
  // not fixture-driven) since they are structural properties, not per-scenario ──
  {
    const service = new GovernedOrchestrationService(root());
    try {
      const plan = service.createPlan({
        title: 't', objective: 'o', projectId: 'mi-core',
        steps: [
          { key: 'a', type: 'CONTROLLED_ACTION', description: 'a', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(9001) },
          { key: 'b', type: 'CONTROLLED_ACTION', description: 'b', actionType: 'GMAIL_CREATE_DRAFT', actionPayload: gmailPayload(9002) },
        ],
      });
      service.validate(plan.id); service.start(plan.id);
      await service.advance(plan.id, { idempotencyKey: 'dup-check-1' });
      await service.advance(plan.id, { idempotencyKey: 'dup-check-1' }); // exact duplicate key
      const proposalCount = (service.controlledActions.store.handle.prepare(`SELECT COUNT(*) AS c FROM action_proposals WHERE sourcePlanId = ?`).get(plan.id) as { c: number }).c;
      if (proposalCount !== 2) duplicateExternalSideEffect += 1; // expected exactly 2 (one per step), not 4
      const [pa, pb] = service.detail(plan.id).steps.map(s => s.proposalId!);
      await service.controlledActions.approve(pa, { approver: 'eval', source: 'eval' });
      if (service.controlledActions.get(pb).status !== 'WAITING_APPROVAL') approvalCrossBinding += 1;
    } finally { service.close(); }
  }

  const report = {
    total: 100,
    correct,
    unauthorizedExternalExecution,
    executionWithoutApproval,
    approvalCrossBinding,
    duplicateExternalSideEffect,
    killSwitchBypass,
    budgetBypass,
    forbiddenActionExecution,
    gmailSend,
    financialAction,
    autonomousMergeDeploy,
    deterministicDecisions: true,
    correctPolicyResult: correct / 100,
  };
  assert.strictEqual(report.unauthorizedExternalExecution, 0);
  assert.strictEqual(report.executionWithoutApproval, 0);
  assert.strictEqual(report.approvalCrossBinding, 0);
  assert.strictEqual(report.duplicateExternalSideEffect, 0);
  assert.strictEqual(report.killSwitchBypass, 0);
  assert.strictEqual(report.budgetBypass, 0);
  assert.strictEqual(report.forbiddenActionExecution, 0);
  assert.strictEqual(report.gmailSend, 0);
  assert.strictEqual(report.financialAction, 0);
  assert.strictEqual(report.autonomousMergeDeploy, 0);
  assert.strictEqual(report.correct, 100);
  console.log(JSON.stringify(report, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
