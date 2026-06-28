/**
 * Phase 2D — Production Approval Gateway Runtime Test
 *
 * Proves the human-in-the-loop approval gate that unblocks Phase 2C's pending
 * production actions (e.g. BO-005 campaign-launch). Every safety guarantee is
 * exercised. No real production system is touched.
 */
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase2d', 'production-approval');
const gate = await import(pathToFileURL(join(dist, 'index.js')).href);

let passed = 0, failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

console.log('\n=== TEST 1: Bootstrap ===');
const boot = gate.runProductionApprovalBootstrap();
assert('Objective id present', boot.objectiveId === 'OBJ-PHASE-2D');
assert('Request created with APR- prefix', boot.request.id.startsWith('APR-'));
assert('Request starts pending', boot.request.status === 'pending');
assert('Request mode is PRODUCTION_WRITE', boot.request.mode === 'PRODUCTION_WRITE');

console.log('\n=== TEST 2: Approvers & Authorization ===');
const approvers = gate.getApprovers();
assert('2 approvers defined', approvers.length === 2);
assert('CEO authorized for doordash', gate.isAuthorizedApprover('ceo', 'doordash') === true);
assert('CFO NOT authorized for doordash (out of scope)', gate.isAuthorizedApprover('cfo', 'doordash') === false);
assert('CFO authorized for quickbooks', gate.isAuthorizedApprover('cfo', 'quickbooks') === true);
assert('Unknown approver rejected', gate.isAuthorizedApprover('intern', 'doordash') === false);

console.log('\n=== TEST 3: Full happy path (request -> grant -> verify -> ALLOWED) ===');
const req = gate.requestApproval({
  objectiveId: 'OBJ-TEST', requester: 'ops',
  targetKey: 'doordash', actionKey: 'update_menu', mode: 'PRODUCTION_WRITE',
  reason: 'Update DoorDash menu pricing', ttlSeconds: 120,
});
assert('Request pending', req.status === 'pending');
const granted = gate.grantApproval(req.id, 'ceo');
assert('Grant succeeds for authorized CEO', granted.ok === true);
assert('Grant returns a token', !!granted.token && granted.token.token.startsWith('TKN-'));
assert('Request now granted', granted.request.status === 'granted');
const v1 = gate.verifyApproval({ token: granted.token.token, targetKey: 'doordash', actionKey: 'update_menu', mode: 'PRODUCTION_WRITE' });
assert('Verify ALLOWED', v1.ok === true && v1.status === 'ALLOWED');
assert('Verify records approver', v1.approver === 'ceo');

console.log('\n=== TEST 4: Single-use token (reuse is blocked) ===');
const v2 = gate.verifyApproval({ token: granted.token.token, targetKey: 'doordash', actionKey: 'update_menu', mode: 'PRODUCTION_WRITE' });
assert('Second verify is CONSUMED (blocked)', v2.ok === false && v2.status === 'CONSUMED');

console.log('\n=== TEST 5: Unauthorized approver cannot grant ===');
const req5 = gate.requestApproval({
  objectiveId: 'OBJ-TEST', requester: 'finance',
  targetKey: 'doordash', actionKey: 'pause_campaign', mode: 'PRODUCTION_WRITE',
  reason: 'Pause campaign', ttlSeconds: 60,
});
const deniedGrant = gate.grantApproval(req5.id, 'cfo'); // cfo not authorized for doordash
assert('CFO grant rejected for doordash', deniedGrant.ok === false);
assert('Request marked denied', deniedGrant.request.status === 'denied');

console.log('\n=== TEST 6: Scope mismatch (token cannot authorize a different action) ===');
const req6 = gate.requestApproval({
  objectiveId: 'OBJ-TEST', requester: 'ops',
  targetKey: 'doordash', actionKey: 'update_menu', mode: 'PRODUCTION_WRITE',
  reason: 'Menu update', ttlSeconds: 60,
});
const g6 = gate.grantApproval(req6.id, 'ceo');
const v6 = gate.verifyApproval({ token: g6.token.token, targetKey: 'doordash', actionKey: 'delete_menu', mode: 'PRODUCTION_WRITE' });
assert('Scope mismatch blocked', v6.ok === false && v6.status === 'SCOPE_MISMATCH');

console.log('\n=== TEST 7: Revoked token is blocked ===');
const req7 = gate.requestApproval({
  objectiveId: 'OBJ-TEST', requester: 'ops',
  targetKey: 'toast', actionKey: 'refund', mode: 'FINANCIAL_ACTION',
  reason: 'Process refund', ttlSeconds: 60,
});
const g7 = gate.grantApproval(req7.id, 'ceo');
const revoked = gate.revokeToken(g7.token.token, 'ceo');
assert('Revoke succeeds', revoked === true);
const v7 = gate.verifyApproval({ token: g7.token.token, targetKey: 'toast', actionKey: 'refund', mode: 'FINANCIAL_ACTION' });
assert('Revoked token blocked', v7.ok === false && v7.status === 'REVOKED');

console.log('\n=== TEST 8: Unknown token rejected ===');
const v8 = gate.verifyApproval({ token: 'TKN-FAKE-0000', targetKey: 'doordash', actionKey: 'update_menu', mode: 'PRODUCTION_WRITE' });
assert('Unknown token UNKNOWN', v8.ok === false && v8.status === 'UNKNOWN');

console.log('\n=== TEST 9: Explicit deny path ===');
const req9 = gate.requestApproval({
  objectiveId: 'OBJ-TEST', requester: 'ops',
  targetKey: 'banking', actionKey: 'wire_transfer', mode: 'FINANCIAL_ACTION',
  reason: 'Wire transfer', ttlSeconds: 60,
});
const d9 = gate.denyApproval(req9.id, 'cfo', 'Insufficient documentation');
assert('Deny succeeds', d9.ok === true);
assert('Request denied', d9.request.status === 'denied');

console.log('\n=== TEST 10: Audit log is append-only and complete ===');
const log = gate.getAuditLog();
assert('Audit log non-empty', log.length > 0);
assert('Audit log has requested events', log.some(e => e.type === 'requested'));
assert('Audit log has granted events', log.some(e => e.type === 'granted'));
assert('Audit log has verified events', log.some(e => e.type === 'verified'));
assert('Audit log has denied events', log.some(e => e.type === 'denied'));
assert('Audit log has revoked events', log.some(e => e.type === 'revoked'));
assert('Audit events have unique ids', new Set(log.map(e => e.id)).size === log.length);

console.log('\n=== TEST 11: Dashboard ===');
const dash = gate.buildProductionApprovalDashboard();
assert('Dashboard has approvers', dash.approvers === 2);
assert('Dashboard PARTIAL', dash.status === 'PARTIAL');
assert('Dashboard records audit count', dash.auditEvents > 0);
assert('Approval-gate warning present', dash.warnings.some(w => w.includes('approval token')));

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 2D PRODUCTION APPROVAL: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('============================================================\n');
process.exit(failed === 0 ? 0 : 1);
