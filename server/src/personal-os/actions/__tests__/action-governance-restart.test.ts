import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ControlledActionService } from '../service';

function eventPayload(id: number) {
  const start = new Date(Date.now() + (id + 3) * 60 * 60_000).toISOString();
  const end = new Date(Date.now() + (id + 4) * 60 * 60_000).toISOString();
  return { title: `Race ${id}`, start, end, timezone: 'Asia/Saigon', attendees: ['owner@example.com'], projectId: 'mi-core', conflicts: [] };
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase5g-restart-'));
  const first = new ControlledActionService(root);
  const p = first.proposeCalendarEvent(eventPayload(1), true);
  const d = first.detail(p.id).governance.latestDecision!;
  await first.approve(p.id, { approver: 'restart', strongConfirmation: `CONFIRM:${p.id} ${d.decisionHash.slice(0, 12)}` });
  first.close();

  const second = new ControlledActionService(root);
  try {
    assert.strictEqual(second.store.integrity().schemaVersion, 8);
    const exec = await second.execute(p.id);
    assert.strictEqual(exec.status, 'COMPLETED');

    const p2 = second.proposeCalendarEvent(eventPayload(2), true);
    const d2 = second.detail(p2.id).governance.latestDecision!;
    await second.approve(p2.id, { approver: 'restart', strongConfirmation: `CONFIRM:${p2.id} ${d2.decisionHash.slice(0, 12)}` });
    await second.execute(p2.id);
    const p3 = second.proposeCalendarEvent(eventPayload(3), true);
    const d3 = second.detail(p3.id).governance.latestDecision!;
    assert.strictEqual(d3.decision, 'BLOCK_BUDGET');
    await assert.rejects(() => second.approve(p3.id, { approver: 'restart', strongConfirmation: `CONFIRM:${p3.id} ${d3.decisionHash.slice(0, 12)}` }), /policy blocked approval/);
  } finally {
    second.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
