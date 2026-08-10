import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ControlledActionService } from '../service';

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phase5g-governance-'));
}

function gmailPayload(projectId = 'mi-core', suffix = 'draft') {
  return {
    to: ['owner@example.com'],
    subject: `Phase 5G ${suffix}`,
    body: 'Governance test draft body.',
    projectId,
    reason: 'Governance test',
  };
}

function calendarPayload(projectId = 'mi-core') {
  const start = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  const end = new Date(Date.now() + 25 * 60 * 60_000).toISOString();
  return {
    title: 'Phase 5G governance event',
    start,
    end,
    timezone: 'Asia/Saigon',
    attendees: ['owner@example.com'],
    projectId,
    conflicts: [],
  };
}

async function main() {
  const root = tempRoot();
  const service = new ControlledActionService(root);
  try {
    const integrity = service.store.integrity();
    assert.strictEqual(integrity.schemaVersion, 8);
    assert.strictEqual(integrity.integrityCheck, 'ok');

    const draft = service.proposeGmailDraft(gmailPayload());
    const draftDecision = service.detail(draft.id).governance.latestDecision;
    assert.ok(draftDecision);
    assert.strictEqual(draftDecision!.decision, 'REQUIRE_APPROVAL');
    assert.strictEqual(draftDecision!.requiredApprovalLevel, 'STANDARD');
    await service.approve(draft.id, { approver: 'test', source: 'test' });
    const draftExec = await service.execute(draft.id);
    assert.strictEqual(draftExec.status, 'COMPLETED');

    const active = service.policyEngine.store.activePolicySet()!;
    const draftPolicy = service.policyEngine.store.createDraftPolicySet(active.rules, 'test');
    assert.strictEqual(draftPolicy.status, 'DRAFT');
    assert.throws(() => service.policyEngine.store.activatePolicySet(active.id), /only DRAFT/);
    const activatedPolicy = service.policyEngine.store.activatePolicySet(draftPolicy.id);
    assert.strictEqual(activatedPolicy.status, 'ACTIVE');
    const rolledBackPolicy = service.policyEngine.store.rollbackPolicySet(active.id);
    assert.strictEqual(rolledBackPolicy.status, 'ACTIVE');

    const event = service.proposeCalendarEvent(calendarPayload(), true);
    const eventDecision = service.detail(event.id).governance.latestDecision!;
    assert.strictEqual(eventDecision.decision, 'REQUIRE_STRONG_APPROVAL');
    await assert.rejects(() => service.approve(event.id, { approver: 'test', source: 'test' }), /strong approval/);
    await service.approve(event.id, {
      approver: 'test',
      source: 'test',
      strongConfirmation: `CONFIRM:${event.id} ${eventDecision.decisionHash.slice(0, 12)}`,
    });
    const eventExec = await service.execute(event.id);
    assert.strictEqual(eventExec.status, 'COMPLETED');

    const lockdown = service.policyEngine.killSwitch.lockdown('test');
    service.policyEngine.audit.record({ eventType: 'kill_switch.enabled', policyVersion: null, inputHash: null, decisionHash: null, actor: 'test', proposalId: null, reasons: [lockdown.reason], metadata: { id: lockdown.id } });
    const blocked = service.proposeGmailDraft(gmailPayload('mi-core', 'blocked'));
    const blockedDecision = service.detail(blocked.id).governance.latestDecision!;
    assert.strictEqual(blockedDecision.decision, 'BLOCK_KILL_SWITCH');
    await assert.rejects(() => service.approve(blocked.id, { approver: 'test' }), /policy blocked approval/);
    service.policyEngine.killSwitch.unlock(lockdown.id);

    const budgetOne = service.proposeCalendarEvent(calendarPayload(), true);
    const budgetOneDecision = service.detail(budgetOne.id).governance.latestDecision!;
    await service.approve(budgetOne.id, { approver: 'test', strongConfirmation: `CONFIRM:${budgetOne.id} ${budgetOneDecision.decisionHash.slice(0, 12)}` });
    await service.execute(budgetOne.id);
    const exhausted = service.proposeCalendarEvent(calendarPayload(), true);
    const exhaustedDecision = service.detail(exhausted.id).governance.latestDecision!;
    assert.strictEqual(exhaustedDecision.decision, 'BLOCK_BUDGET');

    const reopened = new ControlledActionService(root);
    try {
      assert.strictEqual(reopened.store.integrity().schemaVersion, 8);
      assert.ok(reopened.policyEngine.store.listKillSwitches().some(item => item.id === lockdown.id && !item.enabled));
    } finally {
      reopened.close();
    }
  } finally {
    service.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
