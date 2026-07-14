/**
 * SEO Control Center — Bakudan Ramen publishing adapter (spec §25).
 *
 * Bakudan (bakudanramen.com) is a static-HTML site with no real build
 * tooling — package.json's "build" script is literally
 * `echo No build step required`. A prior audit found:
 *  - .github/workflows/deploy.yml SCPs straight to production on push to
 *    `main`, with no build/preview/rollback step.
 *  - The working tree currently has 56+ uncommitted/untracked junk files.
 *
 * This adapter therefore:
 *  - Never touches .github/workflows/*, .htaccess, or any deploy config.
 *  - Never writes into an existing tracked page file — createDraft() only
 *    ever writes new files under blog-drafts/.
 *  - "Preview" means: basic well-formedness check + copy into
 *    .seo-preview/ — an honest description given the site has no real
 *    build pipeline to run.
 *  - publishApproved() only copies an approved draft into a new/untracked
 *    source path after the route-level approval guard and live-write flags
 *    have passed. It never git pushes or runs a production deploy.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import type { WebsitePublisher } from './website-publisher';
import { recordEvidence } from '../seo-evidence';
import { getSeoDb, nowIso, seoId } from '../seo-db';
import { disabledReason, isSeoProductionPublishEnabled, isSeoWebsiteWriteEnabled } from '../seo-write-guards';
import {
  createFileSnapshot,
  getPublishSnapshot,
  restorePublishedSnapshot,
  isGitTracked,
  markSnapshotLive,
  resolveWithinRoot,
  markSnapshotFailed,
} from './publish-safety';

const BAKUDAN_ROOT = process.env.BAKUDAN_ROOT || 'D:/Project/Master/Bakudan/bakudanramen.com-current';
const DRAFTS_DIR = path.join(BAKUDAN_ROOT, 'blog-drafts');
const PREVIEW_DIR = path.join(BAKUDAN_ROOT, '.seo-preview');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/**
 * Minimal, honest well-formedness check for an HTML fragment/page: every
 * non-void opening tag must have a matching closing tag, in a sane nesting
 * order. This is deliberately basic (no full DOM parser dependency) —
 * described accurately as a "basic parse check", not a full HTML validator.
 */
function checkHtmlWellFormed(html: string): { ok: boolean; errors: string[] } {
  const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
  const errors: string[] = [];
  const stack: string[] = [];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g;
  let match: RegExpExecArray | null;
  let tagCount = 0;

  while ((match = tagRe.exec(html)) !== null) {
    tagCount++;
    const isClosing = match[0].startsWith('</');
    const tagName = match[1].toLowerCase();
    const selfClosing = match[2] === '/' || VOID_TAGS.has(tagName);
    if (tagName === 'script' || tagName === 'style') {
      // handled loosely below; still track open/close for balance
    }
    if (isClosing) {
      const top = stack.pop();
      if (top !== tagName) {
        errors.push(`mismatched closing tag </${tagName}> (expected </${top ?? 'nothing open'}>)`);
      }
    } else if (!selfClosing) {
      stack.push(tagName);
    }
  }

  if (tagCount === 0) {
    errors.push('no HTML tags found in draft content');
  }
  if (stack.length > 0) {
    errors.push(`unclosed tag(s): ${stack.join(', ')}`);
  }

  return { ok: errors.length === 0, errors };
}

class BakudanPublisher implements WebsitePublisher {
  brandId = 'bakudan';

  async createDraft(contentId: string, html: string, targetPath: string): Promise<{ draftPath: string }> {
    ensureDir(DRAFTS_DIR);
    const safeId = contentId.replace(/[^a-zA-Z0-9_-]/g, '-') || seoId('draft');
    const draftPath = path.join(DRAFTS_DIR, `${safeId}.html`);

    const absoluteTarget = path.isAbsolute(targetPath) ? targetPath : path.join(BAKUDAN_ROOT, targetPath);
    if (isGitTracked(BAKUDAN_ROOT, absoluteTarget)) {
      throw new Error(`refusing createDraft: intended target "${targetPath}" is a git-tracked live page; drafts only ever write to ${DRAFTS_DIR}`);
    }
    if (fs.existsSync(draftPath)) {
      throw new Error(`draft already exists at ${draftPath} — choose a different contentId`);
    }

    fs.writeFileSync(draftPath, html, 'utf8');
    fs.writeFileSync(`${draftPath}.meta.json`, JSON.stringify({ contentId, intendedTargetPath: targetPath, createdAt: new Date().toISOString() }, null, 2), 'utf8');

    return { draftPath };
  }

