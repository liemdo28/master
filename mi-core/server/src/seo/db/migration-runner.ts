/**
 * SEO Control Center — SQLite migration runner.
 *
 * Manages the schema for `.local-agent-global/seo/seo-control-center.db`
 * (see `../seo-db.ts`). Replaces the old single inline `db.exec(CREATE TABLE...)`
 * bootstrap with a versioned migration system, while keeping every table name
 * and column exactly as they were.
 *
 * Tables currently managed by this migration system (24 total, all defined in
 * migrations/0001_initial_schema.ts — moved verbatim from the old inline bootstrap):
 *   1.  seo_keywords            — keyword research records
 *   2.  seo_topic_clusters      — topic cluster headers
 *   3.  seo_cluster_nodes       — pillar/supporting-article/location/menu nodes within a cluster
 *   4.  seo_site_pages          — URL registry (backs internal link + CTA engines)
 *   5.  seo_content_items       — article/content records
 *   6.  seo_article_versions    — versioned article bodies + metadata
 *   7.  seo_business_facts      — verified business fact registry
 *   8.  seo_article_facts       — fact-to-article claim linkage
 *   9.  seo_internal_links      — internal link graph edges
 *   10. seo_backlinks           — external backlink records
 *   11. seo_backlink_checks     — periodic backlink health-check results
 *   12. seo_audits              — technical/local/gbp/backlink audit runs
 *   13. seo_issues              — issues found during audits
 *   14. seo_actions             — automation actions + policy tier + idempotency
 *   15. seo_automation_runs     — scheduler job run log
 *   16. seo_policy_versions     — versioned automation policy YAML
 *   17. seo_evidence            — evidence store (before/after state, QA results)
 *   18. seo_gbp_snapshots       — Google Business Profile snapshots
 *   19. seo_rankings            — GSC-derived daily ranking rows
 *   20. seo_analytics_daily     — daily analytics metric rollups
 *   21. seo_ai_jobs             — AI content generation job queue
 *   22. seo_ai_responses        — raw/parsed AI job responses
 *   23. seo_publish_snapshots   — publish before/after snapshots (rollback support)
 *   24. seo_reports             — daily/weekly/monthly generated reports
 *
 * (Note: the task brief that requested this migration system referred to "27"
 * tables; the actual inline bootstrap in seo-db.ts at the time of this change
 * defined 24 `seo_*` tables. All 24 were moved verbatim — none renamed, none
 * dropped, no columns changed.)
 *
 * ── Locking strategy ────────────────────────────────────────────────────────
 * Each migration is applied inside its own `db.transaction(fn).immediate()`
 * call. `better-sqlite3`'s `.immediate()` issues `BEGIN IMMEDIATE` instead of
 * a deferred `BEGIN`, which acquires SQLite's RESERVED write lock up front
 * (before any reads/writes happen), rather than lazily on first write. Under
 * SQLite's single-writer model this means:
 *   - If two Mi-Core server processes call `runMigrations()` at the same
 *     moment (e.g. two instances starting concurrently), whichever gets its
 *     `BEGIN IMMEDIATE` in first holds the write lock for the duration of
 *     that one migration's transaction. The second process's `BEGIN
 *     IMMEDIATE` blocks (subject to `busy_timeout`, set below) until the
 *     first commits or rolls back — it can never interleave writes with it.
 *   - Inside each migration's transaction we re-check `schema_migrations`
 *     for that exact version *after* acquiring the lock (not before), so the
 *     second process — once it gets the lock — sees the row the first
 *     process just committed and skips re-applying, instead of racing on the
 *     `INSERT ... PRIMARY KEY(version)` and throwing a spurious "migration
 *     failed" error.
 * This is safe specifically because `better-sqlite3` is fully synchronous
 * (no interleaved event-loop turns inside a transaction body) and because
 * SQLite itself serializes all writers process-wide via its file lock — we
 * are not implementing our own lock, just using SQLite's.
 *
 * ── Duplicate-run / re-entrancy safety ─────────────────────────────────────
 * Running `runMigrations()` twice in a row against the same database (e.g.
 * a fast double-restart) is a no-op the second time: every migration's
 * "already applied?" check happens inside its own locked transaction, so the
 * second run finds every version already present in `schema_migrations`,
 * applies nothing, and returns `{ applied: [], alreadyCurrent: true }`. See
 * `__migration_tests__/duplicate-run-safety.mjs` for a real, executed test.
 *
 * ── Tamper detection ────────────────────────────────────────────────────────
 * Each applied migration's SQL/logic is hashed (SHA-256) and stored in
 * `schema_migrations.checksum`. On every run, already-applied migrations have
 * their current checksum recomputed and compared against the stored one. A
 * mismatch means the migration file was edited *after* it shipped to a
 * running database — we log a loud warning (this is a startup-time integrity
 * signal, useful for catching accidental edits to historical migrations) but
 * deliberately do NOT throw, because a false positive (e.g. from a
 * reformatting tool touching whitespace in a way that changes `up.toString()`)
 * should never take down the SEO Control Center on boot.
 */

