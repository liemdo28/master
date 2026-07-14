/**
 * SEO Control Center — shared SQLite foundation.
 * Single WAL-mode database at .local-agent-global/seo/seo-control-center.db
 * Schema is managed by a versioned migration system — see ./db/migration-runner.ts
 * and ./db/migrations/ (all 24 seo_* tables are defined there, moved verbatim
 * from the old inline-bootstrap `db.exec(...)` that used to live in this file).
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { runMigrations } from './db/migration-runner';

const SEO_DIR = process.env.MI_DATA_DIR
  ? join(process.env.MI_DATA_DIR, 'seo')
  : join('D:/Project/Master/.local-agent-global', 'seo');

if (!existsSync(SEO_DIR)) mkdirSync(SEO_DIR, { recursive: true });

const DB_PATH = join(SEO_DIR, 'seo-control-center.db');

let _db: InstanceType<typeof Database> | null = null;

export function getSeoDb(): InstanceType<typeof Database> {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');
  runMigrations(_db);
  return _db;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function seoId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
