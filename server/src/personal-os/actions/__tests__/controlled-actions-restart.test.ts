import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ControlledActionService } from '../service';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-actions-restart-'));

function draft() {
  return {
    to: ['safe.recipient@example.com'],
    subject: 'Restart persistence',
    body: 'Persist me.',
    reason: 'Restart fixture',
  };
}

async function main() {
  let s = new ControlledActionService(root);
  const proposal = s.proposeGmailDraft(draft());
  s.close();

  s = new ControlledActionService(root);
  assert.equal(s.get(proposal.id).status, 'WAITING_APPROVAL');
  const approved = s.approve(proposal.id);
  s.close();

  s = new ControlledActionService(root);
  assert.equal(s.get(proposal.id).status, 'APPROVED');
  const execution = s.execute(proposal.id);
  assert.equal(execution.status, 'COMPLETED');
  s.close();

  s = new ControlledActionService(root);
  assert.equal(s.execute(proposal.id).id, execution.id);
  assert.equal(s.detail(proposal.id).approval?.id, approved.approval.id);
  assert.equal(s.detail(proposal.id).evidence.some(e => e.eventType === 'action.execution.completed'), true);
  s.close();
  fs.rmSync(root, { recursive: true, force: true });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
