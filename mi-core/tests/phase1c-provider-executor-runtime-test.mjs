/**
 * Phase 1C - Provider Executor Adapter Runtime Test
 */

import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const dist = join(PROJECT_ROOT, 'server', 'dist', 'phase1', 'engineering-division');
const eng = await import(pathToFileURL(join(dist, 'index.js')).href);

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

console.log('\n=== TEST 1: Local Provider Availability ===');
const availability = eng.checkLocalProviderAvailability();
console.log(JSON.stringify(availability, null, 2));
assert('Qwen local adapter available', availability.find((p) => p.provider === 'qwen')?.available === true);
assert('DeepSeek local adapter available', availability.find((p) => p.provider === 'deepseek')?.available === true);
assert('Kimi remains unavailable locally', availability.find((p) => p.provider === 'kimi')?.available === false);

console.log('\n=== TEST 2: Patch Prompt Safety ===');
const task = eng.runEngineeringIntake('Fix NodeJS API documentation typo', 'Fix a low-risk TypeScript NodeJS documentation typo');
const prompt = eng.buildPatchPrompt(task);
assert('Prompt asks for unified diff', prompt.includes('unified diff'));
assert('Prompt forbids invented PR/test artifacts', prompt.includes('Do not invent test results'));

console.log('\n=== TEST 3: Live Execution Safety Gate ===');
const result = eng.runLocalProviderPatchRequest(task);
console.log(JSON.stringify({ provider: result.provider, status: result.status, summary: result.summary }, null, 2));
assert('Adapter does not run model without explicit approval env', result.status === 'human-required');
assert('Adapter reports available model but disabled execution', result.summary.includes('ENGINEERING_ALLOW_LIVE_MODEL_EXECUTION=1'));

console.log('\n============================================================');
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log('  PHASE 1C PROVIDER EXECUTOR ADAPTER: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('  FINAL_ALLOWED_STATUS: ' + (failed === 0 ? 'PARTIAL' : 'BLOCKED'));
console.log('============================================================\n');

process.exit(failed === 0 ? 0 : 1);
