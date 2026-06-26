/**
 * Phase 0 — Coordination Persistence Layer
 *
 * File-based JSON store with migration path to SQLite/Postgres.
 * Backed by .mi-harness/coordination/ in workspace root.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.env.MI_COORDINATION_DIR
  ? path.resolve(process.env.MI_COORDINATION_DIR)
  : path.resolve(process.cwd(), '.mi-harness/coordination');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(ROOT);
ensureDir(path.join(ROOT, 'objectives'));
ensureDir(path.join(ROOT, 'tasks'));
ensureDir(path.join(ROOT, 'evidence'));
ensureDir(path.join(ROOT, 'approvals'));
ensureDir(path.join(ROOT, 'dependencies'));
ensureDir(path.join(ROOT, 'conflicts'));
ensureDir(path.join(ROOT, 'duplicates'));
ensureDir(path.join(ROOT, 'transitions'));

export function coordinationDir(): string { return ROOT; }

export function loadCollection<T>(subdir: string): T[] {
  const dir = path.join(ROOT, subdir);
  if (!fs.existsSync(dir)) return [];
  const items: T[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      items.push(JSON.parse(raw));
    } catch {
      // ignore corrupt file
    }
  }
  return items;
}

export function saveRecord<T extends { id: string }>(subdir: string, record: T): T {
  const dir = path.join(ROOT, subdir);
  ensureDir(dir);
  const safeId = record.id.replace(/[^a-zA-Z0-9._-]/g, '_');
  fs.writeFileSync(path.join(dir, `${safeId}.json`), JSON.stringify(record, null, 2));
  return record;
}

export function loadRecord<T>(subdir: string, id: string): T | null {
  const safeId = id.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fp = path.join(ROOT, subdir, `${safeId}.json`);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function deleteRecord(subdir: string, id: string): boolean {
  const safeId = id.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fp = path.join(ROOT, subdir, `${safeId}.json`);
  if (!fs.existsSync(fp)) return false;
  fs.unlinkSync(fp);
  return true;
}

let _counter = Math.floor(Math.random() * 100000);

export function genId(prefix: string): string {
  _counter++;
  const ts = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 1e6).toString(36);
  return `${prefix}-${ts}-${_counter.toString(36)}${rand}`;
}

export function nowIso(): string { return new Date().toISOString(); }
