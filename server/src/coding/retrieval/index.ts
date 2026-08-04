/**
 * Retrieval entry point and graph cache.
 *
 * The graph is keyed by project, source SHA and schema version so it is rebuilt
 * when the tree or the ranking policy changes and reused otherwise. A failed
 * refresh keeps the last-known-good index rather than leaving retrieval with
 * nothing, which matches how the project registry treats a failed remap.
 */

import * as fs from 'fs';

import { buildRepoGraph, isGeneratedPath, isTestPath, type FileNode, type RepoGraph } from './graph';
import { isBinaryPath, resolveWithinWorktree } from '../llm/tools';
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
  includeExplicitPathNodes({
    graph,
    worktreePath: input.worktreePath,
    intentSymbols: intent.symbols,
    allowedPaths: input.allowedPaths ?? input.filePaths,
    filePaths: input.filePaths,
  });
  const result = rankCandidates({
    graph,
    intent,
    allowedPaths: input.allowedPaths ?? input.filePaths,
    limits,
  });
  result.stats.cacheHit = cacheHit;
  return result;
}

function includeExplicitPathNodes(input: {
  graph: RepoGraph;
  worktreePath: string;
  intentSymbols: string[];
  allowedPaths: string[];
  filePaths: string[];
}): void {
  const allowed = new Set(input.allowedPaths);
  const universe = new Set(input.filePaths);
  for (const raw of input.intentSymbols) {
    const relative = raw.replace(/\\/g, '/').replace(/^\.\//, '');
    if (!relative.includes('/') || pathLooksUnsafe(relative)) continue;
    if (!universe.has(relative) || (allowed.size > 0 && !allowed.has(relative))) continue;
    if (isGeneratedPath(relative) || isBinaryPath(relative)) continue;
    if (input.graph.files.has(relative)) continue;

    const resolved = resolveWithinWorktree(input.worktreePath, relative);
    if (!resolved.ok || !resolved.absolute) continue;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(resolved.absolute);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;

    const node: FileNode = {
      path: relative,
      role: isTestPath(relative) ? 'TEST' : 'UNKNOWN',
      symbols: [],
      imports: [],
      importBindings: {},
      mounts: [],
      importedBy: [],
      routes: [],
      cliCommands: [],
      stringLiterals: [],
      bytes: stat.size,
      isTest: isTestPath(relative),
      isGenerated: false,
    };
    input.graph.files.set(relative, node);
  }
}

function pathLooksUnsafe(relative: string): boolean {
  return relative.startsWith('/') || /^[A-Za-z]:/.test(relative) || relative.split('/').some(part => part === '..' || part === '');
}
