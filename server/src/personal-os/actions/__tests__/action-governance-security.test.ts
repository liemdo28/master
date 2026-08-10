import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ControlledActionService } from '../service';

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase5g-security-'));
  const service = new ControlledActionService(root);
  try {
    assert.throws(() => service.proposeGmailDraft({
      to: ['owner@example.com'],
      subject: 'Secret',
      body: 'api_key=forbidden-secret',
      reason: 'security',
    }), /secret-bearing payloads/);

    const p = service.proposeGmailDraft({ to: ['owner@example.com'], subject: 'Safe', body: 'Safe body', reason: 'security', projectId: 'mi-core' });
    const d = service.detail(p.id).governance.latestDecision!;
    assert.strictEqual(d.decision, 'REQUIRE_APPROVAL');
    service.policyEngine.killSwitch.lockdown('security');
    await assert.rejects(() => service.approve(p.id, { approver: 'security' }), /policy blocked approval/);

    const existing = service.store.handle.prepare(`SELECT normalizedPayloadJson FROM action_proposals WHERE id = ?`).get(p.id) as { normalizedPayloadJson: string };
    const changed = JSON.parse(existing.normalizedPayloadJson);
    changed.body = 'Tampered body';
    service.store.handle.prepare(`UPDATE action_proposals SET normalizedPayloadJson = ? WHERE id = ?`).run(JSON.stringify(changed), p.id);
    service.policyEngine.killSwitch.unlock(service.policyEngine.store.listKillSwitches(false)[0].id);
    await assert.rejects(() => service.approve(p.id, { approver: 'security' }), /payload hash mismatch/);

    const routeBypass = service.policyEngine.store.listEvents().some(event => event.eventType === 'policy.allowed');
    assert.ok(routeBypass, 'policy evidence exists before any execution path');
  } finally {
    service.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
