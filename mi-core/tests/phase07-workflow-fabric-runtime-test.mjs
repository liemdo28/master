import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const WORKFLOW_DATA_DIR = join(PROJECT_ROOT, '.mi-harness', 'workflow-fabric');

if (existsSync(WORKFLOW_DATA_DIR)) rmSync(WORKFLOW_DATA_DIR, { recursive: true, force: true });
mkdirSync(WORKFLOW_DATA_DIR, { recursive: true });

const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase07', 'workflow-fabric');
const moduleUrl = (file) => pathToFileURL(join(dist, file)).href;
const workflow = await import(moduleUrl('index.js'));

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

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 0.7 WORKFLOW AUTOMATION FABRIC: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('============================================================\n');

process.exit(failed === 0 ? 0 : 1);
