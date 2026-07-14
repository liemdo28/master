/**
 * SEO Control Center — Publishing Adapters: shared safety helpers.
 *
 * Both bakudan-publisher.ts and raw-sushi-publisher.ts share this logic so
 * the "never write to a git-tracked live file" rule is enforced in exactly
 * one place, not re-implemented (and potentially drifted) per adapter.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { getSeoDb, nowIso, seoId } from '../seo-db';

/**
 * Resolves `targetPath` against `repoRoot` and throws if the result escapes
 * repoRoot (e.g. a caller-supplied `../../../windows/system32/...`-style
 * path). Every function below that turns a caller-supplied path into a
 * filesystem write location must go through this first — without it,
 * isGitTracked() would harmlessly return `false` for an out-of-repo path
 * (nothing to check against `git ls-files`), which would let a
 * traversal-crafted targetPath slip past the "never touch a tracked file"
 * guard and reach fs.copyFileSync with an arbitrary destination.
 */
export function resolveWithinRoot(repoRoot: string, targetPath: string): string {
  const absoluteTarget = path.isAbsolute(targetPath) ? targetPath : path.join(repoRoot, targetPath);
  const rel = path.relative(repoRoot, absoluteTarget);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`refusing path outside repo root: targetPath "${targetPath}" resolves to "${absoluteTarget}", which escapes ${repoRoot}`);
  }
  return absoluteTarget;
}

/**
 * True if `absPath` is tracked by git inside `repoRoot`. Used as a hard
 * runtime guard — even if a caller passes a live page path by mistake, this
 * stops any write to it. Reading FROM a tracked file (to make a backup copy
 * elsewhere) is fine and still allowed; only *writing back into* a tracked
 * path is refused (see restoreFromSnapshot below).
 */
