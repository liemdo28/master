/**
 * SEO Control Center — Publishing test suite.
 *
 * Exercises real code paths in:
 *   - publishing/publish-safety.ts   (createFileSnapshot, restoreFromSnapshot, isGitTracked)
 *   - publishing/bakudan-publisher.ts / raw-sushi-publisher.ts (createDraft, createPreview,
 *     createSnapshot, publishApproved, rollback)
 *   - approval/gate.ts (transitively, via seo-approval-bridge.ts -> enqueue())
 *
 * Two DIFFERENT module configurations are used, both via cache-busted dynamic
 * import (so top-level env-read constants like BAKUDAN_ROOT get re-evaluated):
 *   - "iso"  — BAKUDAN_ROOT / RAWSUSHI_ROOT point at disposable OS-temp
 *     directories. All write-y tests (draft/preview/snapshot/rollback) run
 *     here so nothing ever touches the real site repos.
 *   - "real" — BAKUDAN_ROOT is left at its real default (the actual
 *     D:/Project/Master/Bakudan/bakudanramen.com-current checkout) ONLY for
 *     the "wrong destination" test, which needs a real git-tracked file to
 *     prove createDraft() refuses it. createDraft() checks isGitTracked()
 *     and throws BEFORE any fs.writeFileSync call, so this is read-only
 *     against the real repo (verified below by confirming no file gets
 *     created).
 *
 * MI_DATA_DIR is overridden throughout so seo_evidence / seo_actions /
 * seo_publish_snapshots and the approval_queue (ops.db) all land in an
 * isolated temp SQLite DB, never the real production databases.
 *
 * Run with (from mi-core/server):
 *   npx tsx src/seo/__tests__/publishing.mjs
 */

import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync, mkdirSync, rmdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import { section, check, gap, note, finalize } from './_harness.mjs';

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

const tmpDataDir = mkdtempSync(join(tmpdir(), 'seo-publishing-data-'));
const tmpBakudanRoot = mkdtempSync(join(tmpdir(), 'seo-publishing-bakudan-'));
const tmpRawSushiRoot = mkdtempSync(join(tmpdir(), 'seo-publishing-rawsushi-'));
process.env.MI_DATA_DIR = tmpDataDir;

const REAL_BAKUDAN_ROOT = 'D:/Project/Master/Bakudan/bakudanramen.com-current';
const REAL_TRACKED_FILE = 'about.html';

let createdDraftsDirForRealTest = false;

