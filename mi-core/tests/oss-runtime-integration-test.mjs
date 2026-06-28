/**
 * OSS Runtime Integration Test (Part A1).
 *
 * Proves the oss-runtime layer gives every phase 12–20 a real, license-gated,
 * health-probed OSS worker with a declared fallback — and writes per-phase
 * evidence. Honest by design: workers report CONFIGURED_NOT_INSTALLED because
 * no OSS server/binary is installed in this environment; the test asserts the
 * INTEGRATION LAYER is real, not that the OSS is running.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, '..', 'server');
const require = createRequire(join(SERVER, 'index.js'));
const oss = require(join(SERVER, 'dist', 'oss-runtime', 'index.js'));

let passed = 0, failed = 0;
function assert(label, cond) { if (cond) { console.log(`  PASS: ${label}`); passed++; } else { console.log(`  FAIL: ${label}`); failed++; } }

console.log('\n=== OSS Runtime Integration Test (Phase 12–20) ===');

const PHASES = [12, 13, 14, 15, 16, 17, 18, 19, 20];
const VALID_STATUS = ['INTEGRATED_RUNNING', 'CONFIGURED_NOT_INSTALLED', 'INSTALLED_UNHEALTHY', 'DISABLED'];

console.log('\n--- Every phase 12–20 has a governed OSS worker ---');
for (const p of PHASES) {
  const sel = oss.selectWorkerForPhase(p);
  assert(`phase ${p} selects a worker`, !!sel && !!sel.worker && typeof sel.worker.name === 'string');
  assert(`phase ${p} license checked + allowed`, sel.licenseAllowed === true);
  assert(`phase ${p} health status captured (${sel?.status})`, VALID_STATUS.includes(sel.status));
  assert(`phase ${p} fallback defined`, typeof sel.fallbackTo === 'string' && sel.fallbackTo.length > 0);
  const exec = sel.adapter.execute({ probe: true });
  assert(`phase ${p} adapter.execute() never blocks`, exec.ok === true);
  assert(`phase ${p} honest: ranOnOss matches health`, exec.ranOnOss === (sel.status === 'INTEGRATED_RUNNING'));
}

console.log('\n--- License policy: flagged licenses still gated + have fallback ---');
const flagged = oss.OSS_WORKERS.filter((w) => w.licenseRisk !== 'low');
assert('flagged-license workers exist (AGPL/BUSL/GPL)', flagged.length >= 1);
assert('every flagged worker still declares a fallback', flagged.every((w) => w.fallback && w.fallback.length > 0));

console.log('\n--- Evidence written per phase ---');
const evidence = oss.captureAllPhaseEvidence(PHASES);
assert('evidence produced for all 9 phases', evidence.length === 9);
let filesOk = 0;
for (const p of PHASES) {
  const path = join(SERVER, '..', 'evidence', 'oss-runtime', `phase-${p}.json`);
  if (existsSync(path)) {
    const ev = JSON.parse(readFileSync(path, 'utf8'));
    if (ev.phase === p && ev.workerId && ev.license && VALID_STATUS.includes(ev.integration) && ev.fallbackTo) filesOk++;
  }
}
assert('all 9 phase evidence files written + complete', filesOk === 9);

console.log('\n--- Honesty guard: no false "running" claim ---');
const summary = oss.ossRuntimeSummary();
assert('summary reports workers + phase coverage', summary.workers >= 9 && summary.phasesCovered.includes(12) && summary.phasesCovered.includes(20));
assert('summary does not claim OSS running when none installed', summary.running === 0 || process.env.OSS_LIVE === '1');
console.log(`    runtime: ${summary.running} running, ${summary.configuredNotInstalled} configured-not-installed, ${summary.flaggedLicenses} flagged licenses`);

console.log(`\n  RESULTS: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
