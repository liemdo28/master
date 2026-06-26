/**
 * Phase 3B - Financial Intelligence Runtime Test
 */

import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const COORD_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'coordination');

if (existsSync(COORD_DATA_DIR)) rmSync(COORD_DATA_DIR, { recursive: true, force: true });
mkdirSync(COORD_DATA_DIR, { recursive: true });

const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase3b', 'financial-intelligence');
const finance = await import(pathToFileURL(join(dist, 'index.js')).href);

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
const boot = finance.runFinancialIntelligenceBootstrap();
assert('Objective created', boot.objective.id === 'OBJ-001');
assert('Finance task created', boot.task.id === 'FIN-001');

console.log('\n=== TEST 2: Source Health ===');
const sourceHealth = finance.getFinanceSourceHealth();
console.log(JSON.stringify(sourceHealth, null, 2));
assert('QuickBooks source status is explicit', ['healthy', 'degraded', 'missing', 'stale'].includes(sourceHealth.status));
assert('No false QB certification', sourceHealth.certified === false);
assert('Action required when source not healthy', sourceHealth.status === 'healthy' || sourceHealth.actionRequired === true);

console.log('\n=== TEST 3: Revenue Engine ===');
const revenue = finance.buildRevenueSummary(sourceHealth);
console.log(JSON.stringify(revenue, null, 2));
assert('Revenue summary has stores', revenue.stores.length === 3);
assert('Revenue total is positive from local certified ledger', revenue.totalRevenue > 0);
assert('Warnings present when QB not healthy', sourceHealth.status === 'healthy' || revenue.warnings.length > 0);

console.log('\n=== TEST 4: Store Ranking ===');
const rankings = finance.rankStores(revenue);
console.log(JSON.stringify(rankings, null, 2));
assert('Stores ranked', rankings.length === revenue.stores.length);
assert('Top rank is 1', rankings[0].rank === 1);
assert('Ranking sorted by revenue', rankings[0].revenue >= rankings[1].revenue);

console.log('\n=== TEST 5: Risk Engine ===');
const risk = finance.evaluateFinanceRisk(sourceHealth, revenue);
console.log(JSON.stringify(risk, null, 2));
assert('Risk level present', ['low', 'medium', 'high', 'critical'].includes(risk.level));
assert('Risk flags source gaps when QB not healthy', sourceHealth.status === 'healthy' || risk.reasons.length > 0);

console.log('\n=== TEST 6: Question Engine ===');
const revenueAnswer = finance.answerFinanceQuestion('Raw Sushi revenue today?', sourceHealth, revenue, rankings);
const rankingAnswer = finance.answerFinanceQuestion('Store ranking?', sourceHealth, revenue, rankings);
const qbAnswer = finance.answerFinanceQuestion('QB sync status?', sourceHealth, revenue, rankings);
console.log(JSON.stringify({ revenueAnswer, rankingAnswer, qbAnswer }, null, 2));
assert('Revenue question answered', revenueAnswer.answered === true);
assert('Ranking question answered', rankingAnswer.answered === true);
assert('QB question answered', qbAnswer.answered === true);
assert('No mock data flag preserved', revenueAnswer.noMockData === true && qbAnswer.noMockData === true);
assert('Revenue answer does not claim fresh QB when source degraded', sourceHealth.status === 'healthy' || revenueAnswer.answer.includes('not claimed as fresh QB revenue'));

console.log('\n=== TEST 7: Dashboard ===');
const dashboard = finance.buildFinancialIntelligenceDashboard();
assert('Dashboard has source health', Boolean(dashboard.sourceHealth));
assert('Dashboard has revenue', dashboard.revenue.totalRevenue > 0);
assert('Dashboard has rankings', dashboard.rankings.length > 0);
assert('Dashboard has question examples', dashboard.questionExamples.length === 3);

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 3B FINANCIAL INTELLIGENCE: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('============================================================\n');

process.exit(failed === 0 ? 0 : 1);