import type Database from 'better-sqlite3';
import { createHash } from 'crypto';

import migration_0001_initial_schema from './migrations/0001_initial_schema';
import migration_0002_pipeline_state from './migrations/0002_pipeline_state';
import migration_0003_approval_bindings from './migrations/0003_approval_bindings';
import migration_0004_approval_execution_state from './migrations/0004_approval_execution_state';
import migration_0005_approval_reconciliation from './migrations/0005_approval_reconciliation';

type SqliteDb = InstanceType<typeof Database>;

export interface Migration {
  /** Monotonically increasing integer version. Migrations apply in this order. */
  version: number;
  /** Short human-readable name, e.g. "initial_schema". */
  name: string;
  /** Applies the migration against the given database handle. */
  up: (db: SqliteDb) => void;
  /**
   * The exact SQL (or other canonical source) this migration will execute.
   * Used to compute the tamper-detection checksum. When omitted, the
   * checksum falls back to `up.toString()`.
   */
  sql?: string;
}

interface SchemaMigrationRow {
  version: number;
  name: string;
  checksum: string;
  applied_at: string;
}

/** All known migrations, registered explicitly (add new ones here, in order). */
const MIGRATIONS: Migration[] = [
  migration_0001_initial_schema,
  migration_0002_pipeline_state,
  migration_0003_approval_bindings,
  migration_0004_approval_execution_state,
  migration_0005_approval_reconciliation,
].sort(
  (a, b) => a.version - b.version
);

function nowIso(): string {
  return new Date().toISOString();
}

function computeChecksum(migration: Migration): string {
  const material = migration.sql ?? migration.up.toString();
  return createHash('sha256').update(material, 'utf8').digest('hex');
}

function ensureMigrationsTable(db: SqliteDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      checksum   TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

export interface RunMigrationsResult {
  /** "<version>_<name>" for every migration actually applied during this call. */
  applied: string[];
  /** True when no migrations needed to be applied (schema was already up to date). */
  alreadyCurrent: boolean;
}

/**
 * Applies all pending migrations, in version order, against `db`.
 * Safe to call on every server startup — already-applied migrations are
 * skipped (see module doc for locking + duplicate-run guarantees).
 */
export function runMigrations(db: SqliteDb): RunMigrationsResult {
  // Give concurrent BEGIN IMMEDIATE callers a chance to wait out a lock held
  // by another process instead of failing immediately with SQLITE_BUSY.
  db.pragma('busy_timeout = 5000');

  ensureMigrationsTable(db);

  const applied: string[] = [];

  for (const migration of MIGRATIONS) {
    const expectedChecksum = computeChecksum(migration);

    const applyOne = db.transaction((): boolean => {
      const existing = db
        .prepare('SELECT version, name, checksum, applied_at FROM schema_migrations WHERE version = ?')
        .get(migration.version) as SchemaMigrationRow | undefined;

      if (existing) {
        if (existing.checksum !== expectedChecksum) {
          console.warn(
            `[seo-db migrations] WARNING: migration ${migration.version} ` +
              `("${migration.name}") was already applied at ${existing.applied_at}, but its ` +
              `checksum no longer matches what's on disk (expected ${expectedChecksum}, ` +
              `stored ${existing.checksum}). This usually means the migration file was edited ` +
              `after it shipped. Not re-applying automatically — review the diff by hand.`
          );
        }
        return false; // not (re-)applied this run — either identical or a flagged mismatch
      }

      try {
        migration.up(db);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(
          `[seo-db migrations] Migration ${migration.version} ("${migration.name}") failed and ` +
            `was rolled back: ${reason}. Stopping migration run — schema is left at the last ` +
            `successfully applied version.`
        );
      }

      db.prepare(
        'INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)'
      ).run(migration.version, migration.name, expectedChecksum, nowIso());

      return true;
    });

    // .immediate() => BEGIN IMMEDIATE: acquires SQLite's write lock up front,
    // making this whole check-then-apply sequence atomic across processes.
    const wasApplied = applyOne.immediate();
    if (wasApplied) {
      applied.push(`${migration.version}_${migration.name}`);
    }
  }

  return { applied, alreadyCurrent: applied.length === 0 };
}
