/**
 * The single gated ingestion entry point for Phase 5D.
 *
 * The broad functions in knowledge/knowledge-db.ts (ingestDirectory, fullIngest,
 * clearAndRebuild) are never called from here. They accept a directory and index up to
 * 2,000 files with no approval, no secret scan, no project scoping and no chunk
 * provenance — none of which can satisfy the citation or privacy contracts. They are
 * left untouched for their existing consumers.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProjectRegistryService } from '../../project-registry/service';
import { buildChunks } from './chunking';
import { classifySourceType, mimeFor, parseDocument, readTextFile } from './parsers';
import { scanForSecrets } from './secret-scanner';
import {
  PathPolicyError, loadApprovedRoots, redactPaths, resolveApprovedDirectory,
  resolveApprovedFile, isExcludedPath, type ApprovedRoots,
} from './path-policy';
import { DocumentStore, fileChecksum } from './store';
import {
  DOCUMENT_LIMITS, DocumentParseError, PARSER_VERSION,
  type DocumentRecord, type DocumentSensitivity,
} from './types';

const INGESTIBLE_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.rst', '.adoc', '.json', '.yaml', '.yml', '.pdf', '.html', '.htm']);

export interface IngestRequest {
  filePath: string;
  operationId?: string;
  projectIds?: string[];
  goalIds?: string[];
  taskIds?: string[];
  tags?: string[];
}

/** Everything a caller is allowed to learn. Deliberately carries no absolute path. */
export interface IngestOutcome {
  status: 'ACTIVE' | 'REJECTED' | 'FAILED' | 'UNCHANGED' | 'SUPERSEDED';
  documentId: string | null;
  operationId: string;
  sourceUri: string;
  title?: string;
  chunkCount?: number;
  version?: number;
  sensitivity?: DocumentSensitivity;
  reason?: string;
  errorCode?: string;
  warnings?: string[];
}

export interface DiscoveredDocument {
  sourceUri: string;
  sourceType: string;
  sizeBytes: number;
  sourceModifiedAt: string;
  alreadyIngested: boolean;
}

export class KnowledgeDocumentService {
  readonly store: DocumentStore;
  private readonly registry: ProjectRegistryService | null;
  private readonly rootOverride?: Partial<ApprovedRoots>;

  constructor(options: { store?: DocumentStore; registry?: ProjectRegistryService | null; roots?: Partial<ApprovedRoots> } = {}) {
    this.store = options.store ?? new DocumentStore();
    this.registry = options.registry === undefined ? safeRegistry() : options.registry;
    this.rootOverride = options.roots;
  }

  close(): void {
    this.store.close();
    this.registry?.close();
  }

  /** Approved roots = registered projects + configured document roots + approved files. */
  approvedRoots(): ApprovedRoots {
    const projectRoots: Record<string, string> = {};
    try {
      for (const project of this.registry?.listProjects() ?? []) {
        const root = (project as { gitRoot?: string; canonicalRoot?: string }).gitRoot
          ?? (project as { canonicalRoot?: string }).canonicalRoot;
        if (root) projectRoots[project.id] = root;
      }
    } catch { /* registry unavailable — configured roots still apply */ }
    return loadApprovedRoots({ projectRoots, ...this.rootOverride });
  }

