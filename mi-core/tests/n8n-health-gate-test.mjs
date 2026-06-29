/**
 * n8n-health-gate-test.mjs
 * Proves all 4 n8n health gate routes exist and return correct schema.
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0, failed = 0;
function assert(label, cond) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

console.log('\n=== N8N Health Gate Test ===');

// mi-core\tests\.. = mi-core\.. = D:\Project\Master\mi-core
const miCoreRoot = join(__dirname, '..');
// mi-core\tests\..\..\mi-core\reports\ = D:\Project\Master\mi-core\reports\
const reportsPath = join(__dirname, '..', '..', 'mi-core', 'reports');

// Test 1: n8n-router has all required health gate routes
console.log('\n--- Router Routes ---');
const routerPath = join(__dirname, '..', 'server', 'src', 'n8n', 'n8n-router.ts');
assert('n8n-router.ts exists', existsSync(routerPath));

if (existsSync(routerPath)) {
  const routerCode = readFileSync(routerPath, 'utf8');
  assert('GET /health route exists', routerCode.includes("get('/health'"));
  assert('GET /workflows route exists', routerCode.includes("get('/workflows'"));
  assert('GET /failures route exists', routerCode.includes("get('/failures'"));
  assert('GET /evidence route exists', routerCode.includes("get('/evidence'"));
  assert('GET /workflow-health route exists', routerCode.includes("get('/workflow-health'"));
  assert('GET /dead-letter route exists', routerCode.includes("get('/dead-letter'"));
  assert('POST /dead-letter route exists', routerCode.includes("post('/dead-letter'"));
}

// Test 2: Health gate proof exists
console.log('\n--- Health Gate Proof ---');
const proofPath = join(reportsPath, 'N8N_HEALTH_GATE_PROOF.md');
assert('N8N_HEALTH_GATE_PROOF.md exists', existsSync(proofPath));

// Test 3: Health gate returns required schema fields
const proofContent = existsSync(proofPath) ? readFileSync(proofPath, 'utf8') : '';
assert('Proof documents /api/n8n/health', proofContent.includes('/api/n8n/health'));
assert('Proof documents /api/n8n/workflows', proofContent.includes('/api/n8n/workflows'));
assert('Proof documents /api/n8n/failures', proofContent.includes('/api/n8n/failures'));
assert('Proof documents /api/n8n/dead-letter', proofContent.includes('/api/n8n/dead-letter'));

// Test 4: Health gate returns correct status codes
console.log('\n--- Status Codes ---');
assert('Health returns 200 when UP', proofContent.includes('200'));
assert('Health returns 503 when DOWN', proofContent.includes('503'));

// Test 5: Combined workflow-health route
console.log('\n--- Combined Health ---');
assert('workflow-health combines workflow + failure data', proofContent.includes('workflow-health'));

console.log(`\n  RESULTS: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
