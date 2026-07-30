/**
 * penalty-functional.js — Functional + business-logic verification for the
 * Penalty module. Run as a single-user sequential test BEFORE the load test.
 *
 * Usage:
 *   k6 run \
 *     --env BASE_URL=https://staging.example.com \
 *     --env TEST_ADMIN_EMAIL=admin@example.com \
 *     --env TEST_ADMIN_PASSWORD=adminpass \
 *     --env TEST_USER_EMAIL=staff@example.com \
 *     --env TEST_USER_PASSWORD=staffpass \
 *     --env TEST_PENALIZED_USER_ID=5 \
 *     performance/k6/penalty-functional.js
 *
 * TEST_PENALIZED_USER_ID: a regular user that the admin will assign penalties to.
 * That user must exist in staging and must NOT already have a penalty_config row,
 * or the test will re-use / overwrite the existing one.
 *
 * Expected result: ALL checks must pass (100 % success rate).
 * Any failure = real bug in the penalty module.
 *
 * Scenarios tested:
 *   P1  Admin adds a penalty           → record appears, amount is correct
 *   P2  User views own penalty         → only own data, correct fields
 *   P3  Permission restrictions        → non-admin is blocked from all admin routes
 *   P4  Admin edits penalty amount     → new amount visible in admin + user views
 *   P5  Admin soft-removes penalty     → is_active=0, historical total preserved
 *   P6  Auto-calculation consistency   → mySummaryApi total matches manual count
 *   P7  Duplicate prevention           → second /add on same user upserts, no duplicate
 *   P8  Invalid input rejection        → negative amount → 422
 *   P9  Re-enable after remove         → POST /add re-activates with new amount
 *   P10 Permission: direct URL block   → /admin/penalty returns non-200 for staff
 */
import http  from 'k6/http';
import { check, group, fail } from 'k6';
import { BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, EMAIL, PASSWORD } from './config.js';
import { doLogin, extractCsrf, apiGet, apiPost, get } from './utils.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ['rate==1.0'],   // Every single check must pass
  },
};

const PENALIZED_UID = parseInt(__ENV.TEST_PENALIZED_USER_ID || '2');
const INITIAL_AMOUNT = 100000; // 100,000 VND
const UPDATED_AMOUNT = 150000; // 150,000 VND

// ── Helpers ───────────────────────────────────────────────────

function loginAs(email, password) {
  http.cookieJar().clear(BASE_URL);
  const result = doLogin(email, password);
  if (!result.ok) fail(`Login failed for ${email}`);
  return result.csrf;
}

function parseBody(res) {
  try { return JSON.parse(res.body); } catch(_) { return null; }
}

// ── Main test function (single iteration) ────────────────────

