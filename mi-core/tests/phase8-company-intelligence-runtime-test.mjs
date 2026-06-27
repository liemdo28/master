/**
 * Phase 8 - Company Intelligence Runtime Test
 */
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const COORD_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'coordination');
if (existsSync(COORD_DATA_DIR)) rmSync(COORD_DATA_DIR, { recursive: true, force: true });
mkdirSync(COORD_DATA_DIR, { recursive: true });

const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase8', 'company-intelligence');
const intel = await import(pathToFileURL(join(dist, 'index.js')).href);

let passed = 0, failed = 0;
function assert(label, condition) { if (condition) { console.log(`  PASS: ${label}`); passed++; } else { console.log(`  FAIL: ${label}`); failed++; } }

console.log('\n=== TEST 1: Bootstrap Through Executive Coordination ===');
const boot = intel.runIntelligenceBootstrap();
assert('Objective created', boot.objective.id.startsWith('OBJ-'));
assert('Intelligence task created', boot.task.id.startsWith('IT-'));

console.log('\n=== TEST 2: Supported Domains ===');
const domains = intel.getSupportedDomains();
console.log(JSON.stringify(domains, null, 2));
assert('Domains loaded', domains.length >= 5);
assert('Finance domain present', domains.includes('finance'));
assert('Marketing domain present', domains.includes('marketing'));

console.log('\n=== TEST 3: Cross-Division Questions ===');
const revenueQ = intel.answerCrossDivisionQuestion('What is our revenue status?');
const marketingQ = intel.answerCrossDivisionQuestion('How is marketing performing?');
const storeQ = intel.answerCrossDivisionQuestion('Which store is best?');
console.log(JSON.stringify({ revenueQ, marketingQ, storeQ }, null, 2));
assert('Revenue question answered', revenueQ.answered === true);
assert('Marketing question answered', marketingQ.answered === true);
assert('Store question answered', storeQ.answered === true);
assert('No fake metrics preserved', revenueQ.noFakeMetrics === true && marketingQ.noFakeMetrics === true);

console.log('\n=== TEST 4: Dashboard ===');
const dashboard = intel.buildIntelligenceDashboard();
console.log(JSON.stringify({ status: dashboard.status, questions: dashboard.questions.length, domains: dashboard.domains.length, warnings: dashboard.warnings }, null, 2));
assert('Dashboard has questions', dashboard.questions.length >= 3);
assert('Dashboard is PARTIAL', dashboard.status === 'PARTIAL');

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 8 COMPANY INTELLIGENCE: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('============================================================\n');
process.exit(failed === 0 ? 0 : 1);