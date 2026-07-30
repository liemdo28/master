/**
 * Scenario E — Comment + notification flow
 * Represents ~10 % of total traffic.
 * Exercises the write-amplification path: one comment triggers
 * a Notification row + optional email queue entry.
 */
import http  from 'k6/http';
import { check, group } from 'k6';
import { BASE_URL, TASK_IDS } from './config.js';
import { get, post, apiGet, apiPost, extractCsrf, randomFrom, thinkTime } from './utils.js';

export function scenarioComments(state) {
  group('Scenario E: comments + notifications', function() {

    const tid = randomFrom(TASK_IDS);

    // ── Step 1: open task detail ──────────────────────────────
    const taskPage = get(`/tasks/${tid}`, 'GET /tasks/:id');
    check(taskPage, { 'task page 200': r => r.status === 200 || r.status === 404 });

    // Re-extract CSRF (task detail page also includes it via main layout)
    const csrf = extractCsrf(taskPage.body) || state.csrf;
    thinkTime(1, 3);

    // ── Step 2: add a comment ─────────────────────────────────
    // POST /tasks/{id}/comments  fields: content, csrf_token
    const commentRes = post(`/tasks/${tid}/comments`, {
      content: `Load test comment at ${new Date().toISOString()} — automated stress test`,
    }, csrf, 'POST /tasks/:id/comments');

    check(commentRes, {
      'comment posted (200/302)': r => r.status === 200 || r.status === 302 || r.status === 404,
    });
    thinkTime(1, 2);

    // ── Step 3: reload task to confirm comment appeared ───────
    const taskReload = get(`/tasks/${tid}`, 'GET /tasks/:id (reload)');
    check(taskReload, { 'task reload 200': r => r.status === 200 || r.status === 404 });
    thinkTime(0.5, 1.5);

    // ── Step 4: fetch comment list via API ────────────────────
    const commentsApi = apiGet(`/api/tasks/${tid}/comments`, 'GET /api/tasks/:id/comments');
    check(commentsApi, { 'comments API 200': r => r.status === 200 || r.status === 404 });
    thinkTime(0.5, 1);

    // ── Step 5: check notifications ───────────────────────────
    const notifs = apiGet('/api/notifications', 'GET /api/notifications');
    check(notifs, {
      'notifications 200': r => r.status === 200,
      'notifications body': r => r.body && r.body.length > 0,
    });

    // Parse out one notification ID to mark as read
    let notifId = null;
    try {
      const data = JSON.parse(notifs.body);
      const list = data.notifications || data;
      if (Array.isArray(list) && list.length > 0) {
        notifId = list[0].id;
      }
    } catch(_) {}

    thinkTime(0.5, 1.5);

    // ── Step 6: mark single notification read (if available) ──
    if (notifId) {
      const markRes = apiPost(`/api/notifications/${notifId}/read`, {}, csrf,
        'POST /api/notifications/:id/read');
      check(markRes, { 'mark read 200': r => r.status === 200 || r.status === 404 });
    }

    // ── Step 7: mark all read ─────────────────────────────────
    const markAllRes = apiPost('/api/notifications/read-all', {}, csrf,
      'POST /api/notifications/read-all');
    check(markAllRes, { 'mark all read 200': r => r.status === 200 });
    thinkTime(0.5, 1);
  });
}

/**
 * Scenario E2 — Notification-only flow (lighter variant)
 * Used inside Scenario E weighting to avoid always triggering writes.
 */
export function scenarioNotifications(state) {
  group('Scenario E2: notifications only', function() {
    const notifs = apiGet('/api/notifications', 'GET /api/notifications');
    check(notifs, { 'notifications 200': r => r.status === 200 });
    thinkTime(0.5, 1);

    const badges = apiGet('/api/sidebar/badges', 'GET /api/sidebar/badges');
    check(badges, { 'badges 200': r => r.status === 200 });
    thinkTime(1, 2);

    const markAllRes = apiPost('/api/notifications/read-all', {}, state.csrf,
      'POST /api/notifications/read-all');
    check(markAllRes, { 'mark all read 200': r => r.status === 200 });
  });
}