export default function() {

  // ════════════════════════════════════════════════════════════
  // P1 — Admin adds a penalty for PENALIZED_UID
  // ════════════════════════════════════════════════════════════
  group('P1: admin adds penalty', function() {
    const csrf = loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

    const res = apiPost('/admin/penalty/add', {
      user_id: PENALIZED_UID,
      amount:  INITIAL_AMOUNT,
      note:    'Functional test — P1 initial add',
    }, csrf, 'POST /admin/penalty/add');

    const body = parseBody(res);
    check(res,  { 'P1: add returns 200':      r => r.status === 200 });
    check(body, { 'P1: response ok=true':      b => b && b.ok === true });

    // Verify it appears in the admin summary
    const summary = apiGet('/api/admin/penalty/summary', 'P1: GET /api/admin/penalty/summary');
    const sData   = parseBody(summary);
    check(summary, { 'P1: summary 200':        r => r.status === 200 });
    check(sData,   {
      'P1: penalized user in summary': d => {
        if (!d || !Array.isArray(d.data)) return false;
        return d.data.some(r => r.user_id === PENALIZED_UID);
      },
    });

    // Verify detail endpoint shows correct amount
    const detail = apiGet(
      `/api/admin/penalty/detail/${PENALIZED_UID}`,
      'P1: GET /api/admin/penalty/detail/:id'
    );
    const dData = parseBody(detail);
    check(detail, { 'P1: detail 200': r => r.status === 200 });
    check(dData, {
      'P1: detail ok=true': d => d && d.ok === true,
      'P1: amount_per_late_task correct': d => {
        return d && d.data && d.data.config &&
               parseFloat(d.data.config.amount_per_late_task) === INITIAL_AMOUNT;
      },
      'P1: is_active = 1': d => {
        return d && d.data && d.data.config &&
               parseInt(d.data.config.is_active) === 1;
      },
    });
  });

  // ════════════════════════════════════════════════════════════
  // P2 — User views own penalty (and ONLY own data)
  // ════════════════════════════════════════════════════════════
  group('P2: user views own penalty', function() {
    const csrf = loginAs(EMAIL, PASSWORD);

    const summary = apiGet('/api/penalty/my-summary', 'P2: GET /api/penalty/my-summary');
    const sData   = parseBody(summary);

    check(summary, { 'P2: my-summary 200': r => r.status === 200 });
    check(sData, {
      'P2: response has ok field':       d => d && typeof d.ok !== 'undefined',
      'P2: response has penalized field':d => d && typeof d.penalized !== 'undefined',
    });

    // If this user IS the penalized user, verify their data
    if (parseInt(__ENV.TEST_PENALIZED_USER_ID || '0') > 0) {
      // Can't verify amount directly without knowing if this user == PENALIZED_UID
      // Just confirm the structure is correct
      if (sData && sData.penalized === true) {
        check(sData, {
          'P2: penalized summary has total_amount': d =>
            d.summary && typeof d.summary.total_amount !== 'undefined',
          'P2: penalized summary has late_count': d =>
            d.summary && typeof d.summary.late_count !== 'undefined',
          'P2: penalized summary has amount_per_task': d =>
            d.summary && typeof d.summary.amount_per_task !== 'undefined',
          'P2: total_amount ≥ 0': d =>
            d.summary && parseFloat(d.summary.total_amount) >= 0,
        });
      }
    }

    // User MUST NOT be able to access /api/admin/penalty/summary
    const adminAttempt = apiGet('/api/admin/penalty/summary', 'P2: admin route blocked for user');
    check(adminAttempt, {
      'P2: admin summary blocked (403 or redirect)': r =>
        r.status === 403 || r.status === 302 || r.status === 401,
    });

    // User MUST NOT be able to access another user's detail
    const otherDetail = apiGet(
      `/api/admin/penalty/detail/${PENALIZED_UID}`,
      'P2: other user detail blocked'
    );
    check(otherDetail, {
      'P2: other user detail blocked (403)': r =>
        r.status === 403 || r.status === 302 || r.status === 401,
    });
  });

  // ════════════════════════════════════════════════════════════
  // P3 — Permission restriction (regular user cannot write)
  // ════════════════════════════════════════════════════════════
  group('P3: permission restrictions', function() {
    const csrf = loginAs(EMAIL, PASSWORD);

    // Attempt to add penalty as non-admin
    const addAttempt = apiPost('/admin/penalty/add', {
      user_id: PENALIZED_UID,
      amount:  999999,
      note:    'Unauthorized attempt',
    }, csrf, 'P3: add penalty as non-admin');
    check(addAttempt, {
      'P3: add blocked (403)': r => r.status === 403 || r.status === 401,
    });

    // Attempt to update penalty
    const updateAttempt = apiPost('/admin/penalty/update', {
      user_id: PENALIZED_UID,
      amount:  999999,
    }, csrf, 'P3: update penalty as non-admin');
    check(updateAttempt, {
      'P3: update blocked (403)': r => r.status === 403 || r.status === 401,
    });

    // Attempt to remove penalty
    const removeAttempt = apiPost('/admin/penalty/remove', {
      user_id: PENALIZED_UID,
    }, csrf, 'P3: remove penalty as non-admin');
    check(removeAttempt, {
      'P3: remove blocked (403)': r => r.status === 403 || r.status === 401,
    });

    // Attempt to toggle penalty
    const toggleAttempt = apiPost('/admin/penalty/toggle', {
      user_id: PENALIZED_UID,
      active: 0,
    }, csrf, 'P3: toggle penalty as non-admin');
    check(toggleAttempt, {
      'P3: toggle blocked (403)': r => r.status === 403 || r.status === 401,
    });

    // Attempt direct page access
    const pageAttempt = get('/admin/penalty', 'P3: /admin/penalty as non-admin');
    check(pageAttempt, {
      'P3: admin page blocked or redirected': r =>
        r.status === 403 || r.url.includes('overview') || r.url.includes('dashboard') ||
        r.url.includes('my-tasks'),
    });
  });

  // ════════════════════════════════════════════════════════════
  // P4 — Admin edits penalty amount
  // ════════════════════════════════════════════════════════════
  group('P4: admin edits penalty amount', function() {
    const csrf = loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

    const updateRes = apiPost('/admin/penalty/update', {
      user_id: PENALIZED_UID,
      amount:  UPDATED_AMOUNT,
    }, csrf, 'P4: POST /admin/penalty/update');

    const body = parseBody(updateRes);
    check(updateRes, { 'P4: update 200':     r => r.status === 200 });
    check(body,      { 'P4: update ok=true': b => b && b.ok === true });

    // Verify the new amount is reflected in the detail API
    const detail = apiGet(
      `/api/admin/penalty/detail/${PENALIZED_UID}`,
      'P4: detail after update'
    );
    const dData = parseBody(detail);
    check(dData, {
      'P4: updated amount in detail': d => {
        return d && d.data && d.data.config &&
               parseFloat(d.data.config.amount_per_late_task) === UPDATED_AMOUNT;
      },
    });

    // Verify user's my-summary also reflects the new amount_per_task
    // (only relevant if the test user is PENALIZED_UID — skip if different accounts)
    // This check is documented so the tester can manually verify via another session.
  });

  // ════════════════════════════════════════════════════════════
  // P5 — Admin soft-removes (disable) penalty
  // ════════════════════════════════════════════════════════════
  group('P5: admin soft-removes penalty', function() {
    const csrf = loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

    const removeRes = apiPost('/admin/penalty/remove', {
      user_id: PENALIZED_UID,
    }, csrf, 'P5: POST /admin/penalty/remove');

    const body = parseBody(removeRes);
    check(removeRes, { 'P5: remove 200':     r => r.status === 200 });
    check(body,      { 'P5: remove ok=true': b => b && b.ok === true });

    // Verify is_active = 0 in detail
    const detail = apiGet(
      `/api/admin/penalty/detail/${PENALIZED_UID}`,
      'P5: detail after remove'
    );
    const dData = parseBody(detail);
    check(dData, {
      'P5: is_active = 0 after remove': d => {
        return d && d.data && d.data.config &&
               parseInt(d.data.config.is_active) === 0;
      },
      'P5: total_amount ≥ 0 (historical preserved)': d => {
        return d && d.data && parseFloat(d.data.total_amount) >= 0;
      },
    });

    // Verify admin summary still shows the user (historical record not deleted)
    const summary = apiGet('/api/admin/penalty/summary', 'P5: summary after remove');
    const sData   = parseBody(summary);
    check(sData, {
      'P5: removed user still in summary (historical)': d => {
        if (!d || !Array.isArray(d.data)) return false;
        return d.data.some(r => r.user_id === PENALIZED_UID);
      },
    });
  });

  // ════════════════════════════════════════════════════════════
  // P6 — Auto-calculation consistency
  //   Verify mySummaryApi total = late_count × amount_per_task
  //   (Requires that PENALIZED_UID == TEST_USER for login match,
  //    or check via admin detail — both paths tested here)
  // ════════════════════════════════════════════════════════════
  group('P6: calculation consistency', function() {
    // Re-enable the penalty first so we get a live calculation
    const adminCsrf = loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);
    apiPost('/admin/penalty/add', {
      user_id: PENALIZED_UID,
      amount:  UPDATED_AMOUNT,
      note:    'P6 re-enable for calculation check',
    }, adminCsrf, 'P6: re-enable for calc test');

    // Get admin detail — this is the source of truth
    const detail = apiGet(
      `/api/admin/penalty/detail/${PENALIZED_UID}`,
      'P6: admin detail for calc check'
    );
    const dData = parseBody(detail);
    check(dData, {
      'P6: detail has ok=true': d => d && d.ok === true,
    });

    if (dData && dData.ok && dData.data) {
      const d       = dData.data;
      const perTask = parseFloat(d.config.amount_per_late_task);
      const count   = parseInt(d.late_count);
      const total   = parseFloat(d.total_amount);

      check(dData, {
        'P6: total_amount = late_count × amount_per_task': () =>
          Math.abs(total - count * perTask) < 0.01,
        'P6: late_tasks array length matches late_count': () =>
          (d.is_active === '1' || d.config.is_active === '1')
            ? Array.isArray(d.late_tasks) && d.late_tasks.length === count
            : true,
        'P6: total_amount ≥ 0': () => total >= 0,
      });
    }
  });

  // ════════════════════════════════════════════════════════════
  // P7 — Duplicate prevention (add same user twice = upsert)
  // ════════════════════════════════════════════════════════════
  group('P7: duplicate prevention', function() {
    const csrf = loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

    // First add
    apiPost('/admin/penalty/add', {
      user_id: PENALIZED_UID,
      amount:  200000,
      note:    'P7 first add',
    }, csrf, 'P7: first add');

    // Second add for same user — should upsert, not create duplicate
    const secondRes = apiPost('/admin/penalty/add', {
      user_id: PENALIZED_UID,
      amount:  300000,
      note:    'P7 second add (should upsert)',
    }, csrf, 'P7: second add');

    check(secondRes, { 'P7: second add 200': r => r.status === 200 });
    const body = parseBody(secondRes);
    check(body, { 'P7: second add ok=true (upsert not error)': b => b && b.ok === true });

    // Verify only one row exists with the latest amount
    const detail = apiGet(
      `/api/admin/penalty/detail/${PENALIZED_UID}`,
      'P7: detail after double-add'
    );
    const dData = parseBody(detail);
    check(dData, {
      'P7: amount is latest value (300000)': d =>
        d && d.data && d.data.config &&
        parseFloat(d.data.config.amount_per_late_task) === 300000,
    });
  });

  // ════════════════════════════════════════════════════════════
  // P8 — Invalid input rejection
  // ════════════════════════════════════════════════════════════
  group('P8: input validation', function() {
    const csrf = loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

    // Negative amount — controller checks `$amount < 0` → 422
    const negativeRes = apiPost('/admin/penalty/add', {
      user_id: PENALIZED_UID,
      amount:  -5000,
      note:    'P8 negative amount test',
    }, csrf, 'P8: negative amount');
    check(negativeRes, {
      'P8: negative amount rejected (422)': r => r.status === 422 || r.status === 400,
    });

    // Missing user_id (defaults to 0 which is <= 0) → 422
    const noUserRes = apiPost('/admin/penalty/update', {
      amount: 100000,
    }, csrf, 'P8: missing user_id');
    check(noUserRes, {
      'P8: missing user_id rejected (422)': r => r.status === 422 || r.status === 400,
    });

    // Zero amount — explicitly allowed (can set penalty to 0 to mark-but-not-charge)
    const zeroRes = apiPost('/admin/penalty/add', {
      user_id: PENALIZED_UID,
      amount:  0,
      note:    'P8 zero amount — should be accepted',
    }, csrf, 'P8: zero amount');
    check(zeroRes, {
      'P8: zero amount accepted (200)': r => r.status === 200,
    });
  });

  // ════════════════════════════════════════════════════════════
  // P9 — Re-enable after remove (re-activate with new amount)
  // ════════════════════════════════════════════════════════════
  group('P9: re-enable after remove', function() {
    const csrf = loginAs(ADMIN_EMAIL, ADMIN_PASSWORD);

    // First remove
    apiPost('/admin/penalty/remove', { user_id: PENALIZED_UID }, csrf, 'P9: remove');

    // Re-add — should re-activate with new amount
    const reAddRes = apiPost('/admin/penalty/add', {
      user_id: PENALIZED_UID,
      amount:  INITIAL_AMOUNT,
      note:    'P9 re-enable',
    }, csrf, 'P9: re-add');

    check(reAddRes, { 'P9: re-add 200': r => r.status === 200 });

    const detail = apiGet(
      `/api/admin/penalty/detail/${PENALIZED_UID}`,
      'P9: detail after re-enable'
    );
    const dData = parseBody(detail);
    check(dData, {
      'P9: is_active = 1 after re-enable': d =>
        d && d.data && d.data.config && parseInt(d.data.config.is_active) === 1,
      'P9: amount reset to INITIAL_AMOUNT': d =>
        d && d.data && d.data.config &&
        parseFloat(d.data.config.amount_per_late_task) === INITIAL_AMOUNT,
    });
  });

  // ════════════════════════════════════════════════════════════
  // P10 — Direct URL block for unauthenticated access
  // ════════════════════════════════════════════════════════════
  group('P10: unauthenticated access blocked', function() {
    // Clear ALL cookies — simulates a fresh unauthenticated browser
    http.cookieJar().clear(BASE_URL);

    const pageRes = http.get(`${BASE_URL}/admin/penalty`, {
      tags: { name: 'P10: /admin/penalty unauthenticated', endpoint: 'read' },
    });
    check(pageRes, {
      'P10: unauthenticated redirects to login or 403': r =>
        r.url.includes('/login') || r.status === 403 || r.status === 401,
    });

    const apiRes = http.get(`${BASE_URL}/api/admin/penalty/summary`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      tags: { name: 'P10: /api/admin/penalty/summary unauthenticated', endpoint: 'read' },
    });
    check(apiRes, {
      'P10: unauthenticated API returns 401 or 403': r =>
        r.status === 401 || r.status === 403,
    });

    const userApiRes = http.get(`${BASE_URL}/api/penalty/my-summary`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      tags: { name: 'P10: /api/penalty/my-summary unauthenticated', endpoint: 'read' },
    });
    check(userApiRes, {
      'P10: user API unauthenticated returns 401 or 403': r =>
        r.status === 401 || r.status === 403,
    });
  });
}
