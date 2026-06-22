// kb/KnowledgeBase.js — high-level facade for the Knowledge Base system
import { openKB, getStats, listDomains, listTopics, listDocuments } from './KBDatabase.js';
import { ingestDocument, ingestBatch, rebuildIDF } from './pipeline/Ingester.js';
import { search, listDocs } from './KBQuery.js';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

const DEFAULT_DB_DIR  = '.local-agent/kb';
const DEFAULT_DB_NAME = 'knowledge.db';

export class KnowledgeBase {
  constructor(workspaceRoot, { dbDir = DEFAULT_DB_DIR } = {}) {
    this.root  = workspaceRoot;
    this.dbDir = join(workspaceRoot, dbDir);
    this.dbPath = join(this.dbDir, DEFAULT_DB_NAME);
    this._db   = null;
  }

  get db() {
    if (!this._db) {
      if (!existsSync(this.dbDir)) mkdirSync(this.dbDir, { recursive: true });
      this._db = openKB(this.dbPath);
    }
    return this._db;
  }

  close() {
    if (this._db) { this._db.close(); this._db = null; }
  }

  // ── Ingestion ──────────────────────────────────────────────────────────────

  ingest(doc) {
    return ingestDocument(this.db, this.dbDir, doc);
  }

  ingestMany(docs) {
    return ingestBatch(this.db, this.dbDir, docs);
  }

  rebuildIndex() {
    return rebuildIDF(this.db, this.dbDir);
  }

  // ── Query ──────────────────────────────────────────────────────────────────

  query(query, opts = {}) {
    return search(this.db, this.dbDir, query, opts);
  }

  // ── Browse ────────────────────────────────────────────────────────────────

  domains()               { return listDomains(this.db); }
  topics(domain)          { return listTopics(this.db, domain); }
  documents(topicId)      { return listDocuments(this.db, topicId); }
  list(opts = {})         { return listDocs(this.db, opts); }
  stats()                 { return getStats(this.db); }
}

/**
 * Open (or create) the global knowledge base for a workspace.
 */
export function openKnowledgeBase(workspaceRoot, opts = {}) {
  return new KnowledgeBase(workspaceRoot, opts);
}
