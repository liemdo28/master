/**
 * runtime-proof.mjs — Phase 13 Multi-Agent Workforce Runtime Proof.
 *
 * Exercises: routing by capability, load accounting, peer review, escalation
 * handoff on failed review, resource-conflict resolution, and the performance
 * scorecard. Isolated temp data dir; deterministic.
 */
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';
import MultiAgentWorkforce from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase13-'));
const opts = { dataDir: DATA_DIR };
const wf = new MultiAgentWorkforce(opts);

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
console.log('  PHASE 13 — MULTI-AGENT WORKFORCE :: RUNTIME PROOF');
console.log(`  data dir: ${DATA_DIR}`);
console.log('═══════════════════════════════════════════════════════════════\n');

/* Register a team ------------------------------------------------- */
// capacity=1 on the SEO agents makes the capacity-flip deterministic: one
// dispatch fills the slot and marks the agent busy, forcing the next task to a
// different agent. This proves the load gate end-to-end.
wf.team.register({ id: 'agent-seo-1', name: 'SEO Worker', capabilities: ['seo', 'gbp'], capacity: 1 });
wf.team.register({ id: 'agent-seo-2', name: 'SEO Worker 2', capabilities: ['seo'], capacity: 1 });
wf.team.register({ id: 'agent-finance-1', name: 'Finance Worker', capabilities: ['qb', 'accounting'], capacity: 1 });
wf.team.register({ id: 'agent-reviewer', name: 'QA Reviewer', capabilities: ['review'], capacity: 5 });


check('team registry has 4 agents', () => assert.strictEqual(wf.team.all().length, 4));
check('4 agents available', () => assert.strictEqual(wf.team.available().length, 4));

/* CASE 1: routing by capability ---------------------------------- */
console.log('\nCASE 1: route an SEO task to a capable agent');
const d1 = wf.dispatch({ id: 'T-1', capabilities: ['seo'] });
check('task routed successfully', () => assert.strictEqual(d1.routed, true));
check('routed to an SEO-capable agent', () =>
  assert.ok(d1.agent.capabilities.includes('seo'), `got ${d1.agent.id}`)
);
console.log(`   -> ${d1.agent.id} (${d1.reason})`);

/* CASE 2: load accounting + capacity flip ------------------------ */
console.log('\nCASE 2: capacity accounting');
// capacity=1, so the first dispatch already fills the slot.
const loaded0 = wf.team.get(d1.agent.id);
check('the routed agent is busy at capacity 1', () =>
  assert.strictEqual(loaded0.status, 'busy', `load map: ${[...wf.team.load.entries()]}`)
);
// While d1.agent is busy, the next SEO task must route to the OTHER free agent.
const d2 = wf.dispatch({ id: 'T-2', capabilities: ['seo'] });
check('next SEO task routed to a DIFFERENT free agent', () => {
  assert.ok(d2.routed, 'expected a route');
  assert.notStrictEqual(d2.agent.id, d1.agent.id);
});
console.log(`   -> ${d2.agent.id} (${d2.reason})`);
// Now both SEO agents are busy → a 3rd SEO task cannot be routed.
const d2b = wf.dispatch({ id: 'T-2b', capabilities: ['seo'] });
check('no routable agent when all capable agents are busy', () =>
  assert.strictEqual(d2b.routed, false)
);
// Release load on d1.agent (task finished) → it becomes routable again.
wf.team.releaseLoad(d1.agent.id);
check('released agent becomes available again', () =>
  assert.strictEqual(wf.team.get(d1.agent.id).status, 'available')
);
const d2c = wf.dispatch({ id: 'T-2c', capabilities: ['seo'] });
check('after release, a task routes back to the freed agent', () => {
  assert.ok(d2c.routed);
  assert.strictEqual(d2c.agent.id, d1.agent.id);
});
console.log(`   -> ${d2c.agent.id} (${d2c.reason})`);




/* CASE 3: no-fit routing ----------------------------------------- */
console.log('\nCASE 3: no agent matches an unknown capability');
const d4 = wf.dispatch({ id: 'T-4', capabilities: ['unknown-cap'] });
check('routing returns routed=false when no fit', () => assert.strictEqual(d4.routed, false));

/* CASE 4: peer review + scorecard -------------------------------- */
console.log('\nCASE 4: peer review + performance scorecard');
const rv = wf.peerReview({
  taskId: 'T-1',
  workAgentId: 'agent-seo-1',
  reviewerAgentId: 'agent-reviewer',
  score: 0.9,
  verdict: 'pass',
  notes: 'clean work',
});
check('review recorded', () => assert.strictEqual(rv.verdict, 'pass'));
const card = wf.scorecard();
check('scorecard has an entry for agent-seo-1', () =>
  assert.ok(card.rows.find((r) => r.agentId === 'agent-seo-1'), 'missing row')
);
check('agent-seo-1 score reflects high pass', () => {
  const row = card.rows.find((r) => r.agentId === 'agent-seo-1');
  assert.ok(row.score >= 0.85, `got ${row.score}`);
});
console.log(`   scorecard: ${JSON.stringify(card.rows)}`);

/* CASE 5: escalation handoff on failed review -------------------- */
console.log('\nCASE 5: failed review -> handoff to a stronger agent');
const esc = wf.escalateAfterFail({ id: 'T-5', capabilities: ['seo'] }, 'agent-seo-2', 'agent-reviewer', 'score 0.3');
check('escalation produced a handoff record', () => assert.ok(esc.handoff, 'expected handoff'));
check('handoff moved to a different agent', () =>
  assert.notStrictEqual(esc.handoff.toAgentId, 'agent-seo-2')
);
console.log(`   -> ${esc.handoff.fromAgentId} → ${esc.handoff.toAgentId} (${esc.handoff.reason})`);

/* CASE 6: resource conflict resolution --------------------------- */
console.log('\nCASE 6: resource conflict (two agents, one credential)');
const conflict = wf.resolveResourceConflict([
  { taskId: 'T-6', agentId: 'agent-finance-1', resource: 'qb.token', priority: 5, seniority: 2 },
  { taskId: 'T-7', agentId: 'agent-seo-1', resource: 'qb.token', priority: 8, seniority: 1 },
]);
check('conflict winner chosen by priority', () =>
  assert.strictEqual(conflict.winnerAgentId, 'agent-seo-1')
);
check('conflict recorded one loser', () => assert.strictEqual(conflict.losers.length, 1));
console.log(`   winner=${conflict.winnerAgentId}, losers=${conflict.losers.length}`);

/* Persistence ----------------------------------------------------- */
console.log('\nPERSISTENCE: re-instantiating from disk...');
const wf2 = new MultiAgentWorkforce(opts);
check('team persisted across restart', () => assert.ok(wf2.team.all().length === 4, `got ${wf2.team.all().length}`));
check('reviews persisted across restart', () => assert.ok(wf2.review.all().length >= 1));

/* Result ---------------------------------------------------------- */
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULT: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════════');
process.exit(failed === 0 ? 0 : 1);
