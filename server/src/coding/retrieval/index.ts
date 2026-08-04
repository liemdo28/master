/**
 * Retrieval entry point and graph cache.
 *
 * The graph is keyed by project, source SHA and schema version so it is rebuilt
 * when the tree or the ranking policy changes and reused otherwise. A failed
 * refresh keeps the last-known-good index rather than leaving retrieval with
 * nothing, which matches how the project registry treats a failed remap.
 */

import { buildRepoGraph, type RepoGraph } from './graph';
import { parseCodingIntent } from './intent';
import { rankCandidates } from './ranker';
import {
  DEFAULT_RETRIEVAL_LIMITS,
  RETRIEVAL_SCHEMA_VERSION,
  type RetrievalLimits,
  type RetrievalResult,
} from './types';

export * from './types';
export { parseCodingIntent, normalizeName, tokenizeRequest } from './intent';
export { buildRepoGraph, composeRoutePath, inferRole, isGeneratedPath, isTestPath } from './graph';
export { rankCandidates, EVIDENCE_WEIGHTS } from './ranker';

interface CacheEntry {
  key: string;
  graph: RepoGraph;
  builtAt: number;
  /** Kept so a failed rebuild can fall back to it. */
  fileCount: number;
}

const graphCache = new Map<string, CacheEntry>();

export function retrievalCacheKey(input: { projectId: string; sourceSha: string | null; worktreePath: string }): string {
  return [RETRIEVAL_SCHEMA_VERSION, input.projectId, input.sourceSha ?? 'nosha', input.worktreePath].join('::');
}

export function clearRetrievalCache(): void {
  graphCache.clear();
}

export function retrievalCacheStats(): { entries: number; totalFiles: number } {
  let totalFiles = 0;
  for (const entry of graphCache.values()) totalFiles += entry.fileCount;
  return { entries: graphCache.size, totalFiles };
}

export interface RetrieveInput {
  projectId: string;
  sourceSha: string | null;
  worktreePath: string;
  userRequest: string;
  /** Repo-relative universe retrieval may consider. */
  filePaths: string[];
  /** Optional narrower allow-list; defaults to `filePaths`. */
  allowedPaths?: string[];
  limits?: RetrievalLimits;
  forceRebuild?: boolean;
}

export function retrieve(input: RetrieveInput): RetrievalResult {
  const limits = input.limits ?? DEFAULT_RETRIEVAL_LIMITS;
  const key = retrievalCacheKey(input);
  const cached = graphCache.get(key);

  let graph: RepoGraph;
  let cacheHit = false;

  if (cached && !input.forceRebuild) {
    graph = cached.graph;
    cacheHit = true;
  } else {
    try {
      graph = buildRepoGraph({
        worktreePath: input.worktreePath,
        filePaths: input.filePaths,
        maxFileBytes: limits.maxFileBytes,
        maxFiles: limits.maxFilesIndexed,
      });
      graphCache.set(key, { key, graph, builtAt: Date.now(), fileCount: graph.files.size });
    } catch (err) {
      // Preserve the last-known-good index rather than failing retrieval.
      if (!cached) throw err;
      graph = cached.graph;
      cacheHit = true;
    }
  }

  const intent = parseCodingIntent(input.userRequest);
  const result = rankCandidates({
    graph,
    intent,
    allowedPaths: input.allowedPaths ?? input.filePaths,
    limits,
  });
  result.stats.cacheHit = cacheHit;
  return result;
}
