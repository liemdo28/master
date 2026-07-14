/**
 * Object-ID scope and route policy regression tests.
 *
 * Verifies SEO middleware resolves stored resource scope instead of trusting
 * client-supplied brand/location fields on object-ID mutation routes.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { section, check, finalize } from './_harness.mjs';

process.env.NODE_ENV = 'test';
process.env.SEO_SECURITY_TEST_MODE = '1';
process.env.MI_DATA_DIR = mkdtempSync(join(tmpdir(), 'seo-resource-scope-'));
process.env.SEO_APPROVAL_TTL_MS = String(24 * 60 * 60 * 1000);

const auth = await import('../../routes/auth.ts');
const gate = await import('../../approval/gate.ts');
const { getSeoDb, nowIso } = await import('../seo-db.ts');
const { bindSeoApproval, hashPayload } = await import('../seo-approval-binding.ts');
const security = await import('../seo-security.ts');

const db = getSeoDb();
const now = nowIso();

db.prepare(`INSERT INTO seo_actions (id, created_at, brand_id, category, policy_tier, description, status, target)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('gbp-raw-modesto', now, 'raw_sushi', 'gbp_post_publish', 'REQUIRES_APPROVAL', 'Raw Sushi GBP post', 'pending', 'modesto');
db.prepare(`INSERT INTO seo_publish_snapshots (id, created_at, brand_id, content_id, target, before_state, after_state, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('snap-raw', now, 'raw_sushi', 'content-raw', 'production', '{}', '{}', 'pending');
db.prepare(`INSERT INTO seo_publish_snapshots (id, created_at, brand_id, content_id, target, before_state, after_state, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('snap-bakudan', now, 'bakudan', 'content-bakudan', 'production', '{}', '{}', 'pending');
db.prepare(`INSERT INTO seo_content_items (id, created_at, updated_at, brand_id, location_id, title, slug, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('article-raw', now, now, 'raw_sushi', 'modesto', 'Raw article', 'raw-article', 'IDEA');
db.prepare(`INSERT INTO seo_backlinks (id, created_at, updated_at, brand_id, source_domain, source_url, destination_url, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('backlink-raw', now, now, 'raw_sushi', 'example.com', 'https://example.com/raw', 'https://raw.example.com', 'PENDING');
db.prepare(`INSERT INTO seo_keywords (id, created_at, updated_at, brand_id, location_id, keyword, normalized_keyword, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('kw-raw', now, now, 'raw_sushi', 'modesto', 'sushi near me', 'sushi near me', 'DISCOVERED');
db.prepare(`INSERT INTO seo_business_facts (id, created_at, updated_at, brand_id, location_id, category, field_name, value, source, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('fact-raw', now, now, 'raw_sushi', 'modesto', 'hours', 'weekday_hours', '11-9', 'test', 'UNVERIFIED');

function makeReq({ method = 'POST', path, session, body = {}, query = {}, params = {} }) {
  return {
    method,
    path,
    url: path,
    originalUrl: path,
    headers: {
      authorization: `Bearer ${session.token}`,
      'x-csrf-token': session.csrf_token,
    },
    body,
    query,
    params,
    ip: '127.0.0.1',
  };
}

function runMiddleware(req) {
  let statusCode = 200;
  let payload = null;
  let nextCalled = false;
  const res = {
    status(code) { statusCode = code; return this; },
    json(data) { payload = data; return this; },
  };
  security.requireSeoAccess(req, res, () => { nextCalled = true; });
  return { statusCode, payload, nextCalled };
}

function approvalFor(expected) {
  const action = gate.enqueue({
    risk_level: 3,
    category: expected.category,
    description: expected.action,
    target: expected.target,
    before_state: null,
    after_state: null,
    rollback_plan: 'test only',
  });
  bindSeoApproval(action.id, expected);
  gate.approve(action.id, 'ceo-1');
  gate.approve(action.id, 'ceo-2');
  return action.id;
}

function routePayloadHash({ route = '/publish/:brandId/:snapshotId/rollback', resourceId = 'snap-bakudan', brandId = 'bakudan', locationId = null, category = 'rollback', action = 'rollback_snapshot', target = 'snap-bakudan' } = {}) {
  return hashPayload({
    route,
    resource_id: resourceId,
    brand_id: brandId,
    location_id: locationId,
    category,
    action,
    target,
  });
}

section('Object-ID resource scope');
{
  const bakudanCeo = auth.__createTestSessionForAuth({ role: 'CEO', brand_scope: ['bakudan'], location_scope: ['stone_oak'] });
  const stocktonCeo = auth.__createTestSessionForAuth({ role: 'CEO', brand_scope: ['raw_sushi'], location_scope: ['stockton'] });

  check('Bakudan-scoped CEO cannot publish Raw Sushi GBP action by ID',
    runMiddleware(makeReq({ path: '/api/seo/gbp/posts/gbp-raw-modesto/publish', session: bakudanCeo, body: { brand_id: 'bakudan' } })).payload?.error === 'seo_resource_scope_violation');

  check('Stockton-scoped CEO cannot operate on Modesto GBP action ID',
    runMiddleware(makeReq({ path: '/api/seo/gbp/posts/gbp-raw-modesto/publish', session: stocktonCeo, body: { brand_id: 'raw_sushi', location_id: 'stockton' } })).payload?.error === 'seo_resource_scope_violation');

  check('user cannot rollback snapshot belonging to another brand',
    runMiddleware(makeReq({ path: '/api/seo/publish/raw_sushi/snap-raw/rollback', session: bakudanCeo, body: { brand_id: 'bakudan' } })).payload?.error === 'seo_resource_scope_violation');

  check('user cannot edit article by ID outside scope',
    runMiddleware(makeReq({ method: 'PATCH', path: '/api/seo/calendar/items/article-raw', session: bakudanCeo, body: { brand_id: 'bakudan', title: 'tamper' } })).payload?.error === 'seo_resource_scope_violation');

  check('user cannot approve backlink outside scope',
    runMiddleware(makeReq({ path: '/api/seo/backlinks/backlink-raw/approve', session: bakudanCeo, body: { brand_id: 'bakudan' } })).payload?.error === 'seo_resource_scope_violation');

  check('user cannot approve keyword outside scope',
    runMiddleware(makeReq({ path: '/api/seo/keywords/kw-raw/approve', session: bakudanCeo, body: { brand_id: 'bakudan' } })).payload?.error === 'seo_resource_scope_violation');

  check('user cannot verify business fact outside scope',
    runMiddleware(makeReq({ path: '/api/seo/facts/fact-raw/verify', session: bakudanCeo, body: { brand_id: 'bakudan', verified_by: 'tester' } })).payload?.error === 'seo_resource_scope_violation');

  check('user cannot view evidence outside explicit scope',
    runMiddleware(makeReq({ method: 'GET', path: '/api/seo/evidence', session: bakudanCeo, query: { brand_id: 'raw_sushi' } })).payload?.error === 'seo_scope_violation');

  check('server canonical resource scope overrides conflicting client body values',
    runMiddleware(makeReq({ path: '/api/seo/gbp/posts/gbp-raw-modesto/publish', session: bakudanCeo, body: { brand_id: 'bakudan', location_id: 'stone_oak' } })).payload?.error === 'seo_resource_scope_violation');

  const wildcard = auth.__createTestSessionForAuth({ role: 'CEO', brand_scope: ['*'], location_scope: ['*'] });
  const approvalId = approvalFor({
    category: 'rollback',
    action: 'rollback_snapshot',
    target: 'snap-bakudan',
    brand_id: 'bakudan',
    location_id: null,
    actor_id: 'ceo-test',
    payload_hash: routePayloadHash(),
  });
  const allowed = runMiddleware(makeReq({
    path: '/api/seo/publish/bakudan/snap-bakudan/rollback',
    session: wildcard,
    body: { approval_id: approvalId },
  }));
  check('wildcard CEO scope still works for bound high-risk resource', allowed.nextCalled === true);

  const wrongActor = runMiddleware(makeReq({
    path: '/api/seo/publish/bakudan/snap-bakudan/rollback',
    session: wildcard,
    body: {
      approval_id: approvalFor({
        category: 'rollback',
        action: 'rollback_snapshot',
        target: 'snap-bakudan',
        brand_id: 'bakudan',
        location_id: null,
        actor_id: 'someone-else',
        payload_hash: routePayloadHash(),
      }),
    },
  }));
  check('actor-bound approval rejects mismatched session actor', wrongActor.payload?.error === 'seo_approval_actor_mismatch');

  const payloadBound = approvalFor({
    category: 'rollback',
    action: 'rollback_snapshot',
    target: 'snap-bakudan',
    brand_id: 'bakudan',
    location_id: null,
    actor_id: 'ceo-test',
    payload_hash: hashPayload({ wrong: 'payload' }),
  });
  const payloadMismatch = runMiddleware(makeReq({
    path: '/api/seo/publish/bakudan/snap-bakudan/rollback',
    session: wildcard,
    body: { approval_id: payloadBound, reason: 'tampered' },
  }));
  check('payload-bound approval rejects mismatched request payload', payloadMismatch.payload?.error === 'seo_approval_payload_mismatch');

  const payloadMatch = runMiddleware(makeReq({
    path: '/api/seo/publish/bakudan/snap-bakudan/rollback',
    session: wildcard,
    body: {
      approval_id: approvalFor({
        category: 'rollback',
        action: 'rollback_snapshot',
        target: 'snap-bakudan',
        brand_id: 'bakudan',
        location_id: null,
        actor_id: 'ceo-test',
        payload_hash: routePayloadHash(),
      }),
      reason: 'approved-maintenance',
    },
  }));
  check('payload-bound approval accepts exact request payload', payloadMatch.nextCalled === true);
}

section('Unknown route fail-closed and audit durability');
{
  const ceo = auth.__createTestSessionForAuth({ role: 'CEO', brand_scope: ['*'], location_scope: ['*'] });
  check('unknown POST mutation path is blocked',
    runMiddleware(makeReq({ path: '/api/seo/unknown/mutate', session: ceo })).payload?.error === 'seo_route_policy_missing');
  check('unknown PATCH mutation path is blocked',
    runMiddleware(makeReq({ method: 'PATCH', path: '/api/seo/unknown/mutate', session: ceo })).payload?.error === 'seo_route_policy_missing');
  check('unknown DELETE mutation path is blocked',
    runMiddleware(makeReq({ method: 'DELETE', path: '/api/seo/unknown/mutate', session: ceo })).payload?.error === 'seo_route_policy_missing');

  process.env.SEO_AUDIT_FAIL_FOR_TEST = '1';
  const readAudit = runMiddleware(makeReq({ method: 'GET', path: '/api/seo/calendar', session: ceo }));
  check('read-only route can continue if audit persistence fails', readAudit.nextCalled === true);

  const auditApproval = approvalFor({
    category: 'rollback',
    action: 'rollback_snapshot',
    target: 'snap-bakudan',
    brand_id: 'bakudan',
    location_id: null,
    actor_id: 'ceo-test',
    payload_hash: routePayloadHash(),
  });
  const highRiskAudit = runMiddleware(makeReq({
    path: '/api/seo/publish/bakudan/snap-bakudan/rollback',
    session: ceo,
    body: { approval_id: auditApproval },
  }));
  check('high-risk mutation blocks when audit persistence fails',
    highRiskAudit.statusCode === 503 && highRiskAudit.payload?.error === 'seo_audit_unavailable');

  delete process.env.SEO_AUDIT_FAIL_FOR_TEST;
  const auditRecovered = runMiddleware(makeReq({
    path: '/api/seo/publish/bakudan/snap-bakudan/rollback',
    session: ceo,
    body: { approval_id: approvalFor({ category: 'rollback', action: 'rollback_snapshot', target: 'snap-bakudan', brand_id: 'bakudan', location_id: null, actor_id: 'ceo-test', payload_hash: routePayloadHash() }) },
  }));
  check('high-risk mutation proceeds again after audit persistence recovers', auditRecovered.nextCalled === true);
}

try { rmSync(process.env.MI_DATA_DIR, { recursive: true, force: true }); } catch {}

const result = finalize('resource-scope-security.mjs');
assert.equal(result.fail, 0);
