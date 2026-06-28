/**
 * runtime-proof.mjs — Phase 14 Human-in-the-Loop Autonomy Runtime Proof.
 *
 * Exercises the full HITL flow:
 *   - trivial action → auto-applied (no human)
 *   - low action → auto unless a recent rejection exists
 *   - moderate action → enqueued for approval → approved → applied
 *   - severe action → enqueued + rollback plan required → approved with plan
 *   - severe action → rejected → rejection learning + suppression; next similar
 *     low action now requires approval (learned behavior)
 *   - full audit trail per draft
 * Isolated temp data dir; deterministic.
 */
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';
import HITLAutonomy from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase14-'));
const opts = { dataDir: DATA_DIR };
const hitl = new HITLAutonomy(opts);

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name} — ${err.message}`);
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('  PHASE 14 — HUMAN-IN-THE-LOOP AUTONOMY :: RUNTIME PROOF');
console.log(`  data dir: ${DATA_DIR}`);
console.log('═══════════════════════════════════════════════════════════════\n');

/* CASE 1: trivial read → auto-applied -------------------------------- */
console.log('CASE 1: trivial read-only action → auto-applied');
const p1 = hitl.propose({ type: 'metrics.read', summary: 'pull GBP metrics' });
check('gate = auto', () => assert.strictEqual(p1.policy.gate, 'auto'));
check('tier = TRIVIAL', () => assert.strictEqual(p1.policy.tier, 0));
check('no inbox item (auto-applied)', () => assert.strictEqual(p1.inboxItem, null));
check('draft status applied', () => assert.strictEqual(hitl.drafts.get(p1.draft.id).status, 'applied'));
check('audit trail has drafted+gated+applied', () =>
  assert.ok(hitl.audit.forDraft(p1.draft.id).length >= 3)
);

/* CASE 2: low retry → auto unless recent rejection ------------------ */
console.log('\nCASE 2: low-risk retry → auto (no prior rejection)');
const p2 = hitl.propose({ type: 'doordash.retry', summary: 'retry the doordash pull' });
check('gate = auto', () => assert.strictEqual(p2.policy.gate, 'auto'));
check('tier = LOW', () => assert.strictEqual(p2.policy.tier, 1));

/* CASE 3: moderate write → enqueued → approved --------------------- */
console.log('\nCASE 3: moderate write → approval required → approved');
const p3 = hitl.propose({ type: 'seo.update', summary: 'update SEO meta tags' });
check('gate = approval', () => assert.strictEqual(p3.policy.gate, 'approval'));
check('tier = MODERATE', () => assert.strictEqual(p3.policy.tier, 2));
check('no rollback plan required for moderate', () => assert.strictEqual(p3.policy.requiresRollbackPlan, false));
check('inbox has a pending item', () => assert.strictEqual(hitl.pending().length >= 1, true));
const ap3 = hitl.approve(p3.inboxItem.id, { approver: 'operator', reason: 'looks good' });
check('approval decision recorded', () => assert.strictEqual(ap3.item.decision, 'approved'));
check('draft marked approved-for-execution', () =>
  assert.strictEqual(hitl.drafts.get(p3.draft.id).status, 'approved-for-execution')
);

/* CASE 4: severe publish → rollback plan required ------------------- */
console.log('\nCASE 4: severe publish → approval + rollback plan required');
const p4 = hitl.propose({ type: 'seo.publish', summary: 'publish blog post to public site' });
check('tier = SEVERE', () => assert.strictEqual(p4.policy.tier, 3));
check('rollback plan required', () => assert.strictEqual(p4.policy.requiresRollbackPlan, true));
check('a rollback plan was generated at propose time', () =>
  assert.ok(p4.rollbackPlan && p4.rollbackPlan.steps.length >= 1)
);
const ap4 = hitl.approve(p4.inboxItem.id, { approver: 'operator' });
check('severe approval also attaches a rollback plan', () =>
  assert.ok(ap4.rollbackPlan, 'expected rollback plan on severe approval')
);
check('rollback plan has >= 2 steps', () => assert.ok(ap4.rollbackPlan.steps.length >= 2));

/* CASE 5: severe refund → rejected → learned ----------------------- */
console.log('\nCASE 5: severe refund → rejected → rejection learning');
const p5 = hitl.propose({ type: 'accounting.refund', summary: 'issue customer refund payment' });
check('refund tier = SEVERE (financial mutation)', () => assert.strictEqual(p5.policy.tier, 3));
hitl.reject(p5.inboxItem.id, { approver: 'cfo', reason: 'needs manager sign-off' });
check('rejection recorded in rejection-learning', () =>
  assert.ok(hitl.rejections.recentForActionType('accounting.refund').length === 1)
);
check('rejected draft status = suppressed', () =>
  assert.strictEqual(hitl.drafts.get(p5.draft.id).status, 'suppressed')
);

/* CASE 6: learned behavior — a LOW action type with a prior rejection now gated */
console.log('\nCASE 6: learned gating — recent rejection forces approval on LOW');
// Make a low-risk action of a type we previously rejected.
const rejLow = hitl.propose({ type: 'low.retry-with-rejection', summary: 'low risk retry' });
check('low action gates to auto initially', () => assert.strictEqual(rejLow.policy.gate, 'auto'));
// Now record a rejection for this action type directly.
hitl.rejections.record({ draftId: 'seed', actionType: 'low.retry-with-rejection', tier: 1, reason: 'flaky' });
const rejLow2 = hitl.propose({ type: 'low.retry-with-rejection', summary: 'low risk retry again' });
check('after a recent rejection, LOW gates to approval', () =>
  assert.strictEqual(rejLow2.policy.gate, 'approval')
);

/* Audit trail completeness ------------------------------------------ */
console.log('\nAUDIT: trail per draft');
const trail = hitl.audit.forDraft(p5.draft.id);
check('rejected draft audit trail includes rejected event', () =>
  assert.ok(trail.some((a) => a.event === 'rejected'))
);
check('every audit row has id+timestamp+draftId', () => {
  assert.ok(hitl.audit.all().every((a) => a.id && a.timestamp && a.draftId));
});

/* Persistence ------------------------------------------------------- */
console.log('\nPERSISTENCE: re-instantiating from disk...');
const hitl2 = new HITLAutonomy(opts);
check('drafts persisted across restart', () => assert.ok(hitl2.drafts.all().length >= 6));
check('audit persisted across restart', () => assert.ok(hitl2.audit.all().length >= 6));
check('rejections persisted across restart', () => assert.ok(hitl2.rejections.all().length >= 1));

/* Result ------------------------------------------------------------ */
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULT: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════════');
process.exit(failed === 0 ? 0 : 1);
