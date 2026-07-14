/**
 * Multiprocess approval-claim concurrency regression.
 *
 * Spawns real child Node processes against the same isolated SQLite DB and
 * approval ID. Exactly one process may claim the approval before side effects.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { section, check, finalize } from './_harness.mjs';

process.env.NODE_ENV = 'test';
process.env.SEO_SECURITY_TEST_MODE = '1';
process.env.MI_DATA_DIR = mkdtempSync(join(tmpdir(), 'seo-claim-concurrency-'));
process.env.SEO_APPROVAL_TTL_MS = String(60 * 1000);

const gate = await import('../../approval/gate.ts');
const { bindSeoApproval, validateSeoApproval } = await import('../seo-approval-binding.ts');

const expected = {
  category: 'rollback',
  action: 'rollback_snapshot',
  target: 'snap-race',
  brand_id: 'bakudan',
  location_id: null,
  actor_id: 'ceo-test',
  payload_hash: null,
};

const action = gate.enqueue({
  risk_level: 3,
  category: expected.category,
  description: 'race claim test',
  target: expected.target,
  before_state: null,
  after_state: null,
  rollback_plan: 'test only',
});
bindSeoApproval(action.id, expected);
gate.approve(action.id, 'ceo-1');
gate.approve(action.id, 'ceo-2');

const workerPath = join(process.env.MI_DATA_DIR, 'claim-worker.mjs');
writeFileSync(workerPath, `
import { claimSeoApproval } from ${JSON.stringify(new URL('../seo-approval-binding.ts', import.meta.url).href)};
const expected = JSON.parse(process.env.EXPECTED_APPROVAL);
const result = claimSeoApproval(process.env.APPROVAL_ID, expected, 'ceo-test', 'child-claim');
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
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('close', code => {
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

section('Multiprocess claim race');
{
  const results = await Promise.all(Array.from({ length: 8 }, () => runWorker()));
  const parsed = results.map(r => {
    try { return JSON.parse(r.stdout.split(/\r?\n/).pop() || '{}'); } catch { return { ok: false, parse_error: r }; }
  });
  const winners = parsed.filter(r => r.ok).length;
  const losers = parsed.filter(r => r.reason === 'approval_claimed' || r.reason === 'approval_consumed' || r.reason === 'approval_not_approved').length;
  check('all child claim processes exited cleanly', results.every(r => r.code === 0), JSON.stringify(results));
  check('exactly one child process claimed the approval', winners === 1, JSON.stringify(parsed));
  check('all other child processes were rejected after the claim', losers === 7, JSON.stringify(parsed));
  check('approval is no longer valid after winning pre-side-effect claim',
    validateSeoApproval(action.id, expected).ok === false);
}

try { rmSync(process.env.MI_DATA_DIR, { recursive: true, force: true }); } catch {}

const result = finalize('approval-claim-concurrency.mjs');
assert.equal(result.fail, 0);
