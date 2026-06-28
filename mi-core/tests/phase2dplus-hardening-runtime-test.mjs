/**
 * Phase 2D+ Hardening Runtime Test.
 *
 * Proves the three capabilities Phase 2D deferred:
 *   1. Session Vault       — credentials encrypted at rest, exposed only as handles.
 *   2. MFA Handoff         — grant requires a bound, single-use, short-lived code.
 *   3. Durable persistence — requests/tokens/audit/vault survive a restart.
 *
 * The original Phase 2D guarantees (single-use, scope-bound, audited tokens) are
 * re-proven on the hardened gateway. No production system is touched — credentials
 * surface only as masked references.
 */
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, '..', 'server', 'dist', 'phase2d', 'production-approval');
const { SessionVault } = await import(pathToFileURL(join(dist, 'session-vault.js')).href);
const { MfaHandoff } = await import(pathToFileURL(join(dist, 'mfa-handoff.js')).href);
const { HardenedApprovalGateway } = await import(pathToFileURL(join(dist, 'hardened-gateway.js')).href);

let passed = 0, failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase2dplus-'));
const SECRET = 'test-vault-secret-1234567890';

console.log('\n=== Phase 2D+ Hardening Runtime Test ===');
console.log(`  data dir: ${DATA_DIR}`);

// ── 1. Session Vault ──────────────────────────────────────────────────────────
console.log('\n--- 1. Session Vault (encrypted at rest) ---');
const vault = new SessionVault({ dataDir: DATA_DIR, secret: SECRET });
const PLAINTEXT = 'doordash_api_token_SUPERSECRET';
const meta = vault.put({ label: 'DoorDash API token', targetKey: 'doordash', secret: PLAINTEXT });
assert('put() returns an opaque handle', typeof meta.handle === 'string' && meta.handle.startsWith('VH-'));
assert('put() does NOT echo the plaintext', JSON.stringify(meta).indexOf(PLAINTEXT) === -1);
assert('list() exposes metadata only, never ciphertext/secret', vault.list().every(m => !('ciphertext' in m) && !('secret' in m) && JSON.stringify(m).indexOf(PLAINTEXT) === -1));
const redeemed = vault.redeem(meta.handle, 'doordash');
assert('redeem() with correct scope returns the plaintext', redeemed.ok === true && redeemed.secret === PLAINTEXT);
const wrongScope = vault.redeem(meta.handle, 'quickbooks');
assert('redeem() with wrong scope is refused', wrongScope.ok === false);
assert('use count is tracked', vault.list().find(m => m.handle === meta.handle).useCount === 1);
vault.revoke(meta.handle);
assert('revoked handle cannot be redeemed', vault.redeem(meta.handle, 'doordash').ok === false);

console.log('\n--- 1b. Vault is actually encrypted on disk ---');
const { readFileSync } = await import('fs');
const onDisk = readFileSync(join(DATA_DIR, 'session-vault.json'), 'utf8');
assert('plaintext secret is NOT present in the vault file on disk', onDisk.indexOf(PLAINTEXT) === -1);
assert('vault file contains ciphertext + authTag fields', onDisk.indexOf('ciphertext') !== -1 && onDisk.indexOf('authTag') !== -1);

console.log('\n--- 1c. Wrong key cannot decrypt ---');
// Fresh isolated vault so we have a live (non-revoked) entry to attack.
const keyTestDir = mkdtempSync(join(tmpdir(), 'mi-vaultkey-'));
const rightVault = new SessionVault({ dataDir: keyTestDir, secret: SECRET });
const kh = rightVault.put({ label: 'k', targetKey: 'doordash', secret: 'KEYTEST_PLAINTEXT' });
const wrongKeyVault = new SessionVault({ dataDir: keyTestDir, secret: 'a-totally-different-secret' });
let wrongKeyFailed = false;
try { wrongKeyFailed = wrongKeyVault.redeem(kh.handle, 'doordash').secret !== 'KEYTEST_PLAINTEXT'; }
catch { wrongKeyFailed = true; } // GCM auth-tag mismatch throws — exactly the desired outcome
assert('a different secret cannot recover the plaintext (GCM auth fails)', wrongKeyFailed === true);
assert('the correct secret still recovers it', rightVault.redeem(kh.handle, 'doordash').secret === 'KEYTEST_PLAINTEXT');

// ── 2. MFA Handoff ────────────────────────────────────────────────────────────
console.log('\n--- 2. MFA Handoff (bound, single-use challenge) ---');
const mfa = new MfaHandoff({ dataDir: DATA_DIR });
const { challenge, code } = mfa.issue({ requestId: 'REQ-1', approverId: 'ceo' });
assert('issue() returns a 6-digit code', /^[0-9]{6}$/.test(code));
assert('issue() never stores the plaintext code', JSON.stringify(challenge).indexOf(code) === -1);
assert('wrong code is rejected', mfa.verify({ challengeId: challenge.id, requestId: 'REQ-1', approverId: 'ceo', code: '000000' }).status === 'CODE_MISMATCH');
assert('code bound to another request is rejected', mfa.verify({ challengeId: challenge.id, requestId: 'REQ-OTHER', approverId: 'ceo', code }).status === 'BOUND_MISMATCH');
assert('correct, bound code VERIFIES', mfa.verify({ challengeId: challenge.id, requestId: 'REQ-1', approverId: 'ceo', code }).status === 'VERIFIED');
assert('a verified challenge is single-use (CONSUMED on reuse)', mfa.verify({ challengeId: challenge.id, requestId: 'REQ-1', approverId: 'ceo', code }).status === 'CONSUMED');

