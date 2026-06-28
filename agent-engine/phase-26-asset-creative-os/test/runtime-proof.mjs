// Phase 26 - Asset & Creative Production OS runtime proof.
// type=copy requires: price + offer. No disallowed words.
import { mkdtempSync } from 'fs'; import { tmpdir } from 'os'; import { join } from 'path'; import assert from 'assert';
import AssetCreativeOS from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase26-'));
const ac = new AssetCreativeOS({ dataDir: DATA_DIR });
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS ' + n); } catch (e) { failed++; console.error('  FAIL ' + n + ' -- ' + e.message); } };
console.log('PHASE 26 -- ASSET AND CREATIVE PRODUCTION OS :: RUNTIME PROOF\n');

const r = ac.handleMissingAsset({ brand: 'raw_sushi', platform: 'doordash', type: 'copy', requestId: 'REQ-001', copyText: 'Fresh sushi delivered! Price from .99. Special offer: 10% off your first order.' });

check('creative brief created', () => assert.ok(r.brief.id && r.brief.status === 'open'));
check('brief routed (copy type -> general-creative lane)', () => assert.ok(r.routedTo.lane === 'general-creative'));
check('asset drafted', () => assert.ok(r.asset.id && r.asset.status === 'draft'));
check('asset compliant (price + offer present)', () => assert.ok(r.compliance.compliant === true));
check('asset compliance CLEAR', () => assert.strictEqual(r.compliance.level, 'CLEAR'));

const bad = ac.compliance.review({ text: 'This is the BEST EVER guaranteed cure for your hunger!', type: 'copy' });
check('disallowed words detected', () => assert.ok(bad.compliant === false));
check('MAJOR compliance flag for disallowed text', () => assert.strictEqual(bad.level, 'MAJOR'));

check('approval request created', () => assert.ok(r.approval.id && r.approval.status === 'pending_approval'));
const dash = ac.dashboard();
check('dashboard status WATCH (pending approvals present)', () => assert.strictEqual(dash.status, 'WATCH'));
check('dashboard counts pending approvals', () => assert.ok(dash.pendingApprovals >= 1));
check('dashboard counts briefs', () => assert.ok(dash.briefs >= 1));

const ac2 = new AssetCreativeOS({ dataDir: DATA_DIR });
check('briefs persisted across restart', () => assert.ok(ac2.briefs.all().length >= 1));
check('approvals persisted across restart', () => assert.ok(ac2.approvals.all().length >= 1));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);