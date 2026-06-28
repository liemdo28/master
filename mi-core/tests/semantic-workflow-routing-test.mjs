/**
 * Semantic Workflow Routing Test (Part A2).
 *
 * Runs the semantic workflow orchestrator for the CEO objective
 * "Increase Raw Sushi online revenue 10%" and proves: intent detected, semantic
 * division routing, OSS-worker selection (via the Part A1 runtime layer),
 * duplicate avoidance, dependency graph, approval policy, evidence plan, and
 * executive report. Writes evidence to evidence/workflow-intelligence/.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, '..', 'server');
const require = createRequire(join(SERVER, 'index.js'));
const wf = require(join(SERVER, 'dist', 'workflow-intelligence', 'index.js'));

let passed = 0, failed = 0;
function assert(label, cond) { if (cond) { console.log(`  PASS: ${label}`); passed++; } else { console.log(`  FAIL: ${label}`); failed++; } }

console.log('\n=== Semantic Workflow Routing Test — "Increase Raw Sushi online revenue 10%" ===');

const objective = 'Increase Raw Sushi online revenue 10%';
const result = wf.runSemanticWorkflow(objective);

console.log('\n--- 1. Business intent detected ---');
assert('intent direction = increase', result.intent.direction === 'increase');
assert('intent type = growth', result.intent.intentType === 'growth');
assert('entity = raw sushi', result.intent.entity === 'raw sushi');
assert('magnitude = 10%', result.intent.magnitude && result.intent.magnitude.value === 10 && result.intent.magnitude.unit === '%');

console.log('\n--- 2. Semantic classification ---');
assert('objective classified (revenue/growth domain)', ['revenue', 'marketing'].includes(result.classification.primaryDomain));
assert('classification has confidence', result.classification.confidence > 0);

console.log('\n--- 3. Steps routed to divisions semantically ---');
assert('workflow decomposed into >=4 steps', result.steps.length >= 4);
assert('every step has a division', result.steps.every((s) => typeof s.division === 'string' && s.division.length > 0));
assert('finance owns the baseline step', result.steps[0].division === 'finance');
console.log('    routes: ' + result.steps.map((s) => `${s.domain}→${s.division}`).join(', '));

console.log('\n--- 4. OSS worker selected per step (Part A1 runtime) ---');
assert('every step selected an OSS worker', result.steps.every((s) => !!s.ossWorker));
assert('OSS status reported honestly per step', result.steps.every((s) => typeof s.ossStatus === 'string'));
assert('executive report counts OSS workers selected', result.executiveReport.ossWorkersSelected === result.steps.length);

console.log('\n--- 5. Duplicate avoided ---');
assert('at least one duplicate step was detected + avoided', result.duplicatesAvoided >= 1);

console.log('\n--- 6. Dependency graph created (ordered, no cycle) ---');
assert('dependency order produced', Array.isArray(result.dependencyOrder) && result.dependencyOrder.length >= 4);
assert('no dependency cycle', result.dependencyCycle === false);
assert('baseline (WF-01) precedes later steps', result.dependencyOrder.indexOf('WF-01') < result.dependencyOrder.indexOf('WF-02'));

console.log('\n--- 7. Approval policy selected ---');
assert('analysis steps auto, launch step gated', result.steps.some((s) => s.approvalGate === 'auto') && result.steps.some((s) => s.requiresHuman));
const launch = result.steps.find((s) => /launch/i.test(s.title));
assert('launch step requires a production approval', launch && launch.approvalGate === 'production_token');

console.log('\n--- 8. Evidence plan + executive report ---');
assert('evidence plan covers every step', result.evidencePlan.length === result.steps.length);
assert('executive report generated', result.executiveReport.stepCount === result.steps.length && result.executiveReport.topDomain.length > 0);
assert('learning hook wired to Phase 12', result.learningHook.recordOutcome === true && result.learningHook.phase12 === 'agent-os/12');

// Write evidence
const evDir = join(SERVER, '..', 'evidence', 'workflow-intelligence');
mkdirSync(evDir, { recursive: true });
writeFileSync(join(evDir, 'raw-sushi-revenue-10.json'), JSON.stringify(result, null, 2));
console.log('  (evidence written: evidence/workflow-intelligence/raw-sushi-revenue-10.json)');

console.log(`\n  RESULTS: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