  async createPreview(draftPath: string): Promise<{ previewPath: string; buildLog: string; success: boolean }> {
    if (!fs.existsSync(draftPath)) {
      return { previewPath: '', buildLog: `FAIL: draft not found at ${draftPath}`, success: false };
    }
    const html = fs.readFileSync(draftPath, 'utf8');
    const { ok, errors } = checkHtmlWellFormed(html);

    ensureDir(PREVIEW_DIR);
    const previewPath = path.join(PREVIEW_DIR, path.basename(draftPath));
    fs.copyFileSync(draftPath, previewPath);

    const buildLog = ok
      ? `PASS: basic HTML well-formedness check passed (${draftPath}). Bakudan's package.json build script is "echo No build step required" — there is no real build pipeline to run, so this preview is a well-formedness check + copy into ${PREVIEW_DIR}, not a compiled build.`
      : `FAIL: ${errors.join('; ')}`;

    return { previewPath, buildLog, success: ok };
  }

  async createSnapshot(targetPath: string): Promise<{ snapshotId: string; backupPath: string }> {
    return createFileSnapshot(this.brandId, BAKUDAN_ROOT, targetPath);
  }

  async publishApproved(snapshotId: string): Promise<{ success: boolean; error?: string }> {
    const flagRefusal = !isSeoProductionPublishEnabled()
      ? disabledReason('SEO_PRODUCTION_PUBLISH_ENABLED')
      : !isSeoWebsiteWriteEnabled()
        ? disabledReason('SEO_WEBSITE_WRITE_ENABLED')
        : null;
    if (flagRefusal) {
      markSnapshotFailed(snapshotId, flagRefusal);
      recordEvidence({
        brand_id: this.brandId,
        category: 'production_deploy',
        summary: `Publish refused: ${flagRefusal}`,
        payload: { snapshotId },
      });
      return { success: false, error: flagRefusal };
    }

    const snapshot = getPublishSnapshot(snapshotId);
    if (!snapshot || snapshot.brand_id !== this.brandId) {
      return { success: false, error: `snapshot ${snapshotId} not found for ${this.brandId}` };
    }
    if (snapshot.status !== 'pending') {
      return { success: false, error: `snapshot ${snapshotId} is not pending (status=${snapshot.status})` };
    }

    const state = getSeoDb().prepare('SELECT * FROM seo_pipeline_state WHERE snapshot_id = ?')
      .get(snapshotId) as { content_id: string; draft_path: string | null; target_path: string | null; preview_build_success: number | null } | undefined;
    if (!state?.draft_path || !state.target_path || state.preview_build_success !== 1) {
      return { success: false, error: 'publish requires a successful pipeline preview with draft_path and target_path bound to this snapshot' };
    }
    if (!fs.existsSync(state.draft_path)) {
      return { success: false, error: `draft_path missing on disk: ${state.draft_path}` };
    }

    let before: { existed?: boolean; targetPath?: string; targetWasGitTracked?: boolean };
    try {
      before = JSON.parse(snapshot.before_state || '{}');
    } catch {
      return { success: false, error: `snapshot ${snapshotId} has unparseable before_state` };
    }

    const targetPath = before.targetPath || state.target_path;
    const absoluteTarget = resolveWithinRoot(BAKUDAN_ROOT, targetPath);
    if (before.targetWasGitTracked || isGitTracked(BAKUDAN_ROOT, absoluteTarget)) {
      return { success: false, error: `refusing to publish to git-tracked path: ${absoluteTarget}` };
    }
    if (fs.existsSync(absoluteTarget) && !before.existed) {
      return { success: false, error: `target appeared after snapshot and has no recorded backup: ${absoluteTarget}` };
    }

    ensureDir(path.dirname(absoluteTarget));
    fs.copyFileSync(state.draft_path, absoluteTarget);
    const digest = sha256File(absoluteTarget);
    getSeoDb().prepare('UPDATE seo_publish_snapshots SET content_id = ? WHERE id = ? AND content_id IS NULL')
      .run(state.content_id, snapshotId);
    markSnapshotLive(snapshotId, {
      publishedPath: absoluteTarget,
      sourcePath: state.draft_path,
      sha256: digest,
      note: 'Copied approved Bakudan draft into a new/untracked source path only; no git push or deploy was run.',
    });
    getSeoDb().prepare('UPDATE seo_content_items SET status = ?, published_at = ?, updated_at = ? WHERE id = ?')
      .run('SOURCE_PUBLISHED_PENDING_DEPLOY', nowIso(), nowIso(), state.content_id);
    recordEvidence({
      brand_id: this.brandId,
      category: 'production_deploy',
      summary: `Published Bakudan approved source content for snapshot ${snapshotId}`,
      payload: { snapshotId, content_id: state.content_id, publishedPath: absoluteTarget, sha256: digest, deploy_ran: false },
    });

    return { success: true };
  }

  async rollback(snapshotId: string): Promise<{ success: boolean; error?: string }> {
    const result = restorePublishedSnapshot(BAKUDAN_ROOT, snapshotId);
    recordEvidence({
      brand_id: this.brandId,
      category: 'rollback',
      summary: result.success ? `Rolled back snapshot ${snapshotId}` : `Rollback failed for snapshot ${snapshotId}: ${result.error}`,
      payload: { snapshotId, result },
    });
    return result;
  }
}

export const bakudanPublisher: WebsitePublisher = new BakudanPublisher();
