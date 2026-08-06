/**
 * Phase 5D-1 persistence — schema v4 inside the existing Personal OS database.
 *
 * There is no second database. The v3 tables from Phases 5A/5B/5C are untouched; v4
 * only adds document, chunk and ingestion-job tables. Migration is additive and
 * idempotent, so re-running it on an already-migrated database is a no-op and a v3
 * production copy migrates without losing a row.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import type { DocumentChunk, DocumentRecord, DocumentStatus, IngestionJob } from './types';

export const PHASE5D_SCHEMA_VERSION = 4;

function dataDir(): string {
  return process.env.MI_PERSONAL_OS_DIR
    ? path.resolve(process.env.MI_PERSONAL_OS_DIR)
    : path.resolve(process.cwd(), '.local-agent-global', 'personal-os');
}

const now = (): string => new Date().toISOString();

function readJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export function assertDocumentId(id: string): void {
  if (!/^doc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('invalid document id');
  }
}

export function fileChecksum(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/**
 * Applies schema v4. Split out from the class so the migration test can run it against
 * a copy of the production database without constructing a full store.
 */
export function applyPhase5dMigration(db: Database.Database): { from: number; to: number; applied: boolean } {
  const before = currentSchemaVersion(db);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        appliedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        sourceType TEXT NOT NULL,
        sourceUri TEXT NOT NULL,
        canonicalPath TEXT NOT NULL,
        projectIds TEXT NOT NULL,
        goalIds TEXT NOT NULL,
        taskIds TEXT NOT NULL,
        mimeType TEXT NOT NULL,
        language TEXT NOT NULL,
        checksum TEXT NOT NULL,
        sizeBytes INTEGER NOT NULL,
        status TEXT NOT NULL,
        sensitivity TEXT NOT NULL,
        ingestionPolicy TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        indexedAt TEXT,
        sourceModifiedAt TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        supersedesId TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        evidenceReferences TEXT NOT NULL DEFAULT '[]'
      );
      CREATE INDEX IF NOT EXISTS idx_kdocs_status ON knowledge_documents(status);
      CREATE INDEX IF NOT EXISTS idx_kdocs_checksum ON knowledge_documents(checksum);
      CREATE INDEX IF NOT EXISTS idx_kdocs_path ON knowledge_documents(canonicalPath);
      CREATE INDEX IF NOT EXISTS idx_kdocs_modified ON knowledge_documents(sourceModifiedAt);
      CREATE INDEX IF NOT EXISTS idx_kdocs_supersedes ON knowledge_documents(supersedesId);
      -- One live document per path: older versions are SUPERSEDED and excluded here.
      CREATE UNIQUE INDEX IF NOT EXISTS idx_kdocs_active_path
        ON knowledge_documents(canonicalPath)
        WHERE status IN ('ACTIVE', 'INDEXING', 'STALE');

      CREATE TABLE IF NOT EXISTS knowledge_document_projects (
        documentId TEXT NOT NULL,
        projectId TEXT NOT NULL,
        PRIMARY KEY (documentId, projectId),
        FOREIGN KEY (documentId) REFERENCES knowledge_documents(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_kdocproj_project ON knowledge_document_projects(projectId);

      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        documentId TEXT NOT NULL,
        ordinal INTEGER NOT NULL,
        headingPath TEXT NOT NULL,
        text TEXT NOT NULL,
        normalizedText TEXT NOT NULL,
        tokenEstimate INTEGER NOT NULL,
        contentHash TEXT NOT NULL,
        sourceStart INTEGER NOT NULL,
        sourceEnd INTEGER NOT NULL,
        pageNumber INTEGER,
        sectionTitle TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        projectIds TEXT NOT NULL DEFAULT '[]',
        sensitivity TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (documentId) REFERENCES knowledge_documents(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_kchunk_doc ON knowledge_chunks(documentId, ordinal);
      CREATE INDEX IF NOT EXISTS idx_kchunk_hash ON knowledge_chunks(contentHash);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_kchunk_doc_hash ON knowledge_chunks(documentId, contentHash);

      CREATE TABLE IF NOT EXISTS knowledge_ingestion_jobs (
        id TEXT PRIMARY KEY,
        documentId TEXT,
        operationId TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        startedAt TEXT,
        completedAt TEXT,
        errorCode TEXT,
        safeError TEXT,
        parserVersion TEXT NOT NULL,
        sourceChecksum TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_kjob_status ON knowledge_ingestion_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_kjob_doc ON knowledge_ingestion_jobs(documentId);
    `);
    db.prepare(`INSERT OR IGNORE INTO schema_migrations (version, appliedAt) VALUES (?, ?)`)
      .run(PHASE5D_SCHEMA_VERSION, now());
  });
  migrate();

  return { from: before, to: currentSchemaVersion(db), applied: before < PHASE5D_SCHEMA_VERSION };
}

export function currentSchemaVersion(db: Database.Database): number {
  try {
    const row = db.prepare(`SELECT MAX(version) AS version FROM schema_migrations`).get() as { version: number | null };
    return row?.version ?? 0;
  } catch {
    return 0;
  }
}

export class DocumentStore {
  private db: Database.Database;

  constructor(readonly root = dataDir()) {
    fs.mkdirSync(root, { recursive: true });
    this.db = new Database(path.join(root, 'personal-os.db'));
    applyPhase5dMigration(this.db);
    this.recoverInterruptedJobs();
  }

  close(): void { this.db.close(); }
  get handle(): Database.Database { return this.db; }

  /**
   * A job left RUNNING means the process died mid-ingestion. Its document is not
   * trustworthy, so both are marked for recovery rather than silently left ACTIVE.
   */
  private recoverInterruptedJobs(): void {
    const stuck = this.db.prepare(
      `SELECT id, documentId FROM knowledge_ingestion_jobs WHERE status IN ('RUNNING','PENDING')`,
    ).all() as Array<{ id: string; documentId: string | null }>;
    if (!stuck.length) return;
    const recover = this.db.transaction(() => {
      for (const job of stuck) {
        this.db.prepare(
          `UPDATE knowledge_ingestion_jobs SET status='RECOVERY_REQUIRED', safeError=?, updatedAt=? WHERE id=?`,
        ).run('ingestion was interrupted before completion', now(), job.id);
        if (job.documentId) {
          this.db.prepare(
            `UPDATE knowledge_documents SET status='FAILED', updatedAt=? WHERE id=? AND status='INDEXING'`,
          ).run(now(), job.documentId);
          // A half-written chunk set is worse than none.
          this.db.prepare(`DELETE FROM knowledge_chunks WHERE documentId=?`).run(job.documentId);
        }
      }
    });
    recover();
  }

  static newDocumentId(): string { return `doc-${randomUUID()}`; }

  findJobByOperation(operationId: string): IngestionJob | null {
    const row = this.db.prepare(`SELECT * FROM knowledge_ingestion_jobs WHERE operationId = ?`).get(operationId) as any;
    return row ?? null;
  }

  createJob(operationId: string, parserVersion: string): IngestionJob {
    const job: IngestionJob = {
      id: `job-${randomUUID()}`, documentId: null, operationId, status: 'RUNNING',
      startedAt: now(), completedAt: null, errorCode: null, safeError: null,
      parserVersion, sourceChecksum: null, createdAt: now(), updatedAt: now(),
    };
    this.db.prepare(`
      INSERT INTO knowledge_ingestion_jobs
        (id, documentId, operationId, status, startedAt, completedAt, errorCode, safeError, parserVersion, sourceChecksum, createdAt, updatedAt)
      VALUES (@id,@documentId,@operationId,@status,@startedAt,@completedAt,@errorCode,@safeError,@parserVersion,@sourceChecksum,@createdAt,@updatedAt)
    `).run(job);
    return job;
  }

  updateJob(id: string, patch: Partial<IngestionJob>): void {
    const current = this.db.prepare(`SELECT * FROM knowledge_ingestion_jobs WHERE id = ?`).get(id) as any;
    if (!current) return;
    const merged = { ...current, ...patch, updatedAt: now() };
    this.db.prepare(`
      UPDATE knowledge_ingestion_jobs SET documentId=@documentId, status=@status, startedAt=@startedAt,
        completedAt=@completedAt, errorCode=@errorCode, safeError=@safeError, sourceChecksum=@sourceChecksum,
        updatedAt=@updatedAt WHERE id=@id
    `).run(merged);
  }

  listJobs(limit = 50): IngestionJob[] {
    return this.db.prepare(`SELECT * FROM knowledge_ingestion_jobs ORDER BY createdAt DESC LIMIT ?`)
      .all(Math.max(1, Math.min(200, limit))) as IngestionJob[];
  }

  /** Document and chunks land together, so a reader never sees a half-indexed document. */
  activateDocument(record: DocumentRecord, chunks: DocumentChunk[]): DocumentRecord {
    const write = this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO knowledge_documents (
          id,title,sourceType,sourceUri,canonicalPath,projectIds,goalIds,taskIds,mimeType,language,
          checksum,sizeBytes,status,sensitivity,ingestionPolicy,createdAt,updatedAt,indexedAt,
          sourceModifiedAt,version,supersedesId,metadata,evidenceReferences
        ) VALUES (
          @id,@title,@sourceType,@sourceUri,@canonicalPath,@projectIds,@goalIds,@taskIds,@mimeType,@language,
          @checksum,@sizeBytes,@status,@sensitivity,@ingestionPolicy,@createdAt,@updatedAt,@indexedAt,
          @sourceModifiedAt,@version,@supersedesId,@metadata,@evidenceReferences
        )
      `).run(serializeDocument(record));

      for (const projectId of record.projectIds) {
        this.db.prepare(`INSERT OR IGNORE INTO knowledge_document_projects (documentId, projectId) VALUES (?, ?)`)
          .run(record.id, projectId);
      }
      const insertChunk = this.db.prepare(`
        INSERT INTO knowledge_chunks (
          id,documentId,ordinal,headingPath,text,normalizedText,tokenEstimate,contentHash,
          sourceStart,sourceEnd,pageNumber,sectionTitle,tags,projectIds,sensitivity,createdAt,updatedAt
        ) VALUES (
          @id,@documentId,@ordinal,@headingPath,@text,@normalizedText,@tokenEstimate,@contentHash,
          @sourceStart,@sourceEnd,@pageNumber,@sectionTitle,@tags,@projectIds,@sensitivity,@createdAt,@updatedAt
        )
      `);
      for (const chunk of chunks) insertChunk.run(serializeChunk(chunk));
    });
    write();
    return record;
  }

  getDocument(id: string): DocumentRecord | null {
    assertDocumentId(id);
    const row = this.db.prepare(`SELECT * FROM knowledge_documents WHERE id = ?`).get(id) as any;
    return row ? parseDocument(row) : null;
  }

  findActiveByPath(canonicalPath: string): DocumentRecord | null {
    const row = this.db.prepare(
      `SELECT * FROM knowledge_documents WHERE canonicalPath = ? AND status IN ('ACTIVE','INDEXING','STALE') LIMIT 1`,
    ).get(canonicalPath) as any;
    return row ? parseDocument(row) : null;
  }

  listDocuments(status?: DocumentStatus, limit = 100): DocumentRecord[] {
    const rows = status
      ? this.db.prepare(`SELECT * FROM knowledge_documents WHERE status = ? ORDER BY updatedAt DESC LIMIT ?`)
          .all(status, Math.max(1, Math.min(500, limit))) as any[]
      : this.db.prepare(`SELECT * FROM knowledge_documents WHERE status != 'DELETED' ORDER BY updatedAt DESC LIMIT ?`)
          .all(Math.max(1, Math.min(500, limit))) as any[];
    return rows.map(parseDocument);
  }

  listChunks(documentId: string, limit = 500): DocumentChunk[] {
    assertDocumentId(documentId);
    const rows = this.db.prepare(
      `SELECT * FROM knowledge_chunks WHERE documentId = ? ORDER BY ordinal ASC LIMIT ?`,
    ).all(documentId, Math.max(1, Math.min(2000, limit))) as any[];
    return rows.map(parseChunk);
  }

  countChunks(documentId: string): number {
    return (this.db.prepare(`SELECT COUNT(*) c FROM knowledge_chunks WHERE documentId = ?`).get(documentId) as { c: number }).c;
  }

  setStatus(id: string, status: DocumentStatus): DocumentRecord | null {
    assertDocumentId(id);
    this.db.prepare(`UPDATE knowledge_documents SET status=?, updatedAt=? WHERE id=?`).run(status, now(), id);
    return this.getDocument(id);
  }

  /**
   * Deletion removes the document from retrieval and drops its chunks, but keeps the
   * record itself so the audit trail — and any citation already issued — still resolves.
   */
  deleteDocument(id: string): DocumentRecord | null {
    assertDocumentId(id);
    const remove = this.db.transaction(() => {
      this.db.prepare(`DELETE FROM knowledge_chunks WHERE documentId=?`).run(id);
      this.db.prepare(`DELETE FROM knowledge_document_projects WHERE documentId=?`).run(id);
      this.db.prepare(`UPDATE knowledge_documents SET status='DELETED', updatedAt=? WHERE id=?`).run(now(), id);
    });
    remove();
    return this.getDocument(id);
  }

  supersede(oldId: string, replacement: DocumentRecord, chunks: DocumentChunk[]): DocumentRecord {
    const run = this.db.transaction(() => {
      // Free the unique active-path index before the replacement claims it.
      this.db.prepare(`UPDATE knowledge_documents SET status='SUPERSEDED', updatedAt=? WHERE id=?`).run(now(), oldId);
      this.db.prepare(`DELETE FROM knowledge_chunks WHERE documentId=?`).run(oldId);
      this.activateDocument(replacement, chunks);
    });
    run();
    return replacement;
  }

  integrity(): { integrityCheck: string; foreignKeyViolations: unknown[]; schemaVersion: number } {
    const integrity = this.db.prepare(`PRAGMA integrity_check`).get() as Record<string, string>;
    return {
      integrityCheck: Object.values(integrity)[0],
      foreignKeyViolations: this.db.prepare(`PRAGMA foreign_key_check`).all(),
      schemaVersion: currentSchemaVersion(this.db),
    };
  }

  stats(): { documents: number; chunks: number; jobs: number } {
    const one = (sql: string) => (this.db.prepare(sql).get() as { c: number }).c;
    return {
      documents: one(`SELECT COUNT(*) c FROM knowledge_documents WHERE status != 'DELETED'`),
      chunks: one(`SELECT COUNT(*) c FROM knowledge_chunks`),
      jobs: one(`SELECT COUNT(*) c FROM knowledge_ingestion_jobs`),
    };
  }
}