// ── 3. Hardened gateway: full MFA-gated, vault-backed flow ────────────────────
console.log('\n--- 3. Hardened gateway full flow ---');
const gw = new HardenedApprovalGateway({ dataDir: DATA_DIR, vaultSecret: SECRET });
const handle = gw.vault.put({ label: 'GBP token', targetKey: 'google_business_profile', secret: 'gbp_oauth_REALTOKEN' });
const req = gw.requestApproval({
  objectiveId: 'OBJ-2DPLUS', requester: 'marketing',
  targetKey: 'google_business_profile', actionKey: 'publish_campaign', mode: 'PRODUCTION_WRITE',
  reason: 'Publish Q3 campaign', ttlSeconds: 300, vaultHandle: handle.handle,
});
assert('request starts pending', req.status === 'pending');

const init = gw.initiateGrant(req.id, 'ceo');
assert('authorized approver triggers MFA challenge', init.ok === true && typeof init.code === 'string');
const reqAfterInit = gw.getRequest(req.id);
assert('request moves to mfa_pending', reqAfterInit.status === 'mfa_pending');

const badGrant = gw.completeGrant({ requestId: req.id, approverId: 'ceo', code: '999999' });
assert('completeGrant with wrong MFA code fails (no token)', badGrant.ok === false && badGrant.token === null);

const grant = gw.completeGrant({ requestId: req.id, approverId: 'ceo', code: init.code });
assert('completeGrant with correct MFA mints a token', grant.ok === true && grant.token.token.startsWith('HTKN-'));

const v1 = gw.verify({ token: grant.token.token, targetKey: 'google_business_profile', actionKey: 'publish_campaign', mode: 'PRODUCTION_WRITE' });
assert('verify ALLOWED', v1.ok === true && v1.status === 'ALLOWED');
assert('verify returns a MASKED credential reference (no plaintext)', typeof v1.credentialRef === 'string' && v1.credentialRef.startsWith('vault:') && v1.credentialRef.indexOf('REALTOKEN') === -1);
const v2 = gw.verify({ token: grant.token.token, targetKey: 'google_business_profile', actionKey: 'publish_campaign', mode: 'PRODUCTION_WRITE' });
assert('token is single-use (CONSUMED on reuse)', v2.ok === false && v2.status === 'CONSUMED');

console.log('\n--- 3b. Scope, authorization, revoke ---');
const reqScope = gw.requestApproval({ objectiveId: 'OBJ', requester: 'ops', targetKey: 'doordash', actionKey: 'update_menu', mode: 'PRODUCTION_WRITE', reason: 'menu', ttlSeconds: 120 });
const initScope = gw.initiateGrant(reqScope.id, 'ceo');
const grantScope = gw.completeGrant({ requestId: reqScope.id, approverId: 'ceo', code: initScope.code });
const vScope = gw.verify({ token: grantScope.token.token, targetKey: 'doordash', actionKey: 'DELETE_STORE', mode: 'PRODUCTION_WRITE' });
assert('scope mismatch (different action) is blocked', vScope.ok === false && vScope.status === 'SCOPE_MISMATCH');

const reqUnauth = gw.requestApproval({ objectiveId: 'OBJ', requester: 'ops', targetKey: 'doordash', actionKey: 'x', mode: 'PRODUCTION_WRITE', reason: 'r', ttlSeconds: 60 });
const initUnauth = gw.initiateGrant(reqUnauth.id, 'cfo'); // CFO not authorized for doordash
assert('unauthorized approver cannot initiate grant', initUnauth.ok === false);

const reqRev = gw.requestApproval({ objectiveId: 'OBJ', requester: 'ops', targetKey: 'doordash', actionKey: 'y', mode: 'PRODUCTION_WRITE', reason: 'r', ttlSeconds: 60 });
const initRev = gw.initiateGrant(reqRev.id, 'ceo');
const grantRev = gw.completeGrant({ requestId: reqRev.id, approverId: 'ceo', code: initRev.code });
gw.revokeToken(grantRev.token.token, 'ceo');
assert('revoked token is blocked at verify', gw.verify({ token: grantRev.token.token, targetKey: 'doordash', actionKey: 'y', mode: 'PRODUCTION_WRITE' }).status === 'REVOKED');

console.log('\n--- 4. Durable persistence across restart ---');
const auditBefore = gw.getAuditLog().length;
const dash = gw.dashboard();
assert('dashboard reports durable=true', dash.durable === true);
assert('dashboard reports audit events', dash.auditEvents === auditBefore && auditBefore > 0);
const gw2 = new HardenedApprovalGateway({ dataDir: DATA_DIR, vaultSecret: SECRET });
assert('requests persisted across restart', gw2.getRequest(req.id) !== null && gw2.getRequest(req.id).status === 'consumed');
assert('audit log persisted across restart', gw2.getAuditLog().length === auditBefore);
assert('vault entries persisted across restart', gw2.vault.list().length >= 1);

console.log(`\n  RESULTS: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
