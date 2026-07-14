/**
 * SEO Control Center — Raw Sushi Bistro publishing adapter (spec §25).
 *
 * A prior audit of RawSushi/RawWebsite found TWO non-identical copies of the
 * site (loose *.html at repo root vs. the actually-deployed public/
 * directory) plus two conflicting _redirects files and two conflicting
 * Wrangler configs (wrangler.toml vs wrangler.jsonc).
 *
 * This adapter avoids all of that ambiguity by using the site's OWN
 * documented content-intake mechanism instead of inventing a new one:
 * public/content/posts/{slug}.md, markdown + YAML frontmatter, as documented
 * in public/content/posts/README.md. New drafts are written with
 * `published: false`; publishApproved() can flip only that untracked draft
 * to `published: true` after the route-level approval guard and live-write
 * flags pass. This adapter never runs `wrangler deploy` or touches
 * wrangler.toml/.jsonc or _redirects.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { parse as parseYaml } from 'yaml';
import type { WebsitePublisher } from './website-publisher';
import { recordEvidence } from '../seo-evidence';
import { getSeoDb, nowIso } from '../seo-db';
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

const RAWSUSHI_ROOT = process.env.RAWSUSHI_ROOT || 'D:/Project/Master/RawSushi/RawWebsite';
const POSTS_DIR = path.join(RAWSUSHI_ROOT, 'public', 'content', 'posts');
const PREVIEW_DIR = path.join(RAWSUSHI_ROOT, '.seo-preview', 'posts');

const REQUIRED_FRONTMATTER_FIELDS = ['title', 'slug', 'date', 'excerpt', 'meta_description', 'primary_keyword', 'post_type', 'published'];
const VALID_POST_TYPES = ['viral_attention', 'conversion_order', 'local_discovery', 'tourist_discovery', 'menu_highlight'];

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sha256File(filePath: string): string {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `post-${Date.now()}`;
}

class RawSushiPublisher implements WebsitePublisher {
  brandId = 'raw_sushi';

  /**
   * The shared WebsitePublisher interface takes an `html` body, but
   * RawSushi's real, documented content-intake mechanism is Markdown +
   * YAML frontmatter (public/content/posts/README.md) — not raw HTML. To
   * honor "prefer using the site's own existing draft mechanism over
   * inventing a new one": if `html` already looks like a frontmatter block
   * (`starts with ---`), it is written through as-is (caller already
   * formatted it to the site's schema). Otherwise it is wrapped in a
   * minimal, honestly-incomplete frontmatter block with `published: false`,
   * and the raw content is placed as the post body — this is a best-effort
   * bridge between the shared interface and the site's real schema, not a
   * claim that arbitrary HTML renders identically to hand-written markdown.
   */
  async createDraft(contentId: string, html: string, targetPath: string): Promise<{ draftPath: string }> {
    ensureDir(POSTS_DIR);
    const slug = slugify(contentId);
    const draftPath = path.join(POSTS_DIR, `${slug}.md`);

    if (fs.existsSync(draftPath)) {
      throw new Error(`draft already exists at ${draftPath} — choose a different contentId/slug`);
    }

    let fileContent: string;
    if (html.trim().startsWith('---')) {
      fileContent = html;
    } else {
      const today = new Date().toISOString().slice(0, 10);
      const frontmatter = [
        '---',
        `title: "${contentId.replace(/[-_]/g, ' ').trim()}"`,
        `slug: ${slug}`,
        `date: ${today}`,
        `excerpt: ""`,
        `meta_description: ""`,
        `image: ""`,
        `primary_keyword: ""`,
        `secondary_keywords: []`,
        `post_type: local_discovery`,
        `target_audience: ""`,
        `published: false`,
        '---',
        '',
        html,
      ].join('\n');
      fileContent = frontmatter;
    }

    fs.writeFileSync(draftPath, fileContent, 'utf8');
    // targetPath is the caller's intended eventual site URL — recorded for
    // traceability, but never used to choose the write location: RawSushi's
    // own content-intake mechanism always resolves the path from the slug.
    fs.writeFileSync(`${draftPath}.meta.json`, JSON.stringify({ contentId, intendedTargetPath: targetPath, createdAt: new Date().toISOString() }, null, 2), 'utf8');

    return { draftPath };
  }

  /**
   * "Build" for RawSushi could mean running `node build.mjs` (Astro), but
   * that compiles the WHOLE site and is unrelated to validating one new
   * content-intake markdown file. Per the task's own guidance ("prefer
   * using the site's own existing draft mechanism ... since that's the
   * site's actual existing content-intake mechanism"), this validates the
   * draft's frontmatter against the schema documented in
   * public/content/posts/README.md instead of invoking the Astro build.
   */
  async createPreview(draftPath: string): Promise<{ previewPath: string; buildLog: string; success: boolean }> {
    if (!fs.existsSync(draftPath)) {
      return { previewPath: '', buildLog: `FAIL: draft not found at ${draftPath}`, success: false };
    }

    const raw = fs.readFileSync(draftPath, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const log: string[] = [];
    let ok = true;

    if (!match) {
      log.push('FAIL: no YAML frontmatter block found (expected --- ... --- at top of file, per public/content/posts/README.md)');
      ok = false;
    } else {
      let fm: Record<string, unknown>;
      try {
        fm = parseYaml(match[1]) as Record<string, unknown>;
      } catch (e) {
        return { previewPath: draftPath, buildLog: `FAIL: frontmatter is not valid YAML: ${(e as Error).message}`, success: false };
      }

      const missing = REQUIRED_FRONTMATTER_FIELDS.filter(f => fm[f] === undefined || fm[f] === null || fm[f] === '');
      if (missing.length) {
        ok = false;
        log.push(`FAIL: missing/empty required frontmatter fields: ${missing.join(', ')}`);
      }
      if (typeof fm.post_type === 'string' && !VALID_POST_TYPES.includes(fm.post_type)) {
        ok = false;
        log.push(`FAIL: post_type "${fm.post_type}" is not one of: ${VALID_POST_TYPES.join(', ')}`);
      }
      if (fm.published !== false) {
        ok = false;
        log.push(`FAIL: draft frontmatter must have published: false until an approved publish flow flips it — got ${JSON.stringify(fm.published)}`);
      }
      if (typeof fm.meta_description === 'string' && fm.meta_description.length > 0 && (fm.meta_description.length < 100 || fm.meta_description.length > 170)) {
        log.push(`WARN: meta_description is ${fm.meta_description.length} chars (README recommends ~120-160)`);
      }
      if (ok) log.push('PASS: frontmatter matches public/content/posts/README.md schema');
    }

    ensureDir(PREVIEW_DIR);
    const previewPath = path.join(PREVIEW_DIR, path.basename(draftPath));
    fs.copyFileSync(draftPath, previewPath);

    return { previewPath, buildLog: log.join('\n'), success: ok };
  }

  async createSnapshot(targetPath: string): Promise<{ snapshotId: string; backupPath: string }> {
    return createFileSnapshot(this.brandId, RAWSUSHI_ROOT, targetPath);
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
    if (!state?.draft_path || state.preview_build_success !== 1) {
      return { success: false, error: 'publish requires a successful pipeline preview with draft_path bound to this snapshot' };
    }
    const draftPath = resolveWithinRoot(RAWSUSHI_ROOT, state.draft_path);
    if (!fs.existsSync(draftPath)) return { success: false, error: `draft_path missing on disk: ${draftPath}` };
    if (isGitTracked(RAWSUSHI_ROOT, draftPath)) {
      return { success: false, error: `refusing to publish git-tracked Raw Sushi post: ${draftPath}` };
    }

    const raw = fs.readFileSync(draftPath, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return { success: false, error: 'Raw Sushi draft missing YAML frontmatter' };
    const fm = parseYaml(match[1]) as Record<string, unknown>;
    if (fm.published !== false) {
      return { success: false, error: `Raw Sushi draft must be published:false before publish; got ${JSON.stringify(fm.published)}` };
    }
    if (/modesto/i.test(raw) || /modesto/i.test(state.target_path || '')) {
      return { success: false, error: 'refusing Raw Sushi publish because draft/target contains Modesto' };
    }

    const backupDir = path.join(RAWSUSHI_ROOT, '.seo-preview', 'backups');
    ensureDir(backupDir);
    const backupPath = path.join(backupDir, `${path.basename(draftPath)}.${Date.now()}.publish.bak`);
    fs.copyFileSync(draftPath, backupPath);
    const published = raw.replace(/^(\s*published:\s*)false(\s*)$/m, '$1true$2');
    if (published === raw) return { success: false, error: 'failed to flip published:false to true in Raw Sushi frontmatter' };
    fs.writeFileSync(draftPath, published, 'utf8');

    const digest = sha256File(draftPath);
    getSeoDb().prepare('UPDATE seo_publish_snapshots SET content_id = ? WHERE id = ? AND content_id IS NULL')
      .run(state.content_id, snapshotId);
    markSnapshotLive(snapshotId, {
      publishedPath: draftPath,
      sourcePath: draftPath,
      sourceBackupPath: backupPath,
      sha256: digest,
      note: 'Flipped approved Raw Sushi markdown draft to published:true only; no git push, deploy, wrangler, or redirect config change was run.',
    });
    getSeoDb().prepare('UPDATE seo_content_items SET status = ?, published_at = ?, updated_at = ? WHERE id = ?')
      .run('SOURCE_PUBLISHED_PENDING_DEPLOY', nowIso(), nowIso(), state.content_id);
    recordEvidence({
      brand_id: this.brandId,
      category: 'production_deploy',
      summary: `Published Raw Sushi approved source content for snapshot ${snapshotId}`,
      payload: { snapshotId, content_id: state.content_id, publishedPath: draftPath, backupPath, sha256: digest, deploy_ran: false },
    });

    return { success: true };
  }

  async rollback(snapshotId: string): Promise<{ success: boolean; error?: string }> {
    const result = restorePublishedSnapshot(RAWSUSHI_ROOT, snapshotId);
    recordEvidence({
      brand_id: this.brandId,
      category: 'rollback',
      summary: result.success ? `Rolled back snapshot ${snapshotId}` : `Rollback failed for snapshot ${snapshotId}: ${result.error}`,
      payload: { snapshotId, result },
    });
    return result;
  }
}

export const rawSushiPublisher: WebsitePublisher = new RawSushiPublisher();

// isGitTracked is re-exported here only for the route layer's convenience
// when validating targetPath before calling createDraft; not required by
// the WebsitePublisher interface itself.
export { isGitTracked as rawSushiIsGitTracked };
