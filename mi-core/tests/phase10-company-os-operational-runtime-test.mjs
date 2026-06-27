/**
 * Phase 10 - MI Company OS Operational Runtime Test
 */
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const COORD_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'coordination');
const PHASE25_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'phase25');
if (existsSync(COORD_DATA_DIR)) rmSync(COORD_DATA_DIR, { recursive: true, force: true });
if (existsSync(PHASE25_DATA_DIR)) rmSync(PHASE25_DATA_DIR, { recursive: true, force: true });
mkdirSync(COORD_DATA_DIR, { recursive: true });

const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase10', 'company-os-operational');
const os = await import(pathToFileURL(join(dist, 'index.js')).href);

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

console.log('\n=== TEST 1: Objective Engine and Routing ===');
const objective = os.createExecutiveObjective('Increase Raw Sushi Revenue 10%');
assert('Objective id created', objective.objectiveId.startsWith('OBJ-'));
assert('Strategy created', objective.strategy.includes('cross-division'));
assert('Finance routed', objective.divisions.includes('finance'));
assert('Marketing routed', objective.divisions.includes('marketing'));
assert('SEO routed', objective.divisions.includes('seo'));
assert('Operations routed', objective.divisions.includes('operations'));
assert('Engineering routed', objective.divisions.includes('engineering'));
assert('Creative routed', objective.divisions.includes('creative'));
assert('At least six tasks generated', objective.tasks.length >= 6);
assert('Revenue baseline metric tracked', objective.metrics.includes('revenue_baseline'));
assert('Website conversion metric tracked', objective.metrics.includes('website_conversion'));
assert('Approval types detected', objective.approvalTypes.length >= 3);
assert('Truth warning about live actions', objective.truthWarnings.some(w => w.includes('approval-gated')));
assert('No task lacks owner', objective.tasks.every(t => t.owner));
assert('No task lacks division', objective.tasks.every(t => t.division));

const routing = os.buildObjectiveRoutingProof('Increase Raw Sushi Revenue 10%');
assert('Routing objective id created', routing.objectiveId.startsWith('OBJ-'));
assert('Task ids created', routing.taskIds.length >= 6);
assert('Routing evidence stored', routing.evidenceStored === true);
assert('Routing has no orphan tasks', routing.noOrphanTasks === true);
assert('Routing requested approvals', routing.approvalsRequested >= 3);
assert('Routing includes finance', routing.divisionsRouted.includes('finance'));
assert('Routing includes seo', routing.divisionsRouted.includes('seo'));
assert('Routing includes operations', routing.divisionsRouted.includes('operations'));
assert('Routing metrics tracked', routing.metricsTracked.length >= 5);
assert('Routing task ids are unique', new Set(routing.taskIds).size === routing.taskIds.length);

console.log('\n=== TEST 2: Command Center ===');
const command = os.buildCommandCenterSnapshot();
assert('Command status is honest partial', command.status === 'MI_COMPANY_OS_PARTIAL');
assert('Finance panel exists', Boolean(command.finance.revenue));
assert('Marketing panel exists', Boolean(command.marketing.traffic));
assert('Operations panel exists', Boolean(command.operations.quickbooks));
assert('IT panel exists', Boolean(command.it.services));
assert('Creative panel exists', Boolean(command.creative.assets));
assert('Truth blockers present', command.truthBlockers.length >= 3);
assert('QuickBooks blocker present', command.truthBlockers.some(b => b.includes('QuickBooks')));
assert('GSC/GBP blocker present', command.truthBlockers.some(b => b.includes('GBP') || b.includes('GSC')));
assert('No fake live QB claim', command.finance.revenue.includes('not certified'));
assert('DoorDash mutation gated', command.operations.doordash.includes('approval'));
assert('Creative assets counted', /\d+ assets/.test(command.creative.assets));

const apiProof = os.buildCommandCenterApiProof();
assert('API proof endpoint named', apiProof.endpoint.includes('command-center'));
assert('API proof has five panels', apiProof.panels.length === 5);
assert('API proof status matches', apiProof.status === command.status);

