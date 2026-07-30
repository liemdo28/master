/**
 * smoke.js — Phase 1 Smoke Test
 *
 * Purpose: Fast validation that the system is reachable, core routes respond,
 *          CSRF works, login works, and no catastrophic errors exist.
 *
 * Scale: 20 VUs × 100 iterations = 2,000 loops
 *
 * Pass criteria:
 *  - Error rate < 2%
 *  - p95 latency < 5 seconds (lenient for smoke)
 *  - All critical checks pass
 *
 * Run:
 *   k6 run --env BASE_URL=https://dashboard.bakudanramen.com performance/k6/smoke.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import {
  BASE_URL, ROLES, shortPause, thinkTime, parseCSRF, login, randomItem,
} from './config.js';

// ── k6 options ────────────────────────────────────────────────────────────────
export const options = {
  vus:        20,
  iterations: 2000,
  maxDuration: '8m',
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed:   ['rate<0.02'],
    checks:             ['rate>=0.90'],
  },
  tags: { phase: 'smoke' },
};

// ── Critical routes to probe ──────────────────────────────────────────────────
const CRITICAL_ROUTES = [
  { path: '/?route=login',      name: 'Login page',     auth: false },
  { path: '/?route=dashboard',  name: 'Dashboard',      auth: true  },
  { path: '/?route=my-tasks',   name: 'My Tasks',       auth: true  },
  { path: '/?route=calendar',   name: 'Calendar',       auth: true  },
  { path: '/?route=inbox',      name: 'Inbox',          auth: true  },
  { path: '/api/sidebar/badges',name: 'Sidebar badges', auth: true  },
  { path: '/api/notifications', name: 'Notifications',  auth: true  },
];

const API_ROUTES = [
  '/api/version',
  '/api/sidebar/badges',
  '/api/notifications',
  '/api/deadline-extensions/quota',
];

const ROLE_LIST = [ROLES.admin, ROLES.manager, ROLES.user];

// ── Main test function ────────────────────────────────────────────────────────
export default function () {
  const jar    = new http.CookieJar();
  const params = { jar, redirects: 5 };
  const creds  = randomItem(ROLE_LIST);

  // ── Group 1: Pre-auth route check ─────────────────────────────────────────
  group('smoke_pre_auth', () => {
    // Version endpoint (public)
    const ver = http.get(`${BASE_URL}/api/version`);
    check(ver, {
      'version: 200':           (r) => r.status === 200,
      'version: valid JSON':    (r) => { try { JSON.parse(r.body); return true; } catch(_){ return false; } },
      'version: has php field': (r) => { try { return !!JSON.parse(r.body).php; } catch(_){ return false; } },
    });
    shortPause();

    // Login page loads
    const loginPage = http.get(`${BASE_URL}/?route=login`, params);
    check(loginPage, {
      'login page: 200':           (r) => r.status === 200,
      'login page: has form':      (r) => r.body.includes('<form'),
      'login page: has csrf':      (r) => r.body.includes('csrf_token'),
      'login page: no PHP error':  (r) =>
        !r.body.includes('Fatal error') &&
        !r.body.includes('Parse error') &&
        !r.body.includes('Uncaught'),
    });
    shortPause();
  });

  // ── Group 2: Login ────────────────────────────────────────────────────────
  group('smoke_login', () => {
    login(creds, params);
    shortPause();
  });

  // ── Group 3: Critical route check ─────────────────────────────────────────
  group('smoke_critical_routes', () => {
    const route = randomItem(CRITICAL_ROUTES.filter((r) => r.auth));
    const res   = http.get(`${BASE_URL}${route.path}`, {
      jar,
      headers: { Accept: route.path.startsWith('/api') ? 'application/json' : 'text/html' },
      redirects: 5,
    });
    check(res, {
      [`${route.name}: 200`]:           (r) => r.status === 200,
      [`${route.name}: no PHP error`]:  (r) =>
        !r.body.includes('Fatal error') &&
        !r.body.includes('Uncaught') &&
        !r.body.includes('Warning: Undefined'),
      [`${route.name}: body not empty`]:(r) => r.body.length > 100,
    });
    shortPause();
  });

  // ── Group 4: New module endpoints exist ───────────────────────────────────
  group('smoke_new_modules', () => {
    // Deadline extension quota
    const quotaRes = http.get(`${BASE_URL}/api/deadline-extensions/quota`, {
      jar, headers: { Accept: 'application/json' },
    });
    check(quotaRes, {
      'ext quota endpoint: 200':     (r) => r.status === 200,
      'ext quota: valid JSON':       (r) => { try { JSON.parse(r.body); return true; } catch(_){ return false; } },
      'ext quota: not 500':          (r) => r.status !== 500,
    });
    shortPause();

    // Task-store API
    const storeApiRes = http.get(`${BASE_URL}/api/tasks/1/stores`, {
      jar, headers: { Accept: 'application/json' },
    });
    check(storeApiRes, {
      'task stores API: not 500':   (r) => r.status !== 500,
      'task stores API: 200 or 404':(r) => r.status === 200 || r.status === 404,
    });
    shortPause();

    // Extension history page
    const histRes = http.get(`${BASE_URL}/?route=deadline-extensions/history`, params);
    check(histRes, {
      'ext history: 200':           (r) => r.status === 200,
      'ext history: not 500':       (r) => r.status !== 500,
    });
    shortPause();
  });

  // ── Group 5: CSRF check ───────────────────────────────────────────────────
  group('smoke_csrf', () => {
    const res = http.post(
      `${BASE_URL}/api/deadline-extensions/request`,
      { task_id: 1, new_due_date: '2099-01-01', reason: 'smoke csrf test', csrf_token: 'bad' },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(res, {
      'CSRF smoke: invalid token blocked': (r) =>
        r.status === 403 || (r.body && r.body.includes('CSRF')),
    });
    shortPause();
  });

  // ── Group 6: Sidebar badges (high-frequency endpoint) ────────────────────
  group('smoke_badges_poll', () => {
    for (let i = 0; i < 3; i++) {
      const res = http.get(`${BASE_URL}/api/sidebar/badges`, {
        jar, headers: { Accept: 'application/json' },
      });
      check(res, {
        'badge poll: 200':       (r) => r.status === 200,
        'badge poll: not 500':   (r) => r.status !== 500,
      });
      shortPause();
    }
  });

  thinkTime();
}

export function handleSummary(data) {
  const report = {
    phase: 'smoke',
    timestamp: new Date().toISOString(),
    vus: options.vus,
    iterations: options.iterations,
    metrics: {
      http_req_duration: data.metrics.http_req_duration,
      http_req_failed:   data.metrics.http_req_failed,
      checks:            data.metrics.checks,
    },
  };
  return {
    stdout: `\n=== SMOKE TEST COMPLETE ===\n` +
      `Total requests: ${data.metrics.http_reqs?.values?.count || 'N/A'}\n` +
      `Failed:         ${data.metrics.http_req_failed?.values?.rate?.toFixed(4) || 'N/A'}\n` +
      `p95 latency:    ${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(0) || 'N/A'}ms\n` +
      `Check rate:     ${((data.metrics.checks?.values?.rate || 0) * 100).toFixed(1)}%\n`,
    'performance/reports/smoke-summary.json': JSON.stringify(report, null, 2),
  };
}
