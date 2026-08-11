import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import { PersonalOsStore } from '../../store';
import { applyPhase5hMigration } from '../../orchestration/schema';
import { applyPhase5iMigration } from '../schema';

function tempRoot(): string { return fs.mkdtempSync(path.join(os.tmpdir(), 'phase5i-migration-')); }

async function main() {
  const root = tempRoot();
  try {
    // Seed a real v9 database the same way production reaches v9: through the actual
    // store classes, not hand-rolled SQL against tables owned by other modules.
    const personal = new PersonalOsStore(root);
    const goal = personal.createGoal({ title: 'seed goal', description: 'x', category: 'engineering', projectIds: ['mi-core'] });
    personal.updateGoalStatus(goal.id, 'ACTIVE');
    personal.close();

    const dbForOrchestration = new Database(path.join(root, 'personal-os.db'));
    applyPhase5hMigration(dbForOrchestration);
    dbForOrchestration.close();

    const db = new Database(path.join(root, 'personal-os.db'));
    const beforeVersion = (db.prepare('SELECT MAX(version) v FROM schema_migrations').get() as any).v;
    assert.strictEqual(beforeVersion, 9);

    const run1 = applyPhase5iMigration(db);
    console.log('RUN_1:', JSON.stringify(run1));
    assert.strictEqual(run1.from, 9);
    assert.strictEqual(run1.to, 10);
    assert.strictEqual(run1.applied, true);

    const run2 = applyPhase5iMigration(db);
    console.log('RUN_2:', JSON.stringify(run2));
    assert.strictEqual(run2.from, 10);
    assert.strictEqual(run2.applied, false);

    const integrity = db.pragma('integrity_check');
    assert.strictEqual((integrity as any)[0].integrity_check, 'ok');
    const fk = db.pragma('foreign_key_check');
    assert.strictEqual((fk as any[]).length, 0);
    const journal = db.pragma('journal_mode');
    assert.strictEqual((journal as any)[0].journal_mode, 'wal');

    const tables = (db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as any[]).map(r => r.name);
    for (const t of ['delegated_authorities', 'delegation_versions', 'delegation_decisions', 'delegation_quota_usage', 'delegation_events']) {
      assert.ok(tables.includes(t), `missing table ${t}`);
    }
    // pre-existing tables from every prior phase must still be present
    for (const t of ['goals', 'action_proposals', 'action_approvals', 'action_budgets', 'kill_switches', 'policy_sets', 'action_plans', 'action_plan_steps']) {
      assert.ok(tables.includes(t), `pre-v10 table ${t} must be preserved`);
    }

    // pre-existing data preserved
    const goalCount = (db.prepare('SELECT COUNT(*) c FROM goals').get() as any).c;
    assert.strictEqual(goalCount, 1);

    db.close();
    console.log('[delegation-migration] PASS');
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (e) { console.error('cleanup warning:', e); }
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
