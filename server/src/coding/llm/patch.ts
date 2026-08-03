/**
 * Applies model-authored edits to a worktree.
 *
 * Every edit is validated before any file is touched, and the whole batch is
 * rolled back if a later edit fails — a half-applied patch is worse than no
 * patch, because validation would then report failures the model cannot explain.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CodingEngineError, type AppliedEdit, type FileEdit, type ModelPatch } from './types';
import { isBinaryPath, resolveWithinWorktree } from './tools';

const MAX_NEW_FILE_BYTES = 256 * 1024;

export interface ApplyOptions {
  worktreePath: string;
  /** Repo-relative paths the plan is allowed to modify. */
  writablePaths: Set<string>;
  patch: ModelPatch;
}

export interface ApplyOutcome {
  applied: AppliedEdit[];
  changedFiles: string[];
}

/** Normalises line endings so an anchor authored with \n matches a CRLF file. */
function normalizeEol(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function restoreEol(original: string, updated: string): string {
  return original.includes('\r\n') ? updated.replace(/\n/g, '\r\n') : updated;
}

export function validateEdit(worktreePath: string, writablePaths: Set<string>, edit: FileEdit): { relative: string; absolute: string } {
  if (!edit || typeof edit.path !== 'string') {
    throw new CodingEngineError('INVALID_PATCH', 'edit is missing a path');
  }
  const resolved = resolveWithinWorktree(worktreePath, edit.path);
  if (!resolved.ok) {
    throw new CodingEngineError('POLICY_DENIED', `write denied for ${edit.path}: ${resolved.reason}`);
  }
  const relative = resolved.relative!;
  if (!writablePaths.has(relative)) {
    throw new CodingEngineError('POLICY_DENIED', `write denied for ${relative}: outside the approved plan`);
  }
  if (isBinaryPath(relative)) {
    throw new CodingEngineError('POLICY_DENIED', `write denied for ${relative}: binary file`);
  }
  if (edit.op === 'replace') {
    if (typeof edit.search !== 'string' || edit.search === '') {
      throw new CodingEngineError('INVALID_PATCH', `edit for ${relative} has an empty search anchor`);
    }
    if (typeof edit.replace !== 'string') {
      throw new CodingEngineError('INVALID_PATCH', `edit for ${relative} has no replacement text`);
    }
    if (!fs.existsSync(resolved.absolute!)) {
      throw new CodingEngineError('INVALID_PATCH', `edit targets a file that does not exist: ${relative}`);
    }
  } else if (edit.op === 'create') {
    const body = edit.content ?? edit.replace;
    if (typeof body !== 'string') {
      throw new CodingEngineError('INVALID_PATCH', `create for ${relative} has no content`);
    }
    if (Buffer.byteLength(body, 'utf8') > MAX_NEW_FILE_BYTES) {
      throw new CodingEngineError('INVALID_PATCH', `create for ${relative} exceeds ${MAX_NEW_FILE_BYTES} bytes`);
    }
  } else {
    throw new CodingEngineError('INVALID_PATCH', `unsupported edit op for ${relative}: ${String(edit.op)}`);
  }
  return { relative, absolute: resolved.absolute! };
}

export function applyPatch(options: ApplyOptions): ApplyOutcome {
  const { worktreePath, writablePaths, patch } = options;
  if (!patch || !Array.isArray(patch.edits) || patch.edits.length === 0) {
    throw new CodingEngineError('INVALID_PATCH', 'model returned no edits');
  }

  // Validate every edit first so a rejected path never leaves partial writes.
  const resolvedEdits = patch.edits.map(edit => ({ edit, ...validateEdit(worktreePath, writablePaths, edit) }));

  const backups = new Map<string, string | null>();
  const applied: AppliedEdit[] = [];
  const changed = new Set<string>();

  try {
    for (const { edit, relative, absolute } of resolvedEdits) {
      const existedBefore = fs.existsSync(absolute);
      if (!backups.has(absolute)) {
        backups.set(absolute, existedBefore ? fs.readFileSync(absolute, 'utf8') : null);
      }

      if (edit.op === 'create') {
        const body = (edit.content ?? edit.replace) as string;
        if (existedBefore) {
          // Treat create-over-existing as a full rewrite rather than failing;
          // models routinely pick 'create' when replacing a whole small file.
          const before = fs.readFileSync(absolute, 'utf8');
          fs.writeFileSync(absolute, restoreEol(before, normalizeEol(body)));
          applied.push({ path: relative, op: 'create', applied: true, bytesBefore: Buffer.byteLength(before), bytesAfter: Buffer.byteLength(body) });
        } else {
          fs.mkdirSync(path.dirname(absolute), { recursive: true });
          fs.writeFileSync(absolute, body);
          applied.push({ path: relative, op: 'create', applied: true, bytesBefore: 0, bytesAfter: Buffer.byteLength(body) });
        }
        changed.add(relative);
        continue;
      }

      const before = fs.readFileSync(absolute, 'utf8');
      const normalizedBefore = normalizeEol(before);
      const needle = normalizeEol(edit.search as string);
      const occurrences = countOccurrences(normalizedBefore, needle);

      if (occurrences > 1) {
        throw new CodingEngineError('INVALID_PATCH', `search anchor is ambiguous in ${relative} (${occurrences} matches)`, {
          path: relative,
          anchorPreview: needle.slice(0, 200),
        });
      }

      let updated: string;
      if (occurrences === 1) {
        updated = normalizedBefore.replace(needle, () => normalizeEol(edit.replace as string));
      } else {
        // Exact matching failed. Local models routinely reproduce a block with
        // the right lines but reconstructed indentation, and this is the single
        // most common patch failure across every model benchmarked. Retry
        // comparing lines by their trimmed content, still requiring exactly one
        // match so an ambiguous anchor is never silently applied to the wrong
        // place, and re-indent the replacement to the file's actual indentation.
        const fuzzy = matchByTrimmedLines(normalizedBefore, needle);
        if (fuzzy.count === 0) {
          throw new CodingEngineError(
            'INVALID_PATCH',
            `search anchor not found in ${relative}. Anchor was: ${JSON.stringify(needle.slice(0, 300))}`,
            { path: relative, anchorPreview: needle.slice(0, 300) }
          );
        }
        if (fuzzy.count > 1) {
          throw new CodingEngineError(
            'INVALID_PATCH',
            `search anchor is ambiguous in ${relative} (${fuzzy.count} whitespace-insensitive matches)`,
            { path: relative, anchorPreview: needle.slice(0, 200) }
          );
        }
        updated = replaceLineRange(normalizedBefore, fuzzy.startLine!, fuzzy.endLine!, normalizeEol(edit.replace as string), fuzzy.indentDelta);
      }

      const finalText = restoreEol(before, updated);
      fs.writeFileSync(absolute, finalText);
      changed.add(relative);
      applied.push({
        path: relative,
        op: 'replace',
        applied: true,
        bytesBefore: Buffer.byteLength(before),
        bytesAfter: Buffer.byteLength(finalText),
      });
    }
  } catch (err) {
    // Roll the whole batch back to its pre-apply state.
    for (const [absolute, original] of backups) {
      try {
        if (original === null) {
          if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
        } else {
          fs.writeFileSync(absolute, original);
        }
      } catch {
        // Best-effort restore; the caller surfaces the original failure.
      }
    }
    throw err;
  }

  return { applied, changedFiles: [...changed] };
}

interface FuzzyMatch {
  count: number;
  startLine?: number;
  endLine?: number;
  /** Spaces to add to (positive) or strip from (negative) the replacement. */
  indentDelta: number;
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/**
 * Finds a line-sequence match ignoring leading and trailing whitespace.
 * Blank lines in the anchor are skipped so a model that adds or drops one does
 * not miss. Requires the caller to enforce uniqueness.
 */
function matchByTrimmedLines(haystack: string, needle: string): FuzzyMatch {
  const anchorLines = needle.split('\n').map(line => line.trim()).filter(line => line !== '');
  if (!anchorLines.length) return { count: 0, indentDelta: 0 };

  const fileLines = haystack.split('\n');
  const matches: Array<{ start: number; end: number; indentDelta: number }> = [];

  for (let start = 0; start < fileLines.length; start += 1) {
    if (fileLines[start].trim() !== anchorLines[0]) continue;

    let cursor = start;
    let matched = 0;
    while (matched < anchorLines.length && cursor < fileLines.length) {
      const current = fileLines[cursor].trim();
      if (current === '') {
        cursor += 1;
        continue;
      }
      if (current !== anchorLines[matched]) break;
      matched += 1;
      cursor += 1;
    }

    if (matched === anchorLines.length) {
      const firstAnchorLine = needle.split('\n').find(line => line.trim() !== '') ?? '';
      matches.push({
        start,
        end: cursor - 1,
        indentDelta: indentOf(fileLines[start]) - indentOf(firstAnchorLine),
      });
    }
  }

  if (matches.length !== 1) return { count: matches.length, indentDelta: 0 };
  return { count: 1, startLine: matches[0].start, endLine: matches[0].end, indentDelta: matches[0].indentDelta };
}

/** Replaces an inclusive line range, re-indenting the replacement by `indentDelta`. */
function replaceLineRange(haystack: string, startLine: number, endLine: number, replacement: string, indentDelta: number): string {
  const lines = haystack.split('\n');
  const reindented = replacement.split('\n').map(line => {
    if (line.trim() === '') return line;
    if (indentDelta > 0) return ' '.repeat(indentDelta) + line;
    if (indentDelta < 0) {
      const strip = Math.min(-indentDelta, indentOf(line));
      return line.slice(strip);
    }
    return line;
  });
  return [...lines.slice(0, startLine), ...reindented, ...lines.slice(endLine + 1)].join('\n');
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    if (count > 1) return count;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}
