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

      if (occurrences === 0) {
        throw new CodingEngineError('INVALID_PATCH', `search anchor not found in ${relative}`, {
          path: relative,
          anchorPreview: needle.slice(0, 200),
        });
      }
      if (occurrences > 1) {
        throw new CodingEngineError('INVALID_PATCH', `search anchor is ambiguous in ${relative} (${occurrences} matches)`, {
          path: relative,
          anchorPreview: needle.slice(0, 200),
        });
      }

      const updated = normalizedBefore.replace(needle, () => normalizeEol(edit.replace as string));
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