console.log('\n=== TEST 3: Cross-Division Coordination ===');
const coordination = os.buildCrossDivisionCoordinationReport();
assert('Coordination timestamp exists', Boolean(coordination.generatedAt));
assert('Coordination tracks duplicates', typeof coordination.duplicateTasks === 'number');
assert('Coordination tracks orphan tasks', typeof coordination.orphanTasks === 'number');
assert('Coordination tracks owners', Object.keys(coordination.ownerCoverage).length >= 5);
assert('Coordination has no orphan tasks', coordination.orphanTasks === 0);
assert('Coordination tracks approvals', coordination.pendingApprovals >= routing.approvalsRequested);
assert('Coordination dependency chains tracked', coordination.dependencyChains >= 1);
assert('Coordination healthy despite live blockers', coordination.healthy === true);

const dependencyProof = os.buildDependencyGraphProof();
assert('Dependency proof has task count', dependencyProof.taskCount >= routing.taskIds.length);
assert('Dependency graph has no cycle', dependencyProof.hasCycle === false);
assert('Dependency proof valid', dependencyProof.proof === 'DEPENDENCY_GRAPH_VALID');
assert('Topological order generated', dependencyProof.topologicalOrder.length >= routing.taskIds.length);

const dedupProof = os.buildDedupEngineProof();
assert('Dedup proof has task count', dedupProof.taskCount >= routing.taskIds.length);
assert('Dedup proof labels review state', dedupProof.proof.includes('DUPLICATES') || dedupProof.proof.includes('NO_DUPLICATES'));
assert('Dedup duplicatePairs numeric', typeof dedupProof.duplicatePairs === 'number');

console.log('\n=== TEST 4: Executive Reporting ===');
const report = os.buildExecutiveReport('daily');
assert('Report id created', report.id.startsWith('EXR-'));
assert('Report status is partial', report.status === 'MI_COMPANY_OS_PARTIAL');
assert('Report says what happened', report.whatHappened.length >= 3);
assert('Report lists blockers', report.blocked.length >= 3);
assert('Report lists late projects', report.lateProjects.length >= 1);
assert('Report lists revenue risks', report.revenueRisks.length >= 3);
assert('Report lists unhealthy systems', report.unhealthySystems.length >= 3);
assert('Report gives CEO focus', report.ceoFocus.length >= 3);

const qToday = os.answerExecutiveQuestion('What happened today?');
assert('Today question answered', qToday.answer.length > 0);
assert('Today answer has evidence', qToday.evidence.length > 0);
assert('Today confidence sane', qToday.confidence > 0.5);
const qBlocked = os.answerExecutiveQuestion('What is blocked?');
assert('Blocked question answered', qBlocked.answer.length > 0);
assert('Blocked confidence sane', qBlocked.confidence > 0.5);
const qRevenue = os.answerExecutiveQuestion('What revenue risks exist?');
assert('Revenue question answered', qRevenue.answer.includes('QB') || qRevenue.answer.includes('revenue'));
assert('Revenue warning present', qRevenue.warnings.length > 0);
const qFocus = os.answerExecutiveQuestion('What should CEO focus on?');
assert('CEO focus answered', qFocus.answer.includes('QuickBooks') || qFocus.answer.includes('Approve'));

const questionProof = os.buildQuestionEngineProof();
assert('Question proof covers six questions', questionProof.questions === 6);
assert('All questions answered', questionProof.answered === 6);
assert('Question confidence positive', questionProof.averageConfidence > 0.6);

console.log('\n=== TEST 5: OSS Global Governance ===');
const registry = os.buildOssGlobalRegistry();
assert('OSS registry has projects', registry.projects.length >= 35);
assert('OSS registry has seven categories', registry.categories.length >= 7);
assert('Engineering category present', registry.categories.includes('Engineering'));
assert('Operator category present', registry.categories.includes('Operator'));
assert('Workflow category present', registry.categories.includes('Workflow'));
assert('Data category present', registry.categories.includes('Data'));
assert('Marketing category present', registry.categories.includes('Marketing'));
assert('Creative category present', registry.categories.includes('Creative'));
assert('IT category present', registry.categories.includes('IT'));
assert('All OSS projects have owners', registry.projects.every(p => p.owner));
assert('All OSS projects have lifecycle', registry.projects.every(p => p.lifecycle));
assert('Playwright registered', registry.projects.some(p => p.name === 'Playwright'));
assert('n8n registered', registry.projects.some(p => p.name === 'n8n'));
assert('DuckDB registered', registry.projects.some(p => p.name === 'DuckDB'));

