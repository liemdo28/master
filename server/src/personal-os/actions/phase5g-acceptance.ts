import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ControlledActionService } from './service';

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase5g-acceptance-'));
  const service = new ControlledActionService(root);
  try {
    const integrity = service.store.integrity();
    assert.strictEqual(integrity.schemaVersion, 8);
    assert.strictEqual(integrity.integrityCheck, 'ok');
    assert.strictEqual(integrity.foreignKeyViolations.length, 0);

    const p = service.proposeGmailDraft({ to: ['owner@example.com'], subject: 'Phase 5G acceptance', body: 'Acceptance draft.', reason: 'Phase 5G acceptance', projectId: 'mi-core' });
    const started = performance.now();
    const d = service.policyEngine.evaluate({ proposal: p, stage: 'simulation', actor: 'acceptance' });
    const evalMs = performance.now() - started;
    assert.ok(evalMs < 50, `policy evaluation p95 sample must be <50ms, got ${evalMs}`);
    assert.ok(d.decisionHash);

    const killStarted = performance.now();
    const ks = service.policyEngine.killSwitch.state({ projectId: p.projectId, actionType: p.actionType });
    const killMs = performance.now() - killStarted;
    assert.ok(killMs < 10, `kill-switch check must be <10ms, got ${killMs}`);
    assert.strictEqual(ks.blocked, false);

    const budgetStarted = performance.now();
    const budget = service.policyEngine.budgetManager.reserveExecution(p);
    const budgetMs = performance.now() - budgetStarted;
    assert.ok(budgetMs < 50, `budget reservation must be <50ms, got ${budgetMs}`);
    assert.strictEqual(budget.blocked, false);

    console.log(JSON.stringify({
      phase: '5G',
      schemaVersion: integrity.schemaVersion,
      policyVersion: d.policyVersion,
      policyHash: service.policyEngine.store.activePolicySet()?.contentHash,
      decisionHash: d.decisionHash,
      performance: { evaluationMs: evalMs, killSwitchMs: killMs, budgetReservationMs: budgetMs },
      migration: integrity,
    }, null, 2));
  } finally {
    service.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
