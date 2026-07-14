/**
 * Multiprocess approved-operation concurrency regression.
 *
 * This proves the central executor invokes the side-effect function exactly
 * once for one approval, even when multiple processes race the same approval.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { section, check, finalize } from './_harness.mjs';

process.env.NODE_ENV = 'test';
process.env.SEO_SECURITY_TEST_MODE = '1';
process.env.MI_DATA_DIR = mkdtempSync(join(tmpdir(), 'seo-operation-concurrency-'));
process.env.SEO_APPROVAL_TTL_MS = String(60 * 1000);

const gate = await import('../../approval/gate.ts');
const {
  bindSeoApproval,
  getSeoApprovalExecutionState,
  hashPayload,
  inspectApprovalExecution,
} = await import('../seo-approval-binding.ts');
const { getSeoDb, nowIso } = await import('../seo-db.ts');
const { executeWithSeoApproval } = await import('../seo-approved-executor.ts');

const counterPath = join(process.env.MI_DATA_DIR, 'operation-counter.log');
const expected = {
  category: 'rollback',
  action: 'rollback_snapshot',
  target: 'snap-operation',
  brand_id: 'bakudan',
  location_id: null,
  actor_id: 'ceo-test',
  payload_hash: hashPayload({
    route: '/publish/:brandId/:snapshotId/rollback',
    resource_id: 'snap-operation',
    brand_id: 'bakudan',
    location_id: null,
    category: 'rollback',
    action: 'rollback_snapshot',
    target: 'snap-operation',
  }),
};

const action = gate.enqueue({
  risk_level: 3,
  category: expected.category,
  description: 'operation race test',
  target: expected.target,
  before_state: null,
  after_state: null,
  rollback_plan: 'test only',
});
bindSeoApproval(action.id, expected);
gate.approve(action.id, 'ceo-1');
gate.approve(action.id, 'ceo-2');

const workerPath = join(process.env.MI_DATA_DIR, 'operation-worker.mjs');
writeFileSync(workerPath, `
import { appendFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { executeWithSeoApproval } from ${JSON.stringify(new URL('../seo-approved-executor.ts', import.meta.url).href)};
const expected = JSON.parse(process.env.EXPECTED_APPROVAL);
const req = {
  seoAuth: {
    session: { actor_id: 'ceo-test' },
    routeKey: '/publish/:brandId/:snapshotId/rollback',
    approvalId: process.env.APPROVAL_ID,
    approvalExpectation: expected,
  },
};
const result = await executeWithSeoApproval(req, async () => {
  appendFileSync(process.env.COUNTER_PATH, process.pid + '\\n');
  await delay(250);
  return { success: true, worker: process.pid };
});
console.log(JSON.stringify(result));
`, 'utf8');

function runWorker() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--import', 'tsx', workerPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        SEO_SECURITY_TEST_MODE: '1',
        APPROVAL_ID: action.id,
        EXPECTED_APPROVAL: JSON.stringify(expected),
        COUNTER_PATH: counterPath,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('close', code => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

section('Multiprocess approved operation race');
{
  const results = await Promise.all(Array.from({ length: 10 }, () => runWorker()));
  const parsed = results.map(r => {
    try { return JSON.parse(r.stdout.split(/\r?\n/).pop() || '{}'); } catch { return { ok: false, parse_error: r }; }
  });
  const counter = existsSync(counterPath) ? readFileSync(counterPath, 'utf8').trim().split(/\r?\n/).filter(Boolean) : [];
  const state = getSeoApprovalExecutionState(action.id);
  check('all operation workers exited cleanly', results.every(r => r.code === 0), JSON.stringify(results));
  check('exactly one worker reported success', parsed.filter(r => r.ok).length === 1, JSON.stringify(parsed));
  check('exactly one operation invocation happened', counter.length === 1, JSON.stringify(counter));
  check('approval final state is SUCCEEDED', state?.state === 'SUCCEEDED', JSON.stringify(state));
  check('approval consumed_at is set after success', !!state?.consumed_at, JSON.stringify(state));
}

section('Operation success with finalization failure requires manual reconciliation');
{
  const expectedFinalizeFailure = {
    ...expected,
    target: 'snap-finalize-failure',
    payload_hash: hashPayload({
      route: '/publish/:brandId/:snapshotId/rollback',
      resource_id: 'snap-finalize-failure',
      brand_id: 'bakudan',
      location_id: null,
      category: 'rollback',
      action: 'rollback_snapshot',
      target: 'snap-finalize-failure',
    }),
  };
  const finalizeAction = gate.enqueue({
    risk_level: 3,
    category: expectedFinalizeFailure.category,
    description: 'finalization failure test',
    target: expectedFinalizeFailure.target,
    before_state: null,
    after_state: null,
    rollback_plan: 'test only',
  });
  bindSeoApproval(finalizeAction.id, expectedFinalizeFailure);
  gate.approve(finalizeAction.id, 'ceo-1');
  gate.approve(finalizeAction.id, 'ceo-2');

  let operationCount = 0;
  const req = {
    headers: { 'x-request-id': 'corr-finalize-failure' },
    seoAuth: {
      session: { actor_id: 'ceo-test' },
      routeKey: '/publish/:brandId/:snapshotId/rollback',
      resource: { id: expectedFinalizeFailure.target, brand_id: 'bakudan', location_id: null },
      approvalId: finalizeAction.id,
      approvalExpectation: expectedFinalizeFailure,
    },
  };
  const failed = await executeWithSeoApproval(req, async () => {
    operationCount++;
    getSeoDb().prepare(`
      UPDATE seo_approval_bindings
      SET consumed_at = ?, consumed_by = ?, execution_result = ?
      WHERE approval_id = ?
    `).run(nowIso(), 'external-test', 'pre-consumed-before-finalization', finalizeAction.id);
    return { success: true, changed: true, marker: 'side-effect-happened' };
  });
  const state = getSeoApprovalExecutionState(finalizeAction.id);
  const inspected = inspectApprovalExecution(finalizeAction.id);
  const generic = gate.getById(finalizeAction.id);
  const retried = await executeWithSeoApproval(req, async () => {
    operationCount++;
    return { success: true, changed: true, marker: 'should-not-run' };
  });

  check('successful operation plus failed finalization does not return normal success', failed.ok === false && failed.status === 503, JSON.stringify(failed));
  check('finalization failure response names manual reconciliation', failed.error === 'operation_succeeded_finalize_failed' && failed.manual_reconciliation_required === true, JSON.stringify(failed));
  check('operation counter stayed exactly one after retry attempt', operationCount === 1, `operationCount=${operationCount}`);
  check('approval cannot be automatically retried after finalization failure', retried.ok === false && /finalization_failed/.test(retried.error || ''), JSON.stringify(retried));
  check('execution state is FINALIZATION_FAILED and retry is blocked', state?.state === 'FINALIZATION_FAILED' && state?.automatic_retry_allowed === 0, JSON.stringify(state));
  check('execution evidence record exists and is inspectable', !!inspected?.evidence?.some(row => row.event_type === 'FINALIZATION_FAILED'), JSON.stringify(inspected));
  check('generic approval was not marked executed after failed finalization', generic?.status !== 'executed', JSON.stringify(generic));
}

try { rmSync(process.env.MI_DATA_DIR, { recursive: true, force: true }); } catch {}

const result = finalize('approval-operation-concurrency.mjs');
assert.equal(result.fail, 0);
