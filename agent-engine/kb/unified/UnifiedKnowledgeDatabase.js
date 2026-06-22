// kb/unified/UnifiedKnowledgeDatabase.js — Unified Knowledge DB V2 schema and CRUD
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, statSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456;

CREATE TABLE IF NOT EXISTS ukv_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')));

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  root_path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  project_type TEXT NOT NULL DEFAULT 'unknown',
  status TEXT NOT NULL DEFAULT 'active',
  registry_source TEXT,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_indexed_at TEXT,
  stale INTEGER NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  qa_fail_count INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS knowledge_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  subtype TEXT,
  title TEXT NOT NULL,
  path TEXT,
  source_root TEXT,
  content TEXT NOT NULL DEFAULT '',
  summary TEXT,
  language TEXT NOT NULL DEFAULT 'unknown',
  normalized_text TEXT NOT NULL DEFAULT '',
  hash TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  mtime_ms INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  tags TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  first_indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(path, hash)
);

CREATE INDEX IF NOT EXISTS idx_ki_kind ON knowledge_items(kind, subtype);
CREATE INDEX IF NOT EXISTS idx_ki_project ON knowledge_items(project_id);
CREATE INDEX IF NOT EXISTS idx_ki_path ON knowledge_items(path);
CREATE INDEX IF NOT EXISTS idx_ki_hash ON knowledge_items(hash);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(normalized_name);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
  title, content, normalized_text, tags,
  content='knowledge_items', content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON knowledge_items BEGIN
  INSERT INTO knowledge_fts(rowid, title, content, normalized_text, tags) VALUES (new.id, new.title, new.content, new.normalized_text, new.tags);
END;
CREATE TRIGGER IF NOT EXISTS knowledge_ad AFTER DELETE ON knowledge_items BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content, normalized_text, tags) VALUES ('delete', old.id, old.title, old.content, old.normalized_text, old.tags);
END;
CREATE TRIGGER IF NOT EXISTS knowledge_au AFTER UPDATE ON knowledge_items BEGIN
  INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content, normalized_text, tags) VALUES ('delete', old.id, old.title, old.content, old.normalized_text, old.tags);
  INSERT INTO knowledge_fts(rowid, title, content, normalized_text, tags) VALUES (new.id, new.title, new.content, new.normalized_text, new.tags);
END;

CREATE TABLE IF NOT EXISTS relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
  rel_type TEXT NOT NULL DEFAULT 'related',
  weight REAL NOT NULL DEFAULT 1.0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_id, target_id, rel_type)
);

CREATE INDEX IF NOT EXISTS idx_rel_source ON relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_rel_target ON relationships(target_id);

-- source_map index: flat file metadata for fast lookup
CREATE TABLE IF NOT EXISTS source_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  rel_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  ext TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  mtime_ms INTEGER NOT NULL DEFAULT 0,
  hash TEXT,
  UNIQUE(project_id, rel_path)
);

CREATE INDEX IF NOT EXISTS idx_sm_project ON source_map(project_id);
CREATE INDEX IF NOT EXISTS idx_sm_ext ON source_map(ext);

-- ingest_log for audit
CREATE TABLE IF NOT EXISTS ingest_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  action TEXT NOT NULL,
  path TEXT,
  detail TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

const KNOWLEDGE_KINDS = [
  'source_map', 'report', 'qa_report', 'patch', 'workflow',
  'incident', 'decision', 'executive_memory', 'website_data',
  'dashboard_data', 'integration_system_data', 'whatsapp_data',
  'menu_data', 'seo_data', 'content_data', 'project_registry',
  'doc', 'readme', 'package_json', 'source_code', 'archive_record'
];

export function openUKV(dbPath) {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  return db;
}

