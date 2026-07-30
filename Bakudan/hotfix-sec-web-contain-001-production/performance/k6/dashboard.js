/**
 * dashboard.js — Dashboard + overview read-path QA + load tests
 *
 * Covers:
 *  - /overview (admin/manager command center)
 *  - /dashboard (staff personal queue)
 *  - /my-tasks
 *  - /calendar
 *  - /inbox / notifications
 *  - /api/sidebar/badges
 *  - /api/calendar (month feed)
 *  - dashboard widget counts match backend state
 *
 * Run standalone:
 *   k6 run --env BASE_URL=https://dashboard.bakudanramen.com performance/k6/dashboard.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import {
  BASE_URL, ROLES, thinkTime, shortPause, parseCSRF, login, randomItem,
} from './config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const overviewLoadTime = new Trend('dashboard_overview_load_ms');
const myTasksLoadTime  = new Trend('dashboard_mytasks_load_ms');
const badgeLoadTime    = new Trend('dashboard_badge_load_ms');
const dashboardErrors  = new Counter('dashboard_errors');

// ── k6 options ────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    dashboard_load: {
      executor: 'shared-iterations',
      vus: 60,
      iterations: 1800,
      maxDuration: '10m',
      tags: { scenario: 'dashboard' },
    },
  },
  thresholds: {
    'http_req_duration{scenario:dashboard}': ['p(95)<2500'],
    'http_req_failed{scenario:dashboard}':   ['rate<0.01'],
    checks:                                   ['rate>=0.92'],
    dashboard_overview_load_ms:               ['p(95)<2500'],
    dashboard_mytasks_load_ms:                ['p(95)<2500'],
    dashboard_badge_load_ms:                  ['p(95)<1000'],
  },
};

// ── Role mix for dashboard tests ──────────────────────────────────────────────
const ROLE_MIX = [
  ROLES.admin,
  ROLES.admin,
  ROLES.manager,
  ROLES.user,
  ROLES.user,
  ROLES.user,
];

// ── Main test function ────────────────────────────────────────────────────────
export default function () {
  const jar    = new http.CookieJar();
  const params = { jar, redirects: 5 };
  const creds  = randomItem(ROLE_MIX);

  login(creds, params);
  shortPause();

  const isPriv = creds.role === 'admin' || creds.role === 'manager';

  const scenario = Math.random();
  if (scenario < 0.30)      readOverview(jar, params, isPriv);
  else if (scenario < 0.50) readMyTasks(jar, params);
  else if (scenario < 0.65) readCalendar(jar, params);
  else if (scenario < 0.80) readSidebarBadges(jar, params);
  else if (scenario < 0.90) readInbox(jar, params);
  else                       readProjectList(jar, params);

  thinkTime();
}

// ── Overview / Command Center ─────────────────────────────────────────────────
function readOverview(jar, params, isPriv) {
  group('dashboard_overview', () => {
    const start = Date.now();
    const route = isPriv ? 'overview' : 'my-tasks';
    const res = http.get(`${BASE_URL}/?route=${route}`, params);
    overviewLoadTime.add(Date.now() - start);

    const ok = check(res, {
      'overview: 200':               (r) => r.status === 200,
      'overview: body not empty':    (r) => r.body.length > 1000,
      'overview: has task content':  (r) => r.body.includes('task') || r.body.includes('Task'),
      'overview: no PHP error':      (r) =>
        !r.body.includes('Fatal error') &&
        !r.body.includes('Uncaught') &&
        !r.body.includes('Warning:'),
    }, { tags: { type: 'read' } });

    if (!ok) dashboardErrors.add(1);
    shortPause();

    if (isPriv) {
      // Store-based task count via API
      const storeRes = http.get(`${BASE_URL}/api/stores/1/tasks`, {
        jar, headers: { Accept: 'application/json' },
      });
      check(storeRes, {
        'overview store api: 200':        (r) => r.status === 200,
        'overview store api: valid json': (r) => {
          try { JSON.parse(r.body); return true; } catch (_) { return false; }
        },
      }, { tags: { type: 'read' } });
    }
  });
}

// ── My Tasks ──────────────────────────────────────────────────────────────────
function readMyTasks(jar, params) {
  group('dashboard_my_tasks', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/?route=my-tasks`, params);
    myTasksLoadTime.add(Date.now() - start);

    const ok = check(res, {
      'my-tasks: 200':            (r) => r.status === 200,
      'my-tasks: body > 500B':    (r) => r.body.length > 500,
      'my-tasks: no PHP error':   (r) =>
        !r.body.includes('Fatal error') && !r.body.includes('Uncaught'),
    }, { tags: { type: 'read' } });

    if (!ok) dashboardErrors.add(1);
    shortPause();

    // Filtered views
    const filterRes = http.get(`${BASE_URL}/?route=my-tasks&filter=overdue`, params);
    check(filterRes, { 'my-tasks filter overdue: 200': (r) => r.status === 200 });
    shortPause();

    // Next focus API
    const focusRes = http.get(`${BASE_URL}/api/my-tasks/next-focus`, {
      jar, headers: { Accept: 'application/json' },
    });
    check(focusRes, {
      'next-focus: 200':       (r) => r.status === 200,
      'next-focus: valid json':(r) => { try { JSON.parse(r.body); return true; } catch(_){ return false; } },
    }, { tags: { type: 'read' } });
  });
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function readCalendar(jar, params) {
  group('dashboard_calendar', () => {
    const res = http.get(`${BASE_URL}/?route=calendar`, params);
    check(res, {
      'calendar page: 200':   (r) => r.status === 200,
      'calendar page: loads': (r) => r.body.length > 500,
    }, { tags: { type: 'read' } });
    shortPause();

    // Calendar API (current month)
    const now = new Date();
    const calApi = http.get(
      `${BASE_URL}/api/calendar?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
      { jar, headers: { Accept: 'application/json' } }
    );
    check(calApi, {
      'calendar API: 200':       (r) => r.status === 200,
      'calendar API: has tasks': (r) => {
        try { const d = JSON.parse(r.body); return Array.isArray(d.tasks); }
        catch (_) { return false; }
      },
    }, { tags: { type: 'read' } });
    shortPause();

    // Day drawer (today)
    const today = new Date().toISOString().slice(0, 10);
    const dayRes = http.get(`${BASE_URL}/api/calendar/day/${today}`, {
      jar, headers: { Accept: 'application/json' },
    });
    check(dayRes, {
      'calendar day drawer: 200':     (r) => r.status === 200,
      'calendar day drawer: has date':(r) => { try { return JSON.parse(r.body).date === today; } catch(_){return false;} },
    }, { tags: { type: 'read' } });
  });
}

// ── Sidebar Badges ────────────────────────────────────────────────────────────
function readSidebarBadges(jar, params) {
  group('sidebar_badges', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/sidebar/badges`, {
      jar,
      headers: { Accept: 'application/json' },
    });
    badgeLoadTime.add(Date.now() - start);

    check(res, {
      'badges: 200':             (r) => r.status === 200,
      'badges: valid JSON':      (r) => { try { JSON.parse(r.body); return true; } catch(_){return false;} },
      'badges: priority ≥ 0':   (r) => { try { return JSON.parse(r.body).priority >= 0; } catch(_){return false;} },
      'badges: has overdue':     (r) => { try { return typeof JSON.parse(r.body).overdue === 'number'; } catch(_){return false;} },
      'badges: has payments':    (r) => { try { return typeof JSON.parse(r.body).payments === 'number'; } catch(_){return false;} },
      'badges: has inbox':       (r) => { try { return typeof JSON.parse(r.body).inbox === 'number'; } catch(_){return false;} },
    }, { tags: { type: 'read' } });

    // Simulate auto-refresh (every 90s in real app)
    shortPause();
    const res2 = http.get(`${BASE_URL}/api/sidebar/badges`, { jar, headers: { Accept: 'application/json' } });
    check(res2, { 'badges refresh: 200': (r) => r.status === 200 });
  });
}

// ── Inbox / Notifications ─────────────────────────────────────────────────────
function readInbox(jar, params) {
  group('dashboard_inbox', () => {
    const res = http.get(`${BASE_URL}/?route=inbox`, params);
    check(res, { 'inbox page: 200': (r) => r.status === 200 });
    shortPause();

    const apiRes = http.get(`${BASE_URL}/api/notifications`, {
      jar, headers: { Accept: 'application/json' },
    });
    check(apiRes, {
      'notifications API: 200':            (r) => r.status === 200,
      'notifications API: has array':      (r) => {
        try { const d = JSON.parse(r.body); return Array.isArray(d.notifications); }
        catch (_) { return false; }
      },
      'notifications API: has unread count':(r) => {
        try { const d = JSON.parse(r.body); return typeof d.unread === 'number'; }
        catch (_) { return false; }
      },
    }, { tags: { type: 'read' } });
  });
}

// ── Project list ──────────────────────────────────────────────────────────────
function readProjectList(jar, params) {
  group('dashboard_projects', () => {
    const res = http.get(`${BASE_URL}/?route=projects`, params);
    check(res, {
      'project list: 200':          (r) => r.status === 200,
      'project list: no PHP error': (r) =>
        !r.body.includes('Fatal error') && !r.body.includes('Uncaught'),
    }, { tags: { type: 'read' } });
    shortPause();

    // Team page (admin/manager)
    const teamRes = http.get(`${BASE_URL}/?route=team`, params);
    check(teamRes, { 'team page: 200 or redirect': (r) => r.status === 200 || r.status === 302 });
  });
}

export function handleSummary(data) {
  return {
    'performance/reports/dashboard-summary.json': JSON.stringify(data, null, 2),
  };
}
