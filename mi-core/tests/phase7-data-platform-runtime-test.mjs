/**
 * Phase 7 - Company Data Platform Runtime Test
 */
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const COORD_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'coordination');
if (existsSync(COORD_DATA_DIR)) rmSync(COORD_DATA_DIR, { recursive: true, force: true });
mkdirSync(COORD_DATA_DIR, { recursive: true });

const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase7', 'company-data-platform');
const platform = await import(pathToFileURL(join(dist, 'index.js')).href);

let passed = 0, failed = 0;
function assert(label, condition) { if (condition) { console.log(`  PASS: ${label}`); passed++; } else { console.log(`  FAIL: ${label}`); failed++; } }

console.log('\n=== TEST 1: Bootstrap Through Executive Coordination ===');
const boot = platform.runDataPlatformBootstrap();
assert('Objective created', boot.objective.id.startsWith('OBJ-'));
assert('Data platform task created', boot.task.id.startsWith('IT-'));

console.log('\n=== TEST 2: Data Sources ===');
const sources = platform.getDataSources();
console.log(JSON.stringify(sources, null, 2));
assert('Sources loaded', sources.length >= 7);
assert('QuickBooks is stale', sources.some(s => s.source === 'quickbooks' && s.status === 'stale'));
assert('Accounting engine is live', sources.some(s => s.source === 'accounting-engine' && s.status === 'live'));
assert('GA4 is missing', sources.some(s => s.source === 'ga4' && s.status === 'missing'));

console.log('\n=== TEST 3: Cross-Source Schemas ===');
const schemas = platform.getCrossSourceSchemas();
console.log(JSON.stringify(schemas, null, 2));
assert('Schemas loaded', schemas.length >= 4);
assert('Store dimension defined', schemas.some(s => s.name === 'store_dimension' && s.status === 'defined'));
assert('Review fact missing', schemas.some(s => s.name === 'review_fact' && s.status === 'missing'));

console.log('\n=== TEST 4: Dashboard ===');
const dashboard = platform.buildDataPlatformDashboard();
console.log(JSON.stringify({ status: dashboard.status, sources: dashboard.sources.length, schemas: dashboard.schemas.length, warnings: dashboard.warnings }, null, 2));
assert('Dashboard has sources', dashboard.sources.length >= 7);
assert('Dashboard has warnings', dashboard.warnings.length > 0);
assert('Dashboard is PARTIAL', dashboard.status === 'PARTIAL');

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 7 COMPANY DATA PLATFORM: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('============================================================\n');
process.exit(failed === 0 ? 0 : 1);