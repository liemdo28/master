/**
 * Phase 1 - Engineering Division Runtime Test
 * Run:
 *   cd D:\Project\Master\mi-core
 *   .\node_modules\.bin\tsc.cmd -p server\tsconfig.phase1.json
 *   node tests\phase1-engineering-runtime-test.mjs
 */

import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'engineering');
const COORD_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'coordination');

if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
if (existsSync(COORD_DATA_DIR)) rmSync(COORD_DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase1', 'engineering-division');
const moduleUrl = (f) => pathToFileURL(join(dist, f)).href;

const index = await import(moduleUrl('index.js'));

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

console.log('\n=== TEST 1: Model Registry ===');
const registry = index.getModelRegistry();
assert('MODEL_REGISTRY_OPERATIONAL', index.MODEL_REGISTRY_STATUS === 'MODEL_REGISTRY_OPERATIONAL');
assert('Six providers registered in model registry', registry.length === 6);
assert('Qwen tracks TypeScript', registry.find((m) => m.provider === 'qwen').languages.includes('typescript'));

console.log('\n=== TEST 2: Classifier ===');
const classification = index.classifyEngineeringTask('Fix dashboard approval workflow bug');
console.log(JSON.stringify(classification, null, 2));
assert('domain dashboard', classification.domain === 'dashboard');
assert('language php', classification.language === 'php');
assert('framework laravel', classification.framework === 'laravel');
assert('complexity medium', classification.complexity === 'medium');

console.log('\n=== TEST 3: Router ===');
const route = index.routeModel(classification, 'Fix dashboard approval workflow bug');
console.log(JSON.stringify(route, null, 2));
assert('Laravel routes to Claude', route.selected_model === 'claude');
assert('confidence >= 90', route.confidence >= 90);

console.log('\n=== TEST 4: Queue + Executive Coordination Registration ===');
const task = index.runEngineeringIntake('Fix Dashboard Approval Bug');
assert('engineering task created', task.task_id === 'ET-001');
assert('objective linked', task.objective_id === 'OBJ-001');
assert('owner engineering division', task.owner === 'engineering-division');
assert('model selected automatically', task.model === 'claude');
assert('approval required for approval workflow', task.approval.required === true);

console.log('\n=== TEST 5: Provider Layer Truth Gate ===');
const certified = index.runEngineeringCertificationFlow('Fix Dashboard Approval Bug');
console.log(JSON.stringify({
  task_id: certified.task_id,
  status: certified.status,
  provider: certified.providerResult?.provider,
  providerStatus: certified.providerResult?.status,
  reviewScore: certified.review?.score,
  testsExecuted: certified.tests?.executed,
  prDraftStatus: certified.prDraft?.status,
  pr: certified.PR,
}, null, 2));
assert('provider dispatch attempted', certified.providerResult !== null);
assert('missing live executor does not fake execution', certified.providerResult.status === 'human-required');
assert('review rejects missing code output', certified.review.decision === 'REJECT');
assert('tests are not faked', certified.tests.executed === false);
assert('PR is not faked', certified.PR === null && certified.prDraft.status === 'BLOCKED_NO_REAL_PR');
assert('task fails truthfully instead of PR_READY', certified.status === 'FAILED');

console.log('\n=== TEST 6: Dashboard + Scorecard ===');
const dashboard = index.buildEngineeringDashboard();
const scorecard = index.modelScorecard();
console.log(JSON.stringify(dashboard, null, 2));
console.log('MODEL_SCORECARD');
console.log(JSON.stringify(scorecard, null, 2));
assert('dashboard shows active/failure queue', dashboard.queueStatus.FAILED === 1);
assert('dashboard reports Claude ownership', dashboard.assignedModels.claude === 2);
assert('scorecard generated', scorecard.length === 6);

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 1 ENGINEERING DIVISION: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'ENGINEERING_DIVISION_PARTIAL' : 'ENGINEERING_DIVISION_BLOCKED'));
console.log('============================================================\n');

process.exit(failed === 0 ? 0 : 1);
