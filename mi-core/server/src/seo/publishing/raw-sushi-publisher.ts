/**
 * SEO Control Center — Raw Sushi Bistro publishing adapter (spec §25).
 *
 * A prior audit of RawSushi/RawWebsite found TWO non-identical copies of the
 * site (loose *.html at repo root vs. the actually-deployed public/
 * directory) plus two conflicting _redirects files and two conflicting
 * Wrangler configs (wrangler.toml vs wrangler.jsonc).
 *
 * This adapter avoids all of that ambiguity by using the site's OWN
 * documented, already-live content-intake mechanism instead of inventing a
 * new one: public/content/posts/{slug}.md, markdown + YAML frontmatter, as
 * documented in public/content/posts/README.md. New posts are written with
 * `published: false` and are never wired into the live build path — this
 * adapter never runs `wrangler deploy` or touches wrangler.toml/.jsonc or
 * _redirects.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import type { WebsitePublisher } from './website-publisher';
import { submitSeoAction } from '../seo-approval-bridge';
import { recordEvidence } from '../seo-evidence';
import { disabledReason, isSeoProductionPublishEnabled, isSeoWebsiteWriteEnabled } from '../seo-write-guards';
import {
  createFileSnapshot,
  restoreFromSnapshot,
  isGitTracked,
  markSnapshotFailed,
  PRODUCTION_DEPLOY_REFUSAL,
} from './publish-safety';

const RAWSUSHI_ROOT = process.env.RAWSUSHI_ROOT || 'D:/Project/Master/RawSushi/RawWebsite';
const POSTS_DIR = path.join(RAWSUSHI_ROOT, 'public', 'content', 'posts');
const PREVIEW_DIR = path.join(RAWSUSHI_ROOT, '.seo-preview', 'posts');

const REQUIRED_FRONTMATTER_FIELDS = ['title', 'slug', 'date', 'excerpt', 'meta_description', 'primary_keyword', 'post_type', 'published'];
const VALID_POST_TYPES = ['viral_attention', 'conversion_order', 'local_discovery', 'tourist_discovery', 'menu_highlight'];

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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
        : PRODUCTION_DEPLOY_REFUSAL;
    submitSeoAction({
      category: 'production_deploy',
      brand_id: this.brandId,
      description: `Publish attempt for Raw Sushi snapshot ${snapshotId}`,
      target: 'production',
      rollback_plan: `Restore from backup recorded on snapshot ${snapshotId} via rollback()`,
      idempotency_key: `raw-sushi-publish-${snapshotId}`,
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
    const result = restoreFromSnapshot(RAWSUSHI_ROOT, snapshotId);
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
