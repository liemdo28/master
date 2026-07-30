// kb/KBDatabase.js — SQLite schema + CRUD for the offline knowledge base
// Uses Node 24 built-in node:sqlite (replaces better-sqlite3 which fails on ABI 137)
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous  = NORMAL;

CREATE TABLE IF NOT EXISTS domains (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,   -- e.g. "coding"
  name        TEXT    NOT NULL,
  description TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS topics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_id   INTEGER NOT NULL REFERENCES domains(id),
  slug        TEXT    NOT NULL,          -- e.g. "javascript"
  name        TEXT    NOT NULL,
  description TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(domain_id, slug)
);

CREATE TABLE IF NOT EXISTS documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id    INTEGER NOT NULL REFERENCES topics(id),
  slug        TEXT    NOT NULL,          -- e.g. "async-await"
  title       TEXT    NOT NULL,
  content     TEXT    NOT NULL,          -- markdown
  source_url  TEXT,
  license     TEXT    NOT NULL DEFAULT 'unknown',
  attribution TEXT,
  word_count  INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  ingested_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(topic_id, slug)
);

CREATE TABLE IF NOT EXISTS chunks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id      INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content     TEXT    NOT NULL,
  word_count  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(doc_id, chunk_index)
);

-- FTS5 full-text search index over chunks
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content,
  content='chunks',
  content_rowid='id',
  tokenize='porter unicode61'
);

CREATE TABLE IF NOT EXISTS tfidf_terms (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chunk_id    INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
  term        TEXT    NOT NULL,
  tf_idf      REAL    NOT NULL DEFAULT 0,
  UNIQUE(chunk_id, term)
);

CREATE TABLE IF NOT EXISTS sources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  domain_slug TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  url         TEXT,
  license     TEXT    NOT NULL,
  robots_ok   INTEGER NOT NULL DEFAULT 0,  -- 1=allowed, 0=dump/manual
  recommend   TEXT    NOT NULL DEFAULT 'include',  -- include|reference|exclude
  notes       TEXT,
  UNIQUE(domain_slug, name)
);

CREATE TABLE IF NOT EXISTS ingest_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id      INTEGER REFERENCES documents(id),
  action      TEXT    NOT NULL,   -- ingest|update|delete|error
  detail      TEXT,
  at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES ('delete', old.id, old.content);
END;

CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES ('delete', old.id, old.content);
  INSERT INTO chunks_fts(rowid, content) VALUES (new.id, new.content);
END;
`;

export function openKB(dbPath) {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  // node:sqlite DatabaseSync — built into Node 24, no native bindings needed
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);
  return db;
}

// ── Domain ────────────────────────────────────────────────────────────────────

export function upsertDomain(db, { slug, name, description = '' }) {
  db.prepare(`
    INSERT INTO domains (slug, name, description)
    VALUES (?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET name=excluded.name, description=excluded.description
  `).run(slug, name, description);
  return db.prepare('SELECT * FROM domains WHERE slug = ?').get(slug);
}

export function getDomain(db, slug) {
  return db.prepare('SELECT * FROM domains WHERE slug = ?').get(slug);
}

export function listDomains(db) {
  return db.prepare('SELECT * FROM domains ORDER BY slug').all();
}

// ── Topic ─────────────────────────────────────────────────────────────────────

export function upsertTopic(db, domainSlug, { slug, name, description = '' }) {
  const domain = getDomain(db, domainSlug);
  if (!domain) throw new Error(`Domain not found: ${domainSlug}`);
  db.prepare(`
    INSERT INTO topics (domain_id, slug, name, description)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(domain_id, slug) DO UPDATE SET name=excluded.name, description=excluded.description
  `).run(domain.id, slug, name, description);
  return db.prepare('SELECT * FROM topics WHERE domain_id = ? AND slug = ?').get(domain.id, slug);
}

export function getTopic(db, domainSlug, topicSlug) {
  const domain = getDomain(db, domainSlug);
  if (!domain) return null;
  return db.prepare('SELECT * FROM topics WHERE domain_id = ? AND slug = ?').get(domain.id, topicSlug);
}

export function listTopics(db, domainSlug) {
  const domain = getDomain(db, domainSlug);
  if (!domain) return [];
  return db.prepare('SELECT * FROM topics WHERE domain_id = ? ORDER BY slug').all(domain.id);
}

// ── Document ──────────────────────────────────────────────────────────────────

export function upsertDocument(db, topicId, { slug, title, content, source_url = null, license = 'unknown', attribution = null }) {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const existing = db.prepare('SELECT id FROM documents WHERE topic_id = ? AND slug = ?').get(topicId, slug);
  if (existing) {
    db.prepare(`
      UPDATE documents SET title=?, content=?, source_url=?, license=?, attribution=?,
        word_count=?, updated_at=datetime('now') WHERE id=?
    `).run(title, content, source_url, license, attribution, wordCount, existing.id);
    return existing.id;
  }
  const result = db.prepare(`
    INSERT INTO documents (topic_id, slug, title, content, source_url, license, attribution, word_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(topicId, slug, title, content, source_url, license, attribution, wordCount);
  return result.lastInsertRowid;
}

export function getDocument(db, docId) {
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
}

export function listDocuments(db, topicId) {
  return db.prepare('SELECT id, slug, title, word_count, chunk_count, ingested_at FROM documents WHERE topic_id = ? ORDER BY slug').all(topicId);
}

export function updateChunkCount(db, docId, count) {
  db.prepare('UPDATE documents SET chunk_count = ? WHERE id = ?').run(count, docId);
}

// ── Chunks ────────────────────────────────────────────────────────────────────

export function insertChunks(db, docId, chunks) {
  db.prepare('DELETE FROM chunks WHERE doc_id = ?').run(docId);
  const stmt = db.prepare('INSERT INTO chunks (doc_id, chunk_index, content, word_count) VALUES (?, ?, ?, ?)');
  // node:sqlite has no .transaction() helper — use explicit BEGIN/COMMIT
  db.exec('BEGIN');
  try {
    for (const [i, text] of chunks.entries()) {
      const wc = text.split(/\s+/).filter(Boolean).length;
      stmt.run(docId, i, text, wc);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  updateChunkCount(db, docId, chunks.length);
}

export function getChunks(db, docId) {
  return db.prepare('SELECT * FROM chunks WHERE doc_id = ? ORDER BY chunk_index').all(docId);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export function getStats(db) {
  return {
    domains:   db.prepare('SELECT COUNT(*) as n FROM domains').get().n,
    topics:    db.prepare('SELECT COUNT(*) as n FROM topics').get().n,
    documents: db.prepare('SELECT COUNT(*) as n FROM documents').get().n,
    chunks:    db.prepare('SELECT COUNT(*) as n FROM chunks').get().n,
    words:     db.prepare('SELECT SUM(word_count) as n FROM documents').get().n ?? 0,
  };
}
