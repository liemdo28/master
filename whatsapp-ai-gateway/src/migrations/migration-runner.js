'use strict';

const path = require('path');
const fs = require('fs');
const { makeLogger } = require('../logger');

const log = makeLogger('migrations');

let db = null;

function getDb() {
  if (db) return db;
  const sqlite3 = require('sqlite3').verbose();
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const dbPath = process.env.DB_PATH || path.join(dataDir, 'gateway.db');
  db = new sqlite3.Database(dbPath);
  return db;
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function ensureMigrationsTable() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ok',
      error TEXT
    )
  `);
}

async function getAppliedVersions() {
  const rows = await dbAll(
    `SELECT version FROM schema_migrations WHERE status = 'ok'`
  );
  return new Set(rows.map(r => r.version));
}

async function loadMigrations() {
  const migrationsDir = path.join(__dirname);
  const files = fs.readdirSync(migrationsDir)
    .filter(f => /^\d{3}_.*\.js$/.test(f))
    .sort();
  return files.map(f => ({
    version: f.slice(0, 3),
    name: f.replace(/\.js$/, ''),
    file: path.join(migrationsDir, f),
  }));
}

async function runMigrations() {
  await ensureMigrationsTable();
  const applied = await getAppliedVersions();
  const migrations = await loadMigrations();

  let ran = 0;
  for (const m of migrations) {
    if (applied.has(m.version)) continue;

    log.info(`Running migration ${m.name}`);
    const startedAt = new Date().toISOString();
    try {
      const migration = require(m.file);
      await migration.up(getDb(), dbRun, dbAll);
      await dbRun(
        `INSERT INTO schema_migrations (version, name, applied_at, status) VALUES (?, ?, ?, 'ok')`,
        [m.version, m.name, startedAt]
      );
      log.info(`Migration ${m.name} applied`);
      ran++;
    } catch (err) {
      await dbRun(
        `INSERT INTO schema_migrations (version, name, applied_at, status, error) VALUES (?, ?, ?, 'failed', ?)`,
        [m.version, m.name, startedAt, err.message]
      );
      log.error(`Migration ${m.name} failed: ${err.message}`);
      throw new Error(`Migration ${m.name} failed: ${err.message}`);
    }
  }

  if (ran === 0) {
    log.info('All migrations up to date');
  } else {
    log.info(`${ran} migration(s) applied`);
  }
  return ran;
}

async function getMigrationStatus() {
  try {
    await ensureMigrationsTable();
    const rows = await dbAll(
      `SELECT version, name, applied_at, status, error FROM schema_migrations ORDER BY version`
    );
    const pending = await loadMigrations();
    const appliedVersions = new Set(rows.filter(r => r.status === 'ok').map(r => r.version));
    return {
      applied: rows,
      pending: pending.filter(m => !appliedVersions.has(m.version)).map(m => m.name),
    };
  } catch (_) {
    return { applied: [], pending: [] };
  }
}

module.exports = { runMigrations, getMigrationStatus };
