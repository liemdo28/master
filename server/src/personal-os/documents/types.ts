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
  /** 1-based line numbers in the original source file. Null for structured (JSON/YAML)
   *  and PDF sources, where heading-path / page number is the citation locator instead. */
  lineStart: number | null;
  lineEnd: number | null;
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
  lineStart: number | null;
  lineEnd: number | null;
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

/* ────────────────────────────────────────────────────────────────────────────────────
 * Phase 5D-2 — index, retrieval, citations, conflicts, staleness.
 *
 * These contracts describe what a caller may ask for (KnowledgeQuery) and what Mi may
 * hand back (KnowledgePack). Every fact in a pack traces to a Citation with an exact
 * source-range pointer; nothing here expresses "search everything" — a query without an
 * explicit, bounded project scope is invalid before it reaches the retrieval layer.
 * ──────────────────────────────────────────────────────────────────────────────────── */

/** Bounds enforced on every KnowledgeQuery before retrieval runs. */
export const KNOWLEDGE_QUERY_LIMITS = {
  minTextChars: 2,
  maxTextChars: 500,
  minProjectIds: 1,
  maxProjectIds: 5,
  maxGoalIds: 10,
  maxTaskIds: 10,
  minLimit: 1,
  maxLimit: 20,
  defaultLimit: 8,
} as const;

/**
 * A caller-supplied retrieval request. `projectIds` is required and bounded — there is
 * deliberately no "search all private knowledge" mode and no way to expand a result set
 * beyond the projects named here.
 */
export interface KnowledgeQuery {
  text: string;
  projectIds: string[];
  goalIds: string[];
  taskIds: string[];
  limit: number;
  /** STALE documents are excluded from retrieval unless the caller opts in. */
  includeStale: boolean;
}

/** A pointer to the exact place a fact came from. Never carries canonicalPath. */
export interface Citation {
  documentId: string;
  chunkId: string;
  title: string;
  /** Project-relative or opaque reference — the same value the document API exposes. */
  sourceUri: string;
  headingPath: string[];
  sectionTitle: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  pageNumber: number | null;
  documentChecksum: string;
  chunkContentHash: string;
  projectIds: string[];
  documentStatus: DocumentStatus;
}

/**
 * How a KnowledgePack item relates to its citations. FACT and SYNTHESIS must carry at
 * least one Citation; SUGGESTION must carry none (a suggestion is Mi's own inference,
 * never dressed up as sourced); UNKNOWN means retrieval found nothing and says so rather
 * than inventing an answer.
 */
export type FactType = 'FACT' | 'SYNTHESIS' | 'SUGGESTION' | 'UNKNOWN';

export interface KnowledgePackItem {
  factType: FactType;
  statement: string;
  citations: Citation[];
  score: number;
  isStale: boolean;
}

export interface KnowledgePack {
  queryId: string;
  query: { text: string; projectIds: string[]; includeStale: boolean };
  generatedAt: string;
  items: KnowledgePackItem[];
  /** Unresolved conflicts touching any returned chunk — surfaced, never silently picked. */
  conflicts: ConflictRecord[];
  warnings: string[];
  /** True when nothing matched: an explicit "I don't know", not an empty list to guess from. */
  unknown: boolean;
}

export type ConflictStatus = 'OPEN' | 'NEEDS_CONFIRMATION' | 'RESOLVED' | 'DISMISSED';

/**
 * Two or more ACTIVE chunks whose content disagrees. Detection only ever raises a
 * conflict for a human to look at — it never silently prefers one chunk over another.
 */
export interface ConflictRecord {
  id: string;
  chunkIds: string[];
  documentIds: string[];
  projectIds: string[];
  description: string;
  detectionReason: string;
  status: ConflictStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

export type KnowledgeRelationType =
  | 'SUPERSEDES' | 'SUPERSEDED_BY'
  | 'REFERENCES' | 'REFERENCED_BY'
  | 'DUPLICATES'
  | 'RELATED_TO'
  | 'CONTRADICTS' | 'CONTRADICTED_BY'
  | 'PART_OF' | 'CONTAINS';

/** A lightweight, deterministic edge between two chunks. Not a graph database. */
export interface KnowledgeRelation {
  id: string;
  fromChunkId: string;
  toChunkId: string;
  relationType: KnowledgeRelationType;
  confidence: number;
  createdAt: string;
}
