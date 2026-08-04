/**
 * Translates a Mi Context Pack into engine input.
 *
 * The engine starts with ranked candidates only. Anything beyond that must be
 * requested explicitly, justified, and re-validated against the same boundary
 * rules — the context pack is an allow-list, not a starting suggestion.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { CandidateFile, CandidateSelection } from '../types';
import type { ContextPack, ProjectRecord } from '../../project-registry/types';
import { isBinaryPath, resolveWithinWorktree, TOOL_LIMITS } from './tools';
import type { ContextExpansionOutcome, ContextExpansionRequest } from './types';
import type { PromptContext, RepoSnapshotFile } from './prompts';

/**
 * Model context window, in tokens, requested for every engine call.
 * qwen3:8b supports 40960; 32768 leaves headroom without inflating the KV cache
 * beyond what 8 GB of VRAM tolerates.
 */
export const DEFAULT_NUM_CTX = 32_768;

/**
 * Bytes of source the engine may hold at once, across all files.
 *
 * This is derived from DEFAULT_NUM_CTX rather than chosen independently. The
 * two were previously unrelated constants — a 96 KB budget against a 16,384
 * token window — so a large context silently overflowed and Ollama truncated
 * the prompt from the left. The model then received source without the
 * instructions that explained what to do with it, and produced search anchors
 * that matched nothing. Roughly 3 bytes per token for source code, with ~40%
 * of the window reserved for instructions and generated output.
 */
export const DEFAULT_CONTEXT_BUDGET_BYTES = Math.floor(DEFAULT_NUM_CTX * 0.6 * 3);
export const MAX_TOTAL_CONTEXT_FILES = 32;
export const MAX_EXPANSIONS_PER_TASK = 8;

export interface ContextBridgeState {
  worktreePath: string;
  budgetBytes: number;
  usedBytes: number;
  files: Map<string, RepoSnapshotFile>;
  expansions: ContextExpansionOutcome[];
}

export function createContextState(worktreePath: string, budgetBytes = DEFAULT_CONTEXT_BUDGET_BYTES): ContextBridgeState {
  return { worktreePath, budgetBytes, usedBytes: 0, files: new Map(), expansions: [] };
}

function readSnapshot(worktreePath: string, relative: string, remainingBytes: number): RepoSnapshotFile | null {
  const resolved = resolveWithinWorktree(worktreePath, relative);
  if (!resolved.ok || isBinaryPath(relative)) return null;
  if (!fs.existsSync(resolved.absolute!)) return null;
  const stat = fs.statSync(resolved.absolute!);
  if (!stat.isFile() || stat.size > TOOL_LIMITS.MAX_READ_BYTES) return null;

  const raw = fs.readFileSync(resolved.absolute!, 'utf8');
  if (Buffer.byteLength(raw, 'utf8') <= remainingBytes) {
    return { path: resolved.relative!, content: raw, truncated: false };
  }
  if (remainingBytes < 512) return null;
  return { path: resolved.relative!, content: raw.slice(0, remainingBytes), truncated: true };
}

/** Loads the ranked candidates, highest confidence first, until the budget is spent. */
export function loadCandidateFiles(state: ContextBridgeState, candidates: CandidateFile[]): RepoSnapshotFile[] {
  for (const candidate of candidates) {
    if (state.files.size >= MAX_TOTAL_CONTEXT_FILES) break;
    const remaining = state.budgetBytes - state.usedBytes;
    if (remaining <= 512) break;
    if (state.files.has(candidate.path)) continue;
    const snapshot = readSnapshot(state.worktreePath, candidate.path, remaining);
    if (!snapshot) continue;
    state.files.set(snapshot.path, snapshot);
    state.usedBytes += Buffer.byteLength(snapshot.content, 'utf8');
  }
  return [...state.files.values()];
}

/** Re-reads files already in context so a repair pass sees post-apply content. */
export function refreshContextFiles(state: ContextBridgeState): RepoSnapshotFile[] {
  const paths = [...state.files.keys()];
  state.files.clear();
  state.usedBytes = 0;
  for (const relative of paths) {
    const remaining = state.budgetBytes - state.usedBytes;
    if (remaining <= 512) break;
    const snapshot = readSnapshot(state.worktreePath, relative, remaining);
    if (!snapshot) continue;
    state.files.set(snapshot.path, snapshot);
    state.usedBytes += Buffer.byteLength(snapshot.content, 'utf8');
  }
  return [...state.files.values()];
}

export interface ExpansionPolicy {
  /** Repo-relative paths inside the active context pack. */
  packPaths: Set<string>;
  /** Paths the pack explicitly excludes. */
  excluded: string[];
}

