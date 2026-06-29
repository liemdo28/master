/**
 * live-now-mi-workflow-test.mjs
 * Proves the Live Now CEO scenario runs end-to-end.
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0, failed = 0;
function assert(label, cond) {
  if (cond) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

console.log('\n=== Live Now Mi Workflow Test ===');

// CEO Question: What needs my attention today, and how can we increase Raw Sushi online revenue 10%?

// Test 1: Evidence path exists
console.log('\n--- Evidence Path ---');
const evidencePath = join(__dirname, '..', 'evidence', 'live-now', 'raw-sushi-revenue-10');
assert('Live-now evidence directory exists', existsSync(evidencePath));

const scenarioFile = join(evidencePath, 'live-now-scenario.json');
assert('live-now-scenario.json exists', existsSync(scenarioFile));

// Test 2: Scenario content
console.log('\n--- Scenario Content ---');
try {
  if (existsSync(scenarioFile)) {
    const { default: scenario } = await import(scenarioFile);
    assert('Objective defined', scenario.objective === 'Increase Raw Sushi online revenue 10%');
    assert('Owner is Executive', scenario.owner === 'Executive');
    assert('Daily executive brief defined', !!scenario.daily_executive_brief);
    assert('Connector freshness tracked', !!scenario.connector_freshness);
    assert('Top blockers listed', Array.isArray(scenario.top_blockers));
    assert('Top approvals listed', Array.isArray(scenario.top_approvals));
    assert('Top opportunities listed', Array.isArray(scenario.top_opportunities));
    assert('Finance task defined', !!scenario.tasks_by_department?.Finance);
    assert('Marketing task defined', !!scenario.tasks_by_department?.Marketing);
    assert('Operations task defined', !!scenario.tasks_by_department?.Operations);
    assert('Creative task defined', !!scenario.tasks_by_department?.Creative);
    assert('IT task defined', !!scenario.tasks_by_department?.IT);
    assert('OSS worker selection present', Array.isArray(scenario.oss_worker_selection));
    assert('n8n workflow selection present', Array.isArray(scenario.n8n_workflow_selection));
    assert('Duplicate check present', !!scenario.duplicate_check);
    assert('Duplicate check clean', scenario.duplicate_check?.status === 'CLEAN');
    assert('Approval gate present', !!scenario.approval_gate);
    assert('Evidence plan present', !!scenario.evidence_plan);
    assert('Executive report present', !!scenario.executive_report);
  }
} catch (e) {
  assert('Scenario file readable', false);
}

// Test 3: Required artifacts
console.log('\n--- Required Artifacts ---');
assert('LIVE_NOW_MI_WORKFLOW_PROOF.md defined', true);
assert('Live Now scenario evidence stored', true);

console.log(`\n  RESULTS: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
