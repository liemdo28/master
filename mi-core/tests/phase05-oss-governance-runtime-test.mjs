/**
 * Phase 0.5 - Open Source Governance Runtime Test
 */

import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const OSS_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'open-source-governance');
const COORD_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'coordination');

if (existsSync(OSS_DATA_DIR)) rmSync(OSS_DATA_DIR, { recursive: true, force: true });
if (existsSync(COORD_DATA_DIR)) rmSync(COORD_DATA_DIR, { recursive: true, force: true });
mkdirSync(OSS_DATA_DIR, { recursive: true });

const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase05', 'open-source-governance');
const moduleUrl = (file) => pathToFileURL(join(dist, file)).href;
const oss = await import(moduleUrl('index.js'));

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

console.log('\n=== TEST 1: Bootstrap Through Executive Coordination ===');
const boot = oss.runOpenSourceGovernanceBootstrap();
assert('Objective created', boot.objective.id === 'OBJ-001');
assert('Task created through Executive Coordination', boot.task.id === 'ENG-001');
assert('OSS_REGISTRY_OPERATIONAL', boot.statuses.registry === 'OSS_REGISTRY_OPERATIONAL');
assert('OSS_SCORECARD_OPERATIONAL', boot.statuses.scorecard === 'OSS_SCORECARD_OPERATIONAL');
assert('OSS_LIFECYCLE_ENGINE_OPERATIONAL', boot.statuses.lifecycle === 'OSS_LIFECYCLE_ENGINE_OPERATIONAL');
assert('OSS_DASHBOARD_OPERATIONAL', boot.statuses.dashboard === 'OSS_DASHBOARD_OPERATIONAL');

console.log('\n=== TEST 2: OSS Registry ===');
const projects = oss.getOssProjects();
console.log(`  projects: ${projects.length}`);
assert('All current candidates registered', projects.length === 27);
assert('Required fields present', projects.every((p) => p.project_id && p.name && p.category && p.github && p.owner_division && p.status && typeof p.roi === 'number' && p.maintenance_cost && p.license && p.risk));
assert('No fake license audit', projects.every((p) => p.license === 'UNVERIFIED'));

console.log('\n=== TEST 3: Scorecard ===');
const scorecard = oss.buildOssScorecard();
console.log(JSON.stringify(scorecard.slice(0, 5), null, 2));
assert('Scorecard covers registry', scorecard.length === projects.length);
assert('Scores are bounded', scorecard.every((s) => s.score >= 0 && s.score <= 100));
assert('Unverified licenses stay in audit/watch path', scorecard.every((s) => s.recommendation !== 'PILOT' && s.recommendation !== 'ADOPT'));

console.log('\n=== TEST 4: Lifecycle Evidence Gates ===');
const missingEvidence = oss.advanceOssLifecycle('OSS-playwright');
assert('Cannot advance to Audit without audit evidence', missingEvidence.advanced === false);
const auditAdvance = oss.advanceOssLifecycle('OSS-playwright', { type: 'audit', value: 'Local governance audit placeholder recorded by runtime test.' });
assert('Can advance to Audit with audit evidence', auditAdvance.advanced === true && auditAdvance.status === 'Audit');
const wrongEvidence = oss.advanceOssLifecycle('OSS-playwright', { type: 'audit', value: 'Wrong evidence for ROI.' });
assert('Cannot advance to ROI with wrong evidence type', wrongEvidence.advanced === false);

console.log('\n=== TEST 5: Dashboard ===');
const dashboard = oss.buildOssDashboard();
console.log(JSON.stringify(dashboard, null, 2));
assert('Dashboard total matches registry', dashboard.totalProjects === projects.length);
assert('Engineering category count', dashboard.byCategory.Engineering === 6);
assert('Operator category count', dashboard.byCategory.Operator === 5);
assert('Dashboard tracks risks', Object.values(dashboard.riskSummary).reduce((a, b) => a + b, 0) === projects.length);

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 0.5 OPEN SOURCE GOVERNANCE: ' + (failed === 0 ? 'OPERATIONAL' : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'OPERATIONAL' : 'BLOCKED'));
console.log('============================================================\n');

process.exit(failed === 0 ? 0 : 1);
