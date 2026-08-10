import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import { applyPhase5hMigration } from '../schema';
import { PersonalOsStore } from '../../store';

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'phase5h-migration-'));
}

async function main() {
  const root = tempRoot();
  try {
    // ── from = 8 (start at Phase 5G's schema, matching an already-deployed production
    // database — not from scratch) ──
    const dbPath = path.join(root, 'personal-os.db');
    // PersonalOsStore (Phase 5A) is the table that creates `preferences` and the
    // `schema_migrations` table itself; go through the real store class rather than
    // hand-rolled SQL, then chain the actions/operating/governance migrations on the
    // same file — this mirrors what production actually looks like (every store class
    // has been instantiated many times by the time a real v8 database exists).
    const personalOsStore = new PersonalOsStore(root);
    personalOsStore.createPreference({ category: 'test', key: 'k', value: 'v' });
    personalOsStore.close();

    const seed = new Database(dbPath);
    const { applyPhase5fMigration } = require('../../actions/store');
    const { applyPhase5gMigration } = require('../../actions/governance/schema');
    applyPhase5fMigration(seed);
    applyPhase5gMigration(seed);
    const before = seed.prepare(`SELECT MAX(version) AS v FROM schema_migrations`).get() as { v: number };
    assert.strictEqual(before.v, 8);
    seed.close();

    // ── first run: from=8, to=9, applied=true ──
    const db1 = new Database(dbPath);
    const first = applyPhase5hMigration(db1);
    assert.strictEqual(first.from, 8);
    assert.strictEqual(first.to, 9);
    assert.strictEqual(first.applied, true);
    const integrity1 = db1.pragma('integrity_check', { simple: true });
    const fk1 = db1.pragma('foreign_key_check');
    const journal1 = db1.pragma('journal_mode', { simple: true });
    assert.strictEqual(integrity1, 'ok');
    assert.strictEqual((fk1 as any[]).length, 0);
    assert.strictEqual(journal1, 'wal');
    db1.close();

    // ── second run against the same file: idempotent, applied=false ──
    const db2 = new Database(dbPath);
    const second = applyPhase5hMigration(db2);
    assert.strictEqual(second.from, 9);
    assert.strictEqual(second.to, 9);
    assert.strictEqual(second.applied, false);
    const integrity2 = db2.pragma('integrity_check', { simple: true });
    assert.strictEqual(integrity2, 'ok');

    // ── preserved: preferences row from before migration still present ──
    const pref = db2.prepare(`SELECT * FROM preferences WHERE category = 'test' AND key = 'k'`).get();
    assert.ok(pref, 'seed preference row must survive the v8->v9 migration');

    // ── new orchestration tables exist ──
    const tables = (db2.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[]).map(t => t.name);
    for (const t of ['action_plans', 'action_plan_steps', 'action_plan_dependencies', 'action_plan_runs', 'action_plan_step_attempts', 'action_plan_evidence']) {
      assert.ok(tables.includes(t), `expected table ${t} to exist after migration`);
    }
    // Phase 5F/5G tables untouched
    for (const t of ['action_proposals', 'action_approvals', 'action_executions', 'policy_sets', 'action_budgets', 'kill_switches']) {
      assert.ok(tables.includes(t), `expected pre-existing table ${t} to remain present`);
    }
    db2.close();

    console.log('[orchestration-migration] PASS');
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (cleanupErr) { console.error('cleanup warning:', cleanupErr); }
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
