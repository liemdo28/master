/**
 * Phase 4A - Marketing Intelligence Runtime Test
 */

import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const COORD_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'coordination');

if (existsSync(COORD_DATA_DIR)) rmSync(COORD_DATA_DIR, { recursive: true, force: true });
mkdirSync(COORD_DATA_DIR, { recursive: true });

const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase4a', 'marketing-intelligence');
const intel = await import(pathToFileURL(join(dist, 'index.js')).href);

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
const boot = intel.runMarketingIntelligenceBootstrap();
assert('Objective created', boot.objective.id === 'OBJ-001');
assert('Marketing task created', boot.task.id === 'MKT-001');

console.log('\n=== TEST 2: Channel Health ===');
const channelHealth = intel.buildChannelHealth();
console.log(JSON.stringify(channelHealth, null, 2));
assert('Channel health has Bakudan', Array.isArray(channelHealth.bakudan));
assert('Channel health has Raw Sushi', Array.isArray(channelHealth.raw_sushi));
assert('GBP missing is explicit', channelHealth.bakudan.some((c) => c.channel === 'gbp' && c.status === 'missing_credentials'));

console.log('\n=== TEST 3: Opportunity Engine ===');
const opportunities = intel.buildMarketingOpportunities();
console.log(JSON.stringify(opportunities, null, 2));
assert('Opportunities generated', opportunities.length >= 2);
assert('Opportunities are scored', opportunities.every((o) => o.score >= 0 && o.score <= 100));
assert('Opportunities require evidence', opportunities.every((o) => o.requiredEvidence.length > 0));

console.log('\n=== TEST 4: Recommendation Engine ===');
const recommendations = intel.buildCampaignRecommendations();
console.log(JSON.stringify(recommendations, null, 2));
assert('Recommendations generated', recommendations.length >= 2);
assert('No campaign launches while approval/blockers exist', recommendations.every((r) => r.canLaunchNow === false));
assert('Approval blocker is explicit', recommendations.every((r) => r.blockers.includes('approval required')));

console.log('\n=== TEST 5: Question Engine ===');
const opportunityAnswer = intel.answerMarketingIntelligenceQuestion('What is top opportunity?', opportunities, recommendations);
const launchAnswer = intel.answerMarketingIntelligenceQuestion('Can we launch campaigns now?', opportunities, recommendations);
console.log(JSON.stringify({ opportunityAnswer, launchAnswer }, null, 2));
assert('Opportunity question answered', opportunityAnswer.answered === true);
assert('Launch question answered', launchAnswer.answered === true);
assert('No fake metrics flag preserved', opportunityAnswer.noFakeMetrics === true && launchAnswer.noFakeMetrics === true);

console.log('\n=== TEST 6: Dashboard ===');
const dashboard = intel.buildMarketingIntelligenceDashboard();
console.log(JSON.stringify({
  status: dashboard.status,
  opportunities: dashboard.opportunities.length,
  recommendations: dashboard.recommendations.length,
  blockers: dashboard.blockers,
}, null, 2));
assert('Dashboard has opportunities', dashboard.opportunities.length >= 2);
assert('Dashboard has recommendations', dashboard.recommendations.length >= 2);
assert('Dashboard is partial while blockers remain', dashboard.blockers.length === 0 || dashboard.status === 'PARTIAL');

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 4A MARKETING INTELLIGENCE: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('============================================================\n');

process.exit(failed === 0 ? 0 : 1);
