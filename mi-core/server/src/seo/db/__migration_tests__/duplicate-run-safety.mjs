/**
 * Migration test: duplicate-run-safety
 *
 * Runs the migration system twice in a row against the same temp DB
 * (simulating a server restarted twice quickly) and asserts the second run
 * is a true no-op: alreadyCurrent=true, zero new migrations applied, and
 * schema_migrations row count did not double.
 *
 * Run with:  node --import tsx src/seo/db/__migration_tests__/duplicate-run-safety.mjs
 * (from mi-core/server)
 */

import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runMigrations } from '../migration-runner.ts';

let pass = 0;
let fail = 0;

function check(label, condition, detail) {
  if (condition) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('=== duplicate-run-safety ===');

const tmpDir = mkdtempSync(join(tmpdir(), 'seo-migration-test-'));
const dbPath = join(tmpDir, 'duplicate.db');
let db;

try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // First run: should apply everything.
  const result1 = runMigrations(db);
  check(
    'first run applies the migration(s)',
    JSON.stringify(result1.applied) === JSON.stringify(['1_initial_schema', '2_pipeline_state', '3_approval_bindings', '4_approval_execution_state', '5_approval_reconciliation']) &&
      result1.alreadyCurrent === false,
    JSON.stringify(result1)
  );

  const countAfterFirst = db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n;
  check('schema_migrations has 5 rows after first run', countAfterFirst === 5, `count=${countAfterFirst}`);

  // Second run against the SAME open db handle: must be a no-op.
  const result2 = runMigrations(db);
  check(
    'second run (same handle) reports alreadyCurrent=true',
    result2.alreadyCurrent === true,
    JSON.stringify(result2)
  );
  check('second run applies zero new migrations', result2.applied.length === 0, JSON.stringify(result2.applied));

  const countAfterSecond = db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n;
  check(
    'schema_migrations row count did not double after second run',
    countAfterSecond === countAfterFirst,
    `before=${countAfterFirst} after=${countAfterSecond}`
  );

  // Third run against a FRESH connection to the same file — simulates a real
  // process restart (new Database() handle, not just calling the function
  // again on the same open handle).
  db.close();
  const db2 = new Database(dbPath);
  db2.pragma('journal_mode = WAL');
  db2.pragma('synchronous = NORMAL');
  const result3 = runMigrations(db2);
  check(
    'third run (fresh process/handle) is also a no-op',
    result3.alreadyCurrent === true && result3.applied.length === 0,
    JSON.stringify(result3)
  );
  const countAfterThird = db2.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n;
  check(
    'schema_migrations row count still did not double after fresh-handle run',
    countAfterThird === countAfterFirst,
    `before=${countAfterFirst} after=${countAfterThird}`
  );
  db2.close();
  db = null; // already closed above
} finally {
  if (db) db.close();
  rmSync(tmpDir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
