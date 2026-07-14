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
 *  - publishApproved() only writes when production + website flags are both
 *    enabled and the caller has already passed the approval-gated route.
 *    It writes source content only; it never git pushes or deploys.
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
   * already be 'live') and enabled write flags. Implementations write only
   * safe source/draft paths and never run deploy commands.
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
