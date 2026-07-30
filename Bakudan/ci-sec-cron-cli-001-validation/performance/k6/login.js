/**
 * Scenario A — Auth flow (login → browse → logout)
 * Represents ~15 % of total traffic.
 * Exported as scenarioAuth(state) for use by mixed-flow.js.
 */
import http  from 'k6/http';
import { check, group } from 'k6';
import { BASE_URL } from './config.js';
import { doLogin, get, thinkTime } from './utils.js';

/**
 * Run a complete login→use→logout cycle.
 * Clears the VU cookie jar before login so this always exercises
 * a genuine authentication handshake.
 *
 * @param {object} state  - VU-level mutable state { loggedIn, csrf }
 */
export function scenarioAuth(state) {
  group('Scenario A: auth flow', function() {

    // Force a fresh session — this is what makes the scenario realistic
    http.cookieJar().clear(BASE_URL);
    state.loggedIn = false;
    state.csrf     = '';

    // ── Step 1: load login page ──────────────────────────────
    const loginPage = get('/login', 'GET /login');
    check(loginPage, { 'login page 200': r => r.status === 200 });
    thinkTime(0.5, 1.5);

    // ── Step 2: submit credentials ───────────────────────────
    const result = doLogin();
    state.csrf     = result.csrf;
    state.loggedIn = result.ok;

    if (!result.ok) return;
    thinkTime(1, 2);

    // ── Step 3: load dashboard (first thing a real user sees) ─
    const dash = get('/my-tasks', 'GET /my-tasks');
    check(dash, { 'dashboard 200': r => r.status === 200 });
    thinkTime(1, 3);

    // ── Step 4: check notification badge (lightweight API) ───
    const notifs = http.get(`${BASE_URL}/api/notifications`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      tags: { name: 'GET /api/notifications', endpoint: 'read' },
    });
    check(notifs, {
      'notifications 200': r => r.status === 200,
      'notifications JSON': r => r.headers['Content-Type'] && r.headers['Content-Type'].includes('json'),
    });
    thinkTime(0.5, 1);

    // ── Step 5: logout ───────────────────────────────────────
    const out = get('/logout', 'GET /logout');
    check(out, { 'logout redirects': r => r.status === 200 || r.status === 302 });

    state.loggedIn = false;
    state.csrf     = '';
  });
}
