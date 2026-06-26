/**
 * Phase 4 - Marketing Foundation Runtime Test
 */

import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const COORD_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'coordination');

if (existsSync(COORD_DATA_DIR)) rmSync(COORD_DATA_DIR, { recursive: true, force: true });
mkdirSync(COORD_DATA_DIR, { recursive: true });

const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase4', 'marketing-foundation');
const marketing = await import(pathToFileURL(join(dist, 'index.js')).href);

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
const boot = marketing.runMarketingFoundationBootstrap();
assert('Objective created', boot.objective.id === 'OBJ-001');
assert('Marketing task created', boot.task.id === 'MKT-001');

console.log('\n=== TEST 2: Brand Intelligence ===');
const brands = marketing.getBrandProfiles();
console.log(JSON.stringify(brands, null, 2));
assert('Brand profiles loaded', brands.length >= 2);
assert('Bakudan present', brands.some((b) => b.brand_id === 'bakudan'));
assert('Raw Sushi present', brands.some((b) => b.brand_id === 'raw_sushi'));
assert('Missing connectors are explicit', brands.some((b) => b.missingConnectors.length > 0));

console.log('\n=== TEST 3: Campaign Intelligence ===');
const campaigns = marketing.buildCampaignPlans(brands);
console.log(JSON.stringify(campaigns, null, 2));
assert('Campaigns generated for active brands', campaigns.length >= 2);
assert('Campaigns require approval', campaigns.every((c) => c.approvalRequired === true));
assert('Blocked campaigns are not publish-ready', campaigns.every((c) => c.blockers.length === 0 || c.publishReady === false));

console.log('\n=== TEST 4: Content Factory ===');
const assets = marketing.listContentAssets(10);
console.log(JSON.stringify(assets.slice(0, 3), null, 2));
assert('SEO draft assets found', assets.length > 0);
assert('Assets include topic', assets.every((a) => a.topic.length > 0));
assert('Assets are drafts, not publish-ready', assets.every((a) => a.publishReady === false));

console.log('\n=== TEST 5: Marketing Questions ===');
const brandAnswer = marketing.answerMarketingQuestion('Which brands are active?', brands, campaigns, assets);
const campaignAnswer = marketing.answerMarketingQuestion('What campaigns are ready?', brands, campaigns, assets);
const contentAnswer = marketing.answerMarketingQuestion('How many SEO content drafts exist?', brands, campaigns, assets);
console.log(JSON.stringify({ brandAnswer, campaignAnswer, contentAnswer }, null, 2));
assert('Brand question answered', brandAnswer.answered === true);
assert('Campaign question answered', campaignAnswer.answered === true);
assert('Content question answered', contentAnswer.answered === true);
assert('No fake metrics flag preserved', brandAnswer.noFakeMetrics === true && campaignAnswer.noFakeMetrics === true);

console.log('\n=== TEST 6: Dashboard ===');
const dashboard = marketing.buildMarketingFoundationDashboard();
console.log(JSON.stringify({
  brands: dashboard.brands.length,
  campaigns: dashboard.campaigns.length,
  contentAssets: dashboard.contentAssets.length,
  sourceWarnings: dashboard.sourceWarnings.length,
  status: dashboard.status,
}, null, 2));
assert('Dashboard has brands', dashboard.brands.length >= 2);
assert('Dashboard has campaigns', dashboard.campaigns.length >= 2);
assert('Dashboard has content assets', dashboard.contentAssets.length > 0);
assert('Dashboard status is PARTIAL while connectors missing', dashboard.sourceWarnings.length === 0 || dashboard.status === 'PARTIAL');

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 4 MARKETING FOUNDATION: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('============================================================\n');

process.exit(failed === 0 ? 0 : 1);
