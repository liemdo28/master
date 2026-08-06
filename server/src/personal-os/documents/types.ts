/**
 * Phase 5D-1 — document foundation contracts.
 *
 * Everything here describes documents Mi has been *given permission* to read. There is
 * deliberately no type in this batch that expresses "ingest a directory" — the broad
 * entry points in knowledge/knowledge-db.ts (ingestDirectory, fullIngest,
 * clearAndRebuild) are left alone for their existing consumers and are never called
 * from this module.
 */

export type DocumentStatus =
  | 'DISCOVERED' | 'PENDING_APPROVAL' | 'INDEXING' | 'ACTIVE'
  | 'STALE' | 'FAILED' | 'SUPERSEDED' | 'DELETED';

export type DocumentSensitivity = 'PUBLIC' | 'INTERNAL' | 'PRIVATE' | 'SECRET_REJECTED';

export type IngestionPolicy =
  | 'MANUAL_ONLY' | 'PROJECT_DOCS' | 'APPROVED_FOLDER' | 'APPROVED_EXTERNAL_ITEM' | 'NO_INGEST';

export type DocumentSourceType =
  | 'MARKDOWN' | 'TEXT' | 'JSON' | 'YAML' | 'PDF' | 'HTML'
  | 'TASK_SUMMARY' | 'GOAL_OUTCOME' | 'PROJECT_MAP' | 'EXTERNAL_ITEM';

export type IngestionJobStatus =
  | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'RECOVERY_REQUIRED';

export interface DocumentRecord {
  id: string;
  title: string;
  sourceType: DocumentSourceType;
  /** Project-relative or opaque reference. Never an absolute path in API output. */
  sourceUri: string;
  /** Absolute on-disk path. Server-side only; redacted before it leaves the process. */
  canonicalPath: string;
  projectIds: string[];
  goalIds: string[];
  taskIds: string[];
  mimeType: string;
  language: string;
  checksum: string;
  sizeBytes: number;
  status: DocumentStatus;
  sensitivity: DocumentSensitivity;
  ingestionPolicy: IngestionPolicy;
  createdAt: string;
  updatedAt: string;
  indexedAt: string | null;
  sourceModifiedAt: string | null;
  version: number;
  supersedesId: string | null;
  metadata: Record<string, unknown>;
  evidenceReferences: string[];
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  ordinal: number;
  /** Heading ancestry, outermost first, e.g. ["Deployment", "Rollback"]. */
  headingPath: string[];
  text: string;
  normalizedText: string;
  tokenEstimate: number;
  contentHash: string;
  /** Character offsets into the parsed source, for citation. */
  sourceStart: number;
  sourceEnd: number;
  pageNumber: number | null;
  sectionTitle: string | null;
  tags: string[];
  projectIds: string[];
  sensitivity: DocumentSensitivity;
  createdAt: string;
  updatedAt: string;
}

export interface IngestionJob {
  id: string;
  documentId: string | null;
  /** Caller-supplied idempotency key. A repeat request returns the original job. */
  operationId: string;
  status: IngestionJobStatus;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  /** Human-readable and safe: never a parser stack trace or an absolute path. */
  safeError: string | null;
  parserVersion: string;
  sourceChecksum: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedSection {
  headingPath: string[];
  text: string;
  sourceStart: number;
  sourceEnd: number;
  pageNumber: number | null;
  sectionTitle: string | null;
}

export interface ParsedDocument {
  title: string;
  language: string;
  mimeType: string;
  sections: ParsedSection[];
  metadata: Record<string, unknown>;
  warnings: string[];
  parserVersion: string;
}

export class DocumentParseError extends Error {
  constructor(readonly code: string, safeMessage: string) {
    // Only the safe message travels; callers must not surface parser internals.
    super(safeMessage);
    this.name = 'DocumentParseError';
  }
}

/** Bounds applied before any file is read into memory or persisted. */
export const DOCUMENT_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxTextChars: 2_000_000,
  maxSections: 5_000,
  maxChunksPerDocument: 2_000,
  maxJsonDepth: 12,
  maxYamlDepth: 12,
  maxHtmlBytes: 2 * 1024 * 1024,
} as const;

/** Chunking defaults. Documented in docs/architecture/PHASE5D_FOUNDATION.md. */
export const CHUNK_DEFAULTS = {
  targetChars: 1_200,
  maxChars: 1_800,
  overlapChars: 150,
  minChars: 40,
} as const;

export const PARSER_VERSION = 'phase5d-1.0.0';
