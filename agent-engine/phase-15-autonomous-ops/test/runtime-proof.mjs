/**
 * runtime-proof.mjs — Phase 15 Safe Autonomy Runtime Proof.
 *
 * Covers: happy-path execution, kill-switch halt, non-whitelisted block,
 * guardrail-fail block (maintenance window), and failure→rollback path.
 *
 * The business-hours guard is overridden so the run is deterministic
 * regardless of the wall-clock time the test executes at.
 */
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';
import AutonomousOps from '../src/orchestrator.js';
import { GuardrailEngine } from '../src/engines.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase15-'));

// Deterministic guards: no wall-clock dependency.
const deterministicGuards = new GuardrailEngine({
  dataDir: DATA_DIR,
  guards: [
    { id: 'not-in-maintenance', check: (ctx) => ctx.maintenance !== true },
    { id: 'below-rate-limit', check: (ctx) => (ctx.callsInLastMinute || 0) < (ctx.maxCallsPerMinute || 60) },
  ],
});

const ops = new AutonomousOps({ dataDir: DATA_DIR, guardrails: deterministicGuards });

// Whitelist low/trivial signatures Mi may run autonomously.
ops.registry.register({ signature: 'doordash.retry', maxTier: 1, description: 'retry a flaky pull' });
ops.registry.register({ signature: 'metrics.read', maxTier: 0, description: 'read-only metrics pull' });

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

// A counter so we can assert the run handler actually fired.
let runCount = 0;

console.log('═══════════════════════════════════════════════════════════════');
console.log('  PHASE 15 — SAFE AUTONOMY :: RUNTIME PROOF');
console.log(`  data dir: ${DATA_DIR}`);
console.log('═══════════════════════════════════════════════════════════════\n');

/* CASE 1: happy path ------------------------------------------------ */
console.log('CASE 1: whitelisted + guardrails pass → executed');
const r1 = await ops.execute({
  signature: 'doordash.retry',
  tier: 1,
  ctx: { maintenance: false, callsInLastMinute: 1 },
  run: () => { runCount++; },
});
check('executed = true', () => assert.strictEqual(r1.executed, true));
check('run handler fired exactly once', () => assert.strictEqual(runCount, 1));
check('autonomy log recorded an executed event', () =>
  assert.ok(ops.log.all().some((e) => e.event === 'executed'))
);

/* CASE 2: kill switch halt ----------------------------------------- */
console.log('\nCASE 2: kill switch tripped → all actions blocked');
ops.tripKillSwitch('incident: runaway refund loop');
check('kill switch reports tripped', () => assert.strictEqual(ops.killSwitch.isTripped(), true));
const r2 = await ops.execute({
  signature: 'doordash.retry',
  tier: 1,
  ctx: {},
  run: () => { runCount++; },
});
check('blocked by kill switch', () => assert.strictEqual(r2.executed, false));
check('reason = kill-switch-tripped', () => assert.strictEqual(r2.reason, 'kill-switch-tripped'));
check('run handler did NOT fire during kill', () => assert.strictEqual(runCount, 1));
ops.clearKillSwitch();
check('kill switch cleared', () => assert.strictEqual(ops.killSwitch.isTripped(), false));

/* CASE 3: not whitelisted ----------------------------------------- */
console.log('\nCASE 3: non-whitelisted action → blocked');
const r3 = await ops.execute({
  signature: 'seo.publish', // not in the registry
  tier: 3,
  ctx: {},
  run: () => { runCount++; },
});
check('blocked because not whitelisted', () => assert.strictEqual(r3.executed, false));
check('reason = not-whitelisted', () => assert.strictEqual(r3.reason, 'not-whitelisted'));

/* CASE 4: guardrail fail (maintenance) ---------------------------- */
console.log('\nCASE 4: guardrail fail (maintenance window) → blocked');
const r4 = await ops.execute({
  signature: 'doordash.retry',
  tier: 1,
  ctx: { maintenance: true }, // trips the not-in-maintenance guard
  run: () => { runCount++; },
});
check('blocked by guardrail', () => assert.strictEqual(r4.executed, false));
check('reason = guardrail-failed', () => assert.strictEqual(r4.reason, 'guardrail-failed'));
check('guard result lists the failing guard', () =>
  assert.ok(r4.guardResult.failures.includes('not-in-maintenance'))
);
check('run handler did NOT fire during guardrail fail', () => assert.strictEqual(runCount, 1));

/* CASE 5: tier above whitelist cap → blocked ---------------------- */
console.log('\nCASE 5: tier above registry maxTier → blocked');
const r5 = await ops.execute({
  signature: 'metrics.read', // maxTier 0
  tier: 2, // exceeds the whitelist cap
  ctx: {},
  run: () => { runCount++; },
});
check('blocked (tier exceeds whitelist cap)', () => assert.strictEqual(r5.executed, false));

/* CASE 6: failure → rollback -------------------------------------- */
console.log('\nCASE 6: run throws → rollback engine invoked and verified');
let rolledBack = false;
let verified = false;
const rollbackPlan = { id: 'PLAN-1', steps: [{ no: 1, step: 'restore snapshot', expect: 'restored' }] };
const r6 = await ops.execute({
  signature: 'doordash.retry',
  tier: 1,
  ctx: { maintenance: false },
  run: () => { throw new Error('upstream 500'); },
  rollbackPlan,
  onRollback: () => { rolledBack = true; },
  verify: () => { verified = true; return true; },
});
check('execution reported not executed', () => assert.strictEqual(r6.executed, false));
check('reason = run-threw', () => assert.strictEqual(r6.reason, 'run-threw'));
check('rollback handler was invoked', () => assert.strictEqual(rolledBack, true));
check('verifier was invoked', () => assert.strictEqual(verified, true));
check('rollback result status = restored', () => assert.strictEqual(r6.rollbackResult.status, 'restored'));
check('autonomy log recorded a rolled-back event', () =>
  assert.ok(ops.log.all().some((e) => e.event === 'rolled-back'))
);

/* Autonomy log completeness --------------------------------------- */
console.log('\nAUTONOMY LOG:');
check('log has multiple entries', () => assert.ok(ops.log.count() >= 5));
check('every log row has id+timestamp+event', () =>
  assert.ok(ops.log.all().every((e) => e.id && e.timestamp && e.event))
);

/* Persistence ------------------------------------------------------ */
console.log('\nPERSISTENCE: re-instantiating from disk...');
const ops2 = new AutonomousOps({
  dataDir: DATA_DIR,
  guardrails: deterministicGuards,
});
check('autonomy log persisted across restart', () => assert.ok(ops2.log.all().length >= 5));
check('registry persisted across restart', () => assert.ok(ops2.registry.all().length >= 2));
check('kill switch persisted as cleared across restart', () =>
  assert.strictEqual(ops2.killSwitch.isTripped(), false)
);

/* Result ---------------------------------------------------------- */
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULT: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════════');
process.exit(failed === 0 ? 0 : 1);