export function isGitTracked(repoRoot: string, absPath: string): boolean {
  try {
    const rel = path.relative(repoRoot, absPath);
    if (rel.startsWith('..')) return false; // outside the repo entirely
    execFileSync('git', ['ls-files', '--error-unmatch', '--', rel], { cwd: repoRoot, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export interface SnapshotBeforeState {
  existed: boolean;
  backupPath: string | null;
  targetPath: string;
  targetWasGitTracked: boolean;
}

export interface SnapshotAfterState {
  publishedPath?: string;
  sourcePath?: string;
  sourceBackupPath?: string | null;
  sha256?: string;
  note?: string;
}

/**
 * Copies the current file at targetPath (if it exists) to a timestamped
 * backup path under `<repoRoot>/.seo-preview/backups/`, and inserts a
 * seo_publish_snapshots row recording enough of `before_state` for a later
 * rollback() to restore from. Reading a git-tracked file to make this backup
 * copy is safe (read-only w.r.t. the tracked file itself).
 */
export function createFileSnapshot(brandId: string, repoRoot: string, targetPath: string): { snapshotId: string; backupPath: string } {
  const absoluteTarget = resolveWithinRoot(repoRoot, targetPath);
  const backupDir = path.join(repoRoot, '.seo-preview', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const targetWasGitTracked = isGitTracked(repoRoot, absoluteTarget);
  let existed = false;
  let backupPath: string | null = null;

  if (fs.existsSync(absoluteTarget)) {
    existed = true;
    backupPath = path.join(backupDir, `${path.basename(absoluteTarget)}.${Date.now()}.bak`);
    fs.copyFileSync(absoluteTarget, backupPath);
  }

  const before: SnapshotBeforeState = { existed, backupPath, targetPath: absoluteTarget, targetWasGitTracked };
  const snapshotId = seoId('pub');
  getSeoDb().prepare(`
    INSERT INTO seo_publish_snapshots (id, created_at, brand_id, content_id, target, before_state, after_state, status)
    VALUES (?, ?, ?, NULL, 'preview', ?, NULL, 'pending')
  `).run(snapshotId, nowIso(), brandId, JSON.stringify(before));

  return { snapshotId, backupPath: backupPath || '' };
}

interface PublishSnapshotRow {
  id: string;
  brand_id: string;
  content_id: string | null;
  target: string;
  before_state: string | null;
  after_state: string | null;
  status: string;
}

export function getPublishSnapshot(snapshotId: string): PublishSnapshotRow | undefined {
  return getSeoDb().prepare('SELECT * FROM seo_publish_snapshots WHERE id = ?').get(snapshotId) as PublishSnapshotRow | undefined;
}

/**
 * Restores the backup file recorded on a snapshot back to its original
 * targetPath — but ONLY when that targetPath is not (and was not) a
 * git-tracked file in the repo. This adapter never publishes to live pages
 * in the first place (see publishApproved's honest refusal in both
 * concrete adapters), so in normal operation rollback() only ever touches
 * paths this same adapter created under blog-drafts/, public/content/posts/,
 * or .seo-preview/ — never a tracked live page.
 */
export function restoreFromSnapshot(repoRoot: string, snapshotId: string): { success: boolean; error?: string } {
  const row = getPublishSnapshot(snapshotId);
  if (!row) return { success: false, error: `snapshot ${snapshotId} not found` };
  if (row.status === 'live') return { success: false, error: `snapshot ${snapshotId} is marked 'live' — refusing to touch it via this file-restore path` };

  let before: SnapshotBeforeState;
  try {
    before = JSON.parse(row.before_state || '{}');
  } catch {
    return { success: false, error: `snapshot ${snapshotId} has unparseable before_state` };
  }

  if (isGitTracked(repoRoot, before.targetPath) || before.targetWasGitTracked) {
    return {
      success: false,
      error: `refusing to write to "${before.targetPath}" — it is a git-tracked file in ${repoRoot}. This adapter never modifies live/tracked site files; rollback only restores untracked draft/preview paths it created itself.`,
    };
  }

  if (!before.existed || !before.backupPath) {
    return { success: false, error: 'no backup file recorded for this snapshot (target did not exist before the snapshot) — nothing to restore' };
  }
  if (!fs.existsSync(before.backupPath)) {
    return { success: false, error: `backup file missing on disk: ${before.backupPath}` };
  }

  fs.copyFileSync(before.backupPath, before.targetPath);
  getSeoDb().prepare(`UPDATE seo_publish_snapshots SET status = 'rolled_back', rolled_back_at = ? WHERE id = ?`)
    .run(nowIso(), snapshotId);

  return { success: true };
}

export function restorePublishedSnapshot(repoRoot: string, snapshotId: string): { success: boolean; error?: string } {
  const row = getPublishSnapshot(snapshotId);
  if (!row) return { success: false, error: `snapshot ${snapshotId} not found` };

  let before: SnapshotBeforeState;
  let after: SnapshotAfterState;
  try {
    before = JSON.parse(row.before_state || '{}');
    after = JSON.parse(row.after_state || '{}');
  } catch {
    return { success: false, error: `snapshot ${snapshotId} has unparseable before_state/after_state` };
  }

  const rawTarget = after.publishedPath || before.targetPath;
  if (!rawTarget) return { success: false, error: `snapshot ${snapshotId} does not record a published target` };
  const absoluteTarget = resolveWithinRoot(repoRoot, rawTarget);
  if (isGitTracked(repoRoot, absoluteTarget) || before.targetWasGitTracked) {
    return { success: false, error: `refusing rollback on git-tracked path: ${absoluteTarget}` };
  }

  const sourcePath = after.sourcePath ? resolveWithinRoot(repoRoot, after.sourcePath) : absoluteTarget;
  const sourceBackupPath = after.sourceBackupPath ? resolveWithinRoot(repoRoot, after.sourceBackupPath) : null;
  if (sourceBackupPath) {
    if (!fs.existsSync(sourceBackupPath)) return { success: false, error: `source backup missing on disk: ${sourceBackupPath}` };
    if (isGitTracked(repoRoot, sourcePath)) return { success: false, error: `refusing rollback on git-tracked source path: ${sourcePath}` };
    fs.copyFileSync(sourceBackupPath, sourcePath);
  } else if (before.existed && before.backupPath) {
    if (!fs.existsSync(before.backupPath)) return { success: false, error: `backup file missing on disk: ${before.backupPath}` };
    fs.copyFileSync(before.backupPath, absoluteTarget);
  } else if (!before.existed) {
    if (fs.existsSync(absoluteTarget)) fs.unlinkSync(absoluteTarget);
  } else {
    return { success: false, error: `snapshot ${snapshotId} does not contain enough backup information to rollback` };
  }

  getSeoDb().prepare(`UPDATE seo_publish_snapshots SET status = 'rolled_back', rolled_back_at = ? WHERE id = ?`)
    .run(nowIso(), snapshotId);
  return { success: true };
}

export function markSnapshotLive(snapshotId: string, after: SnapshotAfterState): void {
  getSeoDb().prepare(`
    UPDATE seo_publish_snapshots
    SET status = 'live', after_state = ?
    WHERE id = ? AND status = 'pending'
  `).run(JSON.stringify(after), snapshotId);
}

export function markSnapshotFailed(snapshotId: string, reason: string): void {
  getSeoDb().prepare(`UPDATE seo_publish_snapshots SET status = 'failed' WHERE id = ? AND status != 'live'`).run(snapshotId);
  void reason;
}
