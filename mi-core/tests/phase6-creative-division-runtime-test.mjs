/**
 * Phase 6 - Creative Division Runtime Test
 */
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const COORD_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'coordination');
if (existsSync(COORD_DATA_DIR)) rmSync(COORD_DATA_DIR, { recursive: true, force: true });
mkdirSync(COORD_DATA_DIR, { recursive: true });

const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase6', 'creative-division');
const creative = await import(pathToFileURL(join(dist, 'index.js')).href);

let passed = 0, failed = 0;
function assert(label, condition) { if (condition) { console.log(`  PASS: ${label}`); passed++; } else { console.log(`  FAIL: ${label}`); failed++; } }

console.log('\n=== TEST 1: Bootstrap Through Executive Coordination ===');
const boot = creative.runCreativeBootstrap();
assert('Objective created', boot.objective.id.startsWith('OBJ-'));
assert('Creative task created', boot.task.id.startsWith('CRE-'));

console.log('\n=== TEST 2: Creative Pipelines ===');
const pipelines = creative.getCreativePipelines();
console.log(JSON.stringify(pipelines, null, 2));
assert('Pipelines loaded', pipelines.length >= 4);
assert('Restaurant Creative Engine active', pipelines.some(p => p.name === 'Restaurant Creative Engine' && p.status === 'active'));
assert('Video generation needs config', pipelines.some(p => p.name === 'Video Generation' && p.status === 'needs_config'));

console.log('\n=== TEST 3: Creative Assets ===');
const assets = creative.getCreativeAssets();
console.log(JSON.stringify(assets, null, 2));
assert('Assets loaded', assets.length >= 3);
assert('SEO article exists', assets.some(a => a.type === 'article' && a.brand === 'bakudan'));
assert('All assets are drafts', assets.every(a => a.status === 'draft'));

console.log('\n=== TEST 4: Dashboard ===');
const dashboard = creative.buildCreativeDashboard();
console.log(JSON.stringify({ status: dashboard.status, assets: dashboard.assets.length, pipelines: dashboard.pipelines.length, warnings: dashboard.warnings }, null, 2));
assert('Dashboard has assets', dashboard.assets.length >= 3);
assert('Dashboard has pipelines', dashboard.pipelines.length >= 4);
assert('Dashboard is PARTIAL', dashboard.status === 'PARTIAL');

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 6 CREATIVE DIVISION: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('============================================================\n');
process.exit(failed === 0 ? 0 : 1);