/**
 * PREVIEW/VERIFY ONLY — standalone harness that exercises the real
 * bakudan-publisher.ts / raw-sushi-publisher.ts against DISPOSABLE isolated
 * copies of the two real sites (set via BAKUDAN_ROOT / RAWSUSHI_ROOT env
 * vars pointing at a %TEMP% directory, never the real repos). Never calls
 * publishApproved() (that's an intentional, already-documented no-op
 * refusal and calling it would route through the real approval-gate /
 * WhatsApp-notify pipeline, which is out of scope for a read+copy+verify
 * task). Prints one JSON report to stdout.
 *
 * Usage (from mi-core/server, PowerShell/bash):
 *   BAKUDAN_ROOT=<temp>/bakudan MI_DATA_DIR=<temp>/mi-data npx tsx src/seo/publishing/__preview_verify__/run.ts bakudan
 *   RAWSUSHI_ROOT=<temp>/raw-sushi MI_DATA_DIR=<temp>/mi-data npx tsx src/seo/publishing/__preview_verify__/run.ts raw-sushi
 *
 * Not part of the production build: src/seo/** is excluded from
 * tsconfig.json, and this directory is never imported by src/index.ts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { resolveWithinRoot } from '../publish-safety';
import {
  BAKUDAN_SAMPLE_HTML, BAKUDAN_TITLE, BAKUDAN_META_DESCRIPTION,
  RAWSUSHI_SAMPLE_MD, RAWSUSHI_TITLE, RAWSUSHI_META_DESCRIPTION,
} from './fixtures';

function sha256File(p: string): string {
  return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function extractHrefs(html: string): string[] {
  const out: string[] = [];
  const re = /href="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function extractMdLinks(md: string): string[] {
  const out: string[] = [];
  const re = /\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) out.push(m[1]);
  return out;
}

async function main() {
  const site = process.argv[2];
  const report: any = { site, generatedAt: new Date().toISOString(), steps: {} };

  if (site === 'bakudan') {
    const ROOT = process.env.BAKUDAN_ROOT!;
    const { bakudanPublisher } = await import('../bakudan-publisher');
    const { isGitTracked } = await import('../publish-safety');

    // ── Step 0: resolveWithinRoot path-traversal guard (direct unit test) ──
    const traversal: any = {};
    try {
      resolveWithinRoot(ROOT, path.join('..', '..', '..', 'Windows', 'System32', 'evil.html'));
      traversal.relativeTraversal = { blocked: false, note: 'DID NOT THROW — guard failed' };
    } catch (e) {
      traversal.relativeTraversal = { blocked: true, error: (e as Error).message };
    }
    try {
      resolveWithinRoot(ROOT, 'C:\\Windows\\System32\\evil.html');
      traversal.absoluteOutsideRoot = { blocked: false, note: 'DID NOT THROW — guard failed' };
    } catch (e) {
      traversal.absoluteOutsideRoot = { blocked: true, error: (e as Error).message };
    }
    const validResolve = resolveWithinRoot(ROOT, 'index.html');
    traversal.validInRootPath = { resolved: validResolve, matchesExpected: validResolve === path.join(ROOT, 'index.html') };
    report.steps.pathTraversalGuard = traversal;

    // ── Step 1: createDraft refuses a git-tracked targetPath ──
    let refusal: any;
    try {
      await bakudanPublisher.createDraft('refusal-test', '<p>x</p>', 'index.html');
      refusal = { refused: false, note: 'DID NOT THROW — guard failed' };
    } catch (e) {
      refusal = { refused: true, error: (e as Error).message };
    }
    report.steps.createDraftRefusesTrackedTarget = refusal;

    // ── Step 2: real createDraft ──
    const draft = await bakudanPublisher.createDraft('community-ramen-night', BAKUDAN_SAMPLE_HTML, 'blog-community-ramen-night.html');
    report.steps.createDraft = { draftPath: draft.draftPath, exists: fs.existsSync(draft.draftPath) };

    // ── Step 3: createPreview ──
    const preview = await bakudanPublisher.createPreview(draft.draftPath);
    report.steps.createPreview = preview;

    // ── Step 4: inspect draft content ──
    const draftContent = fs.readFileSync(draft.draftPath, 'utf8');
    report.steps.inspectDraft = {
      containsTitle: draftContent.includes(BAKUDAN_TITLE),
      containsKeyword: draftContent.includes('tonkotsu'),
      byteLength: Buffer.byteLength(draftContent, 'utf8'),
    };

    // ── Step 5: verify links ──
    const hrefs = extractHrefs(BAKUDAN_SAMPLE_HTML).filter(h => !/^https?:\/\//.test(h) && !h.startsWith('#'));
    const linkResults = hrefs.map(h => ({ href: h, resolvedPath: path.join(ROOT, h), exists: fs.existsSync(path.join(ROOT, h)) }));
    report.steps.verifyLinks = linkResults;

    // ── Step 6: verify metadata lengths ──
    const titleMatch = draftContent.match(/<title>([^<]*)<\/title>/);
    const metaMatch = draftContent.match(/<meta name="description" content="([^"]*)"/);
    report.steps.verifyMetadata = {
      title: titleMatch?.[1] ?? null,
      titleLength: titleMatch?.[1]?.length ?? null,
      titleWithinBounds: !!titleMatch && titleMatch[1].length >= 50 && titleMatch[1].length <= 60,
      metaDescription: metaMatch?.[1] ?? null,
      metaDescriptionLength: metaMatch?.[1]?.length ?? null,
      metaDescriptionWithinBounds: !!metaMatch && metaMatch[1].length >= 120 && metaMatch[1].length <= 160,
    };

    // ── Step 7: verify JSON-LD schema ──
    const ldMatch = draftContent.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    let ldValid = false; let ldError: string | undefined; let ldParsed: unknown;
    if (ldMatch) {
      try { ldParsed = JSON.parse(ldMatch[1]); ldValid = true; } catch (e) { ldError = (e as Error).message; }
    }
    report.steps.verifySchema = { found: !!ldMatch, valid: ldValid, error: ldError, parsed: ldParsed };

    // ── Step 8: mobile rendering ──
    report.steps.verifyMobileRendering = {
      status: 'ATTEMPTED_SEPARATELY',
      note: 'This script has no browser. The orchestrating agent opens draftPath via a real browser tool at 375px width and reports the result separately (see evidence doc).',
      draftPathForBrowser: draft.draftPath,
    };

    // ── Step 9a: createSnapshot + rollback against a GIT-TRACKED file (expect refusal) ──
    const trackedTarget = 'index.html';
    const trackedAbs = path.join(ROOT, trackedTarget);
    const hashOriginalTracked = sha256File(trackedAbs);
    const snapTracked = await bakudanPublisher.createSnapshot(trackedTarget);
    const hashBackupTracked = sha256File(snapTracked.backupPath);
    const rollbackTrackedAttempt = await bakudanPublisher.rollback(snapTracked.snapshotId);
    report.steps.trackedFileGuard = {
      target: trackedTarget,
      wasGitTracked: isGitTracked(ROOT, trackedAbs),
      hashOriginal: hashOriginalTracked,
      hashBackup: hashBackupTracked,
      backupMatchesOriginal: hashOriginalTracked === hashBackupTracked,
      rollbackAttemptResult: rollbackTrackedAttempt,
      rollbackCorrectlyRefused: rollbackTrackedAttempt.success === false,
    };

    // ── Step 9b: full snapshot -> simulated overwrite -> rollback round trip on an UNTRACKED file ──
    const rtTarget = 'menu-preview-copy.html';
    const rtAbs = path.join(ROOT, rtTarget);
    fs.copyFileSync(path.join(ROOT, 'menu.html'), rtAbs); // untracked duplicate of a real page, created after the baseline git commit
    const hashBefore = sha256File(rtAbs);
    const snap2 = await bakudanPublisher.createSnapshot(rtTarget);
    const hashSnapshotBackup = sha256File(snap2.backupPath);
    const simulatedOverwrite = '<!DOCTYPE html><html><body><p>SIMULATED OVERWRITE FOR ROLLBACK TEST</p></body></html>';
    fs.writeFileSync(rtAbs, simulatedOverwrite, 'utf8');
    const hashAfterModify = sha256File(rtAbs);
    const rollbackResult = await bakudanPublisher.rollback(snap2.snapshotId);
    const hashAfterRollback = sha256File(rtAbs);
    report.steps.roundTripRollback = {
      target: rtTarget,
      wasGitTracked: isGitTracked(ROOT, rtAbs),
      note: 'No adapter method actually overwrites targetPath (publishApproved is a no-op refusal) — the "modify" step below is simulated with fs.writeFileSync to mimic what a future approved publish step would eventually do, purely so rollback() has something real to restore from.',
      hashBefore,
      hashSnapshotBackup,
      snapshotBackupMatchesBefore: hashBefore === hashSnapshotBackup,
      hashAfterModify,
      rollbackResult,
      hashAfterRollback,
      hashBeforeEqualsHashAfterRollback: hashBefore === hashAfterRollback,
      hashAfterRollbackDiffersFromModified: hashAfterRollback !== hashAfterModify,
    };

  } else if (site === 'raw-sushi') {
    const ROOT = process.env.RAWSUSHI_ROOT!;
    const { rawSushiPublisher } = await import('../raw-sushi-publisher');
    const { isGitTracked } = await import('../publish-safety');
    const { parse: parseYaml } = await import('yaml');

    // ── Step 0: resolveWithinRoot path-traversal guard ──
    const traversal: any = {};
    try {
      resolveWithinRoot(ROOT, path.join('..', '..', '..', 'Windows', 'System32', 'evil.md'));
      traversal.relativeTraversal = { blocked: false, note: 'DID NOT THROW — guard failed' };
    } catch (e) {
      traversal.relativeTraversal = { blocked: true, error: (e as Error).message };
    }
    try {
      resolveWithinRoot(ROOT, 'C:\\Windows\\System32\\evil.md');
      traversal.absoluteOutsideRoot = { blocked: false, note: 'DID NOT THROW — guard failed' };
    } catch (e) {
      traversal.absoluteOutsideRoot = { blocked: true, error: (e as Error).message };
    }
    const validResolve = resolveWithinRoot(ROOT, path.join('public', 'index.html'));
    traversal.validInRootPath = { resolved: validResolve, matchesExpected: validResolve === path.join(ROOT, 'public', 'index.html') };
    report.steps.pathTraversalGuard = traversal;

    // ── Step 1: createDraft — NOTE: raw-sushi-publisher's createDraft never
    // checks targetPath against git-tracked status (it always writes via
    // slug into public/content/posts/, targetPath is purely informational).
    // Documented here as an observed asymmetry vs. Bakudan, not a bug.
    report.steps.createDraftTargetPathTrackedCheck = {
      applicable: false,
      note: "raw-sushi-publisher.createDraft() does not check targetPath against isGitTracked at all — it always resolves the write location from contentId's slug under public/content/posts/, per the site's real content-intake mechanism. This differs from bakudan-publisher, which does check. Confirmed by reading the source, not assumed.",
    };

    const draft = await rawSushiPublisher.createDraft('omakase-night-raw-sushi-bar', RAWSUSHI_SAMPLE_MD, '/blog-posts.html?slug=omakase-night-raw-sushi-bar');
    report.steps.createDraft = { draftPath: draft.draftPath, exists: fs.existsSync(draft.draftPath) };

    // ── Step 2: createPreview ──
    const preview = await rawSushiPublisher.createPreview(draft.draftPath);
    report.steps.createPreview = preview;

    // ── Step 3: inspect draft content ──
    const draftContent = fs.readFileSync(draft.draftPath, 'utf8');
    const fmMatch = draftContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const fm = fmMatch ? (parseYaml(fmMatch[1]) as Record<string, unknown>) : null;
    report.steps.inspectDraft = {
      writtenThroughAsIs: draftContent === RAWSUSHI_SAMPLE_MD,
      frontmatterParsed: fm,
      containsKeyword: draftContent.includes('omakase'),
    };

    // ── Step 4: verify links (relative to public/, since these are site-root-absolute URLs) ──
    const links = extractMdLinks(RAWSUSHI_SAMPLE_MD).filter(h => !/^https?:\/\//.test(h));
    const linkResults = links.map(h => {
      const rel = h.startsWith('/') ? h.slice(1) : h;
      const resolvedPath = path.join(ROOT, 'public', rel);
      return { href: h, resolvedPath, exists: fs.existsSync(resolvedPath) };
    });
    report.steps.verifyLinks = linkResults;

    // ── Step 5: verify metadata lengths ──
    const title = fm?.title as string | undefined;
    const metaDescription = fm?.meta_description as string | undefined;
    report.steps.verifyMetadata = {
      title: title ?? null,
      titleLength: title?.length ?? null,
      titleWithinBounds: !!title && title.length >= 50 && title.length <= 60,
      metaDescription: metaDescription ?? null,
      metaDescriptionLength: metaDescription?.length ?? null,
      metaDescriptionWithinBounds: !!metaDescription && metaDescription.length >= 120 && metaDescription.length <= 160,
    };

    // ── Step 6: JSON-LD schema — not included in the RawSushi fixture (Bakudan's covers this check) ──
    report.steps.verifySchema = {
      applicable: false,
      note: 'No JSON-LD included in the RawSushi sample content — markdown content-intake has no place to embed a <script> tag; the site template (blog-posts.html) would be responsible for emitting Article schema at render time, which is out of scope for a content-intake-only draft. JSON-LD parsing IS exercised on the Bakudan side of this evidence run.',
    };

    // ── Step 7: mobile rendering — honestly NOT_VERIFIED ──
    report.steps.verifyMobileRendering = {
      status: 'NOT_VERIFIED',
      reason: "The draft is a Markdown+frontmatter file, not a renderable page. Per public/content/posts/README.md, posts are rendered client-side by blog-posts.html's content loader at /blog-posts.html?slug=... — exercising that requires running the real Astro dev/build pipeline against public/, which is out of scope for this isolated publish-safety verification and was not attempted. Opening the raw .md file in a browser would not reflect real rendering and would be a false pass, so this is reported honestly as not achievable within this task's scope rather than rubber-stamped.",
    };

    // ── Step 8a: createSnapshot + rollback against a GIT-TRACKED file (expect refusal) ──
    const trackedTarget = path.join('public', 'index.html');
    const trackedAbs = path.join(ROOT, trackedTarget);
    const hashOriginalTracked = sha256File(trackedAbs);
    const snapTracked = await rawSushiPublisher.createSnapshot(trackedTarget);
    const hashBackupTracked = sha256File(snapTracked.backupPath);
    const rollbackTrackedAttempt = await rawSushiPublisher.rollback(snapTracked.snapshotId);
    report.steps.trackedFileGuard = {
      target: trackedTarget,
      wasGitTracked: isGitTracked(ROOT, trackedAbs),
      hashOriginal: hashOriginalTracked,
      hashBackup: hashBackupTracked,
      backupMatchesOriginal: hashOriginalTracked === hashBackupTracked,
      rollbackAttemptResult: rollbackTrackedAttempt,
      rollbackCorrectlyRefused: rollbackTrackedAttempt.success === false,
    };

    // ── Step 8b: full snapshot -> simulated overwrite -> rollback round trip on an UNTRACKED file ──
    const rtTarget = path.join('public', 'stockton-preview-copy.html');
    const rtAbs = path.join(ROOT, rtTarget);
    fs.copyFileSync(path.join(ROOT, 'public', 'stockton.html'), rtAbs);
    const hashBefore = sha256File(rtAbs);
    const snap2 = await rawSushiPublisher.createSnapshot(rtTarget);
    const hashSnapshotBackup = sha256File(snap2.backupPath);
    const simulatedOverwrite = '<!DOCTYPE html><html><body><p>SIMULATED OVERWRITE FOR ROLLBACK TEST</p></body></html>';
    fs.writeFileSync(rtAbs, simulatedOverwrite, 'utf8');
    const hashAfterModify = sha256File(rtAbs);
    const rollbackResult = await rawSushiPublisher.rollback(snap2.snapshotId);
    const hashAfterRollback = sha256File(rtAbs);
    report.steps.roundTripRollback = {
      target: rtTarget,
      wasGitTracked: isGitTracked(ROOT, rtAbs),
      note: 'No adapter method actually overwrites targetPath (publishApproved is a no-op refusal) — the "modify" step below is simulated with fs.writeFileSync to mimic what a future approved publish step would eventually do, purely so rollback() has something real to restore from.',
      hashBefore,
      hashSnapshotBackup,
      snapshotBackupMatchesBefore: hashBefore === hashSnapshotBackup,
      hashAfterModify,
      rollbackResult,
      hashAfterRollback,
      hashBeforeEqualsHashAfterRollback: hashBefore === hashAfterRollback,
      hashAfterRollbackDiffersFromModified: hashAfterRollback !== hashAfterModify,
    };

  } else {
    console.error('usage: run.ts <bakudan|raw-sushi>');
    process.exit(2);
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
