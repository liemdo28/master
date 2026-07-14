/**
 * Migration test: upgrade-from-partial
 *
 * Simulates a database that already had the OLD inline-bootstrap schema
 * applied (before this migration system existed) — i.e. some/all seo_*
 * tables already exist, but there is no `schema_migrations` table yet.
 *
 * Manually creates a SUBSET of the 24 tables (a handful, with real column
 * definitions matching migrations/0001_initial_schema.ts) before ever
 * calling runMigrations(), then verifies:
 *   (a) runMigrations() does NOT error on "table already exists" — it must
 *       tolerate pre-existing tables (CREATE TABLE IF NOT EXISTS in the
 *       migration SQL itself is what makes this safe)
 *   (b) schema_migrations ends up populated correctly afterward
 *   (c) all migration-managed tables exist afterward (the ones that were missing get created)
 *
 * Run with:  node --import tsx src/seo/db/__migration_tests__/upgrade-from-partial.mjs
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

// A deliberate SUBSET (not all 24) — pre-created "as if" by the old inline
// bootstrap, before schema_migrations existed. Real column defs, copied from
// migrations/0001_initial_schema.ts, so this is a faithful simulation.
const PRE_EXISTING_SQL = `
  CREATE TABLE IF NOT EXISTS seo_keywords (
    id                  TEXT PRIMARY KEY,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    brand_id            TEXT NOT NULL,
    location_id         TEXT,
    keyword             TEXT NOT NULL,
    normalized_keyword  TEXT NOT NULL,
    language            TEXT DEFAULT 'en-US',
    search_intent        TEXT,
    funnel_stage        TEXT,
    estimated_demand    INTEGER,
    difficulty_estimate INTEGER,
    local_relevance     REAL,
    business_relevance  REAL,
    menu_relevance      REAL,
    conversion_potential REAL,
    seasonal_relevance  TEXT,
    target_url          TEXT,
    current_ranking     INTEGER,
    impressions         INTEGER,
    clicks              INTEGER,
    ctr                 REAL,
    avg_position        REAL,
    assigned_content_id TEXT,
    cannibalization_risk TEXT,
    status              TEXT NOT NULL DEFAULT 'DISCOVERED',
    source              TEXT,
    evidence_id         TEXT,
    last_reviewed_at    TEXT,
    deleted_at          TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_kw_brand ON seo_keywords(brand_id);

  CREATE TABLE IF NOT EXISTS seo_topic_clusters (
    id           TEXT PRIMARY KEY,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    brand_id     TEXT NOT NULL,
    name         TEXT NOT NULL,
    pillar_content_id TEXT,
    health_status TEXT DEFAULT 'unknown',
    deleted_at   TEXT
  );

  CREATE TABLE IF NOT EXISTS seo_site_pages (
    id           TEXT PRIMARY KEY,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    brand_id     TEXT NOT NULL,
    location_id  TEXT,
    url          TEXT NOT NULL,
    page_type    TEXT NOT NULL,
    title        TEXT,
    meta_title   TEXT,
    meta_description TEXT,
    canonical    TEXT,
    is_orphan    INTEGER DEFAULT 0,
    last_crawled_at TEXT,
    deleted_at   TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_page_url ON seo_site_pages(brand_id, url);

  CREATE TABLE IF NOT EXISTS seo_content_items (
    id                TEXT PRIMARY KEY,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    brand_id          TEXT NOT NULL,
    location_id       TEXT,
    title             TEXT,
    slug              TEXT,
    primary_keyword_id TEXT,
    search_intent     TEXT,
    article_type      TEXT,
    status            TEXT NOT NULL DEFAULT 'IDEA',
    quality_score     REAL,
    ai_provider       TEXT,
    scheduled_publish_at TEXT,
    published_at      TEXT,
    approval_id       TEXT,
    current_version_id TEXT,
    deleted_at        TEXT
  );

  CREATE TABLE IF NOT EXISTS seo_evidence (
    id           TEXT PRIMARY KEY,
    created_at   TEXT NOT NULL,
    action_id    TEXT,
    brand_id     TEXT,
    category     TEXT NOT NULL,
    summary      TEXT,
    payload      TEXT,
    sha256       TEXT
  );

  CREATE TABLE IF NOT EXISTS seo_reports (
    id           TEXT PRIMARY KEY,
    created_at   TEXT NOT NULL,
    brand_id     TEXT,
    report_type  TEXT NOT NULL,
    period_start TEXT,
    period_end   TEXT,
    content      TEXT
  );
`;

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

console.log('=== upgrade-from-partial ===');

const tmpDir = mkdtempSync(join(tmpdir(), 'seo-migration-test-'));
const dbPath = join(tmpDir, 'partial.db');
let db;

try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // Seed a pre-existing subset of tables, simulating the old inline bootstrap.
  db.exec(PRE_EXISTING_SQL);

  const preExistingTables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'seo_%'")
    .all()
    .map((r) => r.name)
    .sort();
  check(
    `pre-seeded a real subset (6 of ${EXPECTED_TABLES.length} tables), not all of them`,
    preExistingTables.length === 6 && preExistingTables.length < EXPECTED_TABLES.length,
    `pre-existing=${JSON.stringify(preExistingTables)}`
  );

  const hasMigrationsTableBefore = !!db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
    .get();
  check('no schema_migrations table before running migrations', !hasMigrationsTableBefore);

  let thrown = null;
  let result = null;
  try {
    result = runMigrations(db);
  } catch (err) {
    thrown = err;
  }

  check(
    'runMigrations() does not throw on pre-existing tables',
    thrown === null,
    thrown ? String(thrown.stack || thrown) : undefined
  );

  const tableRows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'seo_%'")
    .all()
    .map((r) => r.name)
    .sort();
  check(
    `all ${EXPECTED_TABLES.length} seo_* tables exist after migration (missing ones got created)`,
    EXPECTED_TABLES.every((t) => tableRows.includes(t)),
    `missing=${JSON.stringify(EXPECTED_TABLES.filter((t) => !tableRows.includes(t)))}`
  );

  const migrationRows = db.prepare('SELECT version, name, checksum, applied_at FROM schema_migrations').all();
  check(
    'schema_migrations is populated correctly (rows for migrations 1, 2, 3, 4, and 5)',
    migrationRows.length === 5 &&
      migrationRows[0].version === 1 &&
      migrationRows[0].name === 'initial_schema' &&
      migrationRows[1].version === 2 &&
      migrationRows[1].name === 'pipeline_state' &&
      migrationRows[2].version === 3 &&
      migrationRows[2].name === 'approval_bindings' &&
      migrationRows[3].version === 4 &&
      migrationRows[3].name === 'approval_execution_state' &&
      migrationRows[4].version === 5 &&
      migrationRows[4].name === 'approval_reconciliation',
    `rows=${JSON.stringify(migrationRows)}`
  );

  check(
    'result.applied reflects the migration actually ran',
    !!result &&
      JSON.stringify(result.applied) === JSON.stringify(['1_initial_schema', '2_pipeline_state', '3_approval_bindings', '4_approval_execution_state', '5_approval_reconciliation']) &&
      result.alreadyCurrent === false,
    JSON.stringify(result)
  );

  // Data integrity spot-check: pre-existing table's structure wasn't clobbered.
  db.prepare(
    `INSERT INTO seo_keywords (id, created_at, updated_at, brand_id, keyword, normalized_keyword)
     VALUES ('kw-1', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'brand-1', 'ramen near me', 'ramen near me')`
  ).run();
  const row = db.prepare('SELECT * FROM seo_keywords WHERE id = ?').get('kw-1');
  check('pre-existing table still usable for inserts after migration run', !!row && row.brand_id === 'brand-1');
} finally {
  if (db) db.close();
  rmSync(tmpDir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
