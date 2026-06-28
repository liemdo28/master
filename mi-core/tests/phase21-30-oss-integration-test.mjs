'use strict';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as assert from 'assert';

const __testDir = fileURLToPath(new URL('.', import.meta.url));
const abs = path.resolve(__testDir, '..', 'server', 'dist', 'oss-runtime', 'index.js');
const ossMod = await import('file:///' + abs.replace(/\\/g, '/').replace(/\\/g, '/'));

let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };

console.log('PHASE 21-30 OSS INTEGRATION TEST\n');

const ossRuntimeSummary = ossMod.ossRuntimeSummary || (ossMod.default && ossMod.default.ossRuntimeSummary);
const selectWorkerForPhase = ossMod.selectWorkerForPhase || (ossMod.default && ossMod.default.selectWorkerForPhase);

check('ossRuntimeSummary available', () => assert.strictEqual(typeof ossRuntimeSummary, 'function'));
check('selectWorkerForPhase available', () => assert.strictEqual(typeof selectWorkerForPhase, 'function'));

const summary = ossRuntimeSummary();
check('oss-runtime summary has worker counts', () => assert.ok(summary && typeof summary.workers === 'number'));
check('oss-runtime has workers >= 19', () => assert.ok(typeof summary.workers === 'number' && summary.workers >= 19));

const PHASE_OSS = {21:'Chatwoot',22:'PostHog',23:'n8n',24:'DuckDB',25:'OrangeHRM',26:'ComfyUI',27:'Keycloak',28:'n8n',29:'OpenMetadata',30:'Grafana'};

for (const [phase, ossName] of Object.entries(PHASE_OSS)) {
  const worker = selectWorkerForPhase(Number(phase));
  const status = worker && worker.status;
  console.log('  Phase ' + phase + ': ' + (worker ? worker.worker.name : 'NONE') + ' [' + status + ']');
  check('Phase ' + phase + ' selects worker', () => assert.ok(worker !== null));
  check('Phase ' + phase + ' worker has name', () => assert.ok(worker && worker.worker.name && worker.worker.name.length > 0));
  check('Phase ' + phase + ' health status', () => assert.ok(worker && (worker.status === 'CONFIGURED_NOT_INSTALLED' || worker.status === 'INTEGRATED_RUNNING')));
  check('Phase ' + phase + ' has fallback', () => assert.ok(worker && worker.fallbackTo && worker.fallbackTo.length > 0));
}

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
