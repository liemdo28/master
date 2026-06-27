/**
 * Phase 9 - Company Autonomy Runtime Test
 */
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const COORD_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'coordination');
if (existsSync(COORD_DATA_DIR)) rmSync(COORD_DATA_DIR, { recursive: true, force: true });
mkdirSync(COORD_DATA_DIR, { recursive: true });

const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase9', 'company-autonomy');
const autonomy = await import(pathToFileURL(join(dist, 'index.js')).href);

let passed = 0, failed = 0;
function assert(label, condition) { if (condition) { console.log(`  PASS: ${label}`); passed++; } else { console.log(`  FAIL: ${label}`); failed++; } }

console.log('\n=== TEST 1: Bootstrap Through Executive Coordination ===');
const boot = autonomy.runAutonomyBootstrap();
assert('Objective created', boot.objective.id.startsWith('OBJ-'));
assert('Autonomy task created', boot.task.id.startsWith('IT-'));

console.log('\n=== TEST 2: Autonomy Signals ===');
const signals = autonomy.detectAutonomySignals();
console.log(JSON.stringify(signals, null, 2));
assert('Signals detected', signals.length >= 4);
assert('Service down signal exists', signals.some(s => s.type === 'service_down'));
assert('Stale data signal exists', signals.some(s => s.type === 'stale_data'));
assert('All signals are approval-gated', signals.every(s => s.autoCreated === false && s.approvalRequired === true));

console.log('\n=== TEST 3: Dashboard ===');
const dashboard = autonomy.buildAutonomyDashboard();
console.log(JSON.stringify({ status: dashboard.status, signals: dashboard.signals.length, autoObjectivesCreated: dashboard.autoObjectivesCreated, warnings: dashboard.warnings }, null, 2));
assert('Dashboard has signals', dashboard.signals.length >= 4);
assert('Dashboard is PARTIAL', dashboard.status === 'PARTIAL');
assert('No auto-objectives created without approval', dashboard.autoObjectivesCreated === 0);
assert('Approval-gate warning present', dashboard.warnings.some(w => w.includes('approval-gated')));

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 9 COMPANY AUTONOMY: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('============================================================\n');
process.exit(failed === 0 ? 0 : 1);