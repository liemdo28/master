// Phase 82 runtime proof - phase-82-self-healing-projects (real domain logic)
import * as assert from 'assert';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
const DATA_DIR = mkdtempSync(join(tmpdir(), 'ph82-test-'));
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };
console.log('PHASE 82 -- SelfHealingProjectsOS :: RUNTIME PROOF');

const { SelfHealingProjectsOS } = await import(`../src/orchestrator.js`);
const { ProjectRecoveryEngine } = await import(`../src/engines.js`);

const eng = new ProjectRecoveryEngine();
check('on-track -> no action', () => assert.strictEqual(eng.decide({ status: 'on-track' }).action, 'none'));
check('slack + owner + non-critical -> auto-reschedule', () => assert.strictEqual(eng.decide({ status: 'at-risk', slackDays: 3, severity: 'high', hasOwner: true }).action, 'auto-reschedule'));
check('critical -> escalate', () => assert.strictEqual(eng.decide({ status: 'blocked', slackDays: 3, severity: 'critical', hasOwner: true }).action, 'escalate'));
check('no slack -> escalate', () => assert.strictEqual(eng.decide({ status: 'overdue', slackDays: 0, severity: 'high', hasOwner: true }).action, 'escalate'));
check('no owner -> escalate', () => assert.strictEqual(eng.decide({ status: 'blocked', slackDays: 5, severity: 'high', hasOwner: false }).action, 'escalate'));
check('auto-reschedule absorbs capped slack', () => assert.strictEqual(eng.decide({ status: 'at-risk', slackDays: 10, severity: 'low', hasOwner: true }).absorbDays, 5));

const os = new SelfHealingProjectsOS({ dataDir: DATA_DIR });
const snap = os.handle({ projects: [
  { name: 'P1', status: 'at-risk', slackDays: 3, severity: 'high', hasOwner: true },
  { name: 'P2', status: 'blocked', slackDays: 0, severity: 'critical', hasOwner: true },
  { name: 'P3', status: 'on-track' },
] });
check('auto-recovered count correct', () => assert.strictEqual(snap.autoRecovered, 1));
check('escalated count correct', () => assert.strictEqual(snap.escalated, 1));
check('recovery rate over actionable', () => assert.strictEqual(snap.recoveryRate, 0.5));

const dash = os.dashboard();
check('dashboard() phase correct', () => assert.strictEqual(dash.phase, 82));
check('dashboard() has status string', () => assert.ok(typeof dash.status === 'string'));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
