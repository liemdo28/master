/**
 * Phase 2C - Business Operators Runtime Test
 */
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const COORD_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'coordination');
if (existsSync(COORD_DATA_DIR)) rmSync(COORD_DATA_DIR, { recursive: true, force: true });
mkdirSync(COORD_DATA_DIR, { recursive: true });

const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase2c', 'business-operators');
const biz = await import(pathToFileURL(join(dist, 'index.js')).href);

let passed = 0, failed = 0;
function assert(label, condition) { if (condition) { console.log(`  PASS: ${label}`); passed++; } else { console.log(`  FAIL: ${label}`); failed++; } }

console.log('\n=== TEST 1: Bootstrap Through Executive Coordination ===');
const boot = biz.runBusinessOperatorsBootstrap();
assert('Objective created', boot.objective.id.startsWith('OBJ-'));
assert('Business operators task created', boot.task.id.startsWith('COP-'));

console.log('\n=== TEST 2: Business Operators ===');
const operators = biz.getBusinessOperators();
console.log(JSON.stringify(operators.map(o => ({ role: o.role, status: o.status, allowedActions: o.allowedActions.length })), null, 2));
assert('5 operators defined', operators.length === 5);
assert('CEO operator present', operators.some(o => o.role === 'ceo'));
assert('Finance operator present', operators.some(o => o.role === 'finance'));
assert('Marketing operator present', operators.some(o => o.role === 'marketing'));
assert('All operators active', operators.every(o => o.status === 'active'));
assert('CEO has approve action', operators.find(o => o.role === 'ceo').allowedActions.includes('approve'));

console.log('\n=== TEST 3: Recent Tasks ===');
const tasks = biz.getRecentTasks();
console.log(JSON.stringify(tasks, null, 2));
assert('5 tasks recorded', tasks.length === 5);
assert('CEO dashboard read complete', tasks.some(t => t.role === 'ceo' && t.action === 'read_dashboard' && t.status === 'done'));
assert('Pending approval exists', tasks.some(t => t.status === 'pending'));

console.log('\n=== TEST 4: Dashboard ===');
const dashboard = biz.buildBusinessOperatorsDashboard();
console.log(JSON.stringify({ status: dashboard.status, operators: dashboard.operators.length, tasks: dashboard.recentTasks.length, warnings: dashboard.warnings }, null, 2));
assert('Dashboard has operators', dashboard.operators.length === 5);
assert('Dashboard has tasks', dashboard.recentTasks.length >= 3);
assert('Dashboard is PARTIAL', dashboard.status === 'PARTIAL');
assert('Approval-gate warning present', dashboard.warnings.some(w => w.includes('approval')));

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 2C BUSINESS OPERATORS: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('============================================================\n');
process.exit(failed === 0 ? 0 : 1);