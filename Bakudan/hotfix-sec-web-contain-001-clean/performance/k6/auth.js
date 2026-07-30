/**
 * auth.js — Authentication flow tests
 *
 * Covers:
 *  - login (admin, manager, staff)
 *  - logout + re-login
 *  - session persistence
 *  - unauthorized access to protected pages
 *  - CSRF enforcement (tampered/missing token)
 *
 * Run standalone:
 *   k6 run --env BASE_URL=https://dashboard.bakudanramen.com performance/k6/auth.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import {
  BASE_URL, ROLES, thinkTime, shortPause, parseCSRF, login, randomItem,
} from './config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const loginSuccess    = new Counter('auth_login_success');
const loginFailure    = new Counter('auth_login_failure');
const csrfBlocked     = new Counter('auth_csrf_blocked');
const unauthorizedHit = new Counter('auth_unauthorized_hit');

// ── k6 options ────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    auth_smoke: {
      executor: 'shared-iterations',
      vus: 20,
      iterations: 400,
      maxDuration: '5m',
      tags: { scenario: 'auth' },
    },
  },
  thresholds: {
    'http_req_duration{scenario:auth}': ['p(95)<3000'],
    'http_req_failed{scenario:auth}':   ['rate<0.02'],
    checks:                              ['rate>=0.90'],
  },
};

// ── Roles to cycle through ────────────────────────────────────────────────────
const ROLE_LIST = [ROLES.admin, ROLES.manager, ROLES.user];

// ── Unauthorized access targets ───────────────────────────────────────────────
const PROTECTED_PAGES = [
  '/?route=overview',
  '/?route=admin/deadline-extensions',
  '/?route=team',
  '/?route=my-tasks',
  '/?route=bills',
];

const PROTECTED_APIS = [
  '/api/sidebar/badges',
  '/api/notifications',
  '/api/team/summary',
  '/api/deadline-extensions/quota',
];

// ── Main test function ────────────────────────────────────────────────────────
export default function () {
  const jar = new http.CookieJar();
  const params = { jar, redirects: 5 };

  const creds = randomItem(ROLE_LIST);

  // ── Group 1: Unauthorized access (before login) ───────────────────────────
  group('unauthorized_access', () => {
    const page = randomItem(PROTECTED_PAGES);
    const res = http.get(`${BASE_URL}${page}`, { jar, redirects: 0 });
    const blocked = check(res, {
      'protected page: redirected to login (302/303)': (r) =>
        r.status === 302 || r.status === 303 ||
        (r.url && r.url.includes('login')) ||
        r.body.includes('login'),
    });
    if (blocked) unauthorizedHit.add(1);
    shortPause();

    // Protected API without session
    const apiPath = randomItem(PROTECTED_APIS);
    const apiRes = http.get(`${BASE_URL}${apiPath}`, {
      jar,
      headers: { Accept: 'application/json' },
    });
    check(apiRes, {
      'protected API: 401 or redirect without session': (r) =>
        r.status === 401 || r.status === 302 || r.status === 403,
    });
    shortPause();
  });

  // ── Group 2: Valid login ──────────────────────────────────────────────────
  group('valid_login', () => {
    const loginPage = http.get(`${BASE_URL}/?route=login`, params);
    check(loginPage, { 'login page loads': (r) => r.status === 200 });
    const csrf = parseCSRF(loginPage.body);

    const res = http.post(
      `${BASE_URL}/?route=login`,
      { email: creds.email, password: creds.password, csrf_token: csrf },
      params
    );
    const ok = check(res, {
      'login: success (200 or redirect)': (r) => r.status === 200 || r.status === 302 || r.status === 303,
      'login: no error message':          (r) => !r.body.includes('Invalid email or password'),
    });
    if (ok) loginSuccess.add(1); else loginFailure.add(1);
    shortPause();
  });

  // ── Group 3: Session validation ───────────────────────────────────────────
  group('session_validation', () => {
    // After login, protected pages should now be accessible
    const res = http.get(`${BASE_URL}/?route=my-tasks`, params);
    check(res, {
      'authenticated: my-tasks accessible':    (r) => r.status === 200,
      'authenticated: not redirected to login': (r) =>
        !(r.url && r.url.includes('login')) && !r.body.includes('Login to TaskFlow'),
    });
    shortPause();

    // Sidebar badges should return JSON
    const badge = http.get(`${BASE_URL}/api/sidebar/badges`, {
      jar,
      headers: { Accept: 'application/json' },
    });
    check(badge, {
      'sidebar badges: 200': (r) => r.status === 200,
      'sidebar badges: JSON with priority field': (r) => {
        try { const d = JSON.parse(r.body); return typeof d.priority === 'number'; }
        catch (_) { return false; }
      },
    });
    shortPause();
  });

  // ── Group 4: CSRF enforcement ─────────────────────────────────────────────
  group('csrf_enforcement', () => {
    // POST with missing CSRF token — should be blocked (403) or redirect
    const res = http.post(
      `${BASE_URL}/api/deadline-extensions/request`,
      { task_id: '1', new_due_date: '2099-01-01', reason: 'test', csrf_token: 'INVALID_TOKEN' },
      { jar, headers: { Accept: 'application/json' } }
    );
    const blocked = check(res, {
      'CSRF: invalid token blocked (403 or error)': (r) =>
        r.status === 403 || r.status === 401 ||
        (r.body && r.body.includes('Invalid CSRF')),
    });
    if (blocked) csrfBlocked.add(1);
    shortPause();
  });

  // ── Group 5: Logout ───────────────────────────────────────────────────────
  group('logout', () => {
    const res = http.get(`${BASE_URL}/?route=logout`, params);
    check(res, {
      'logout: redirects': (r) => r.status === 200 || r.status === 302 || r.status === 303,
    });

    // After logout, protected pages must redirect again
    const afterLogout = http.get(`${BASE_URL}/?route=my-tasks`, { jar, redirects: 0 });
    check(afterLogout, {
      'after logout: protected page blocked': (r) =>
        r.status === 302 || r.status === 303 || r.body.includes('login'),
    });
    shortPause();
  });

  // ── Group 6: Wrong credentials ────────────────────────────────────────────
  group('wrong_credentials', () => {
    const freshJar = new http.CookieJar();
    const loginPage = http.get(`${BASE_URL}/?route=login`, { jar: freshJar });
    const csrf = parseCSRF(loginPage.body);

    const res = http.post(
      `${BASE_URL}/?route=login`,
      { email: 'notreal@example.com', password: 'wrongpassword', csrf_token: csrf },
      { jar: freshJar }
    );
    check(res, {
      'wrong creds: not successful login': (r) =>
        r.body.includes('Invalid') || r.body.includes('invalid') ||
        r.body.includes('error') || r.url.includes('login'),
    });
    loginFailure.add(1);
  });

  thinkTime();
}

export function handleSummary(data) {
  return {
    'performance/reports/auth-summary.json': JSON.stringify(data, null, 2),
  };
}
