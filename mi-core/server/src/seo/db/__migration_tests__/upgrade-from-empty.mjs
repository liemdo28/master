/**
 * Migration test: upgrade-from-empty
 *
 * Creates a brand-new, completely empty temp SQLite file, runs the seo-db
 * migration system against it, and asserts:
 *   - runMigrations() reports every migration as applied, alreadyCurrent=false
 *   - all migration-managed seo_* tables now exist
 *   - `schema_migrations` has exactly one row per migration file
 *
 * Run with:  node --import tsx src/seo/db/__migration_tests__/upgrade-from-empty.mjs
 * (from mi-core/server)
 */

import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runMigrations } from '../migration-runner.ts';

const EXPECTED_TABLES = [
  'seo_keywords',
  'seo_topic_clusters',
  'seo_cluster_nodes',
  'seo_site_pages',
  'seo_content_items',
  'seo_article_versions',
  'seo_business_facts',
  'seo_article_facts',
  'seo_internal_links',
  'seo_backlinks',
  'seo_backlink_checks',
  'seo_audits',
  'seo_issues',
  'seo_actions',
  'seo_automation_runs',
  'seo_policy_versions',
  'seo_evidence',
  'seo_gbp_snapshots',
  'seo_rankings',
  'seo_analytics_daily',
  'seo_ai_jobs',
  'seo_ai_responses',
  'seo_publish_snapshots',
  'seo_reports',
  'seo_pipeline_state',
  'seo_pipeline_steps',
  'seo_approval_bindings',
  'seo_approval_execution_state',
  'seo_approval_execution_evidence',
];

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

console.log('=== upgrade-from-empty ===');

const tmpDir = mkdtempSync(join(tmpdir(), 'seo-migration-test-'));
const dbPath = join(tmpDir, 'empty.db');
let db;

try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  const result = runMigrations(db);

  check(
    'runMigrations() reports migrations applied',
    JSON.stringify(result.applied) === JSON.stringify(['1_initial_schema', '2_pipeline_state', '3_approval_bindings', '4_approval_execution_state', '5_approval_reconciliation']),
    `applied=${JSON.stringify(result.applied)}`
  );
  check('alreadyCurrent is false on first run', result.alreadyCurrent === false, `alreadyCurrent=${result.alreadyCurrent}`);

  const tableRows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'seo_%'")
    .all()
    .map((r) => r.name)
    .sort();

  check(
    `all ${EXPECTED_TABLES.length} seo_* tables exist`,
    EXPECTED_TABLES.every((t) => tableRows.includes(t)),
    `missing=${JSON.stringify(EXPECTED_TABLES.filter((t) => !tableRows.includes(t)))}`
  );
  check(
    `exactly ${EXPECTED_TABLES.length} seo_* tables (no extras)`,
    tableRows.length === EXPECTED_TABLES.length,
    `found ${tableRows.length}: ${JSON.stringify(tableRows)}`
  );

  const migrationRows = db.prepare('SELECT version, name, checksum, applied_at FROM schema_migrations').all();
  check(
    'schema_migrations has one row per migration file (5)',
    migrationRows.length === 5,
    `rows=${JSON.stringify(migrationRows)}`
  );
  check(
    'schema_migrations rows have non-empty checksum + applied_at',
    migrationRows.length === 5 && migrationRows.every((row) => !!row.checksum && !!row.applied_at),
    JSON.stringify(migrationRows)
  );
} finally {
  if (db) db.close();
  rmSync(tmpDir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
