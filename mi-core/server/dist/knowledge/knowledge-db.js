"use strict";
/**
 * Executive Knowledge Database — SQLite FTS5 for fast local search.
 * Ingests: .md, .txt, .json, reports, READMEs, source maps, connector caches.
 * Supports: Vietnamese, English, fuzzy, project, report, decision search.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestFile = ingestFile;
exports.ingestDirectory = ingestDirectory;
exports.search = search;
exports.searchByCategory = searchByCategory;
exports.getStats = getStats;
exports.clearAndRebuild = clearAndRebuild;
exports.fullIngest = fullIngest;
exports.buildCatalog = buildCatalog;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Path resolution: prefer mi-core root, then workspace root
const MI_CORE_ROOT = path_1.default.resolve(__dirname, '..', '..', '..');
const GLOBAL_DIR = process.env.GLOBAL_DIR || path_1.default.join(MI_CORE_ROOT, '.local-agent-global');
const MASTER_ROOT = process.env.MASTER_ROOT || path_1.default.resolve(MI_CORE_ROOT, '..');
const DB_PATH = path_1.default.join(GLOBAL_DIR, 'knowledge-db', 'knowledge.db');
const STATS_PATH = path_1.default.join(GLOBAL_DIR, 'knowledge-db', 'stats.json');
const LOG_PATH = path_1.default.join(GLOBAL_DIR, 'knowledge-db', 'ingestion_log.json');
const CATALOG_PATH = path_1.default.join(GLOBAL_DIR, 'knowledge-db', 'source_catalog.json');
let _db = null;
function db() {
    if (_db)
        return _db;
    fs_1.default.mkdirSync(path_1.default.dirname(DB_PATH), { recursive: true });
    _db = new better_sqlite3_1.default(DB_PATH);
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
// ---- INGEST ----
const INCLUDE_EXT = new Set(['.md', '.txt', '.json', '.csv', '.html', '.ts', '.js', '.php', '.py']);
const EXCLUDE_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', 'vendor', 'cache', 'tmp',
    '.claude', 'worktrees', '.backups',
]);
const MAX_FILE_SIZE = 500 * 1024; // 500KB
function simpleChecksum(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++)
        h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    return Math.abs(h).toString(16);
}
function detectCategory(filePath, content) {
    const fp = filePath.toLowerCase();
    if (/report|audit|qa|validation/.test(fp))
        return 'report';
    if (/readme/i.test(fp))
        return 'readme';
    if (/decision|lesson|retrospect/.test(fp))
        return 'decision';
    if (/workflow|process|runbook/.test(fp))
        return 'workflow';
    if (/source-map|source_map/.test(fp))
        return 'source-map';
    if (/knowledge|reference/.test(fp))
        return 'reference';
    if (/dashboard/.test(fp))
        return 'dashboard';
    if (/rawsushi|bakudan|restaurant/.test(fp))
        return 'business';
    if (/\.json$/.test(fp) && /package|composer|pyproject/.test(fp))
        return 'project-config';
    return 'project';
}
function extractTitle(filePath, content) {
    // Try H1 from markdown
    const h1 = content.match(/^#\s+(.+)/m);
    if (h1)
        return h1[1].trim();
    return path_1.default.basename(filePath, path_1.default.extname(filePath)).replace(/[-_]/g, ' ');
}
function ingestFile(filePath, source = 'local') {
    try {
        const stat = fs_1.default.statSync(filePath);
        if (stat.size > MAX_FILE_SIZE)
            return false;
        const content = fs_1.default.readFileSync(filePath, 'utf-8').trim();
        if (content.length < 30)
            return false;
        const checksum = simpleChecksum(content);
        const d = db();
        // Skip if already ingested with same checksum
        const existing = d.prepare('SELECT id FROM docs WHERE file_path = ? AND checksum = ?').get(filePath, checksum);
        if (existing)
            return false;
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
    }
    catch {
        return false;
    }
}
function ingestDirectory(rootDir, source, maxFiles = 2000) {
    let ingested = 0;
    let skipped = 0;
    let errors = 0;
    const src = source || path_1.default.basename(rootDir);
    const walk = (dir, depth) => {
        if (depth > 5 || ingested >= maxFiles)
            return;
        try {
            for (const entry of fs_1.default.readdirSync(dir, { withFileTypes: true })) {
                if (EXCLUDE_DIRS.has(entry.name))
                    continue;
                const full = path_1.default.join(dir, entry.name);
                if (entry.isFile()) {
                    const ext = path_1.default.extname(entry.name).toLowerCase();
                    if (!INCLUDE_EXT.has(ext)) {
                        skipped++;
                        continue;
                    }
                    const ok = ingestFile(full, src);
                    if (ok)
                        ingested++;
                    else
                        skipped++;
                }
                else if (entry.isDirectory()) {
                    walk(full, depth + 1);
                }
            }
        }
        catch {
            errors++;
        }
    };
    walk(rootDir, 0);
    return { ingested, skipped, errors };
}
// ---- SEARCH ----
function search(query, limit = 10, category) {
    try {
        const d = db();
        // Normalize query for FTS5 — wrap in quotes for phrase, add * for prefix
        const terms = query.trim().split(/\s+/).map(t => `"${t}"`).join(' OR ');
        const catFilter = category ? 'AND d.category = ?' : '';
        const params = [terms, ...(category ? [category] : []), limit];
        const rows = d.prepare(`
      SELECT d.id, d.title, d.source, d.category, d.content, d.file_path,
             rank as rank_score
      FROM docs_fts f
      JOIN docs d ON d.id = f.rowid
      WHERE docs_fts MATCH ? ${catFilter}
      ORDER BY rank
      LIMIT ?
    `).all(...params);
        return rows.map(r => ({
            id: r.id, title: r.title, source: r.source, category: r.category,
            file_path: r.file_path, rank: r.rank_score,
            snippet: buildSnippet(r.content, query),
        }));
    }
    catch (e) {
        console.error('[KnowledgeDB search]', e);
        return [];
    }
}
function buildSnippet(content, query) {
    const q = query.toLowerCase();
    const idx = content.toLowerCase().indexOf(q.split(' ')[0]);
    if (idx < 0)
        return content.slice(0, 200) + '...';
    const start = Math.max(0, idx - 80);
    return (start > 0 ? '...' : '') + content.slice(start, start + 300) + '...';
}
function searchByCategory(category, limit = 20) {
    try {
        const rows = db().prepare(`
      SELECT id, title, source, category, content, file_path FROM docs
      WHERE category = ? ORDER BY ingested_at DESC LIMIT ?
    `).all(category, limit);
        return rows.map(r => ({
            id: r.id, title: r.title, source: r.source, category: r.category,
            file_path: r.file_path, snippet: r.content.slice(0, 250), rank: 0,
        }));
    }
    catch {
        return [];
    }
}
// ---- STATS ----
function getStats() {
    try {
        const d = db();
        const total = d.prepare('SELECT COUNT(*) as c FROM docs').get().c;
        const byCategory = d.prepare('SELECT category, COUNT(*) as c FROM docs GROUP BY category').all();
        const bySource = d.prepare('SELECT source, COUNT(*) as c FROM docs GROUP BY source ORDER BY c DESC LIMIT 10').all();
        const stats = { total_docs: total, by_category: byCategory, by_source: bySource, db_path: DB_PATH, generated_at: new Date().toISOString() };
        fs_1.default.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));
        return stats;
    }
    catch {
        return { total_docs: 0, by_category: [], by_source: [] };
    }
}
function clearAndRebuild() {
    const d = db();
    d.exec('DELETE FROM docs; DELETE FROM docs_fts;');
    _db = null; // Reset so triggers re-create properly on next db() call
    return fullIngest();
}
function fullIngest() {
    const log = [];
    let totalIngested = 0;
    let totalSkipped = 0;
    // Ingest Master Workspace
    const masterResult = ingestDirectory(MASTER_ROOT, 'master-workspace');
    log.push({ source: 'master-workspace', ...masterResult, at: new Date().toISOString() });
    totalIngested += masterResult.ingested;
    totalSkipped += masterResult.skipped;
    // Ingest global visibility cache
    const cacheDir = path_1.default.join(GLOBAL_DIR, 'visibility');
    if (fs_1.default.existsSync(cacheDir)) {
        const cacheResult = ingestDirectory(cacheDir, 'visibility-cache');
        log.push({ source: 'visibility-cache', ...cacheResult, at: new Date().toISOString() });
        totalIngested += cacheResult.ingested;
        totalSkipped += cacheResult.skipped;
    }
    // Ingest executive memory
    const memDir = path_1.default.join(GLOBAL_DIR, 'executive-memory-v2');
    if (fs_1.default.existsSync(memDir)) {
        const memResult = ingestDirectory(memDir, 'executive-memory');
        log.push({ source: 'executive-memory', ...memResult, at: new Date().toISOString() });
        totalIngested += memResult.ingested;
    }
    fs_1.default.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
    getStats(); // Update stats file
    return { ingested: totalIngested, skipped: totalSkipped };
}
function buildCatalog() {
    try {
        const rows = db().prepare(`
      SELECT source, category, COUNT(*) as doc_count, MAX(ingested_at) as last_ingested
      FROM docs GROUP BY source, category ORDER BY doc_count DESC
    `).all();
        fs_1.default.writeFileSync(CATALOG_PATH, JSON.stringify(rows, null, 2));
        return rows;
    }
    catch {
        return [];
    }
}
