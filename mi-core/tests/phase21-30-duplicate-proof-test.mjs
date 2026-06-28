'use strict';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as assert from 'assert';

const __testDir = fileURLToPath(new URL('.', import.meta.url));
const AGENT_ENGINE = path.resolve(__testDir, '..', '..', 'agent-engine');
const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-dedup-'));

let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };

console.log('PHASE 21-30 DUPLICATE PROOF TEST\\n');

const wfMod = await import('file:///' + AGENT_ENGINE + '/phase-28-workflow-fabric-os/src/orchestrator.js');
const WorkflowFabric2OS = wfMod.default || wfMod.WorkflowFabric2OS;
const wf = new WorkflowFabric2OS({ dataDir: DATA_DIR });

const r1 = wf.handleTrigger({ workflowId: 'doordash-sync', name: 'DoorDash Sync', owner: 'ops', division: 'operations', trigger: 'cron:daily', outcome: 'success', durationMs: 3000, approved: true });
check('first trigger runs (no duplicate)', () => assert.ok(r1.execution !== null));

const r2 = wf.handleTrigger({ workflowId: 'doordash-sync', name: 'DoorDash Sync', owner: 'ops', division: 'operations', trigger: 'cron:daily', outcome: 'success', durationMs: 3100, approved: true });
check('second same trigger is duplicate', () => assert.strictEqual(r2.dedupResult.duplicate, true));
check('duplicate preserves only one exec', () => assert.strictEqual(r2.execution, null));

const r3 = wf.handleTrigger({ workflowId: 'doordash-sync', name: 'DoorDash Sync', owner: 'ops', division: 'operations', trigger: 'cron:weekly', outcome: 'success', durationMs: 2800, approved: true });
check('different trigger is not duplicate', () => assert.strictEqual(r3.dedupResult.duplicate, false));

const wfIntAbs = path.resolve(__testDir, '..', 'server', 'dist', 'workflow-intelligence', 'index.js');
const wfIntMod = await import('file:///' + wfIntAbs.replace(/\\/g, '/'));
const semanticRun = wfIntMod.runSemanticWorkflow;
check('semantic-workflow available', () => assert.strictEqual(typeof semanticRun, 'function'));

const result = semanticRun('Increase Raw Sushi online revenue 10%');
check('produces objective', () => assert.ok(result.objective && result.objective.length > 0));
check('produces steps', () => assert.ok(Array.isArray(result.steps) && result.steps.length > 0));
check('has duplicateCheck field', () => assert.ok('duplicatesAvoided' in result));

console.log('\\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
