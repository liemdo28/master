/**
 * runtime-proof.mjs — Phase 12 Runtime Proof.
 *
 * Executes the 5 directive cases from the architecture spec against the REAL
 * engine and asserts each stage of the learning cycle. Uses an isolated temp
 * data dir so the proof is deterministic and never pollutes production data.
 *
 * Run: node test/runtime-proof.mjs
 */
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';
import SelfImprovingIntelligence from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase12-'));
const opts = { dataDir: DATA_DIR };
const sii = new SelfImprovingIntelligence(opts);

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
console.log('  PHASE 12 — SELF-IMPROVING INTELLIGENCE :: RUNTIME PROOF');
console.log(`  data dir: ${DATA_DIR}`);
console.log('═══════════════════════════════════════════════════════════════\n');

/* ------------------------------------------------------------------ */
/* Seed: a prior outcome + a prior learned failure (memory exists)     */
/* ------------------------------------------------------------------ */
sii.observeOutcome({
  actionId: 'A-1001',
  actionType: 'doordash.read',
  status: 'success',
  metrics: { revenue: 4200 },
});
sii.observeApproval({
  requestId: 'R-1001',
  actionType: 'seo.publish',
  decision: 'approved',
  approver: 'operator',
});

// A previously-seen & resolved failure (so later replays can match it).
sii.learn({
  actionId: 'A-2001',
  actionType: 'doordash.read',
  symptom: 'DoorDash scrape returned empty after 30s timeout',
  signal: { durationMs: 30000, rows: 0, http: 503 },
  context: { connector: 'doordash' },
});

/* ------------------------------------------------------------------ */
/* CASE 1 — DoorDash Timeout (repeat of the seeded failure)            */
/* ------------------------------------------------------------------ */
console.log('CASE 1: DoorDash Timeout');
const c1 = sii.learn({
  actionId: 'A-2002',
  actionType: 'doordash.read',
  symptom: 'DoorDash scrape returned empty after 30s timeout',
  signal: { durationMs: 30000, rows: 0, http: 503 },
});
check('failure stored to failure-memory', () => assert.ok(c1.failure.id.startsWith('FAIL_')));
check('decision replay found a prior match', () => assert.ok(c1.replay.match, 'expected a replay match'));
check('replay matchScore >= 70 (HIGH)', () => assert.ok(c1.replay.matchScore >= 70, `got ${c1.replay.matchScore}`));
check('RCA chain length >= 2', () => assert.ok(c1.rca.chain.length >= 2, `got ${c1.rca.chain.length}`));
check('RCA bucket = external_dependency', () => assert.strictEqual(c1.rca.bucket, 'external_dependency'));
check('recommendation confidence HIGH', () => assert.strictEqual(c1.recommendation.confidence, 'HIGH'));
check('recommendation actionable', () => assert.strictEqual(c1.recommendation.actionable, true));
check('playbook has >= 2 steps', () => assert.ok(c1.playbook.steps.length >= 2, `got ${c1.playbook.steps.length}`));
console.log(`   -> "${c1.recommendation.action}"\n`);

/* ------------------------------------------------------------------ */
/* CASE 2 — QB Stale Heartbeat                                         */
/* ------------------------------------------------------------------ */
console.log('CASE 2: QB Stale Heartbeat');
const c2 = sii.learn({
  actionId: 'A-2003',
  actionType: 'qb.sync',
  symptom: 'QB financial data stale for over 24h',
  signal: { lastSyncAgeHrs: 26, rows: 0 },
});
check('RCA bucket = data_freshness', () => assert.strictEqual(c2.rca.bucket, 'data_freshness'));
check('recommendation actionable', () => assert.strictEqual(c2.recommendation.actionable, true));
check('playbook = data-freshness-guard', () => assert.strictEqual(c2.playbook.name, 'data-freshness-guard'));
console.log(`   -> "${c2.recommendation.action}"\n`);

