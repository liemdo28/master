/**
 * Bound SEO approval regression tests.
 *
 * These tests exercise the binding table directly so they can prove exact
 * category/action/target/scope matching and one-time consumption without
 * enabling any live publisher.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { section, check, finalize } from './_harness.mjs';

process.env.NODE_ENV = 'test';
process.env.SEO_SECURITY_TEST_MODE = '1';
process.env.MI_DATA_DIR = mkdtempSync(join(tmpdir(), 'seo-approval-binding-'));
process.env.SEO_APPROVAL_TTL_MS = String(60 * 1000);

const gate = await import('../../approval/gate.ts');
const { getOpsDb } = await import('../../operations/ops-db.ts');
const {
  bindSeoApproval,
  validateSeoApproval,
  consumeSeoApproval,
  claimSeoApproval,
  hashPayload,
} = await import('../seo-approval-binding.ts');

function createApproval(expected, { risk = 2, status = 'approved' } = {}) {
  const action = gate.enqueue({
    risk_level: risk,
    category: expected.category,
    description: `${expected.action} ${expected.target}`,
    target: expected.target,
    before_state: null,
    after_state: null,
    rollback_plan: 'test only',
  });
  bindSeoApproval(action.id, expected);
  if (status === 'approved') {
    gate.approve(action.id, 'security-test');
    if (risk === 3) gate.approve(action.id, 'security-test-2');
  } else if (status === 'rejected') {
    gate.reject(action.id, 'security-test');
  }
  return action.id;
}

const base = {
  category: 'article_publish',
  action: 'publish_article',
  target: 'article-A',
  brand_id: 'bakudan',
  location_id: 'stone_oak',
  actor_id: 'actor-1',
  payload_hash: hashPayload({ title: 'Article A' }),
};

section('Exact approval binding');
{
  const id = createApproval(base);
  check('matching bound approval validates', validateSeoApproval(id, base).ok === true);
  check('article-publish approval cannot authorize rollback',
    validateSeoApproval(id, { ...base, category: 'rollback', action: 'rollback_snapshot' }).reason === 'approval_category_mismatch');
  check('approval for article A cannot publish article B',
    validateSeoApproval(id, { ...base, target: 'article-B' }).reason === 'approval_target_mismatch');
  check('approval for Bakudan cannot authorize Raw Sushi',
    validateSeoApproval(id, { ...base, brand_id: 'raw_sushi' }).reason === 'approval_brand_mismatch');
  check('approval for location A cannot authorize location B',
    validateSeoApproval(id, { ...base, location_id: 'modesto' }).reason === 'approval_location_mismatch');
  check('mismatched action rejected',
    validateSeoApproval(id, { ...base, action: 'publish_gbp_post' }).reason === 'approval_action_mismatch');
  check('payload-hash mismatch rejected where configured',
    validateSeoApproval(id, { ...base, payload_hash: hashPayload({ title: 'Tampered' }) }).reason === 'approval_payload_mismatch');
  check('missing expected actor is rejected when approval is actor-bound',
    validateSeoApproval(id, { ...base, actor_id: null }).reason === 'approval_actor_mismatch');
  check('missing expected payload hash is rejected when approval is payload-bound',
    validateSeoApproval(id, { ...base, payload_hash: null }).reason === 'approval_payload_mismatch');

  const noActor = createApproval({ ...base, target: 'no-actor', actor_id: null });
  check('missing binding actor is rejected when request expects actor',
    validateSeoApproval(noActor, { ...base, target: 'no-actor' }).reason === 'approval_actor_mismatch');

  const noPayload = createApproval({ ...base, target: 'no-payload', payload_hash: null });
  check('missing binding payload hash is rejected when request expects payload hash',
    validateSeoApproval(noPayload, { ...base, target: 'no-payload' }).reason === 'approval_payload_mismatch');
}

section('Approval state and TTL');
{
  const pendingId = createApproval({ ...base, target: 'pending-A' }, { status: 'pending' });
  check('pending approval rejected', validateSeoApproval(pendingId, { ...base, target: 'pending-A' }).reason === 'approval_not_approved');

  const rejectedId = createApproval({ ...base, target: 'rejected-A' }, { status: 'rejected' });
  check('rejected approval rejected', validateSeoApproval(rejectedId, { ...base, target: 'rejected-A' }).reason === 'approval_not_approved');

  const expiredId = createApproval({ ...base, target: 'expired-A' });
  const oldResolved = new Date(Date.now() - 120 * 1000).toISOString();
  getOpsDb().prepare('UPDATE approval_queue SET resolved_at = ?, created_at = ? WHERE id = ?')
    .run(oldResolved, new Date().toISOString(), expiredId);
  check('expired approval rejected based on resolved_at',
    validateSeoApproval(expiredId, { ...base, target: 'expired-A' }).reason === 'approval_expired');

  const unbound = gate.enqueue({
    risk_level: 2,
    category: 'article_publish',
    description: 'legacy unbound approval',
    target: 'legacy-A',
    before_state: null,
    after_state: null,
    rollback_plan: 'test only',
  });
  gate.approve(unbound.id, 'security-test');
  check('old unbound approvals are rejected for SEO high-risk actions',
    validateSeoApproval(unbound.id, { ...base, target: 'legacy-A' }).reason === 'approval_unbound');
}

section('One-time consumption');
{
  const consumeId = createApproval({ ...base, target: 'consume-A' });
  const first = consumeSeoApproval(consumeId, 'actor-1', 'published');
  check('successful operation consumes approval', first.ok === true);
  check('executed approval rejected after consumption',
    validateSeoApproval(consumeId, { ...base, target: 'consume-A' }).reason === 'approval_not_approved');

  const duplicate = consumeSeoApproval(consumeId, 'actor-1', 'published-again');
  check('approval cannot be reused after successful execution', duplicate.ok === false);

  const preMutationId = createApproval({ ...base, target: 'premutation-A' });
  const bad = validateSeoApproval(preMutationId, { ...base, target: 'other-target' });
  const stillGood = validateSeoApproval(preMutationId, { ...base, target: 'premutation-A' });
  check('failed pre-mutation validation does not consume approval', bad.ok === false && stillGood.ok === true);

  const raceId = createApproval({ ...base, target: 'race-A' });
  const attempts = [
    claimSeoApproval(raceId, { ...base, target: 'race-A' }, 'actor-1', 'race-1'),
    claimSeoApproval(raceId, { ...base, target: 'race-A' }, 'actor-1', 'race-2'),
    claimSeoApproval(raceId, { ...base, target: 'race-A' }, 'actor-1', 'race-3'),
  ];
  check('duplicate pre-side-effect claims cannot all use the same approval',
    attempts.filter(a => a.ok).length === 1 && attempts.filter(a => !a.ok).length === 2);
}

try { rmSync(process.env.MI_DATA_DIR, { recursive: true, force: true }); } catch {}

const result = finalize('approval-binding-security.mjs');
assert.equal(result.fail, 0);
