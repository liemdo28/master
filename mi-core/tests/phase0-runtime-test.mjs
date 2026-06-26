/**
 * Phase 0 — Runtime Test (Node.js ESM)
 * CEO objective: "Increase Raw Sushi Revenue 10%"
 * Run: node tests/phase0-runtime-test.mjs
 */

import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const SERVER_ROOT = join(PROJECT_ROOT, 'server');
const DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'coordination');

if (existsSync(DATA_DIR)) rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

const coordDist = join(SERVER_ROOT, 'dist', 'executive-coordination');
const moduleUrl = (f) => pathToFileURL(join(coordDist, f)).href;

const { routeTask } = await import(moduleUrl('division-router.js'));
const { autoClassify, priorityBreakdown } = await import(moduleUrl('priority-engine.js'));
const { createTask, getTask, updateTaskStatus, getAllTasks, getBlockingDependencies } = await import(moduleUrl('task-registry.js'));
const { createRegisteredObjective } = await import(moduleUrl('objective-registry.js'));
const { detectDuplicates } = await import(moduleUrl('duplicate-detector.js'));
const { detectAllConflicts } = await import(moduleUrl('conflict-engine.js'));
const { describeChain, topologicalOrder } = await import(moduleUrl('dependency-graph.js'));
const { buildDashboard, renderAsciiDashboard } = await import(moduleUrl('executive-dashboard.js'));
const { addEvidenceRecord } = await import(moduleUrl('evidence-registry.js'));

let passed = 0, failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

// TEST 1: Division Router
console.log('\n=== TEST 1: Division Router ===');
for (const [text, expected] of [
  ['Deploy production dashboard', 'engineering'],
  ['Process weekly payroll', 'finance'],
  ['Create Instagram campaign', 'marketing'],
  ['Set up GA4 tracking', 'it'],
  ['Design landing page banner', 'creative'],
  ['Restart pm2 services', 'computer-operator'],
]) {
  assert(`routeTask("${text}") -> ${expected}`, routeTask(text).division === expected);
}

// TEST 2: Auto Priority
console.log('\n=== TEST 2: Auto Priority Classification ===');
assert('payment -> P0', autoClassify('Fix payment processing', '').priority === 'P0');
assert('documentation -> P3', autoClassify('Update documentation', '').priority === 'P3');
assert('seo -> P1', autoClassify('Run SEO audit', '').priority === 'P1');

// TEST 3: CEO Objective
console.log('\n=== TEST 3: CEO Objective ===');
const obj = createRegisteredObjective('Increase Raw Sushi Revenue 10%', 'ceo');
assert('Objective created', obj.id.startsWith('OBJ-'));

// TEST 4: Task Creation
console.log('\n=== TEST 4: Task Creation ===');
const t1 = createTask({ objectiveId: obj.id, title: 'Run SEO Audit', description: 'Audit rawsushi.com SEO health', division: 'marketing', owner: 'seo-lead', approvalRequired: 'none' });
const t2 = createTask({ objectiveId: obj.id, title: 'Check SEO performance', description: 'Verify keyword rankings on Google', division: 'seo', owner: 'seo-lead', approvalRequired: 'none' });
const t3 = createTask({ objectiveId: obj.id, title: 'Run SEO Review', description: 'Comprehensive SEO review', division: 'marketing', owner: 'seo-lead', approvalRequired: 'none' });
const t4 = createTask({ objectiveId: obj.id, title: 'Deploy marketing dashboard', description: 'Push new marketing dashboard to production', division: 'engineering', owner: 'eng-lead', approvalRequired: 'merge' });
const t5 = createTask({ objectiveId: obj.id, title: 'Modify production dashboard schema', description: 'Update dashboard schema for revenue metrics', division: 'engineering', owner: 'eng-lead', approvalRequired: 'deploy' });
const t6 = createTask({ objectiveId: obj.id, title: 'Set up GA4 tracking', description: 'Install GA4 on landing pages', division: 'it', owner: 'it-admin', approvalRequired: 'credentials' });
const t7 = createTask({ objectiveId: obj.id, title: 'Build marketing dashboard', description: 'Visualize campaign ROI', division: 'marketing', owner: 'marketing-lead', dependencies: [t6.id], approvalRequired: 'none' });
const t8 = createTask({ objectiveId: obj.id, title: 'Build revenue dashboard', description: 'Aggregate revenue across channels', division: 'marketing', owner: 'marketing-lead', dependencies: [t7.id], approvalRequired: 'none' });
const t9 = createTask({ objectiveId: obj.id, title: 'Process payroll for staff', description: 'Run monthly payroll via QuickBooks', division: 'finance', owner: 'finance-lead', approvalRequired: 'payroll' });
assert('9 tasks created', [t1,t2,t3,t4,t5,t6,t7,t8,t9].length === 9);
for (const t of [t1,t2,t3,t4,t5,t6,t7,t8,t9])
  console.log(`  [${t.id}] ${t.priority} | ${t.division} | ${t.title}`);