/* ------------------------------------------------------------------ */
/* CASE 3 — WhatsApp Routing                                           */
/* ------------------------------------------------------------------ */
console.log('CASE 3: WhatsApp Routing');
const c3 = sii.learn({
  actionId: 'A-2004',
  actionType: 'whatsapp.route',
  symptom: 'WhatsApp message misrouted to wrong department',
  signal: { intentConfidence: 0.41, expectedDept: 'sales', routedDept: 'support' },
});
check('RCA produced a chain', () => assert.ok(c3.rca.chain.length >= 2));
check('recommendation generated', () => assert.ok(c3.recommendation.id.startsWith('REC_')));
check('playbook generated', () => assert.ok(c3.playbook.id.startsWith('PB_')));
console.log(`   -> "${c3.recommendation.action}"\n`);

/* ------------------------------------------------------------------ */
/* CASE 4 — GBP Empty Metrics                                          */
/* ------------------------------------------------------------------ */
console.log('CASE 4: GBP Empty Metrics');
const c4 = sii.learn({
  actionId: 'A-2005',
  actionType: 'gbp.read',
  symptom: 'GBP metrics returned zero for 24h',
  signal: { metricsValue: 0, windowHrs: 24 },
});
check('RCA bucket = data_freshness', () => assert.strictEqual(c4.rca.bucket, 'data_freshness'));
check('playbook = data-freshness-guard', () => assert.strictEqual(c4.playbook.name, 'data-freshness-guard'));
console.log(`   -> "${c4.recommendation.action}"\n`);

/* ------------------------------------------------------------------ */
/* CASE 5 — SEO Traffic Drop                                           */
/* ------------------------------------------------------------------ */
console.log('CASE 5: SEO Traffic Drop');
const c5 = sii.learn({
  actionId: 'A-2006',
  actionType: 'seo.read',
  symptom: 'SEO traffic dropped 25 percent week over week',
  signal: { trafficDeltaPct: -25 },
});
check('RCA produced a chain', () => assert.ok(c5.rca.chain.length >= 2));
check('recommendation generated with evidence', () => assert.ok(c5.recommendation.evidence.root));
check('playbook generated', () => assert.ok(c5.playbook.id.startsWith('PB_')));
console.log(`   -> "${c5.recommendation.action}"\n`);

/* ------------------------------------------------------------------ */
/* Learning scorecard                                                  */
/* ------------------------------------------------------------------ */
console.log('SCORECARD:');
const card = sii.scorecard();
console.log(JSON.stringify(card, null, 2));
check('scorecard counts failuresAnalyzed >= 5', () => assert.ok(card.failuresAnalyzed >= 5, `got ${card.failuresAnalyzed}`));
check('scorecard counts playbooksGenerated >= 5', () => assert.ok(card.playbooksGenerated >= 5, `got ${card.playbooksGenerated}`));
check('scorecard has a topBucket', () => assert.ok(card.topBucket, 'topBucket missing'));
check('approvals learned persisted (>= 1)', () => assert.ok(card.approvalsLearned >= 1));
check('outcomes persisted (>= 1)', () => assert.ok(card.outcomesStored >= 1));

/* ------------------------------------------------------------------ */
/* Persistence proof: reload from disk, data survived                  */
/* ------------------------------------------------------------------ */
console.log('\nPERSISTENCE: re-instantiating from disk...');
const reloaded = new SelfImprovingIntelligence(opts);
const rcard = reloaded.scorecard();
check('data survived process restart (failures persist)', () =>
  assert.ok(rcard.failuresAnalyzed >= 5, `got ${rcard.failuresAnalyzed}`)
);
check('data survived process restart (replays persist)', () =>
  assert.ok(rcard.replaysRun >= 5, `got ${rcard.replaysRun}`)
);

/* ------------------------------------------------------------------ */
/* Result                                                              */
/* ------------------------------------------------------------------ */
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULT: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════════');
process.exit(failed === 0 ? 0 : 1);
