// core/DatabaseManager.js - SQLite with WAL mode + batch writer
import { createRequire } from 'module';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_DB_PATH = join(__dirname, '..', 'ledgers', 'accounting.db');
const SCHEMA_PATH     = join(__dirname, '..', 'database', 'schema.sql');

let _db = null;

export function openDatabase(dbPath = DEFAULT_DB_PATH) {
  if (_db) return _db;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const Database = require('better-sqlite3');
  const db = new Database(dbPath);

  // P0: WAL mode + performance PRAGMAs
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');
  db.pragma('cache_size = -32000');      // 32 MB cache
  db.pragma('mmap_size = 268435456');    // 256 MB mmap
  db.pragma('wal_autocheckpoint = 1000');

  // Apply schema
  if (existsSync(SCHEMA_PATH)) {
    const schema = readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema);
  }

  _db = db;
  return db;
}

export function getDatabase() {
  if (!_db) throw new Error('Database not opened. Call openDatabase() first.');
  return _db;
}

export function closeDatabase() {
  if (_db) { _db.close(); _db = null; }
}

export function withTransaction(db, fn) {
  return db.transaction(fn)();
}

// Batch insert helper — runs all inserts in one transaction
export function batchInsert(db, tableName, rows) {
  if (!rows.length) return 0;
  const keys   = Object.keys(rows[0]);
  const cols   = keys.join(', ');
  const params = keys.map((k) => `@${k}`).join(', ');
  const stmt   = db.prepare(`INSERT INTO ${tableName} (${cols}) VALUES (${params})`);
  const run    = db.transaction((items) => { for (const row of items) stmt.run(row); });
  run(rows);
  return rows.length;
}

export function getStats(db) {
  return {
    sessions:     db.prepare('SELECT COUNT(*) as c FROM sessions').get().c,
    metrics:      db.prepare('SELECT COUNT(*) as c FROM resource_metrics').get().c,
    auditRows:    db.prepare('SELECT COUNT(*) as c FROM audit_ledger').get().c,
    patches:      db.prepare('SELECT COUNT(*) as c FROM patch_ledger').get().c,
    qaRuns:       db.prepare('SELECT COUNT(*) as c FROM qa_runs').get().c,
    dbSizeBytes:  db.pragma('page_count')[0].page_count * db.pragma('page_size')[0].page_size,
    walMode:      db.pragma('journal_mode')[0].journal_mode,
  };
}
