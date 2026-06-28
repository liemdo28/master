/**
 * runtime-proof.mjs — Phase 28 N8N / Workflow Fabric 2.0.
 * Scenario: same workflow triggered twice -> duplicate detected -> one execution preserved -> evidence stored.
 */
import { mkdtempSync } from 'fs'; import { tmpdir } from 'os'; import { join } from 'path'; import assert from 'assert';
import WorkflowFabric2OS from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase28-'));
const wf = new WorkflowFabric2OS({ dataDir: DATA_DIR });
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  ✅ ' + n); } catch (e) { failed++; console.error('  ❌ ' + n + ' — ' + e.message); } };
console.log('PHASE 28 — WORKFLOW FABRIC 2.0 :: RUNTIME PROOF\n');

// First trigger
const r1 = wf.handleTrigger({ workflowId: 'doordash-revenue-sync', name: 'DoorDash Revenue Sync', owner: 'ops', division: 'operations', trigger: 'schedule:daily', outcome: 'success', durationMs: 3200, approved: false });
check('first trigger registered', () => assert.ok(r1.execution !== null));
check('first trigger creates evidence', () => assert.ok(r1.evidence !== null));
check('first trigger approval requested (not pre-approved)', () => assert.ok(r1.approval !== null));

// Duplicate trigger (same workflow + same trigger within dedupe window)
const r2 = wf.handleTrigger({ workflowId: 'doordash-revenue-sync', name: 'DoorDash Revenue Sync', owner: 'ops', division: 'operations', trigger: 'schedule:daily', outcome: 'success', durationMs: 3100, approved: false });
check('duplicate detected', () => assert.strictEqual(r2.dedupResult.duplicate, true));
check('duplicate -> no second execution', () => assert.strictEqual(r2.execution, null));
check('duplicate -> no second evidence', () => assert.strictEqual(r2.evidence, null));

// Distinct trigger -> runs fine
const r3 = wf.handleTrigger({ workflowId: 'doordash-revenue-sync', name: 'DoorDash Revenue Sync', owner: 'ops', division: 'operations', trigger: 'manual:retry', outcome: 'success', durationMs: 2800, approved: true });
check('different trigger -> runs', () => assert.ok(r3.execution !== null));
check('pre-approved -> no approval requested', () => assert.strictEqual(r3.approval, null));

// Replay request (approval-gated)
const replay = wf.replay.request('doordash-revenue-sync', 'Data was stale, re-run required');
check('replay request recorded', () => assert.ok(replay.id && replay.status === 'pending_approval'));

// Dashboard
const dash = wf.dashboard();
check('dashboard counts workflows', () => assert.ok(dash.totalWorkflows >= 1));
check('dashboard counts executions', () => assert.ok(dash.totalExecutions >= 2));

// Persistence
const wf2 = new WorkflowFabric2OS({ dataDir: DATA_DIR });
check('evidence persisted across restart', () => assert.ok(wf2.evidence.all().length >= 2));
check('replay requests persisted', () => assert.ok(wf2.replay.all().length >= 1));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);