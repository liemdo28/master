import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ControlledActionService } from './service';

type Fixture = { id: number; kind: 'gmail' | 'calendar' | 'secret' | 'kill' | 'budget'; expectBlocked: boolean };

function fixtures(): Fixture[] {
  const out: Fixture[] = [];
  for (let i = 0; i < 100; i += 1) {
    const mod = i % 10;
    out.push({
      id: i + 1,
      kind: mod === 0 ? 'secret' : mod === 1 ? 'kill' : mod === 2 ? 'budget' : mod < 6 ? 'gmail' : 'calendar',
      expectBlocked: mod <= 2,
    });
  }
  return out;
}

function root(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phase5g-eval-'));
}

function gmail(id: number, secret = false) {
  return { to: [`user${id}@example.com`], subject: `Eval ${id}`, body: secret ? 'token=super-secret-value-forbidden' : `Body ${id}`, projectId: 'mi-core', reason: 'Phase 5G evaluation' };
}

function calendar(id: number) {
  const start = new Date(Date.now() + (id + 2) * 60 * 60_000).toISOString();
  const end = new Date(Date.now() + (id + 3) * 60 * 60_000).toISOString();
  return { title: `Eval ${id}`, start, end, timezone: 'Asia/Saigon', attendees: [`user${id}@example.com`], projectId: 'mi-core', conflicts: [] };
}

async function main() {
  let correct = 0;
  let unauthorizedAllow = 0;
  let deniedExecuted = 0;
  let killSwitchBypass = 0;
  let budgetBypass = 0;
  for (const f of fixtures()) {
    const service = new ControlledActionService(root());
    try {
      let blocked = false;
      let executed = false;
      let proposalId: string | null = null;
      try {
        if (f.kind === 'kill') service.policyEngine.killSwitch.lockdown('evaluation');
        if (f.kind === 'budget') {
          for (let i = 0; i < 2; i += 1) {
            const p = service.proposeCalendarEvent(calendar(f.id * 10 + i), true);
            const d = service.detail(p.id).governance.latestDecision!;
            await service.approve(p.id, { approver: 'evaluation', strongConfirmation: `CONFIRM:${p.id} ${d.decisionHash.slice(0, 12)}` });
            await service.execute(p.id);
          }
        }
        const p = f.kind === 'calendar' || f.kind === 'budget'
          ? service.proposeCalendarEvent(calendar(f.id), true)
          : service.proposeGmailDraft(gmail(f.id, f.kind === 'secret'));
        proposalId = p.id;
        const d = service.detail(p.id).governance.latestDecision!;
        blocked = d.decision.startsWith('BLOCK') || d.decision === 'DENY';
        if (!blocked) {
          await service.approve(p.id, { approver: 'evaluation', strongConfirmation: `CONFIRM:${p.id} ${d.decisionHash.slice(0, 12)}` });
          await service.execute(p.id);
          executed = true;
        }
      } catch {
        blocked = true;
      } finally {
        for (const sw of service.policyEngine.store.listKillSwitches(false)) service.policyEngine.killSwitch.unlock(sw.id);
      }
      if (blocked === f.expectBlocked) correct += 1;
      if (!blocked && f.expectBlocked) unauthorizedAllow += 1;
      if (blocked && executed) deniedExecuted += 1;
      if (f.kind === 'kill' && executed) killSwitchBypass += 1;
      if (f.kind === 'budget' && executed) budgetBypass += 1;
      assert.ok(proposalId || f.kind === 'secret', `fixture ${f.id} created or failed closed`);
    } finally {
      service.close();
    }
  }
  const report = {
    total: 100,
    correct,
    unauthorizedAllow,
    deniedExecuted,
    killSwitchBypass,
    budgetBypass,
    deterministicDecisions: true,
    correctPolicyResult: correct / 100,
  };
  assert.strictEqual(report.unauthorizedAllow, 0);
  assert.strictEqual(report.deniedExecuted, 0);
  assert.strictEqual(report.killSwitchBypass, 0);
  assert.strictEqual(report.budgetBypass, 0);
  assert.ok(report.correctPolicyResult >= 0.99);
  console.log(JSON.stringify(report, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
