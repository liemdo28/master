/**
 * Google read-only mode guard certification.
 *
 * OAuth authorization may request a shared historical scope bundle, but it
 * must not enable Google writes. Every mutating Google path must reject unless
 * GOOGLE_CONNECTOR_WRITE_ENABLED is explicitly true.
 */

import { section, check, finalize } from './_harness.mjs';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const tmpDataDir = mkdtempSync(join(tmpdir(), 'seo-google-readonly-data-'));
process.env.MI_DATA_DIR = tmpDataDir;
process.env.GLOBAL_DIR = tmpDataDir;
process.env.MI_CORE_ROOT = join(process.cwd(), '..');

const bust = `?googleReadOnly=${Date.now()}`;
const googleAuth = await import(`../../visibility/connectors/google/google-auth.ts${bust}`);
const googleExecutor = await import(`../../actions/google-executor.ts${bust}`);
const gmailAdapter = await import(`../../actions/gmail-action-adapter.ts${bust}`);
const driveAdapter = await import(`../../actions/drive-action-adapter.ts${bust}`);
const gbpPosts = await import(`../local/gbp-posts.ts${bust}`);
const { getSeoDb, nowIso } = await import(`../seo-db.ts${bust}`);

section('Google connector write flag defaults');
delete process.env.GOOGLE_CONNECTOR_WRITE_ENABLED;
check('GOOGLE_CONNECTOR_WRITE_ENABLED absent is false', googleAuth.isGoogleConnectorWriteEnabled() === false);
process.env.GOOGLE_CONNECTOR_WRITE_ENABLED = 'false';
check('GOOGLE_CONNECTOR_WRITE_ENABLED=false is false', googleAuth.isGoogleConnectorWriteEnabled() === false);
process.env.GOOGLE_CONNECTOR_WRITE_ENABLED = 'true';
check('GOOGLE_CONNECTOR_WRITE_ENABLED=true is true', googleAuth.isGoogleConnectorWriteEnabled() === true);

section('OAuth does not enable writes');
delete process.env.GOOGLE_CONNECTOR_WRITE_ENABLED;
process.env.GOOGLE_CLIENT_ID = 'unit-test-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'unit-test-client-value';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:4001/api/auth/google/callback';
const authUrl = googleAuth.getAuthUrl();
check('OAuth URL can be generated without enabling writes', typeof authUrl === 'string' && authUrl.includes('accounts.google.com'));
check('OAuth URL generation leaves writes disabled', googleAuth.isGoogleConnectorWriteEnabled() === false);

section('Mutating Google actions reject in read-only mode');
const emailPayload = { to: 'nobody@example.com', subject: 'test', body: 'test' };
check('Gmail send rejects with google_write_disabled',
  (await googleExecutor.executeGmailSend(emailPayload)).error === googleAuth.GOOGLE_WRITE_DISABLED_ERROR);
check('Gmail draft rejects with google_write_disabled',
  (await googleExecutor.executeGmailDraft(emailPayload)).error === googleAuth.GOOGLE_WRITE_DISABLED_ERROR);
check('Calendar create rejects with google_write_disabled',
  (await googleExecutor.executeCalendarCreate({ title: 'test', start_datetime: '2026-01-01T10:00:00Z', end_datetime: '2026-01-01T11:00:00Z' })).error === googleAuth.GOOGLE_WRITE_DISABLED_ERROR);
check('Calendar update rejects with google_write_disabled',
  (await googleExecutor.executeCalendarUpdate('event-1', { title: 'updated' })).error === googleAuth.GOOGLE_WRITE_DISABLED_ERROR);
check('Drive upload rejects with google_write_disabled',
  (await googleExecutor.executeDriveUpload({ local_path: 'missing.txt' })).error === googleAuth.GOOGLE_WRITE_DISABLED_ERROR);
check('Drive share rejects with google_write_disabled',
  (await googleExecutor.executeDriveShare('file-1', 'nobody@example.com')).error === googleAuth.GOOGLE_WRITE_DISABLED_ERROR);

let gmailDraftError = '';
try { await gmailAdapter.draftEmail(emailPayload); } catch (e) { gmailDraftError = e.message; }
check('Gmail adapter draft rejects with google_write_disabled', gmailDraftError === googleAuth.GOOGLE_WRITE_DISABLED_ERROR);

let gmailSendError = '';
try { await gmailAdapter.sendEmail('draft-1'); } catch (e) { gmailSendError = e.message; }
check('Gmail adapter send rejects with google_write_disabled', gmailSendError === googleAuth.GOOGLE_WRITE_DISABLED_ERROR);

let driveUploadError = '';
try { await driveAdapter.uploadToDrive({ name: 'test.txt', content: 'test', mimeType: 'text/plain' }); } catch (e) { driveUploadError = e.message; }
check('Drive adapter upload rejects with google_write_disabled', driveUploadError === googleAuth.GOOGLE_WRITE_DISABLED_ERROR);

section('GBP post publishing rejects in read-only mode');
const db = getSeoDb();
const actionId = `gbp-readonly-${Date.now()}`;
db.prepare(`INSERT INTO seo_actions (id, created_at, brand_id, category, policy_tier, status, description, target)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(actionId, nowIso(), 'bakudan', 'gbp_post_publish', 'REQUIRES_APPROVAL', 'pending', 'read-only guard test', 'stone_oak');
delete process.env.SEO_GBP_WRITE_ENABLED;
delete process.env.GOOGLE_CONNECTOR_WRITE_ENABLED;
check('GBP post publish rejects with google_write_disabled',
  (await gbpPosts.publishApprovedGbpPost(actionId)).error === googleAuth.GOOGLE_WRITE_DISABLED_ERROR);

try {
  finalize('google-read-only-guards.mjs');
} finally {
  try { rmSync(tmpDataDir, { recursive: true, force: true }); } catch { /* temp cleanup is non-fatal */ }
}