// ── Meta helpers ──
export function getMeta(db, key) {
  const row = db.prepare('SELECT value FROM ukv_meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setMeta(db, key, value) {
  db.prepare(`INSERT INTO ukv_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`).run(key, value);
}

// ── Project ──
export function upsertProject(db, { root_path, name, project_type = 'unknown', status = 'active', registry_source = null, file_count = 0, metadata_json = '{}' }) {
  const normalized = normalizeText(name);
  db.prepare(`
    INSERT INTO projects (root_path, name, normalized_name, project_type, status, registry_source, file_count, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(root_path) DO UPDATE SET
      name=excluded.name, normalized_name=excluded.normalized_name, project_type=excluded.project_type,
      status=excluded.status, registry_source=COALESCE(excluded.registry_source, projects.registry_source),
      file_count=excluded.file_count, metadata_json=excluded.metadata_json, last_seen_at=datetime('now')
  `).run(root_path, name, normalized, project_type, status, registry_source, file_count, metadata_json);
  return db.prepare('SELECT * FROM projects WHERE root_path = ?').get(root_path);
}

export function getProject(db, idOrPath) {
  if (typeof idOrPath === 'number') return db.prepare('SELECT * FROM projects WHERE id = ?').get(idOrPath);
  return db.prepare('SELECT * FROM projects WHERE root_path = ?').get(idOrPath);
}

export function listProjects(db, { status = null, stale = null } = {}) {
  let sql = 'SELECT * FROM projects WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (stale !== null) { sql += ' AND stale = ?'; params.push(stale ? 1 : 0); }
  sql += ' ORDER BY name';
  return db.prepare(sql).all(...params);
}

export function markStaleProjects(db) {
  // Mark projects not seen in 7+ days as stale
  db.exec(`UPDATE projects SET stale = 1 WHERE last_seen_at < datetime('now', '-7 days')`);
  return db.prepare('SELECT COUNT(*) as n FROM projects WHERE stale = 1').get().n;
}

export function markProjectIndexed(db, projectId) {
  db.prepare(`UPDATE projects SET last_indexed_at = datetime('now'), stale = 0 WHERE id = ?`).run(projectId);
}

export function setQAReportCount(db, projectId, count) {
  db.prepare('UPDATE projects SET qa_fail_count = ? WHERE id = ?').run(count, projectId);
}

export function setReportCount(db, projectId, count) {
  db.prepare('UPDATE projects SET report_count = ? WHERE id = ?').run(count, projectId);
}

// ── Knowledge Items ──
export function upsertKnowledgeItem(db, item) {
  const { project_id, kind, subtype = null, title, path = null, source_root = null, content = '', summary = null, language = 'unknown', tags = '[]', metadata_json = '{}', size_bytes = 0, mtime_ms = 0, status = 'active' } = item;
  const normalized = normalizeText(title + ' ' + content);
  const hash = createHash('sha256').update((path || '') + content).digest('hex').slice(0, 16);
  const existing = db.prepare('SELECT id FROM knowledge_items WHERE path = ? AND hash = ?').get(path, hash);
  if (existing) {
    db.prepare(`
      UPDATE knowledge_items SET kind=?, subtype=?, title=?, content=?, summary=?, language=?, normalized_text=?,
        tags=?, metadata_json=?, size_bytes=?, mtime_ms=?, status=?, last_indexed_at=datetime('now')
      WHERE id=?
    `).run(kind, subtype, title, content, summary, language, normalized, tags, metadata_json, size_bytes, mtime_ms, status, existing.id);
    return existing.id;
  }
  const result = db.prepare(`
    INSERT INTO knowledge_items (project_id, kind, subtype, title, path, source_root, content, summary, language, normalized_text, hash, size_bytes, mtime_ms, status, tags, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(project_id, kind, subtype, title, path, source_root, content, summary, language, normalized, hash, size_bytes, mtime_ms, status, tags, metadata_json);
  return result.lastInsertRowid;
}

export function getKnowledgeItem(db, id) {
  return db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(id);
}

export function queryKnowledgeItems(db, { kind = null, project_id = null, subtype = null, limit = 100, offset = 0 } = {}) {
  let sql = 'SELECT * FROM knowledge_items WHERE status = ?';
  const params = ['active'];
  if (kind) { sql += ' AND kind = ?'; params.push(kind); }
  if (project_id) { sql += ' AND project_id = ?'; params.push(project_id); }
  if (subtype) { sql += ' AND subtype = ?'; params.push(subtype); }
  sql += ' ORDER BY last_indexed_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  return db.prepare(sql).all(...params);
}

export function deleteKnowledgeItemsByProject(db, projectId) {
  db.prepare('DELETE FROM knowledge_items WHERE project_id = ?').run(projectId);
}

// ── Relationships ──
export function upsertRelationship(db, sourceId, targetId, relType = 'related', weight = 1.0, metadata_json = '{}') {
  db.prepare(`
    INSERT INTO relationships (source_id, target_id, rel_type, weight, metadata_json)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(source_id, target_id, rel_type) DO UPDATE SET weight=excluded.weight, metadata_json=excluded.metadata_json
  `).run(sourceId, targetId, relType, weight, metadata_json);
}

export function getRelationships(db, itemId) {
  return db.prepare(`
    SELECT r.*, ki.title AS source_title, ki2.title AS target_title, ki.kind AS source_kind, ki2.kind AS target_kind
    FROM relationships r
    JOIN knowledge_items ki ON ki.id = r.source_id
    JOIN knowledge_items ki2 ON ki2.id = r.target_id
    WHERE r.source_id = ? OR r.target_id = ?
    ORDER BY r.weight DESC
  `).all(itemId, itemId);
}

// ── Source Map ──
export function upsertSourceMap(db, { project_id, rel_path, file_name, ext, size_bytes, mtime_ms, hash = null }) {
  db.prepare(`
    INSERT INTO source_map (project_id, rel_path, file_name, ext, size_bytes, mtime_ms, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id, rel_path) DO UPDATE SET size_bytes=excluded.size_bytes, mtime_ms=excluded.mtime_ms, hash=excluded.hash
  `).run(project_id, rel_path, file_name, ext, size_bytes, mtime_ms, hash);
}

export function clearSourceMap(db, projectId) {
  db.prepare('DELETE FROM source_map WHERE project_id = ?').run(projectId);
}

export function getSourceMap(db, projectId) {
  return db.prepare('SELECT * FROM source_map WHERE project_id = ? ORDER BY rel_path').all(projectId);
}

// ── Ingest Log ──
export function logIngest(db, { kind, action, path = null, detail = null, duration_ms = 0 }) {
  db.prepare('INSERT INTO ingest_log (kind, action, path, detail, duration_ms) VALUES (?, ?, ?, ?, ?)').run(kind, action, path, detail, duration_ms);
}

export function getRecentIngestLogs(db, limit = 50) {
  return db.prepare('SELECT * FROM ingest_log ORDER BY created_at DESC LIMIT ?').all(limit);
}

// ── Stats ──
export function getUKVStats(db) {
  return {
    projects: db.prepare('SELECT COUNT(*) as n FROM projects').get().n,
    active_projects: db.prepare('SELECT COUNT(*) as n FROM projects WHERE status = ?').get('active').n,
    stale_projects: db.prepare('SELECT COUNT(*) as n FROM projects WHERE stale = 1').get().n,
    total_items: db.prepare('SELECT COUNT(*) as n FROM knowledge_items').get().n,
    total_source_map: db.prepare('SELECT COUNT(*) as n FROM source_map').get().n,
    relationships: db.prepare('SELECT COUNT(*) as n FROM relationships').get().n,
    last_indexed: getMeta(db, 'last_indexed_at'),
    total_size_bytes: db.prepare('SELECT COALESCE(SUM(size_bytes), 0) as n FROM source_map').get().n,
    by_kind: db.prepare(`
      SELECT kind, COUNT(*) as n FROM knowledge_items WHERE status = 'active' GROUP BY kind ORDER BY n DESC
    `).all(),
  };
}

// ── Normalization (Vietnamese no-accent + lowercase) ──
// Uses Unicode NFD decomposition to strip diacritics, then handles đ/Đ.
export function normalizeText(input) {
  if (!input) return '';
  return String(input)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip combining diacritical marks
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export { KNOWLEDGE_KINDS };
