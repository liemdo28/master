/**
 * Phase 4.5 retrieval contracts.
 *
 * Retrieval is layered evidence, not one flat keyword score. Each layer
 * contributes evidence with a weight and an explanation, and a candidate's rank
 * is the sum of what can be justified about it. The point is that a filename
 * containing a word from the request is the *weakest* kind of evidence, and must
 * never outrank an exact route or symbol match.
 */

/** What a file structurally is, inferred from its content rather than its name. */
export type StructuralRole =
  | 'ROUTE'
  | 'HANDLER'
  | 'CONTROLLER'
  | 'SERVICE'
  | 'MODEL'
  | 'TYPE'
  | 'TEST'
  | 'CONFIG'
  | 'ENTRYPOINT'
  | 'CLI'
  | 'UNKNOWN';

export type EvidenceKind =
  // Layer 1 — exact structural signals
  | 'EXPLICIT_PATH'
  | 'EXACT_ROUTE'
  | 'EXACT_SYMBOL'
  | 'EXACT_RESPONSE_KEY'
  | 'EXACT_STRING'
  // Layer 2 — framework-aware structure
  | 'ROUTE_DEFINITION'
  | 'ROUTE_HANDLER'
  | 'ARTIFACT_ROLE'
  | 'CLI_DEFINITION'
  // Layer 3 — import and dependency graph
  | 'DIRECT_IMPORT'
  | 'ONE_HOP_IMPORT'
  | 'IMPORTED_BY_SELECTED'
  | 'RELATED_TEST'
  // Layer 4 — symbol graph
  | 'SYMBOL_DEFINITION'
  | 'TYPE_REFERENCE'
  // Layer 5 — lexical
  | 'FILENAME_TOKEN'
  | 'DIRECTORY_TOKEN'
  | 'CONTENT_TOKEN'
  // Layer 6 — optional
  | 'SEMANTIC_SIMILARITY'
  // negative
  | 'NEGATIVE_GENERATED'
  | 'NEGATIVE_UNRELATED_ROLE'
  | 'NEGATIVE_ORPHAN_TEST'
  | 'NEGATIVE_DIRECTORY_ONLY';

export interface RetrievalEvidence {
  kind: EvidenceKind;
  value: string;
  weight: number;
  sourcePath?: string;
  explanation: string;
}

export interface RetrievalCandidate {
  path: string;
  score: number;
  rank: number;
  evidence: RetrievalEvidence[];
  matchedRoutes: string[];
  matchedSymbols: string[];
  structuralRole: StructuralRole;
  relatedTests: string[];
  /** 0 = directly matched, 1 = one import hop away, null = unrelated. */
  dependencyDistance: number | null;
  lexicalMatches: string[];
  semanticScore: number | null;
  exclusionReasons: string[];
  selected: boolean;
}

export type IntentAction = 'ADD' | 'FIX' | 'CHANGE' | 'REMOVE' | 'REFACTOR' | 'TEST' | 'UNKNOWN';

export type ArtifactType =
  | 'HTTP_RESPONSE'
  | 'HTTP_ROUTE'
  | 'SERVICE'
  | 'TYPE'
  | 'CLI'
  | 'TEST'
  | 'CONFIG'
  | 'MODEL'
  | 'UNKNOWN';

export interface CodingIntent {
  action: IntentAction;
  artifactType: ArtifactType;
  /** Nouns the request is about, normalised across casing conventions. */
  targetNames: string[];
  /** Route-shaped strings found in the request, e.g. /tasks/:id/plan. */
  routePaths: string[];
  /** Identifier-shaped tokens, e.g. TaskRecord, handleAssign. */
  symbols: string[];
  behavior: string;
  expectedOutput: string | null;
  frameworkHints: string[];
  testHints: string[];
  /** Roles the request implies should be de-prioritised. */
  negativeConstraints: string[];
  /** Deterministic parse confidence, 0-1. */
  confidence: number;
}

export interface RetrievalResult {
  intent: CodingIntent;
  candidates: RetrievalCandidate[];
  selected: RetrievalCandidate[];
  excluded: RetrievalCandidate[];
  stats: {
    filesConsidered: number;
    routesDiscovered: number;
    symbolsDiscovered: number;
    graphBuildMs: number;
    rankMs: number;
    cacheHit: boolean;
  };
}

export interface RetrievalLimits {
  /** Maximum candidates handed to the engine before expansion. */
  topK: number;
  /** Files that may be parsed when building the graph. */
  maxFilesIndexed: number;
  maxFileBytes: number;
  /** Minimum score for a candidate to be selected at all. */
  minScore: number;
}

export const DEFAULT_RETRIEVAL_LIMITS: RetrievalLimits = {
  topK: 6,
  maxFilesIndexed: 4000,
  maxFileBytes: 256 * 1024,
  minScore: 1,
};

/** Schema version; part of the cache key so a policy change invalidates it. */
export const RETRIEVAL_SCHEMA_VERSION = '4.5.0';
