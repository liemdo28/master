/**
 * Phase 5 - IT Operations Runtime Test
 */
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const COORD_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'coordination');
if (existsSync(COORD_DATA_DIR)) rmSync(COORD_DATA_DIR, { recursive: true, force: true });
mkdirSync(COORD_DATA_DIR, { recursive: true });

const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase5', 'it-operations');
const itOps = await import(pathToFileURL(join(dist, 'index.js')).href);

let passed = 0, failed = 0;
function assert(label, condition) { if (condition) { console.log(`  PASS: ${label}`); passed++; } else { console.log(`  FAIL: ${label}`); failed++; } }

console.log('\n=== TEST 1: Bootstrap Through Executive Coordination ===');
const boot = itOps.runITOperationsBootstrap();
assert('Objective created', boot.objective.id.startsWith('OBJ-'));
assert('IT task created', boot.task.id.startsWith('IT-'));

console.log('\n=== TEST 2: Service Health ===');
const services = itOps.getServiceHealth();
console.log(JSON.stringify(services, null, 2));
assert('Services loaded', services.length >= 5);
assert('mi-core is healthy', services.some(s => s.service === 'mi-core-server' && s.status === 'healthy'));
assert('doordash-agent is down', services.some(s => s.service === 'doordash-agent' && s.status === 'down'));

console.log('\n=== TEST 3: Docker Containers ===');
const containers = itOps.getDockerContainers();
console.log(JSON.stringify(containers, null, 2));
assert('Containers loaded', containers.length >= 4);
assert('postgres is running', containers.some(c => c.name === 'postgres-review' && c.status === 'running'));
assert('metabase is missing', containers.some(c => c.name === 'metabase' && c.status === 'missing'));

console.log('\n=== TEST 4: Backups ===');
const backups = itOps.getBackupStatus();
console.log(JSON.stringify(backups, null, 2));
assert('Backups loaded', backups.length >= 3);
assert('QB backup is stale', backups.some(b => b.name === 'qb-data' && b.status === 'stale'));

console.log('\n=== TEST 5: Dashboard ===');
const dashboard = itOps.buildITDashboard();
console.log(JSON.stringify({ status: dashboard.status, services: dashboard.services.length, containers: dashboard.containers.length, backups: dashboard.backups.length, warnings: dashboard.warnings }, null, 2));
assert('Dashboard has services', dashboard.services.length >= 5);
assert('Dashboard has warnings', dashboard.warnings.length > 0);
assert('Dashboard is DEGRADED or DOWN', ['DEGRADED', 'DOWN'].includes(dashboard.status));

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 5 IT OPERATIONS: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('============================================================\n');
process.exit(failed === 0 ? 0 : 1);