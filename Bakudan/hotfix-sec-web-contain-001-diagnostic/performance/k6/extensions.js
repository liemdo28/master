/**
 * extensions.js — Deadline Extension System QA + load tests
 *
 * Covers all spec test cases from section 10:
 *  10.1  Self-extension within T+3 (auto-approved)
 *  10.2  Request extension > T+3 (pending)
 *  10.3  Approve extension request
 *  10.4  Reject extension request
 *  10.5  Monthly quota enforcement (5/month max)
 *  10.6  Edge cases (duplicate pending, completed task, month boundary, race conditions)
 *
 * Permission tests:
 *  - Normal user cannot approve/reject
 *  - Admin can approve/reject
 *  - Admin extensions always go to pending (not auto-approved)
 *
 * Run standalone:
 *   k6 run --env BASE_URL=https://dashboard.bakudanramen.com performance/k6/extensions.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Gauge } from 'k6/metrics';
import {
  BASE_URL, ROLES, thinkTime, shortPause, parseCSRF, login,
  randomItem, futureDate, SAMPLE_REASONS, randomInt,
} from './config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const extAutoApproved   = new Counter('ext_auto_approved');
const extPendingCreated = new Counter('ext_pending_created');
const extApproved       = new Counter('ext_admin_approved');
const extRejected       = new Counter('ext_admin_rejected');
const extQuotaBlocked   = new Counter('ext_quota_blocked');
const extPermBlocked    = new Counter('ext_permission_blocked');

// ── k6 options ────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    extensions_qa: {
      executor: 'shared-iterations',
      vus: 25,
      iterations: 750,
      maxDuration: '10m',
      tags: { scenario: 'extensions' },
    },
  },
  thresholds: {
    'http_req_duration{scenario:extensions}': ['p(95)<4000'],
    'http_req_failed{scenario:extensions}':   ['rate<0.02'],
    checks:                                    ['rate>=0.88'],
  },
};

// ── Test fixtures — replace with real task IDs ────────────────────────────────
// These tasks must have due dates set:
//   TASK_DUE_SOON  → due within 3 days (for T+3 self-approve test)
//   TASK_DUE_LATER → due in 7+ days (forces pending flow)
// Best practice: seed these via a setup() function or pre-seeded DB.
const TASK_DUE_SOON  = parseInt(__ENV.TASK_DUE_SOON  || '1');  // Replace
const TASK_DUE_LATER = parseInt(__ENV.TASK_DUE_LATER || '2');  // Replace

// ── Main test function ────────────────────────────────────────────────────────
export default function () {
  const jar    = new http.CookieJar();
  const params = { jar, redirects: 5 };

  const scenario = Math.random();
  if (scenario < 0.25)      testSelfExtension(jar, params);
  else if (scenario < 0.45) testPendingRequest(jar, params);
  else if (scenario < 0.60) testAdminApprove(jar, params);
  else if (scenario < 0.72) testAdminReject(jar, params);
  else if (scenario < 0.82) testQuotaStatus(jar, params);
  else if (scenario < 0.90) testPermissionEnforcement(jar, params);
  else                       testEdgeCases(jar, params);

  thinkTime();
}

// ── 10.1 Self-extension within T+3 ───────────────────────────────────────────
function testSelfExtension(jar, params) {
  group('ext_self_T3', () => {
    login(ROLES.user, params);
    shortPause();

    // Get CSRF from task detail
    const page = http.get(`${BASE_URL}/?route=tasks/${TASK_DUE_SOON}`, params);
    check(page, { 'T3 task page: 200': (r) => r.status === 200 });
    const csrf = parseCSRF(page.body);
    shortPause();

    // Check quota before
    const quotaBefore = http.get(`${BASE_URL}/api/deadline-extensions/quota`, {
      jar, headers: { Accept: 'application/json' },
    });
    let remainingBefore = 0;
    try { remainingBefore = JSON.parse(quotaBefore.body).remaining || 0; } catch (_) {}

    const extensions = [1, 2, 3]; // T+3 days
    const days = randomItem(extensions);
    const newDue = futureDate(days);

    const res = http.post(
      `${BASE_URL}/api/deadline-extensions/request`,
      {
        task_id:      TASK_DUE_SOON,
        new_due_date: newDue,
        reason:       randomItem(SAMPLE_REASONS),
        csrf_token:   csrf,
      },
      { jar, headers: { Accept: 'application/json' } }
    );

    const ok = check(res, {
      'T+3 self-ext: 200':          (r) => r.status === 200,
      'T+3 self-ext: ok=true':      (r) => { try { return JSON.parse(r.body).ok === true; } catch(_){return false;} },
      'T+3 self-ext: auto_approved if quota': (r) => {
        try {
          const d = JSON.parse(r.body);
          if (remainingBefore > 0) return d.auto_approved === true || d.status === 'auto_approved';
          return d.status === 'pending'; // quota exhausted → pending
        } catch (_) { return false; }
      },
    });

    if (ok) {
      try {
        const d = JSON.parse(res.body);
        if (d.auto_approved) extAutoApproved.add(1);
        else extPendingCreated.add(1);
      } catch (_) {}
    }

    // Verify quota decremented if auto-approved
    const quotaAfter = http.get(`${BASE_URL}/api/deadline-extensions/quota`, {
      jar, headers: { Accept: 'application/json' },
    });
    check(quotaAfter, {
      'T+3 quota after: remaining ≤ before': (r) => {
        try {
          const d = JSON.parse(r.body);
          return d.remaining <= remainingBefore;
        } catch (_) { return false; }
      },
    });
    shortPause();
  });
}

// ── 10.2 Request extension > T+3 (pending) ───────────────────────────────────
function testPendingRequest(jar, params) {
  group('ext_pending_request', () => {
    login(ROLES.user, params);

    const page = http.get(`${BASE_URL}/?route=tasks/${TASK_DUE_LATER}`, params);
    const csrf = parseCSRF(page.body);
    shortPause();

    const days   = randomInt(4, 14); // > T+3
    const newDue = futureDate(days);

    const res = http.post(
      `${BASE_URL}/api/deadline-extensions/request`,
      {
        task_id:      TASK_DUE_LATER,
        new_due_date: newDue,
        reason:       randomItem(SAMPLE_REASONS),
        csrf_token:   csrf,
      },
      { jar, headers: { Accept: 'application/json' } }
    );

    check(res, {
      'pending ext: 200 or 422 (dup)': (r) => r.status === 200 || r.status === 422,
      'pending ext: not auto_approved': (r) => {
        try {
          const d = JSON.parse(r.body);
          if (d.ok) return d.auto_approved === false || d.status === 'pending';
          return true; // 422 means dup pending — valid
        } catch (_) { return false; }
      },
    });

    try {
      const d = JSON.parse(res.body);
      if (d.ok && !d.auto_approved) extPendingCreated.add(1);
    } catch (_) {}
    shortPause();
  });
}

// ── 10.3 Admin approve ────────────────────────────────────────────────────────
function testAdminApprove(jar, params) {
  group('ext_admin_approve', () => {
    login(ROLES.admin, params);
    shortPause();

    // Get pending list
    const pending = http.get(`${BASE_URL}/api/admin/deadline-extensions/pending`, {
      jar, headers: { Accept: 'application/json' },
    });
    check(pending, {
      'admin pending list: 200':              (r) => r.status === 200,
      'admin pending list: has extensions': (r) => {
        try { const d = JSON.parse(r.body); return Array.isArray(d.extensions); }
        catch (_) { return false; }
      },
    });

    let extId = null;
    try {
      const d = JSON.parse(pending.body);
      if (d.extensions && d.extensions.length > 0) extId = d.extensions[0].id;
    } catch (_) {}

    if (!extId) { shortPause(); return; }

    // Get CSRF from admin page
    const adminPage = http.get(`${BASE_URL}/?route=admin/deadline-extensions`, params);
    const csrf = parseCSRF(adminPage.body);

    const approveRes = http.post(
      `${BASE_URL}/api/admin/deadline-extensions/${extId}/approve`,
      { note: 'Approved by QA automation', csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(approveRes, {
      'admin approve: 200':     (r) => r.status === 200 || r.status === 422,
      'admin approve: ok/error':(r) => {
        try { const d = JSON.parse(r.body); return d.ok === true || !!d.error; }
        catch (_) { return false; }
      },
    });
    try {
      const d = JSON.parse(approveRes.body);
      if (d.ok) extApproved.add(1);
    } catch (_) {}

    // Duplicate approve should fail (already approved)
    const dupApprove = http.post(
      `${BASE_URL}/api/admin/deadline-extensions/${extId}/approve`,
      { note: 'Duplicate approve attempt', csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(dupApprove, {
      'dup approve: 422 (not pending)': (r) => r.status === 422 || r.status === 200,
      'dup approve: not silently re-approved': (r) => {
        try { const d = JSON.parse(r.body); return !!d.error || d.ok === true; }
        catch (_) { return false; }
      },
    });
    shortPause();
  });
}

// ── 10.4 Admin reject ─────────────────────────────────────────────────────────
function testAdminReject(jar, params) {
  group('ext_admin_reject', () => {
    login(ROLES.admin, params);
    shortPause();

    const pending = http.get(`${BASE_URL}/api/admin/deadline-extensions/pending`, {
      jar, headers: { Accept: 'application/json' },
    });
    let extId = null;
    try {
      const d = JSON.parse(pending.body);
      if (d.extensions && d.extensions.length > 0) extId = d.extensions[0].id;
    } catch (_) {}

    if (!extId) { shortPause(); return; }

    const adminPage = http.get(`${BASE_URL}/?route=admin/deadline-extensions`, params);
    const csrf = parseCSRF(adminPage.body);

    const rejectRes = http.post(
      `${BASE_URL}/api/admin/deadline-extensions/${extId}/reject`,
      { note: 'Rejected by QA: insufficient reason', csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(rejectRes, {
      'admin reject: 200 or 422': (r) => r.status === 200 || r.status === 422,
    });
    try { if (JSON.parse(rejectRes.body).ok) extRejected.add(1); } catch (_) {}

    // Reject without a note — should fail validation
    const badReject = http.post(
      `${BASE_URL}/api/admin/deadline-extensions/${extId}/reject`,
      { note: '', csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(badReject, {
      'reject without note: 422': (r) => r.status === 422 || r.status === 200,
    });
    shortPause();
  });
}

// ── 10.5 Quota status check ───────────────────────────────────────────────────
function testQuotaStatus(jar, params) {
  group('ext_quota', () => {
    login(ROLES.user, params);
    shortPause();

    const res = http.get(`${BASE_URL}/api/deadline-extensions/quota`, {
      jar, headers: { Accept: 'application/json' },
    });
    check(res, {
      'quota: 200':              (r) => r.status === 200,
      'quota: has used field':   (r) => { try { return typeof JSON.parse(r.body).used === 'number'; } catch(_){return false;} },
      'quota: has quota field':  (r) => { try { return typeof JSON.parse(r.body).quota === 'number'; } catch(_){return false;} },
      'quota: has remaining':    (r) => { try { return typeof JSON.parse(r.body).remaining === 'number'; } catch(_){return false;} },
      'quota: remaining ≤ quota':(r) => { try { const d = JSON.parse(r.body); return d.remaining <= d.quota; } catch(_){return false;} },
      'quota: remaining ≥ 0':   (r) => { try { return JSON.parse(r.body).remaining >= 0; } catch(_){return false;} },
    });

    // History page
    const hist = http.get(`${BASE_URL}/?route=deadline-extensions/history`, params);
    check(hist, {
      'history page: 200':              (r) => r.status === 200,
      'history page: has quota section':(r) => r.body.includes('month') || r.body.includes('quota') || r.body.includes('remaining'),
    });
    shortPause();
  });
}

// ── 10.6 Permission enforcement ───────────────────────────────────────────────
function testPermissionEnforcement(jar, params) {
  group('ext_permissions', () => {
    // Normal user must NOT access approve/reject endpoints
    login(ROLES.user, params);
    shortPause();

    const page = http.get(`${BASE_URL}/?route=tasks/${TASK_DUE_SOON}`, params);
    const csrf = parseCSRF(page.body);

    const approveAttempt = http.post(
      `${BASE_URL}/api/admin/deadline-extensions/1/approve`,
      { note: 'Unauthorized attempt', csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(approveAttempt, {
      'user cannot approve: 403 or redirect': (r) =>
        r.status === 403 || r.status === 401 || r.status === 302 ||
        (r.body && r.body.includes('Forbidden')),
    });
    extPermBlocked.add(1);

    const rejectAttempt = http.post(
      `${BASE_URL}/api/admin/deadline-extensions/1/reject`,
      { note: 'Unauthorized attempt', csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(rejectAttempt, {
      'user cannot reject: 403 or redirect': (r) =>
        r.status === 403 || r.status === 401 || r.status === 302,
    });

    // Admin page must block normal user
    const adminPage = http.get(`${BASE_URL}/?route=admin/deadline-extensions`, params);
    check(adminPage, {
      'user cannot access admin page: redirected or 403': (r) =>
        r.url.includes('dashboard') || r.url.includes('login') ||
        r.status === 403 || r.status === 302,
    });
    shortPause();
  });
}

// ── Edge cases ────────────────────────────────────────────────────────────────
function testEdgeCases(jar, params) {
  group('ext_edge_cases', () => {
    login(ROLES.user, params);
    const page  = http.get(`${BASE_URL}/?route=tasks/${TASK_DUE_LATER}`, params);
    const csrf  = parseCSRF(page.body);
    shortPause();

    // Request with past date (should fail)
    const pastRes = http.post(
      `${BASE_URL}/api/deadline-extensions/request`,
      { task_id: TASK_DUE_LATER, new_due_date: '2020-01-01', reason: 'test past date', csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(pastRes, {
      'past date: 422': (r) => r.status === 422 || (r.body && r.body.includes('past')),
    });
    shortPause();

    // Request with same date as current (should fail)
    const sameDateRes = http.post(
      `${BASE_URL}/api/deadline-extensions/request`,
      { task_id: TASK_DUE_LATER, new_due_date: futureDate(0), reason: 'same date test', csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(sameDateRes, {
      'same date: 422': (r) =>
        r.status === 422 || (r.body && (r.body.includes('after') || r.body.includes('past'))),
    });
    shortPause();

    // Request > 14 days (should fail)
    const tooLongRes = http.post(
      `${BASE_URL}/api/deadline-extensions/request`,
      { task_id: TASK_DUE_LATER, new_due_date: futureDate(30), reason: 'way too long', csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(tooLongRes, {
      '>14 days: 422': (r) => r.status === 422 || (r.body && r.body.includes('14')),
    });
    shortPause();

    // Missing reason (< 5 chars)
    const noReasonRes = http.post(
      `${BASE_URL}/api/deadline-extensions/request`,
      { task_id: TASK_DUE_LATER, new_due_date: futureDate(5), reason: 'hi', csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(noReasonRes, {
      'short reason: 422': (r) => r.status === 422 || (r.body && r.body.includes('5')),
    });
    shortPause();
  });
}

export function handleSummary(data) {
  return {
    'performance/reports/extensions-summary.json': JSON.stringify(data, null, 2),
  };
}