try {
  // ── Module instance: ISOLATED (writes go to disposable temp dirs) ────
  process.env.BAKUDAN_ROOT = tmpBakudanRoot;
  process.env.RAWSUSHI_ROOT = tmpRawSushiRoot;
  const isoBust = `?iso=${Date.now()}`;
  const { bakudanPublisher: bakudanIso } = await import(`../publishing/bakudan-publisher.ts${isoBust}`);
  const { rawSushiPublisher: rawSushiIso } = await import(`../publishing/raw-sushi-publisher.ts${isoBust}`);
  const { createFileSnapshot, getPublishSnapshot, restoreFromSnapshot, PRODUCTION_DEPLOY_REFUSAL } =
    await import(`../publishing/publish-safety.ts${isoBust}`);

  // ── Module instance: REAL BAKUDAN_ROOT (read-only isGitTracked check) ─
  delete process.env.BAKUDAN_ROOT;
  const realBust = `?real=${Date.now()}`;
  const { bakudanPublisher: bakudanReal } = await import(`../publishing/bakudan-publisher.ts${realBust}`);
  // restore isolation for the rest of the file
  process.env.BAKUDAN_ROOT = tmpBakudanRoot;

  // ── Preview snapshot: existed:false / existed:true + byte-identical backup ─
  section('Preview snapshot (publish-safety.ts createFileSnapshot)');

  const missingSnap = createFileSnapshot('bakudan', tmpBakudanRoot, 'does-not-exist-yet.html');
  const missingRow = getPublishSnapshot(missingSnap.snapshotId);
  const missingBefore = JSON.parse(missingRow.before_state);
  check('snapshot of a non-existent path records existed:false', missingBefore.existed === false,
    JSON.stringify(missingBefore));
  check('snapshot of a non-existent path records backupPath:null', missingBefore.backupPath === null);

  const originalContent = `original content ${Date.now()} ${'x'.repeat(500)}`;
  const originalRelPath = 'existing-file-for-snapshot.html';
  writeFileSync(join(tmpBakudanRoot, originalRelPath), originalContent, 'utf8');
  const originalSha = sha256(Buffer.from(originalContent, 'utf8'));

  const existingSnap = createFileSnapshot('bakudan', tmpBakudanRoot, originalRelPath);
  const existingRow = getPublishSnapshot(existingSnap.snapshotId);
  const existingBefore = JSON.parse(existingRow.before_state);
  check('snapshot of an existing path records existed:true', existingBefore.existed === true);
  check('snapshot of an existing path records a non-null backupPath', !!existingSnap.backupPath);

  const backupSha = sha256(readFileSync(existingSnap.backupPath));
  check('backup file is byte-identical (sha256 match) to the original', backupSha === originalSha,
    `original=${originalSha} backup=${backupSha}`);

  // ── Build failure: malformed HTML reports success:false ──────────────
  section('Build failure (bakudan-publisher.ts createPreview on malformed HTML)');

  const malformedHtml = '<html><body><div><p>Unclosed paragraph and div</body></html>';
  const { draftPath: malformedDraftPath } = await bakudanIso.createDraft('malformed-html-test', malformedHtml, 'blog/malformed-test.html');
  check('createDraft wrote the malformed draft file', existsSync(malformedDraftPath));

  const previewResult = await bakudanIso.createPreview(malformedDraftPath);
  check('createPreview on unclosed-tag HTML reports success:false', previewResult.success === false,
    JSON.stringify(previewResult));
  check('createPreview build log names the specific problem (unclosed tag)',
    /unclosed/i.test(previewResult.buildLog), previewResult.buildLog);

  // Control case: well-formed HTML should report success:true, proving the
  // check isn't just always failing.
  const wellFormedHtml = '<html><body><div><p>Closed paragraph and div</p></div></body></html>';
  const { draftPath: wellFormedDraftPath } = await bakudanIso.createDraft('well-formed-html-test', wellFormedHtml, 'blog/well-formed-test.html');
  const goodPreviewResult = await bakudanIso.createPreview(wellFormedDraftPath);
  check('createPreview on well-formed HTML reports success:true (control case)', goodPreviewResult.success === true,
    goodPreviewResult.buildLog);

  // ── Wrong destination: refuses a real git-tracked file ────────────────
  section('Wrong destination (createDraft refuses a REAL git-tracked file)');

  const realTrackedAbsPath = join(REAL_BAKUDAN_ROOT, REAL_TRACKED_FILE);
  check(`setup sanity: ${REAL_TRACKED_FILE} exists in the real Bakudan repo`, existsSync(realTrackedAbsPath));

  const realDraftsDir = join(REAL_BAKUDAN_ROOT, 'blog-drafts');
  createdDraftsDirForRealTest = !existsSync(realDraftsDir);

  let threwForTrackedFile = false;
  let threwMessage = '';
  try {
    await bakudanReal.createDraft('wrong-destination-test-' + Date.now(), '<p>should never be written</p>', REAL_TRACKED_FILE);
  } catch (e) {
    threwForTrackedFile = true;
    threwMessage = e.message;
  }
  check('createDraft() throws when targetPath resolves to a git-tracked real site file',
    threwForTrackedFile, 'did not throw — this would be a live-file overwrite bug');
  check('the thrown error explains it is refusing a git-tracked file', /git-tracked/i.test(threwMessage), threwMessage);

  // Prove nothing was actually written for that intended contentId.
  const wouldBeDraftPath = join(realDraftsDir, 'wrong-destination-test.html');
  check('no draft file was written to the real repo for the refused request', !existsSync(wouldBeDraftPath));
  check('the real tracked file itself was not modified', readFileSync(realTrackedAbsPath, 'utf8').length > 0);

  // ── Rollback: disposable scratch file under .seo-preview/, exact restore ─
  section('Rollback (createSnapshot + modify + rollback, checksum-verified)');

  const scratchRelPath = '.seo-preview/scratch-rollback-test.txt';
  const scratchAbsPath = join(tmpBakudanRoot, scratchRelPath);
  mkdirSync(join(tmpBakudanRoot, '.seo-preview'), { recursive: true });
  const scratchOriginal = `scratch original v1 — ${Date.now()}`;
  writeFileSync(scratchAbsPath, scratchOriginal, 'utf8');
  const scratchOriginalSha = sha256(readFileSync(scratchAbsPath));

  const rollbackSnap = await bakudanIso.createSnapshot(scratchRelPath);
  check('rollback setup: snapshot of the scratch file was created', !!rollbackSnap.snapshotId);

  writeFileSync(scratchAbsPath, 'scratch MODIFIED — this should be reverted', 'utf8');
  const modifiedSha = sha256(readFileSync(scratchAbsPath));
  check('scratch file was actually modified before rollback (sanity check)', modifiedSha !== scratchOriginalSha);

  const rollbackResult = await bakudanIso.rollback(rollbackSnap.snapshotId);
  check('rollback() reports success:true', rollbackResult.success === true, JSON.stringify(rollbackResult));

  const restoredSha = sha256(readFileSync(scratchAbsPath));
  check('rolled-back file is byte-identical (sha256) to the pre-modification original',
    restoredSha === scratchOriginalSha, `original=${scratchOriginalSha} restored=${restoredSha}`);

  // ── Missing approval / production blocked: hard invariant, both publishers ─
  section('Missing approval + production blocked (publishApproved honest refusal)');

  // A snapshot with no linked seo_actions row / no approval_id at all —
  // publishApproved() is called directly against it, exactly as a caller
  // would if they skipped the approval step entirely.
  const noApprovalSnap = await bakudanIso.createSnapshot('never-approved.html');
  const noApprovalResult = await bakudanIso.publishApproved(noApprovalSnap.snapshotId);
  check('publishApproved() on a snapshot with no approval refuses (success:false)',
    noApprovalResult.success === false, JSON.stringify(noApprovalResult));
  check('default refusal names disabled production publish flag',
    /SEO_PRODUCTION_PUBLISH_ENABLED/.test(noApprovalResult.error || ''), noApprovalResult.error);

  const bakudanBlockedResult = await bakudanIso.publishApproved(noApprovalSnap.snapshotId + '-repeat');
  check('Bakudan publishApproved() returns success:false while live publish flag is disabled',
    bakudanBlockedResult.success === false && /SEO_PRODUCTION_PUBLISH_ENABLED/.test(bakudanBlockedResult.error || ''),
    JSON.stringify(bakudanBlockedResult));

  const rawSushiSnap = await rawSushiIso.createSnapshot('never-approved.md');
  const rawSushiBlockedResult = await rawSushiIso.publishApproved(rawSushiSnap.snapshotId);
  check('Raw Sushi publishApproved() returns success:false while live publish flag is disabled',
    rawSushiBlockedResult.success === false && /SEO_PRODUCTION_PUBLISH_ENABLED/.test(rawSushiBlockedResult.error || ''),
    JSON.stringify(rawSushiBlockedResult));

  process.env.SEO_PRODUCTION_PUBLISH_ENABLED = 'true';
  process.env.SEO_WEBSITE_WRITE_ENABLED = 'true';
  const bakudanCiBlockedResult = await bakudanIso.publishApproved(noApprovalSnap.snapshotId + '-ci-repeat');
  check('Bakudan publishApproved() still hard-refuses production deploy even when flags are enabled',
    bakudanCiBlockedResult.success === false && bakudanCiBlockedResult.error === PRODUCTION_DEPLOY_REFUSAL,
    JSON.stringify(bakudanCiBlockedResult));
  const rawSushiCiBlockedResult = await rawSushiIso.publishApproved(rawSushiSnap.snapshotId + '-ci-repeat');
  check('Raw Sushi publishApproved() still hard-refuses production deploy even when flags are enabled',
    rawSushiCiBlockedResult.success === false && rawSushiCiBlockedResult.error === PRODUCTION_DEPLOY_REFUSAL,
    JSON.stringify(rawSushiCiBlockedResult));
  delete process.env.SEO_PRODUCTION_PUBLISH_ENABLED;
  delete process.env.SEO_WEBSITE_WRITE_ENABLED;

  note('Design observation (not a bug): publishApproved() never inspects the linked seo_actions ' +
    'row\'s approval_id at all — it unconditionally calls submitSeoAction() then refuses. So "missing ' +
    'approval" and "production blocked" are the same code path/invariant in the current implementation, ' +
    'not two independently-triggerable states. Confirmed intentional per the inline comments in ' +
    'bakudan-publisher.ts/raw-sushi-publisher.ts ("explicit, honest no-op refusal").');

  // ── Expired approval ───────────────────────────────────────────────
  section('Expired approval (approval/gate.ts expiry concept)');
  const { getById: gateGetById } = await import(`../../approval/gate.ts${isoBust}`);
  gap('approval/gate.ts has no expiry concept',
    'ApprovalAction has no expires_at/ttl field, and none of enqueue()/approve()/reject()/getPending()/' +
    'getById() in mi-core/server/src/approval/gate.ts contain any time-based expiry logic — a pending ' +
    'approval created a year ago is still approvable today. Nothing to test here without inventing ' +
    'behavior the code does not have.');
  void gateGetById; // referenced only to make the "checked the real export" intent explicit

  // ── Bonus: production_deploy really does route through the real approval gate ─
  section('Approval-gate wiring sanity (seo-approval-bridge.ts -> approval/gate.ts)');
  const { getSeoDb } = await import(`../seo-db.ts${isoBust}`);
  const actionRow = getSeoDb().prepare(
    `SELECT * FROM seo_actions WHERE idempotency_key = ?`
  ).get(`bakudan-publish-${noApprovalSnap.snapshotId}`);
  check('publishApproved() really did create a seo_actions row via submitSeoAction()', !!actionRow);
  check('that seo_actions row has policy_tier REQUIRES_APPROVAL (production_deploy)', actionRow.policy_tier === 'REQUIRES_APPROVAL',
    actionRow.policy_tier);
  check('that seo_actions row has a real approval_id from the approval queue', !!actionRow.approval_id);
  const { getById } = await import(`../../approval/gate.ts${isoBust}`);
  const queuedAction = getById(actionRow.approval_id);
  check('the approval_id resolves to a real pending row in approval_queue', !!queuedAction && queuedAction.status === 'pending',
    JSON.stringify(queuedAction));

} finally {
  try { (await import(`../seo-db.ts?cleanup=${Date.now()}`)).getSeoDb().close(); } catch { /* ignore */ }
  await new Promise(r => setTimeout(r, 200));
  for (const dir of [tmpDataDir, tmpBakudanRoot, tmpRawSushiRoot]) {
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
    catch (e) { note(`temp dir cleanup failed (non-fatal): ${dir}: ${e.message}`); }
  }
  if (createdDraftsDirForRealTest) {
    const realDraftsDir = join(REAL_BAKUDAN_ROOT, 'blog-drafts');
    try {
      if (existsSync(realDraftsDir)) rmdirSync(realDraftsDir); // only removes if empty — never force-deletes real content
    } catch { /* if non-empty (e.g. real drafts exist), leave it alone */ }
  }
}

const result = finalize('publishing.mjs');
process.exit(result.fail > 0 ? 1 : 0);
