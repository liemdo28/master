/**
 * Phase 5D-3 §26 — migration test suite (schema v5 -> v6).
 */

import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import { applyPhase5d3Migration, currentSchemaVersion, OperatingStore } from '../store';
import { applyPhase5d2Migration, applyPhase5dMigration } from '../../documents/store';
import { PersonalOsStore } from '../../store';
import { backupDatabase, restoreFromBackup, verifyBackup } from '../../documents/backup';

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mi-5d3-migration-'));
}

function tableCounts(file: string): Record<string, number> {
  const db = new Database(file, { readonly: true });
  const tables = (db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all() as Array<{ name: string }>).map(t => t.name).sort();
  const counts: Record<string, number> = {};
  for (const t of tables) counts[t] = (db.prepare(`SELECT COUNT(*) c FROM "${t}"`).get() as { c: number }).c;
  db.close();
  return counts;
}

async function run(): Promise<void> {
  // --- a brand new v6 database --------------------------------------------------
  const freshRoot = tmp();
  const fresh = new OperatingStore(freshRoot);
  const freshIntegrity = fresh.integrity();
  assert.strictEqual(freshIntegrity.integrityCheck, 'ok');
  assert.deepStrictEqual(freshIntegrity.foreignKeyViolations, []);
  assert.strictEqual(freshIntegrity.schemaVersion, 6, 'a new database is created at v6');
  fresh.close();
  fs.rmSync(freshRoot, { recursive: true, force: true });

  // --- v5 -> v6 preserving every existing row -------------------------------------
  const root = tmp();
  const personal = new PersonalOsStore(root);
  const goal = personal.createGoal({ title: 'Pre-existing goal', description: 'created before the v6 migration', category: 'test', projectIds: ['proj-x'] });
  personal.close();

  const dbFile = path.join(root, 'personal-os.db');
  // Bring the copy to v5 first (Phase 5D-2's own migration), matching the real
  // upgrade path, before applying v6.
  const preDb = new Database(dbFile);
  applyPhase5d2Migration(preDb);
  preDb.close();

  const before = tableCounts(dbFile);
  assert.ok(before.goals >= 1);

  const store = new OperatingStore(root);
  assert.strictEqual(store.integrity().schemaVersion, 6, 'opening an OperatingStore moves v5 straight to v6');
  store.close();

  const after = tableCounts(dbFile);
  for (const [table, count] of Object.entries(before)) {
    if (table === 'schema_migrations') {
      assert.strictEqual(after[table], count + 1, 'schema_migrations gains exactly the v6 row');
      continue;
    }
    assert.strictEqual(after[table], count, `row count preserved for ${table}`);
  }
  for (const added of ['daily_operating_briefs', 'daily_plans', 'daily_refreshes', 'end_of_day_reviews', 'weekly_operating_reviews', 'operating_loop_runs']) {
    assert.ok(added in after, `${added} created by the migration`);
    assert.strictEqual(after[added], 0, `${added} starts empty`);
  }

  // --- previous API compatibility: Phase 5A goal survives, readable as before -------
  const personalAfter = new PersonalOsStore(root);
  assert.ok(personalAfter.getGoal(goal.id), 'the pre-existing goal survives the v6 migration');
  personalAfter.close();

  // --- OperatingStore opened directly against a pre-v5 database must still chain
  // through 5D-2's own migration, not just create the v6 tables in isolation -----------
  const chainRoot = tmp();
  const chainDbFile = path.join(chainRoot, 'personal-os.db');
  const chainSeedDb = new Database(chainDbFile);
  applyPhase5dMigration(chainSeedDb); // bring the fresh copy to v4 only, nothing more
  assert.strictEqual(currentSchemaVersion(chainSeedDb), 4, 'seed database is at v4 before OperatingStore ever opens it');
  chainSeedDb.close();

  const chainedStore = new OperatingStore(chainRoot);
  assert.strictEqual(chainedStore.integrity().schemaVersion, 6, 'OperatingStore opened directly against a v4 database still reaches v6');
  chainedStore.close();

  const chainDb = new Database(chainDbFile, { readonly: true });
  const chainTables = new Set((chainDb.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as Array<{ name: string }>).map(t => t.name));
  chainDb.close();
  for (const v5Table of ['knowledge_chunks_fts', 'knowledge_conflicts', 'knowledge_relations']) {
    assert.ok(chainTables.has(v5Table), `${v5Table} (5D-2's own migration) must exist even when OperatingStore opened the database first`);
  }
  for (const v6Table of ['daily_operating_briefs', 'daily_plans', 'operating_loop_runs']) {
    assert.ok(chainTables.has(v6Table), `${v6Table} (5D-3's own migration) must also exist`);
  }
  fs.rmSync(chainRoot, { recursive: true, force: true });

  // --- rerun is a no-op -------------------------------------------------------------
  const rerunDb = new Database(dbFile);
  const first = applyPhase5d3Migration(rerunDb);
  const second = applyPhase5d3Migration(rerunDb);
  assert.strictEqual(first.to, 6);
  assert.strictEqual(second.applied, false, 'a second run applies nothing');
  assert.strictEqual(currentSchemaVersion(rerunDb), 6);
  rerunDb.close();
  assert.deepStrictEqual(tableCounts(dbFile), after, 'rerun changes no row counts');

  // --- backup/restore round-trip -----------------------------------------------------
  const backupDir = tmp();
  const backupPath = path.join(backupDir, 'personal-os-backup.db');
  await backupDatabase(dbFile, backupPath);
  const verification = verifyBackup(backupPath);
  assert.strictEqual(verification.integrityCheck, 'ok');
  assert.strictEqual(verification.schemaVersion, 6);

  const restoreDir = tmp();
  const restoredPath = path.join(restoreDir, 'personal-os.db');
  restoreFromBackup(backupPath, restoredPath);
  const restoredStore = new OperatingStore(restoreDir);
  assert.strictEqual(restoredStore.integrity().schemaVersion, 6);
  restoredStore.close();

  fs.rmSync(backupDir, { recursive: true, force: true });
  fs.rmSync(restoreDir, { recursive: true, force: true });
  fs.rmSync(root, { recursive: true, force: true });
  console.log('[operating-migration] PASS');
}

run().catch(err => { console.error('[operating-migration] FAIL:', err); process.exit(1); });