const lifecycle = os.buildOssLifecycleDashboard();
assert('Lifecycle dashboard counts all projects', lifecycle.projects === registry.projects.length);
assert('Lifecycle rule mentions approval', lifecycle.rule.includes('approval'));
assert('Lifecycle has candidates', lifecycle.byLifecycle.candidate > 0);

const scorecard = os.buildOssGlobalScorecard();
assert('Scorecard average positive', scorecard.averageScore > 0);
assert('Scorecard has top projects', scorecard.topProjects.length === 8);
assert('Scorecard warns about live reviews', scorecard.truthWarning.includes('license'));

const depMap = os.buildOssDependencyMap();
assert('Dependency map has edges', depMap.edges.length >= registry.projects.length);
assert('Dependency map has owners', depMap.owners.length >= 6);

console.log('\n=== TEST 6: Operational Certification ===');
const scenario1 = os.generateScenarioProof('scenario_1');
assert('Scenario 1 objective created', scenario1.objectiveCreated === true);
assert('Scenario 1 tasks created', scenario1.tasksCreated >= 6);
assert('Scenario 1 division routed', scenario1.divisionRouted === true);
assert('Scenario 1 evidence stored', scenario1.evidenceStored === true);
assert('Scenario 1 approval required', scenario1.approvalRequired === true);
assert('Scenario 1 metrics updated', scenario1.metricsUpdated === true);
assert('Scenario 1 report generated', scenario1.executiveReportGenerated === true);
assert('Scenario 1 passed local proof', scenario1.passed === true);
assert('Scenario 1 blockers remain honest', scenario1.blockers.length >= 1);

const cert = os.runOperationalCertification();
assert('Certification has five scenarios', cert.totalScenarios === 5);
assert('Certification scenarios returned', cert.scenarios.length === 5);
assert('All scenarios pass local loop proof', cert.passedScenarios === 5);
assert('Certification remains partial', cert.status === 'MI_COMPANY_OS_PARTIAL');
assert('Certification lists blockers', cert.blockers.length >= 5);
assert('Every scenario created objective', cert.scenarios.every(s => s.objectiveCreated));
assert('Every scenario created tasks', cert.scenarios.every(s => s.tasksCreated > 0));
assert('Every scenario routed division', cert.scenarios.every(s => s.divisionRouted));
assert('Every scenario stored evidence', cert.scenarios.every(s => s.evidenceStored));
assert('Every scenario generated report', cert.scenarios.every(s => s.executiveReportGenerated));

console.log('\n=== TEST 7: Full Bootstrap ===');
const boot = os.bootstrapCompanyOSOperational();
assert('Bootstrap objective id created', boot.objectiveId.startsWith('OBJ-'));
assert('Bootstrap task id created', boot.bootstrapTaskId.includes('-'));
assert('Bootstrap status partial', boot.status === 'MI_COMPANY_OS_PARTIAL');
assert('Bootstrap command center attached', boot.commandCenter.status === 'MI_COMPANY_OS_PARTIAL');
assert('Bootstrap coordination attached', boot.coordination.healthy === true);
assert('Bootstrap report attached', boot.executiveReport.status === 'MI_COMPANY_OS_PARTIAL');
assert('Bootstrap OSS count attached', boot.ossProjectCount >= 35);
assert('Bootstrap certification attached', boot.certification.totalScenarios === 5);
assert('Bootstrap blockers attached', boot.blockers.length >= 5);
assert('Getter returns runtime status', os.getCompanyOSOperationalStatus().status === 'MI_COMPANY_OS_PARTIAL');

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 10 COMPANY OS OPERATIONAL: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'MI_COMPANY_OS_PARTIAL' : 'BLOCKED'));
console.log('============================================================\n');
process.exit(failed === 0 ? 0 : 1);
