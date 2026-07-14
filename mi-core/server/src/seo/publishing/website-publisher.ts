/**
 * SEO Control Center — Website Publishing Adapters (spec §25).
 *
 * PREVIEW/BUILD ONLY. Per the hard safety constraint for this task:
 *  - Never touch .github/workflows/*, wrangler.toml, wrangler.jsonc, .htaccess,
 *    _redirects in either website repo.
 *  - Never git push / git commit / wrangler deploy from this code.
 *  - Never overwrite an existing git-tracked live page file — only ever
 *    write to new untracked paths, or a site's own documented content-intake
 *    mechanism (e.g. RawSushi's public/content/posts/*.md).
 *  - publishApproved() is an honest no-op refusal for both adapters — see
 *    bakudan-publisher.ts / raw-sushi-publisher.ts for the specific reason.
 */

export interface WebsitePublisher {
  brandId: string;

  /** Writes new content to a NEW untracked path. Never overwrites an existing tracked file. */
  createDraft(contentId: string, html: string, targetPath: string): Promise<{ draftPath: string }>;

  /** Validates the draft and produces a local preview artifact. Never touches the live site. */
  createPreview(draftPath: string): Promise<{ previewPath: string; buildLog: string; success: boolean }>;

  /** Backs up the current file at targetPath (if any) before any future overwrite, and records a seo_publish_snapshots row. */
  createSnapshot(targetPath: string): Promise<{ snapshotId: string; backupPath: string }>;

  /**
   * REQUIRES an already-approved seo_publish_snapshots row (status must not
   * already be 'live'). Both concrete adapters intentionally implement this
   * as a safe, honest no-op refusal — see their inline comments.
   */
  publishApproved(snapshotId: string): Promise<{ success: boolean; error?: string }>;

  /**
   * REQUIRES an already-approved seo_publish_snapshots row. Restores from the
   * backup_path recorded on the snapshot. Only ever touches files this same
   * adapter created/backed up (never a live-deployed file it didn't back up
   * itself), and refuses outright if the resolved path is currently
   * git-tracked in the site's repo.
   */
  rollback(snapshotId: string): Promise<{ success: boolean; error?: string }>;
}