/**
 * Evaluates one model-requested file against the boundary. Denials are recorded
 * rather than thrown so the engine can tell the model why and continue.
 */
export function evaluateExpansion(
  state: ContextBridgeState,
  policy: ExpansionPolicy,
  request: ContextExpansionRequest
): ContextExpansionOutcome {
  const base: ContextExpansionOutcome = { path: request.path, reason: request.reason ?? '', granted: false, bytes: 0 };

  if (state.expansions.filter(e => e.granted).length >= MAX_EXPANSIONS_PER_TASK) {
    return { ...base, denialReason: 'expansion limit reached' };
  }
  if (!request.reason || request.reason.trim().length < 8) {
    return { ...base, denialReason: 'no justification supplied' };
  }

  const resolved = resolveWithinWorktree(state.worktreePath, request.path);
  if (!resolved.ok) return { ...base, denialReason: resolved.reason };

  const relative = resolved.relative!;
  if (state.files.has(relative)) return { ...base, path: relative, granted: true, bytes: 0, reason: 'already in context' };
  if (!policy.packPaths.has(relative)) {
    return { ...base, path: relative, denialReason: 'path is not in the active context pack' };
  }
  if (isBinaryPath(relative)) return { ...base, path: relative, denialReason: 'binary file' };
  if (!fs.existsSync(resolved.absolute!)) return { ...base, path: relative, denialReason: 'file does not exist' };

  const remaining = state.budgetBytes - state.usedBytes;
  if (remaining <= 512) return { ...base, path: relative, denialReason: 'context budget exhausted' };
  if (state.files.size >= MAX_TOTAL_CONTEXT_FILES) {
    return { ...base, path: relative, denialReason: 'context file limit reached' };
  }

  const snapshot = readSnapshot(state.worktreePath, relative, remaining);
  if (!snapshot) return { ...base, path: relative, denialReason: 'file could not be read within limits' };

  state.files.set(snapshot.path, snapshot);
  const bytes = Buffer.byteLength(snapshot.content, 'utf8');
  state.usedBytes += bytes;
  const outcome: ContextExpansionOutcome = { path: relative, reason: request.reason, granted: true, bytes };
  state.expansions.push(outcome);
  return outcome;
}

export function recordDeniedExpansion(state: ContextBridgeState, outcome: ContextExpansionOutcome): void {
  state.expansions.push(outcome);
}

export function buildPromptContext(input: {
  state: ContextBridgeState;
  project: ProjectRecord;
  contextPack: ContextPack;
  sourceSha: string;
  userRequest: string;
  candidates: CandidateSelection;
  validationCommands: string[];
}): PromptContext {
  const { state, project, contextPack, sourceSha, userRequest, candidates, validationCommands } = input;
  const summaryParts = [`${project.displayName} (${project.id})`];
  if (contextPack.summary) summaryParts.push(contextPack.summary);
  for (const moduleSummary of contextPack.moduleSummaries.slice(0, 6)) summaryParts.push(`- ${moduleSummary}`);

  return {
    userRequest,
    projectSummary: summaryParts.join('\n'),
    mapVersion: contextPack.mapVersion ?? 'unknown',
    sourceSha,
    constraints: [
      'All work happens inside an isolated git worktree; the base checkout is never modified.',
      'Only the listed candidate files may be edited.',
      `Excluded from this task: ${candidates.excluded.slice(0, 8).join(', ') || 'none'}`,
    ],
    validationCommands,
    candidates: candidates.candidates,
    files: [...state.files.values()],
    expansions: state.expansions,
  };
}

/** Paths the engine could request, drawn from the pack and minus what it already holds. */
export function expandablePaths(policy: ExpansionPolicy, state: ContextBridgeState): string[] {
  return [...policy.packPaths]
    .filter(p => !state.files.has(p) && !isBinaryPath(p))
    .sort();
}

export function buildExpansionPolicy(worktreePath: string, contextPack: ContextPack): ExpansionPolicy {
  const packPaths = new Set<string>();
  for (const raw of contextPack.includedPaths ?? []) {
    const resolved = resolveWithinWorktree(worktreePath, String(raw).replace(/\\/g, '/'));
    if (resolved.ok) packPaths.add(resolved.relative!);
  }
  return { packPaths, excluded: [...(contextPack.excludedPaths ?? [])] };
}

/** Sidecar location for resumable engine state; deliberately outside the worktree. */
export function sessionFilePath(worktreePath: string): string {
  const taskId = path.basename(worktreePath);
  return path.join(path.dirname(worktreePath), '.mi-engine-sessions', `${taskId}.json`);
}