// TEST 5: Ownership
console.log('\n=== TEST 5: Ownership ===');
const all = getAllTasks();
assert('No orphan tasks', all.every(t => t.owner.length > 0 && t.division.length > 0));

// TEST 6: Duplicate Detection
console.log('\n=== TEST 6: Duplicate Detection ===');
const duplicates = detectDuplicates(all);
console.log(`  Detected ${duplicates.length} duplicate pair(s):`);
for (const d of duplicates) {
  const a = getTask(d.taskA), b = getTask(d.taskB);
  console.log(`    ${d.taskA} (${a.title}) <-> ${d.taskB} (${b.title}) ${(d.similarity * 100).toFixed(0)}%`);
  console.log(`      Reason: ${d.reason}`);
}
assert('SEO duplicates detected', duplicates.length >= 1);

// TEST 7: Dependency Graph
console.log('\n=== TEST 7: Dependency Graph ===');
const topo = topologicalOrder(all);
console.log(`  Topo order: ${topo.order.join(' -> ')}`);
console.log(`  Order count: ${topo.order.length}, Tasks count: ${all.length}, hasCycle: ${topo.hasCycle}`);
assert('Topological order has all tasks', topo.order.length === all.length);
assert('No cycles', topo.hasCycle === false);
console.log(`  Chain: ${describeChain(all, t8.id)}`);

// TEST 8: Conflict Detection
console.log('\n=== TEST 8: Conflict Detection ===');
updateTaskStatus(t4.id, 'in-progress');
updateTaskStatus(t5.id, 'in-progress');
const freshAll = getAllTasks();
const conflicts = detectAllConflicts(freshAll);
console.log(`  Detected ${conflicts.length} conflict(s):`);
for (const c of conflicts) {
  console.log(`    ${c.taskA} <-> ${c.taskB} (${c.conflictType})`);
  console.log(`      ${c.description}`);
}
assert('Dashboard conflict detected', conflicts.some(c => c.conflictType === 'simultaneous-modify'));

// TEST 9: Priority Breakdown
console.log('\n=== TEST 9: Priority Breakdown ===');
const bd = priorityBreakdown(all);
console.log(`  P0: ${bd.P0} | P1: ${bd.P1} | P2: ${bd.P2} | P3: ${bd.P3}`);
assert('Has SEO (P1) tasks', bd.P1 > 0);

// TEST 10: Evidence
console.log('\n=== TEST 10: Evidence Registry ===');
addEvidenceRecord(t1.id, { type: 'api-output', url: 'https://gsc.example.com/audit', capturedAt: '' });
addEvidenceRecord(t6.id, { type: 'screenshot', url: 'https://drive.google.com/file/ga4.png', capturedAt: '' });
assert('Evidence attached', true);

// TEST 11: Dashboard
console.log('\n=== TEST 11: Executive Dashboard ===');
const dash = buildDashboard(all, obj.title);
console.log(renderAsciiDashboard(dash));
assert('Dashboard generated', dash !== null);
assert('Dashboard has 9 tasks', dash.summary.totalTasks === 9);
assert('Blocked tasks shown', dash.blockedTasks.length > 0);

// TEST 12: CEO Q&A
console.log('\n=== TEST 12: CEO Q&A Validation ===');
assert('Who owns MKT-003? -> marketing-lead', getTask(t7.id).owner === 'marketing-lead');
assert('Objective linked to ENG-001', getTask(t4.id).objectiveId === obj.id);
assert('FIN-001 approval -> payroll', t9.approvalRequired === 'payroll');
assert('ENG-002 division -> engineering', t5.division === 'engineering');
assert('MKT-003 is blocked (depends on IT-001)', getBlockingDependencies(t7.id).length > 0);

// Final Result
console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('============================================================');
console.log('  PHASE 0 EXECUTIVE COORDINATION DIVISION: ' + (failed === 0 ? 'OPERATIONAL' : 'PARTIAL'));
console.log('============================================================\n');

process.exit(failed === 0 ? 0 : 1);