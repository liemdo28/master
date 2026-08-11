import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { OperatorControlService } from '../service';
import { TaskStore } from '../../task-runtime/store';
import { TaskEngine } from '../../task-runtime/engine';
import { PersonalOsStore } from '../../personal-os/store';
import { ControlledActionService } from '../../personal-os/actions/service';
import { DelegationService } from '../../personal-os/delegation/service';

function tempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function gmailPayload(overrides: Record<string, unknown> = {}) {
  return {
    to: ['owner@example.com'],
    subject: 'Operator fixture',
    body: 'Draft body',
    projectId: 'mi-core',
    reason: 'operator fixture',
    ...overrides,
  };
}

function delegationInput(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Fixture delegation',
    description: 'Narrow draft delegation',
    owner: 'liem',
    projectId: 'mi-core',
    allowedActionTypes: ['GMAIL_CREATE_DRAFT'],
    targetRestriction: { allowedDomains: ['example.com'], maxRecipients: 3 },
    riskCeiling: 'R2',
    approvalLevelCeiling: 'STANDARD',
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    timezone: 'UTC',
    maxExecutions: 3,
    ...overrides,
  };
}

async function main() {
  const personalRoot = tempDir('phase6c-personal-');
  const taskRoot = tempDir('phase6c-task-');

  const taskStore = new TaskStore(taskRoot);
  const taskEngine = new TaskEngine(taskStore);
  const personal = new PersonalOsStore(personalRoot);
  const actions = new ControlledActionService(personalRoot);
  const delegation = new DelegationService(personalRoot);
  try {
    const waitingTask = taskEngine.createTask({ userRequest: 'Review the deployment plan', projectId: 'mi-core', riskLevel: 'local-reversible' });
    taskEngine.transition(waitingTask.id, 'CONTEXT_BUILDING');
    taskEngine.transition(waitingTask.id, 'PLANNING');
    taskEngine.transition(waitingTask.id, 'WAITING_APPROVAL');

    const blockedTask = taskEngine.createTask({ userRequest: 'Blocked task', projectId: 'mi-core' });
    taskEngine.transition(blockedTask.id, 'CONTEXT_BUILDING');
    taskEngine.transition(blockedTask.id, 'BLOCKED', 'missing dependency');

    personal.createKnowledge({
      kind: 'PROJECT_CONVENTION',
      title: 'Needs confirmation',
      summary: 'Inferred convention must be confirmed.',
      content: 'candidate',
      sourceType: 'INFERRED',
      provenance: 'operator-control-fixture',
      projectIds: ['mi-core'],
      evidenceReferences: ['task:fixture'],
    });

    const proposal = actions.proposeGmailDraft(gmailPayload());
    const d = delegation.createDelegation(delegationInput());
    delegation.submitForApproval(d.id);
    delegation.approve(d.id, { approver: 'liem', strongConfirmation: `AUTHORIZE:${d.id}` });

    const service = new OperatorControlService({ personalOsRoot: personalRoot, taskRuntimeRoot: taskRoot });
    try {
      const snapshot = service.snapshot();
      assert.ok(snapshot.pending.some(item => item.id === `task:${waitingTask.id}`), 'waiting Task Runtime item is surfaced');
      assert.ok(snapshot.pending.some(item => item.sourceType === 'KNOWLEDGE_CONFIRMATION'), 'knowledge confirmation is surfaced');
      assert.ok(snapshot.pending.some(item => item.id === `action:${proposal.id}`), 'waiting Controlled Action is surfaced');
      assert.ok(snapshot.blocked.some(item => item.id === `task:${blockedTask.id}`), 'blocked task is surfaced');
      assert.strictEqual(new Set(snapshot.items.map(item => item.id)).size, snapshot.items.length, 'operator items are deduplicated');
      assert.ok(snapshot.authority.effectiveActions.some(item => item.actionType === 'GMAIL_CREATE_DRAFT'), 'effective action summary includes frozen writable action');
      assert.strictEqual(snapshot.authority.effectiveActions.some(item => item.actionType === 'GMAIL_SEND_DRAFT'), false, 'Gmail send is never promoted into effective authority');
      assert.ok(snapshot.authority.effectiveActions.every(item => item.canonicalRecheckRequired), 'effective authority requires canonical re-checks');
    } finally {
      service.close();
    }
  } finally {
    delegation.close();
    actions.close();
    personal.close();
    taskStore.close();
  }

  console.log('[operator-control] PASS');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
