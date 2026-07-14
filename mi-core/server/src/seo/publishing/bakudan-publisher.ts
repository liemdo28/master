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
 *  - publishApproved() is an explicit, honest no-op refusal. It still
 *    routes the attempt through submitSeoAction(production_deploy) so the
 *    approval-gate/evidence trail is real.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { WebsitePublisher } from './website-publisher';
import { submitSeoAction } from '../seo-approval-bridge';
import { recordEvidence } from '../seo-evidence';
import { seoId } from '../seo-db';
import { disabledReason, isSeoProductionPublishEnabled, isSeoWebsiteWriteEnabled } from '../seo-write-guards';
import {
  createFileSnapshot,
  restoreFromSnapshot,
  isGitTracked,
  markSnapshotFailed,
  PRODUCTION_DEPLOY_REFUSAL,
} from './publish-safety';

const BAKUDAN_ROOT = process.env.BAKUDAN_ROOT || 'D:/Project/Master/Bakudan/bakudanramen.com-current';
const DRAFTS_DIR = path.join(BAKUDAN_ROOT, 'blog-drafts');
const PREVIEW_DIR = path.join(BAKUDAN_ROOT, '.seo-preview');

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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
        : PRODUCTION_DEPLOY_REFUSAL;
    submitSeoAction({
      category: 'production_deploy',
      brand_id: this.brandId,
      description: `Publish attempt for Bakudan snapshot ${snapshotId}`,
      target: 'production',
      rollback_plan: `Restore from backup recorded on snapshot ${snapshotId} via rollback()`,
      idempotency_key: `bakudan-publish-${snapshotId}`,
    });

    markSnapshotFailed(snapshotId, flagRefusal);
    recordEvidence({
      brand_id: this.brandId,
      category: 'production_deploy',
      summary: `Publish refused: ${flagRefusal}`,
      payload: { snapshotId },
    });

    return { success: false, error: flagRefusal };
  }

  async rollback(snapshotId: string): Promise<{ success: boolean; error?: string }> {
    const result = restoreFromSnapshot(BAKUDAN_ROOT, snapshotId);
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