function serializeDocument(record: DocumentRecord): Record<string, unknown> {
  return {
    ...record,
    projectIds: JSON.stringify(record.projectIds),
    goalIds: JSON.stringify(record.goalIds),
    taskIds: JSON.stringify(record.taskIds),
    metadata: JSON.stringify(record.metadata ?? {}),
    evidenceReferences: JSON.stringify(record.evidenceReferences ?? []),
  };
}

function parseDocument(row: any): DocumentRecord {
  return {
    ...row,
    projectIds: readJson<string[]>(row.projectIds, []),
    goalIds: readJson<string[]>(row.goalIds, []),
    taskIds: readJson<string[]>(row.taskIds, []),
    metadata: readJson<Record<string, unknown>>(row.metadata, {}),
    evidenceReferences: readJson<string[]>(row.evidenceReferences, []),
  } as DocumentRecord;
}

function serializeChunk(chunk: DocumentChunk): Record<string, unknown> {
  return {
    ...chunk,
    headingPath: JSON.stringify(chunk.headingPath),
    tags: JSON.stringify(chunk.tags),
    projectIds: JSON.stringify(chunk.projectIds),
  };
}

function parseChunk(row: any): DocumentChunk {
  return {
    ...row,
    headingPath: readJson<string[]>(row.headingPath, []),
    tags: readJson<string[]>(row.tags, []),
    projectIds: readJson<string[]>(row.projectIds, []),
  } as DocumentChunk;
}