  /**
   * Lists ingestible files under one approved directory. Discovery never reads file
   * contents and never ingests; it only reports what *could* be approved.
   */
  discover(directory: string, maxResults = 200): { sourceUri: string; documents: DiscoveredDocument[]; skipped: number } {
    const roots = this.approvedRoots();
    const resolved = resolveApprovedDirectory(directory, roots);
    const documents: DiscoveredDocument[] = [];
    let skipped = 0;

    const walk = (dir: string, depth: number) => {
      if (depth > 6 || documents.length >= maxResults) return;
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        if (documents.length >= maxResults) return;
        const full = path.join(dir, entry.name);
        if (isExcludedPath(full, resolved.canonicalPath)) { skipped++; continue; }
        if (entry.isDirectory()) { walk(full, depth + 1); continue; }
        if (!entry.isFile()) continue;
        if (!INGESTIBLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) { skipped++; continue; }
        let stat: fs.Stats;
        try { stat = fs.statSync(full); } catch { skipped++; continue; }
        if (stat.size > DOCUMENT_LIMITS.maxFileBytes) { skipped++; continue; }
        documents.push({
          sourceUri: toPosix(path.relative(resolved.canonicalPath, full)),
          sourceType: path.extname(entry.name).slice(1).toUpperCase(),
          sizeBytes: stat.size,
          sourceModifiedAt: stat.mtime.toISOString(),
          alreadyIngested: Boolean(this.store.findActiveByPath(full)),
        });
      }
    };
    walk(resolved.canonicalPath, 0);
    return { sourceUri: resolved.sourceUri, documents, skipped };
  }

  async ingestApprovedDocument(request: IngestRequest): Promise<IngestOutcome> {
    const operationId = (request.operationId || `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`).slice(0, 120);

    // Idempotency: a repeated operationId returns the original outcome rather than
    // ingesting twice.
    const existingJob = this.store.findJobByOperation(operationId);
    if (existingJob && existingJob.status === 'COMPLETED' && existingJob.documentId) {
      const document = this.store.getDocument(existingJob.documentId);
      return {
        status: 'UNCHANGED', documentId: existingJob.documentId, operationId,
        sourceUri: document?.sourceUri ?? '', title: document?.title,
        chunkCount: document ? this.store.countChunks(document.id) : 0,
        reason: 'operation already completed',
      };
    }
    if (existingJob && existingJob.status === 'FAILED') {
      return {
        status: 'FAILED', documentId: null, operationId, sourceUri: '',
        errorCode: existingJob.errorCode ?? 'FAILED', reason: existingJob.safeError ?? 'ingestion previously failed',
      };
    }

    let resolved;
    try {
      resolved = resolveApprovedFile(request.filePath, this.approvedRoots());
    } catch (err) {
      const code = err instanceof PathPolicyError ? err.code : 'PATH_REJECTED';
      return { status: 'REJECTED', documentId: null, operationId, sourceUri: '', errorCode: code, reason: safeMessage(err) };
    }

    const job = this.store.createJob(operationId, PARSER_VERSION);

    try {
      const stat = fs.statSync(resolved.canonicalPath);
      if (stat.size > DOCUMENT_LIMITS.maxFileBytes) {
        throw new DocumentParseError('FILE_TOO_LARGE', 'document exceeds the maximum ingestible size');
      }
      const sourceType = classifySourceType(resolved.canonicalPath);
      const checksum = fileChecksum(resolved.canonicalPath);
      this.store.updateJob(job.id, { sourceChecksum: checksum });

      // Unchanged content is a no-op: same checksum means the same chunks and the same
      // citations, so there is nothing to re-index.
      const previous = this.store.findActiveByPath(resolved.canonicalPath);
      if (previous && previous.checksum === checksum && previous.status === 'ACTIVE') {
        this.store.updateJob(job.id, { documentId: previous.id, status: 'COMPLETED', completedAt: nowIso() });
        return {
          status: 'UNCHANGED', documentId: previous.id, operationId, sourceUri: previous.sourceUri,
          title: previous.title, chunkCount: this.store.countChunks(previous.id), version: previous.version,
          reason: 'source is unchanged since the last ingestion',
        };
      }

      // Secret scan runs on raw bytes, before parsing, so nothing credential-bearing is
      // ever transformed, chunked or persisted.
      if (sourceType !== 'PDF') {
        const scan = scanForSecrets(readTextFile(resolved.canonicalPath));
        if (scan.classification === 'SECRET_REJECTED') {
          this.store.updateJob(job.id, {
            status: 'FAILED', completedAt: nowIso(), errorCode: 'SECRET_REJECTED', safeError: scan.safeReason,
          });
          return {
            status: 'REJECTED', documentId: null, operationId, sourceUri: resolved.sourceUri,
            sensitivity: 'SECRET_REJECTED', errorCode: 'SECRET_REJECTED', reason: scan.safeReason,
          };
        }
      }

      const parsed = await parseDocument(resolved.canonicalPath, sourceType);
      const projectIds = unique([
        ...(resolved.projectId ? [resolved.projectId] : []),
        ...(request.projectIds ?? []),
      ]);
      const documentId = DocumentStore.newDocumentId();
      const sensitivity: DocumentSensitivity = resolved.rootKind === 'PROJECT' ? 'INTERNAL' : 'PRIVATE';

      const { chunks, rejectedSections, duplicatesSkipped } = buildChunks({
        documentId, sections: parsed.sections, projectIds, sensitivity,
        tags: request.tags ?? [], now: nowIso(),
      });

      if (!chunks.length) {
        this.store.updateJob(job.id, {
          status: 'FAILED', completedAt: nowIso(), errorCode: 'NO_CONTENT',
          safeError: 'document produced no ingestible content',
        });
        return {
          status: 'FAILED', documentId: null, operationId, sourceUri: resolved.sourceUri,
          errorCode: 'NO_CONTENT', reason: 'document produced no ingestible content',
        };
      }

      const record: DocumentRecord = {
        id: documentId,
        title: parsed.title.slice(0, 300),
        sourceType,
        sourceUri: resolved.sourceUri,
        canonicalPath: resolved.canonicalPath,
        projectIds,
        goalIds: request.goalIds ?? [],
        taskIds: request.taskIds ?? [],
        mimeType: mimeFor(sourceType),
        language: parsed.language,
        checksum,
        sizeBytes: stat.size,
        status: 'ACTIVE',
        sensitivity,
        ingestionPolicy: resolved.ingestionPolicy,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        indexedAt: nowIso(),
        sourceModifiedAt: stat.mtime.toISOString(),
        version: previous ? previous.version + 1 : 1,
        supersedesId: previous ? previous.id : null,
        metadata: { ...parsed.metadata, rejectedSections, duplicatesSkipped },
        evidenceReferences: [`document:${checksum.slice(0, 16)}`],
      };

      if (previous) this.store.supersede(previous.id, record, chunks);
      else this.store.activateDocument(record, chunks);

      this.store.updateJob(job.id, { documentId, status: 'COMPLETED', completedAt: nowIso() });

      return {
        status: previous ? 'SUPERSEDED' : 'ACTIVE',
        documentId, operationId, sourceUri: record.sourceUri, title: record.title,
        chunkCount: chunks.length, version: record.version, sensitivity,
        warnings: parsed.warnings,
      };
    } catch (err) {
      const errorCode = err instanceof DocumentParseError ? err.code : 'INGESTION_FAILED';
      const reason = safeMessage(err);
      this.store.updateJob(job.id, { status: 'FAILED', completedAt: nowIso(), errorCode, safeError: reason });
      return { status: 'FAILED', documentId: null, operationId, sourceUri: resolved.sourceUri, errorCode, reason };
    }
  }

  /** Re-reads the source and creates a new version if the content changed. */
  async reindex(documentId: string): Promise<IngestOutcome> {
    const document = this.store.getDocument(documentId);
    if (!document) return { status: 'FAILED', documentId: null, operationId: '', sourceUri: '', errorCode: 'NOT_FOUND', reason: 'document not found' };
    return this.ingestApprovedDocument({
      filePath: document.canonicalPath,
      operationId: `reindex-${documentId}-${Date.now()}`,
      projectIds: document.projectIds,
      goalIds: document.goalIds,
      taskIds: document.taskIds,
    });
  }

  /**
   * Compares each ACTIVE document against its source. A changed or vanished source
   * makes the document STALE; stale content is excluded from default retrieval when
   * Phase 5D-2 adds it.
   */
  refreshStaleness(): Array<{ documentId: string; sourceUri: string; status: string; reason: string }> {
    const out: Array<{ documentId: string; sourceUri: string; status: string; reason: string }> = [];
    for (const document of this.store.listDocuments('ACTIVE', 500)) {
      let reason = '';
      if (!fs.existsSync(document.canonicalPath)) {
        reason = 'source file is missing';
      } else {
        const stat = fs.statSync(document.canonicalPath);
        if (stat.size !== document.sizeBytes) reason = 'source size changed';
        else if (fileChecksum(document.canonicalPath) !== document.checksum) reason = 'source content changed';
        else if (document.metadata && (document.metadata as { parserVersion?: string }).parserVersion
          && (document.metadata as { parserVersion?: string }).parserVersion !== PARSER_VERSION) reason = 'parser version changed';
      }
      if (!reason) continue;
      this.store.setStatus(document.id, 'STALE');
      out.push({ documentId: document.id, sourceUri: document.sourceUri, status: 'STALE', reason });
    }
    return out;
  }

  listStale(): DocumentRecord[] {
    return this.store.listDocuments('STALE', 200);
  }
}

/** Strips absolute paths and parser internals before a message leaves the process. */
export function safeMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return redactPaths(raw).split('\n')[0].slice(0, 200);
}

/** API-facing shape: canonicalPath never crosses the boundary. */
export function toPublicDocument(record: DocumentRecord): Omit<DocumentRecord, 'canonicalPath'> {
  const { canonicalPath, ...rest } = record;
  void canonicalPath;
  return rest;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map(v => String(v).trim()).filter(Boolean))].slice(0, 10);
}

function toPosix(input: string): string {
  return input.split(path.sep).join('/');
}

function nowIso(): string { return new Date().toISOString(); }

function safeRegistry(): ProjectRegistryService | null {
  try { return new ProjectRegistryService(); } catch { return null; }
}
