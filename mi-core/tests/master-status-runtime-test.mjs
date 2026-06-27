/**
 * Mi Company OS Master Status Runtime Test
 */

import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const dist = join(PROJECT_ROOT, 'server', 'dist', 'master-status', 'mi-company-os-master');
const master = await import(pathToFileURL(join(dist, 'index.js')).href);

let passed = 0;
let failed = 0;
function assert(label, condition) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    failed++;
  }
}

console.log('\n=== TEST 1: Master Phase Registry ===');
const phases = master.getMasterPhases();
assert('Contains Phase 0', phases.some((p) => p.phase === '0'));
assert('Contains Phase 0.5', phases.some((p) => p.phase === '0.5'));
assert('Contains Phase 0.6', phases.some((p) => p.phase === '0.6'));
assert('Contains Phase 10', phases.some((p) => p.phase === '10'));
assert('Every phase has deliverables', phases.every((p) => p.deliverables.length > 0));
assert('Every non-operational phase has blockers or next actions', phases.every((p) => p.status === 'OPERATIONAL' || p.blockers.length > 0 || p.nextActions.length > 0));

console.log('\n=== TEST 2: No Status Inflation ===');
const phase1 = phases.find((p) => p.phase === '1');
const phase1c = phases.find((p) => p.phase === '1C');
const phase2b = phases.find((p) => p.phase === '2B');
const phase3b = phases.find((p) => p.phase === '3B');
const phase4 = phases.find((p) => p.phase === '4');
const phase4a = phases.find((p) => p.phase === '4A');
const phase10 = phases.find((p) => p.phase === '10');
assert('Phase 1 remains PARTIAL by current evidence', phase1.status === 'PARTIAL');
assert('Phase 1C is PARTIAL with local Qwen/DeepSeek adapter proof', phase1c.status === 'PARTIAL');
assert('Phase 2B is OPERATIONAL with local live operator proof', phase2b.status === 'OPERATIONAL');
assert('Phase 3B remains PARTIAL while QB source is degraded', phase3b.status === 'PARTIAL');
assert('Phase 4 remains PARTIAL while marketing connectors/publishing are not certified', phase4.status === 'PARTIAL');
assert('Phase 4A remains PARTIAL while live marketing metrics/publishing are not certified', phase4a.status === 'PARTIAL');
assert('Phase 10 is PARTIAL with local operational loop proof', phase10.status === 'PARTIAL');

console.log('\n=== TEST 3: Dashboard ===');
const dashboard = master.buildMasterStatusDashboard();
console.log(JSON.stringify({
  summary: dashboard.summary,
  nextBuildOrder: dashboard.nextBuildOrder,
  finalStatus: dashboard.finalStatus,
}, null, 2));
assert('Dashboard has all phases', dashboard.phases.length === phases.length);
assert('Next build order starts with 1C', dashboard.nextBuildOrder[0] === '1C');
assert('Final status remains partial until all phases are operational', dashboard.finalStatus === 'MI_COMPANY_OS_PARTIAL');

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  MI COMPANY OS MASTER STATUS: ' + (failed === 0 ? dashboard.finalStatus : 'MI_COMPANY_OS_BLOCKED'));
console.log('============================================================\n');

process.exit(failed === 0 ? 0 : 1);
