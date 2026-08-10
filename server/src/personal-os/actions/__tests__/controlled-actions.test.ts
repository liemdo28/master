import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ControlledActionService } from '../service';

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-actions-'));
}

function gmailPayload() {
  return {
    to: ['safe.recipient@example.com'],
    subject: 'Phase 5F draft',
    body: 'Hello from a fixture-only controlled action.',
    reason: 'Acceptance fixture',
    projectId: 'mi-core',
    sensitivity: 'PRIVATE' as const,
  };
}

function calendarPayload(conflicts: unknown[] = []) {
  return {
    title: 'Phase 5F sandbox fixture',
    start: '2026-08-08T09:00:00+07:00',
    end: '2026-08-08T09:30:00+07:00',
    timezone: 'Asia/Saigon',
    attendees: ['safe.recipient@example.com'],
    location: 'Fixture room',
    description: 'Disposable fixture event.',
    projectId: 'mi-core',
    conflicts,
    freeBusyEvidence: 'fixture-freebusy-clean',
  };
}

async function main() {
  const root = tempRoot();
  const service = new ControlledActionService(root);
  try {
    const draft = service.proposeGmailDraft(gmailPayload());
    assert.equal(draft.status, 'WAITING_APPROVAL');
    assert.equal(draft.actionType, 'GMAIL_CREATE_DRAFT');
    assert.equal(draft.riskClass, 'R2');
    assert.match(draft.preview.text, /Sends: false/);
    assert.ok(draft.payloadHash.length >= 64);

    await assert.rejects(() => service.execute(draft.id), /missing approval/i);

    const approved = await service.approve(draft.id, { approver: 'tester' });
    assert.equal(approved.proposal.status, 'APPROVED');
    assert.equal(approved.approval.payloadHash, draft.payloadHash);
    assert.deepEqual(approved.approval.approvedPayloadSnapshot, draft.normalizedPayload);

    const execution = await service.execute(draft.id);
    assert.equal(execution.status, 'COMPLETED');
    assert.match(execution.externalObjectId || '', /^gmail-draft-fixture-/);
    assert.equal(execution.providerResponseSummary.sent, false);

    const duplicate = await service.execute(draft.id);
    assert.equal(duplicate.id, execution.id);
    assert.equal(service.detail(draft.id).executions.length, 1);

    const rejected = service.proposeGmailDraft({ ...gmailPayload(), subject: 'Reject me' });
    service.reject(rejected.id, { reason: 'No longer needed' });
    assert.equal(service.get(rejected.id).status, 'REJECTED');

    const localProposal = service.proposeCalendarEvent(calendarPayload(), false);
    await service.approve(localProposal.id);
    const localExecution = await service.execute(localProposal.id);
    assert.equal(localExecution.status, 'COMPLETED');
    assert.match(localExecution.externalObjectId || '', /^calendar-proposal-/);

    const create = service.proposeCalendarEvent(calendarPayload(), true);
    const createDecision = service.detail(create.id).governance.latestDecision!;
    await service.approve(create.id, { strongConfirmation: `CONFIRM:${create.id} ${createDecision.decisionHash.slice(0, 12)}` });
    const calendarExecution = await service.execute(create.id);
    assert.equal(calendarExecution.status, 'COMPLETED');
    assert.match(calendarExecution.externalObjectId || '', /^calendar-event-fixture-/);

    const conflicted = service.proposeCalendarEvent(calendarPayload([{ eventId: 'fixture-conflict', title: 'Busy', start: '2026-08-08T09:00:00+07:00', end: '2026-08-08T09:30:00+07:00' }]), true);
    const conflictedDecision = service.detail(conflicted.id).governance.latestDecision!;
    await service.approve(conflicted.id, { strongConfirmation: `CONFIRM:${conflicted.id} ${conflictedDecision.decisionHash.slice(0, 12)}` });
    const failed = await service.execute(conflicted.id);
    assert.equal(failed.status, 'FAILED');
    assert.equal(failed.failureCode, 'CONFLICT_CHANGED');

    const integrity = service.store.integrity();
    assert.equal(integrity.integrityCheck, 'ok');
    assert.equal(integrity.schemaVersion, 8);
  } finally {
    service.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
