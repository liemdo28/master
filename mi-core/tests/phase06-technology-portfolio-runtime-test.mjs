/**
 * Phase 0.6 - Technology Portfolio Office Runtime Test
 */

import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const TPO_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'technology-portfolio');
const COORD_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'coordination');

if (existsSync(TPO_DATA_DIR)) rmSync(TPO_DATA_DIR, { recursive: true, force: true });
if (existsSync(COORD_DATA_DIR)) rmSync(COORD_DATA_DIR, { recursive: true, force: true });
mkdirSync(TPO_DATA_DIR, { recursive: true });

const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase06', 'technology-portfolio-office');
const moduleUrl = (file) => pathToFileURL(join(dist, file)).href;
const tpo = await import(moduleUrl('index.js'));

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
const boot = tpo.runTechnologyPortfolioBootstrap();
assert('Objective created', boot.objective.id === 'OBJ-001');
assert('Task created through Executive Coordination', boot.task.id === 'ENG-001');
assert('Registry operational', boot.statuses.registry === 'TECHNOLOGY_PORTFOLIO_REGISTRY_OPERATIONAL');
assert('Scorecard operational', boot.statuses.scorecard === 'TECHNOLOGY_PORTFOLIO_SCORECARD_OPERATIONAL');
assert('Dashboard operational', boot.statuses.dashboard === 'TECHNOLOGY_PORTFOLIO_DASHBOARD_OPERATIONAL');

console.log('\n=== TEST 2: Registry Tracks ===');
const items = tpo.getPortfolioItems();
console.log(`  items: ${items.length}`);
assert('Portfolio has at least 20 certified assets', items.length >= 20);
assert('Tracks Open Source', items.some((i) => i.track === 'Open Source'));
assert('Tracks AI Models', items.some((i) => i.track === 'AI Models'));
assert('Tracks SaaS', items.some((i) => i.track === 'SaaS'));
assert('Tracks Internal Projects', items.some((i) => i.track === 'Internal Projects'));
assert('Required fields present', items.every((i) => i.item_id && i.name && i.track && i.owner_division && i.status && typeof i.business_value === 'number' && i.source_ref));

console.log('\n=== TEST 3: Scorecard ===');
const scorecard = tpo.buildPortfolioScorecard();
console.log(JSON.stringify(scorecard.slice(0, 5), null, 2));
assert('Scorecard covers registry', scorecard.length === items.length);
assert('Scores bounded', scorecard.every((s) => s.score >= 0 && s.score <= 100));

console.log('\n=== TEST 4: Dashboard ===');
const dashboard = tpo.buildPortfolioDashboard();
console.log(JSON.stringify(dashboard, null, 2));
assert('Dashboard total matches registry', dashboard.totalItems === items.length);
assert('Dashboard has all four tracks', Object.values(dashboard.byTrack).filter((count) => count > 0).length === 4);
assert('Dashboard tracks approval requirements', dashboard.approvalRequired >= 1);
assert('Blocked items identify approval evidence gaps', dashboard.blockedItems.length >= 1);

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 0.6 TECHNOLOGY PORTFOLIO OFFICE: ' + (failed === 0 ? 'OPERATIONAL' : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'OPERATIONAL' : 'BLOCKED'));
console.log('============================================================\n');

process.exit(failed === 0 ? 0 : 1);
