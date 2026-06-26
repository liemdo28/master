import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import http from 'http';
import express from 'express';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const WORKFLOW_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'workflow-fabric');

if (existsSync(WORKFLOW_DATA_DIR)) rmSync(WORKFLOW_DATA_DIR, { recursive: true, force: true });
mkdirSync(WORKFLOW_DATA_DIR, { recursive: true });

const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase07', 'workflow-fabric');
const moduleUrl = (file) => pathToFileURL(join(dist, file)).href;
const workflow = await import(moduleUrl('index.js'));
const route = await import(pathToFileURL(join(PROJECT_ROOT, 'server', 'dist', 'phase07', 'routes', 'workflow-fabric.js')).href);

let passed = 0;
let failed = 0;
let apiFinalStatus = 'PARTIAL';
function assert(label, condition) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    failed++;
  }
}

function httpJson(port, method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
        connection: 'close',
      },
      agent: false,
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

console.log('\n=== TEST 1: Workflow Fingerprint Contract ===');
const input = { project: 'SEO', entity: 'Bakudan', action: 'Daily Audit', time_window: '2026-06-26' };
const key = workflow.buildWorkflowFingerprintKey(input);
assert('Fingerprint key includes project/entity/action/time_window', key === 'seo|bakudan|daily-audit|2026-06-26');
assert('Fingerprint hash is stable sha256', workflow.buildWorkflowFingerprint(input).length === 64);

console.log('\n=== TEST 2: Duplicate Detection ===');
const first = workflow.checkAndRegisterWorkflowRun(input, { storeDir: join(WORKFLOW_DATA_DIR, 'fingerprints') });
const second = workflow.checkAndRegisterWorkflowRun(input, { storeDir: join(WORKFLOW_DATA_DIR, 'fingerprints') });
console.log(JSON.stringify({ first, second }, null, 2));
assert('First run registers', first.status === 'REGISTERED');
assert('Second run skips duplicate', second.status === 'SKIP_DUPLICATE');
assert('Duplicate carries same fingerprint', first.fingerprint === second.fingerprint);

console.log('\n=== TEST 3: Governance ===');
assert('READ_ONLY does not require approval', workflow.requiresWorkflowApproval('READ_ONLY') === false);
assert('FINANCIAL requires approval', workflow.requiresWorkflowApproval('FINANCIAL') === true);
assert('Unapproved FINANCIAL workflow is blocked', workflow.assertWorkflowCanRun('FINANCIAL', false).allowed === false);
assert('Approved FINANCIAL workflow is allowed', workflow.assertWorkflowCanRun('FINANCIAL', true).allowed === true);

console.log('\n=== TEST 4: Evidence Model ===');
const evidence = workflow.buildWorkflowEvidenceRecord({
  workflow_id: 'seo-daily-audit',
  start_time: '2026-06-26T00:00:00.000Z',
  end_time: '2026-06-26T00:00:05.000Z',
  duration: 5000,
  status: 'SUCCESS',
  input,
  output: { pages: 13 },
  errors: [],
  evidence: ['crawler-1782461553235.json'],
});
assert('Evidence preserves workflow_id', evidence.workflow_id === 'seo-daily-audit');
assert('Evidence stores duration', evidence.duration === 5000);
assert('Evidence stores output object', evidence.output.pages === 13);

console.log('\n=== TEST 5: Workflow Fabric HTTP API ===');
const app = express();
app.use(express.json());
app.use('/api/workflows', route.workflowFabricRouter);
const server = app.listen(0);
const port = server.address().port;
try {
  const statusJson = await httpJson(port, 'GET', '/api/workflows/status');
  console.log(JSON.stringify(statusJson.status, null, 2));
  apiFinalStatus = statusJson.status.final_status;
  assert('GET /api/workflows/status returns ok', statusJson.ok === true);
  assert('Status route reports machine registry count', statusJson.status.machine_registered_workflows >= 7);

  const payload = {
    workflow_id: 'phase07-http-proof',
    project: 'SEO',
    entity: 'Bakudan',
    action: 'Daily Audit',
    time_window: '2026-06-26-http',
    risk: 'READ_ONLY',
    status: 'SUCCESS',
    output: { route: 'POST /api/workflows/log' },
  };
  const firstLog = await httpJson(port, 'POST', '/api/workflows/log', payload);
  const secondLog = await httpJson(port, 'POST', '/api/workflows/log', payload);
  assert('POST /api/workflows/log first call succeeds', firstLog.ok === true && firstLog.duplicate === false);
  assert('POST /api/workflows/log duplicate returns SKIP_DUPLICATE', secondLog.ok === true && secondLog.duplicate === true && secondLog.dedup.status === 'SKIP_DUPLICATE');
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 0.7 WORKFLOW AUTOMATION FABRIC: ' + (failed === 0 ? apiFinalStatus : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? apiFinalStatus : 'BLOCKED'));
console.log('============================================================\n');

process.exit(failed === 0 ? 0 : 1);
