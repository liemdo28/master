/**
 * Executive Knowledge Database — SQLite FTS5 for fast local search.
 * Ingests: .md, .txt, .json, reports, READMEs, source maps, connector caches.
 * Supports: Vietnamese, English, fuzzy, project, report, decision search.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Path resolution: prefer mi-core root, then workspace root
const MI_CORE_ROOT = path.resolve(__dirname, '..', '..', '..');
const GLOBAL_DIR  = process.env.GLOBAL_DIR  || path.join(MI_CORE_ROOT, '.local-agent-global');
const MASTER_ROOT = process.env.MASTER_ROOT || path.resolve(MI_CORE_ROOT, '..');
const DB_PATH = path.join(GLOBAL_DIR, 'knowledge-db', 'knowledge.db');
const STATS_PATH = path.join(GLOBAL_DIR, 'knowledge-db', 'stats.json');
const LOG_PATH   = path.join(GLOBAL_DIR, 'knowledge-db', 'ingestion_log.json');
const CATALOG_PATH = path.join(GLOBAL_DIR, 'knowledge-db', 'source_catalog.json');

let _db: Database.Database | null = null;

function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS docs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      source      TEXT NOT NULL,
      category    TEXT NOT NULL,
      title       TEXT NOT NULL,
      content     TEXT NOT NULL,
      file_path   TEXT,
      ingested_at TEXT NOT NULL,
      checksum    TEXT
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
      title, content, source, category,
      content='docs', content_rowid='id',
      tokenize='unicode61 remove_diacritics 2'
    );
    CREATE TRIGGER IF NOT EXISTS docs_ai AFTER INSERT ON docs BEGIN
      INSERT INTO docs_fts(rowid, title, content, source, category)
      VALUES (new.id, new.title, new.content, new.source, new.category);
    END;
    CREATE TABLE IF NOT EXISTS packs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pack_id TEXT UNIQUE,
      name TEXT,
      domain TEXT,
      doc_count INTEGER DEFAULT 0,
      installed_at TEXT
    );
  `);
  return _db;
}

export interface KnowledgeDoc {
  id: number;
  source: string;
  category: string;
  title: string;
  content: string;
  file_path?: string;
  ingested_at: string;
}

export interface SearchResult {
  id: number;
  title: string;
  source: string;
  category: string;
  snippet: string;
  file_path?: string;
  rank: number;
}

// ---- INGEST ----

const INCLUDE_EXT = new Set(['.md', '.txt', '.json', '.csv', '.html', '.ts', '.js', '.php', '.py']);
// Phase 9G — 'mi-core-deployed-source' and 'mi-core-predeploy-backups' are deploy-tooling
// output directories (exact-SHA source snapshots and predeploy DB/dist backups), not
// knowledge sources. Confirmed via direct production DB query: zero of the 44,000+
// currently-ingested docs originate from either name, at either of their real locations
// (F:\Projects\mi-core-predeploy-backups and the two under F:\Projects\D-root-mi-snapshots).
// Excluding by basename is safe here specifically because a filesystem search found these
// exact names used nowhere else in the tree for any other purpose — this is not a general
// pattern to reach for; each addition to this set needs its own such evidence.
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'vendor', 'cache', 'tmp',
  '.claude', 'worktrees', '.backups',
  'mi-core-deployed-source', 'mi-core-predeploy-backups',
]);
// Phase 9G — exported so the deterministic evaluation harness exercises the exact real
// decision function, not a re-implementation of it.
export function isExcludedDirName(name: string): boolean {
  return EXCLUDE_DIRS.has(name);
}
const MAX_FILE_SIZE = 500 * 1024; // 500KB

function simpleChecksum(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h).toString(16);
}

function detectCategory(filePath: string, content: string): string {
  const fp = filePath.toLowerCase();
  if (/report|audit|qa|validation/.test(fp)) return 'report';
  if (/readme/i.test(fp)) return 'readme';
  if (/decision|lesson|retrospect/.test(fp)) return 'decision';
  if (/workflow|process|runbook/.test(fp)) return 'workflow';
  if (/source-map|source_map/.test(fp)) return 'source-map';
  if (/knowledge|reference/.test(fp)) return 'reference';
  if (/dashboard/.test(fp)) return 'dashboard';
  if (/rawsushi|bakudan|restaurant/.test(fp)) return 'business';
  if (/\.json$/.test(fp) && /package|composer|pyproject/.test(fp)) return 'project-config';
  return 'project';
}

function extractTitle(filePath: string, content: string): string {
  // Try H1 from markdown
  const h1 = content.match(/^#\s+(.+)/m);
  if (h1) return h1[1].trim();
  return path.basename(filePath, path.extname(filePath)).replace(/[-_]/g, ' ');
}

export function ingestFile(filePath: string, source = 'local'): boolean {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_SIZE) return false;
    const content = fs.readFileSync(filePath, 'utf-8').trim();
    if (content.length < 30) return false;

    const checksum = simpleChecksum(content);
    const d = db();

    // Skip if already ingested with same checksum
    const existing = d.prepare('SELECT id FROM docs WHERE file_path = ? AND checksum = ?').get(filePath, checksum);
    if (existing) return false;

    // Remove old version
    d.prepare('DELETE FROM docs WHERE file_path = ?').run(filePath);

    const category = detectCategory(filePath, content);
    const title = extractTitle(filePath, content);
    const snippet = content.slice(0, 2000); // Store first 2KB for search context

    d.prepare(`
      INSERT INTO docs (source, category, title, content, file_path, ingested_at, checksum)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(source, category, title, snippet, filePath, new Date().toISOString(), checksum);

    return true;
  } catch { return false; }
}

// Phase 9F — yields back to the event loop periodically during a walk. `fullIngest()`
// can visit tens of thousands of directory entries in one call (MASTER_ROOT defaults to
// the workspace root, a sibling of mi-core itself); without this, the entire walk ran as
// one uninterrupted synchronous burst, blocking every other timer and HTTP request on
// Node's single JS thread for the walk's whole duration (observed: ~30-35 minutes).
// setImmediate (not setTimeout(0)) is used deliberately — it yields exactly one turn of
// the event loop, letting pending I/O/timers run, without adding idle delay.
const YIELD_EVERY_ENTRIES = 25;
function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

export async function ingestDirectory(
  rootDir: string,
  source?: string,
  maxFiles = 2000,
  onYield?: () => void,
  // Phase 9G — test-only observation hook, fired once per directory `walk()` actually
  // calls readdirSync on. Never fires for a name in EXCLUDE_DIRS, because the exclusion
  // check below runs in the *parent's* loop, before `walk()` is ever invoked for that
  // child — the recursive call, and therefore this hook, simply never happens for it.
  // This is what lets a test prove "never entered" rather than only "entered then
  // rejected": assert this callback is never invoked with an excluded path. Read-only,
  // no mutation authority, undefined in every production call site.
  onDirectoryEnter?: (dir: string) => void,
): Promise<{ ingested: number; skipped: number; errors: number }> {
  let ingested = 0; let skipped = 0; let errors = 0;
  let entriesSinceYield = 0;
  const src = source || path.basename(rootDir);

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > 5 || ingested >= maxFiles) return;
    onDirectoryEnter?.(dir);
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (isExcludedDirName(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!INCLUDE_EXT.has(ext)) { skipped++; }
          else {
            const ok = ingestFile(full, src);
            if (ok) ingested++; else skipped++;
          }
        } else if (entry.isDirectory()) {
          await walk(full, depth + 1);
        }
        if (++entriesSinceYield >= YIELD_EVERY_ENTRIES) {
          entriesSinceYield = 0;
          onYield?.();
          await yieldToEventLoop();
        }
        if (ingested >= maxFiles) return;
      }
    } catch { errors++; }
  };

  await walk(rootDir, 0);
  return { ingested, skipped, errors };
}

// ---- SEARCH ----

export function search(query: string, limit = 10, category?: string): SearchResult[] {
  try {
    const d = db();
    // Normalize query for FTS5 — wrap in quotes for phrase, add * for prefix
    const terms = query.trim().split(/\s+/).map(t => `"${t}"`).join(' OR ');
    const catFilter = category ? 'AND d.category = ?' : '';
    const params: unknown[] = [terms, ...(category ? [category] : []), limit];

    const rows = d.prepare(`
      SELECT d.id, d.title, d.source, d.category, d.content, d.file_path,
             rank as rank_score
      FROM docs_fts f
      JOIN docs d ON d.id = f.rowid
      WHERE docs_fts MATCH ? ${catFilter}
      ORDER BY rank
      LIMIT ?
    `).all(...params) as Array<{
      id: number; title: string; source: string; category: string;
      content: string; file_path: string; rank_score: number;
    }>;

    return rows.map(r => ({
      id: r.id, title: r.title, source: r.source, category: r.category,
      file_path: r.file_path, rank: r.rank_score,
      snippet: buildSnippet(r.content, query),
    }));
  } catch (e) {
    console.error('[KnowledgeDB search]', e);
    return [];
  }
}

function buildSnippet(content: string, query: string): string {
  const q = query.toLowerCase();
  const idx = content.toLowerCase().indexOf(q.split(' ')[0]);
  if (idx < 0) return content.slice(0, 200) + '...';
  const start = Math.max(0, idx - 80);
  return (start > 0 ? '...' : '') + content.slice(start, start + 300) + '...';
}

export function searchByCategory(category: string, limit = 20): SearchResult[] {
  try {
    const rows = db().prepare(`
      SELECT id, title, source, category, content, file_path FROM docs
      WHERE category = ? ORDER BY ingested_at DESC LIMIT ?
    `).all(category, limit) as KnowledgeDoc[];
    return rows.map(r => ({
      id: r.id, title: r.title, source: r.source, category: r.category,
      file_path: r.file_path, snippet: r.content.slice(0, 250), rank: 0,
    }));
  } catch { return []; }
}

// ---- STATS ----

export function getStats() {
  try {
    const d = db();
    const total = (d.prepare('SELECT COUNT(*) as c FROM docs').get() as { c: number }).c;
    const byCategory = d.prepare('SELECT category, COUNT(*) as c FROM docs GROUP BY category').all() as Array<{ category: string; c: number }>;
    const bySource = d.prepare('SELECT source, COUNT(*) as c FROM docs GROUP BY source ORDER BY c DESC LIMIT 10').all() as Array<{ source: string; c: number }>;
    const stats = { total_docs: total, by_category: byCategory, by_source: bySource, db_path: DB_PATH, generated_at: new Date().toISOString() };
    fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
    return stats;
  } catch { return { total_docs: 0, by_category: [], by_source: [] }; }
}

export async function clearAndRebuild(): Promise<{ ingested: number; skipped: number; errors: number }> {
  // Phase 9F — if a scheduled/other-caller ingest is still walking, let it finish before
  // wiping the tables out from under it rather than deleting mid-walk.
  if (_ingestInFlight) await _ingestInFlight.catch(() => undefined);
  const d = db();
  d.exec('DELETE FROM docs; DELETE FROM docs_fts;');
  _db = null; // Reset so triggers re-create properly on next db() call
  return fullIngest();
}

// Phase 9F — coalesces concurrent callers (the 4-hourly scheduler, a manual /ingest
// HTTP call, boot-time ingest) onto the single real walk in flight, rather than letting
// two walks run at once against the same DB/log file. Cleared in `finally` so the next
// call — whether the previous run succeeded or failed — always starts a fresh walk.
let _ingestInFlight: Promise<{ ingested: number; skipped: number; errors: number }> | null = null;

export function fullIngest(): Promise<{ ingested: number; skipped: number; errors: number }> {
  if (_ingestInFlight) return _ingestInFlight;
  const run = runFullIngest().finally(() => { _ingestInFlight = null; });
  _ingestInFlight = run;
  return run;
}

async function runFullIngest(): Promise<{ ingested: number; skipped: number; errors: number }> {
  const log: Array<{ source: string; ingested: number; skipped: number; errors: number; at: string }> = [];
  let totalIngested = 0; let totalSkipped = 0; let totalErrors = 0;

  // Ingest Master Workspace
  const masterResult = await ingestDirectory(MASTER_ROOT, 'master-workspace');
  log.push({ source: 'master-workspace', ...masterResult, at: new Date().toISOString() });
  totalIngested += masterResult.ingested;
  totalSkipped += masterResult.skipped;
  totalErrors += masterResult.errors;

  // Ingest global visibility cache
  const cacheDir = path.join(GLOBAL_DIR, 'visibility');
  if (fs.existsSync(cacheDir)) {
    const cacheResult = await ingestDirectory(cacheDir, 'visibility-cache');
    log.push({ source: 'visibility-cache', ...cacheResult, at: new Date().toISOString() });
    totalIngested += cacheResult.ingested;
    totalSkipped += cacheResult.skipped;
    totalErrors += cacheResult.errors;
  }

  // Ingest executive memory
  const memDir = path.join(GLOBAL_DIR, 'executive-memory-v2');
  if (fs.existsSync(memDir)) {
    const memResult = await ingestDirectory(memDir, 'executive-memory');
    log.push({ source: 'executive-memory', ...memResult, at: new Date().toISOString() });
    totalIngested += memResult.ingested;
    totalErrors += memResult.errors;
  }

  // Phase 9F — neither of these is allowed to reject `fullIngest()`'s promise: a disk-full
  // or permission failure writing the log/stats file is a real but bounded error, truthfully
  // counted here, not a reason for the whole ingest run (whose actual DB writes already
  // committed per-file above) to come back as a rejected promise the scheduler must guess
  // how to handle.
  try {
    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
    getStats(); // Update stats file
  } catch (e) {
    totalErrors += 1;
    console.warn('[KnowledgeDB] fullIngest: log/stats write failed (ingested docs are unaffected):', e instanceof Error ? e.message : e);
  }
  return { ingested: totalIngested, skipped: totalSkipped, errors: totalErrors };
}

export function buildCatalog(): unknown[] {
  try {
    const rows = db().prepare(`
      SELECT source, category, COUNT(*) as doc_count, MAX(ingested_at) as last_ingested
      FROM docs GROUP BY source, category ORDER BY doc_count DESC
    `).all();
    fs.writeFileSync(CATALOG_PATH, JSON.stringify(rows, null, 2));
    return rows;
  } catch { return []; }
}
