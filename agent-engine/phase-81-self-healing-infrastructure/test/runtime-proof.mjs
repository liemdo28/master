// Phase 81 runtime proof - phase-81-self-healing-infrastructure (real domain logic)
import * as assert from 'assert';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
// Incident dashboard rolls up the full incident list, so isolate the data dir
// to keep exact-count assertions deterministic across repeated runs.
const DATA_DIR = mkdtempSync(join(tmpdir(), 'ph81-test-'));
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };
console.log('PHASE 81 -- SelfHealingInfrastructureOS :: RUNTIME PROOF');

const { SelfHealingInfrastructureOS } = await import(`../src/orchestrator.js`);
const { HealingDecisionEngine, MTTREngine } = await import(`../src/engines.js`);

const eng = new HealingDecisionEngine();
check('known remediation + low severity -> auto-heal', () => assert.strictEqual(eng.decide({ severity: 'low', knownRemediation: 'restart' }).action, 'auto-heal'));
check('auto-heal does not require approval', () => assert.strictEqual(eng.decide({ severity: 'high', knownRemediation: 'restart' }).requiresApproval, false));
check('critical always escalates', () => assert.strictEqual(eng.decide({ severity: 'critical', knownRemediation: 'restart' }).action, 'escalate'));
check('critical requires approval', () => assert.strictEqual(eng.decide({ severity: 'critical', knownRemediation: 'restart' }).requiresApproval, true));
check('no remediation -> escalate', () => assert.strictEqual(eng.decide({ severity: 'low', knownRemediation: null }).action, 'escalate'));

const mt = new MTTREngine();
check('MTTR average computed', () => assert.strictEqual(mt.rollup([{ mttrMs: 1000 }, { mttrMs: 3000 }]).avgMTTRms, 2000));

const os = new SelfHealingInfrastructureOS({ dataDir: DATA_DIR });
const r1 = os.handle({ service: 'api', severity: 'low', knownRemediation: 'restart', mttrMs: 1000 });
check('auto-heal incident is resolved', () => assert.strictEqual(r1.status, 'resolved'));
const r2 = os.handle({ service: 'db', severity: 'critical', knownRemediation: 'failover' });
check('critical incident is escalated', () => assert.strictEqual(r2.status, 'escalated'));
os.handle({ service: 'cache', severity: 'high', knownRemediation: 'flush', mttrMs: 3000 });

const dash = os.dashboard();
check('dashboard() phase correct', () => assert.strictEqual(dash.phase, 81));
check('auto-heal count correct', () => assert.strictEqual(dash.autoHealed, 2));
check('escalated count correct', () => assert.strictEqual(dash.escalated, 1));
check('auto-heal rate correct', () => assert.strictEqual(dash.autoHealRate, 0.67));
check('avg MTTR correct', () => assert.strictEqual(dash.avgMTTRms, 2000));
check('dashboard() has status string', () => assert.ok(typeof dash.status === 'string'));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
