/**
 * Penalty load scenarios — integrated into mixed-flow.js
 *
 * scenarioPenaltyUserRead  — 7 % of traffic (any logged-in user)
 * scenarioPenaltyAdminRead — 5 % of traffic (admin only; 403 acceptable for non-admin)
 * scenarioPenaltyAdminWrite— 3 % of traffic (admin only; 403 acceptable for non-admin)
 *
 * For maximum accuracy run the full test with TEST_USER_EMAIL pointing to
 * an admin account, or set TEST_ADMIN_EMAIL separately and let mixed-flow
 * route the admin scenarios to a dedicated executor pool.
 *
 * Penalty module routes (confirmed from PenaltyController.php):
 *   GET  /admin/penalty                      → admin management page
 *   POST /admin/penalty/add                  → add/re-enable user  {user_id,amount,note,csrf_token}
 *   POST /admin/penalty/update               → change amount        {user_id,amount,csrf_token}
 *   POST /admin/penalty/remove               → soft-disable         {user_id,csrf_token}
 *   POST /admin/penalty/toggle               → set is_active        {user_id,active,csrf_token}
 *   GET  /api/admin/penalty/detail/{userId}  → user breakdown (JSON)
 *   GET  /api/admin/penalty/summary          → all summaries (JSON)
 *   GET  /api/penalty/my-summary             → current user summary (JSON)
 */
import http  from 'k6/http';
import { check, group } from 'k6';
import { BASE_URL, PROJECT_IDS, TASK_IDS } from './config.js';
import { get, apiGet, apiPost, extractCsrf, randomFrom, thinkTime } from './utils.js';

// ── Scenario: user views own penalty summary ──────────────────
export function scenarioPenaltyUserRead(state) {
  group('Scenario P-user: own penalty summary', function() {

    // ── Step 1: check my penalty summary (lightweight JSON) ──
    const summary = apiGet('/api/penalty/my-summary', 'GET /api/penalty/my-summary');
    check(summary, {
      'my-summary 200': r => r.status === 200,
      'my-summary JSON': r => {
        try {
          const d = JSON.parse(r.body);
          return typeof d.ok !== 'undefined' && typeof d.penalized !== 'undefined';
        } catch(_) { return false; }
      },
    });
    thinkTime(0.5, 1.5);

    // ── Step 2: if penalized, also load a task detail to see
    //           the penalty chip on the task row ───────────────
    let isPenalized = false;
    try {
      const d = JSON.parse(summary.body);
      isPenalized = d.penalized === true;
    } catch(_) {}

    if (isPenalized) {
      const tid = randomFrom(TASK_IDS);
      const task = get(`/tasks/${tid}`, 'GET /tasks/:id (penalty chip)');
      check(task, { 'task with penalty 200': r => r.status === 200 || r.status === 404 });
      thinkTime(1, 2);
    }

    // ── Step 3: check dashboard — penalty banner visible ─────
    const dash = get('/my-tasks', 'GET /my-tasks (penalty banner)');
    check(dash, { 'dashboard with penalty 200': r => r.status === 200 });
    thinkTime(0.5, 1);
  });
}

// ── Scenario: admin reads penalty list and detail ─────────────
export function scenarioPenaltyAdminRead(state) {
  group('Scenario P-admin-read: penalty management page', function() {

    // ── Step 1: open penalty management page ─────────────────
    const page = get('/admin/penalty', 'GET /admin/penalty');
    check(page, {
      'admin penalty page 200 or 302': r => r.status === 200 || r.status === 302,
    });

    // Re-extract CSRF (admin pages also have main layout CSRF)
    const csrf = extractCsrf(page.body) || state.csrf;
    thinkTime(1, 2);

    // ── Step 2: fetch all summaries JSON ─────────────────────
    const summaries = apiGet('/api/admin/penalty/summary', 'GET /api/admin/penalty/summary');
    check(summaries, {
      'admin summary 200 or 403': r => r.status === 200 || r.status === 403,
    });

    // Parse one user ID from summaries to use for detail lookup
    let targetUserId = null;
    try {
      const d = JSON.parse(summaries.body);
      if (d.ok && Array.isArray(d.data) && d.data.length > 0) {
        targetUserId = d.data[0].user_id;
      }
    } catch(_) {}

    thinkTime(0.5, 1.5);

    // ── Step 3: open detail for that user ────────────────────
    if (targetUserId) {
      const detail = apiGet(
        `/api/admin/penalty/detail/${targetUserId}`,
        'GET /api/admin/penalty/detail/:id'
      );
      check(detail, {
        'admin detail 200 or 403': r => r.status === 200 || r.status === 403,
        'admin detail JSON': r => {
          try { JSON.parse(r.body); return true; } catch(_) { return false; }
        },
      });
    }
    thinkTime(1, 2);
  });
}

// ── Scenario: admin writes (add / update / toggle) ────────────
// NOTE: intentionally does NOT add a full remove in the load
// scenario — removal would deplete test data. Use penalty-
// functional.js for the full lifecycle test.
export function scenarioPenaltyAdminWrite(state) {
  group('Scenario P-admin-write: add and update penalty', function() {

    // Load the page to get a fresh CSRF and a list of user IDs
    const page = get('/admin/penalty', 'GET /admin/penalty');
    check(page, { 'penalty page loaded': r => r.status === 200 || r.status === 302 });
    const csrf = extractCsrf(page.body) || state.csrf;
    thinkTime(1, 2);

    // ── Step 1: fetch user list to pick a random target ───────
    // /api/users/assignable returns {id, name, role, ...}
    const usersRes = apiGet('/api/users/assignable', 'GET /api/users/assignable');
    let testUserId = 1;
    try {
      const users = JSON.parse(usersRes.body);
      if (Array.isArray(users) && users.length > 0) {
        testUserId = randomFrom(users).id;
      }
    } catch(_) {}

    // ── Step 2: add or update penalty for that user ───────────
    const amount = (Math.floor(Math.random() * 10) + 1) * 50000; // 50k–500k VND
    const addRes = apiPost('/admin/penalty/add', {
      user_id: testUserId,
      amount:  amount,
      note:    'Load test — automated entry',
    }, csrf, 'POST /admin/penalty/add');

    check(addRes, {
      'penalty add 200 or 403': r => r.status === 200 || r.status === 403,
      'penalty add JSON': r => {
        try { JSON.parse(r.body); return true; } catch(_) { return false; }
      },
    });
    thinkTime(0.5, 1.5);

    // ── Step 3: update the amount for the same user ───────────
    const newAmount = amount + 50000;
    const updateRes = apiPost('/admin/penalty/update', {
      user_id: testUserId,
      amount:  newAmount,
    }, csrf, 'POST /admin/penalty/update');

    check(updateRes, {
      'penalty update 200 or 403': r => r.status === 200 || r.status === 403,
    });
    thinkTime(0.5, 1);

    // ── Step 4: toggle active/inactive ────────────────────────
    const toggleRes = apiPost('/admin/penalty/toggle', {
      user_id: testUserId,
      active:  1,
    }, csrf, 'POST /admin/penalty/toggle');

    check(toggleRes, {
      'penalty toggle 200 or 403': r => r.status === 200 || r.status === 403,
    });
    thinkTime(1, 2);

    // ── Step 5: reload admin summary to see updated totals ────
    const summary = apiGet('/api/admin/penalty/summary', 'GET /api/admin/penalty/summary (post-write)');
    check(summary, {
      'summary reloaded 200 or 403': r => r.status === 200 || r.status === 403,
    });
    thinkTime(0.5, 1);
  });
}
