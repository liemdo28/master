/**
 * SEO route security tests.
 *
 * Runs the real /api/seo middleware without starting Mi-Core or touching PM2.
 * These assertions prove SEO Control Center does not inherit the general
 * localhost dashboard bypass and that mutations require session auth, role
 * permission, scope, CSRF, and fresh approvals where applicable.
 *
 * Usage:
 *   npx tsx src/seo/__tests__/route-security.mjs
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { section, check, finalize } from './_harness.mjs';

process.env.NODE_ENV = 'test';
process.env.SEO_SECURITY_TEST_MODE = '1';
process.env.MI_DATA_DIR = mkdtempSync(join(tmpdir(), 'seo-route-security-'));
process.env.SEO_APPROVAL_TTL_MS = String(24 * 60 * 60 * 1000);

const auth = await import('../../routes/auth.ts');
const gate = await import('../../approval/gate.ts');
const { getOpsDb } = await import('../../operations/ops-db.ts');
const security = await import('../seo-security.ts');
const { bindSeoApproval, hashPayload } = await import('../seo-approval-binding.ts');
const { getSeoDb, nowIso } = await import('../seo-db.ts');

getSeoDb().prepare(`INSERT INTO seo_publish_snapshots (id, created_at, brand_id, content_id, target, before_state, after_state, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run('snapshot-1', nowIso(), 'bakudan', 'content-1', 'production', '{}', '{}', 'pending');

function routePayloadHash({ route = '/publish/:brandId/:snapshotId/publish', resourceId = 'snapshot-1', brandId = 'bakudan', locationId = null, category = 'production_deploy', action = 'publish_snapshot', target = 'snapshot-1' } = {}) {
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

function makeReq({ method = 'GET', path = '/api/seo/calendar', token, csrf, body = {}, query = {}, params = {}, ip = '127.0.0.1' } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (csrf) headers['x-csrf-token'] = csrf;
  return {
    method,
    path,
    url: path,
    originalUrl: path,
    headers,
    body,
    query,
    params,
    ip,
    socket: { remoteAddress: ip },
  };
}

function runMiddleware(req) {
  let statusCode = 200;
  let payload = null;
  let nextCalled = false;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      payload = data;
      return this;
    },
  };
  security.requireSeoAccess(req, res, () => { nextCalled = true; });
  return { statusCode, payload, nextCalled, req };
}

function approvedAction({ ageMs = 0, target = 'snapshot-1', category = 'production_deploy', actionKey = 'publish_snapshot', brandId = 'bakudan', locationId = null, actorId = 'ceo-test' } = {}) {
  const action = gate.enqueue({
    risk_level: 3,
    category,
    description: 'test publish approval',
    target,
    before_state: null,
    after_state: null,
    rollback_plan: 'test rollback only',
  });
  bindSeoApproval(action.id, {
    category,
    action: actionKey,
    target,
    brand_id: brandId,
    location_id: locationId,
    actor_id: actorId,
    payload_hash: routePayloadHash({ brandId, locationId, category, action: actionKey, target, resourceId: target }),
  });
  gate.approve(action.id, 'ceo-1');
  gate.approve(action.id, 'ceo-2');
  if (ageMs > 0) {
    const oldIso = new Date(Date.now() - ageMs).toISOString();
    getOpsDb().prepare('UPDATE approval_queue SET resolved_at = ? WHERE id = ?').run(oldIso, action.id);
  }
  return action.id;
}

section('Strict session auth');
{
  const res = runMiddleware(makeReq({ method: 'GET', path: '/api/seo/calendar' }));
  check('anonymous SEO GET is blocked even from localhost', res.statusCode === 401 && res.payload?.error === 'seo_bearer_auth_required');

  const expired = auth.__createTestSessionForAuth({ role: 'SEO_VIEWER', ttlMs: -1 });
  const expiredRes = runMiddleware(makeReq({ token: expired.token }));
  check('expired session is blocked', expiredRes.statusCode === 401 && expiredRes.payload?.error === 'seo_bearer_auth_required');
}

section('RBAC matrix');
{
  const viewer = auth.__createTestSessionForAuth({ role: 'SEO_VIEWER' });
  const viewerPost = runMiddleware(makeReq({
    method: 'POST',
    path: '/api/seo/calendar/items',
    token: viewer.token,
    csrf: viewer.csrf_token,
    body: { brand_id: 'bakudan' },
  }));
  check('SEO_VIEWER cannot mutate calendar', viewerPost.statusCode === 403 && viewerPost.payload?.error === 'seo_forbidden');

  const manager = auth.__createTestSessionForAuth({ role: 'SEO_MANAGER', brand_scope: ['*'], location_scope: ['*'] });
  const keywordPost = runMiddleware(makeReq({
    method: 'POST',
    path: '/api/seo/keywords',
    token: manager.token,
    csrf: manager.csrf_token,
    body: { brand_id: 'bakudan' },
  }));
  check('SEO_MANAGER can create keyword with CSRF', keywordPost.nextCalled === true);

  const managerPublish = runMiddleware(makeReq({
    method: 'POST',
    path: '/api/seo/publish/bakudan/snapshot-1/publish',
    token: manager.token,
    csrf: manager.csrf_token,
    body: { approval_id: approvedAction() },
  }));
  check('SEO_MANAGER cannot production-publish even with approval id', managerPublish.statusCode === 403 && managerPublish.payload?.error === 'seo_forbidden');

  const admin = auth.__createTestSessionForAuth({ role: 'ADMIN' });
  const adminPublish = runMiddleware(makeReq({
    method: 'POST',
    path: '/api/seo/publish/bakudan/snapshot-1/publish',
    token: admin.token,
    csrf: admin.csrf_token,
    body: { approval_id: approvedAction() },
  }));
  check('ADMIN cannot bypass CEO-only production approval', adminPublish.statusCode === 403 && adminPublish.payload?.error === 'seo_forbidden');
}

section('CSRF and scope isolation');
{
  const manager = auth.__createTestSessionForAuth({ role: 'SEO_MANAGER', brand_scope: ['bakudan'], location_scope: ['stone_oak'] });

  const noCsrf = runMiddleware(makeReq({
    method: 'POST',
    path: '/api/seo/keywords',
    token: manager.token,
    body: { brand_id: 'bakudan', location_id: 'stone_oak' },
  }));
  check('mutation without CSRF is blocked', noCsrf.statusCode === 403 && noCsrf.payload?.error === 'seo_csrf_required');

  const crossBrand = runMiddleware(makeReq({
    method: 'POST',
    path: '/api/seo/keywords',
    token: manager.token,
    csrf: manager.csrf_token,
    body: { brand_id: 'raw_sushi', location_id: 'stone_oak' },
  }));
  check('cross-brand mutation is blocked', crossBrand.statusCode === 403 && crossBrand.payload?.error === 'seo_scope_violation');

  const crossLocation = runMiddleware(makeReq({
    method: 'POST',
    path: '/api/seo/keywords',
    token: manager.token,
    csrf: manager.csrf_token,
    body: { brand_id: 'bakudan', location_id: 'outside_scope' },
  }));
  check('cross-location mutation is blocked', crossLocation.statusCode === 403 && crossLocation.payload?.error === 'seo_scope_violation');
}

section('Fresh approval enforcement');
{
  const ceo = auth.__createTestSessionForAuth({ role: 'CEO', brand_scope: ['*'], location_scope: ['*'] });
  const missingApproval = runMiddleware(makeReq({
    method: 'POST',
    path: '/api/seo/publish/bakudan/snapshot-1/publish',
    token: ceo.token,
    csrf: ceo.csrf_token,
  }));
  check('CEO production publish still requires approval id', missingApproval.statusCode === 403 && missingApproval.payload?.error === 'seo_missing_approval_id');

  const expiredApproval = approvedAction({ ageMs: 25 * 60 * 60 * 1000 });
  const expiredRes = runMiddleware(makeReq({
    method: 'POST',
    path: '/api/seo/publish/bakudan/snapshot-1/publish',
    token: ceo.token,
    csrf: ceo.csrf_token,
    body: { approval_id: expiredApproval },
  }));
  check('expired approval cannot authorize production publish', expiredRes.statusCode === 403 && expiredRes.payload?.error === 'seo_approval_expired');

  const freshApproval = approvedAction();
  const freshRes = runMiddleware(makeReq({
    method: 'POST',
    path: '/api/seo/publish/bakudan/snapshot-1/publish',
    token: ceo.token,
    csrf: ceo.csrf_token,
    body: { approval_id: freshApproval },
  }));
  check('CEO + CSRF + fresh approved action passes middleware', freshRes.nextCalled === true);
}

section('RBAC documentation shape');
{
  const matrix = security.getSeoRbacMatrix();
  check('matrix exposes all required roles', ['CEO', 'ADMIN', 'SEO_MANAGER', 'SEO_VIEWER'].every(r => Array.isArray(matrix[r])));
  check('only CEO has production_approval', matrix.CEO.includes('production_approval') && !matrix.ADMIN.includes('production_approval') && !matrix.SEO_MANAGER.includes('production_approval'));
}

try {
  rmSync(process.env.MI_DATA_DIR, { recursive: true, force: true });
} catch {}

const result = finalize('route-security.mjs');
assert.equal(result.fail, 0);
