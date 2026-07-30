/**
 * Migration Runner — Phase 21
 *
 * Runs SQL migration files against Postgres.
 * Tracks applied migrations in schema_migrations table.
 *
 * Usage: node dist/db/migrate.js
 * Or import and call: await runMigrations(pgPool)
 */

import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

/**
 * Get the Postgres pool from env vars.
 */
export function createPool(): Pool {
  return new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE || 'mi_exec',
    user: process.env.PGUSER || 'mi_exec',
    password: process.env.PGPASSWORD || '',
    max: 5,
    idleTimeoutMillis: 10000,
  });
}

/**
 * Get list of applied migration versions.
 */
async function getAppliedMigrations(pool: Pool): Promise<Set<string>> {
  try {
    const result = await pool.query('SELECT version FROM schema_migrations ORDER BY applied_at');
    return new Set(result.rows.map((r: any) => r.version));
  } catch {
    // Table might not exist yet
    return new Set();
  }
}

/**
 * Read all migration files from the migrations directory.
 */
function getMigrationFiles(): Array<{ version: string; filePath: string; sql: string }> {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];

  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => ({
      version: f.replace('.sql', ''),
      filePath: path.join(MIGRATIONS_DIR, f),
      sql: fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf-8'),
    }));
}

/**
 * Run all pending migrations.
 */
export async function runMigrations(pool?: Pool): Promise<{ applied: string[]; skipped: string[] }> {
  const ownPool = !pool;
  const p = pool || createPool();

  try {
    const applied = await getAppliedMigrations(p);
    const migrations = getMigrationFiles();
    const appliedList: string[] = [];
    const skippedList: string[] = [];

    for (const migration of migrations) {
      if (applied.has(migration.version)) {
        skippedList.push(migration.version);
        continue;
      }

      console.log(`[Migration] Applying ${migration.version}...`);
      try {
        await p.query('BEGIN');
        await p.query(migration.sql);
        await p.query('COMMIT');
        appliedList.push(migration.version);
        console.log(`[Migration] ✓ ${migration.version} applied`);
      } catch (err) {
        await p.query('ROLLBACK');
        console.error(`[Migration] ✗ ${migration.version} FAILED: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    }

    if (appliedList.length === 0 && skippedList.length === 0) {
      console.log('[Migration] No migration files found');
    } else {
      console.log(`[Migration] Done: ${appliedList.length} applied, ${skippedList.length} skipped`);
    }

    return { applied: appliedList, skipped: skippedList };
  } finally {
    if (ownPool) await p.end();
  }
}

// CLI entry point
if (require.main === module) {
  runMigrations()
    .then(result => {
      console.log('[Migration] Completed:', result);
      process.exit(0);
    })
    .catch(err => {
      console.error('[Migration] Failed:', err);
      process.exit(1);
    });
}
