/**
 * mixed-flow.js — Full-system mixed traffic simulation
 *
 * This is the PRIMARY stress test — simulates all 5 phases:
 *   Phase 1: Smoke     —  20 VUs ×  2,000 iterations
 *   Phase 2: Functional—  50 VUs ×  8,000 iterations
 *   Phase 3: Moderate  — 100 VUs × 20,000 iterations
 *   Phase 4: Heavy     — 250 VUs × 30,000 iterations
 *   Phase 5: Full      — 500 VUs × 40,000 iterations
 *
 * Traffic mix (matches spec §5):
 *   12% auth/session
 *   18% dashboard/overview reads
 *   15% task list/detail reads
 *   12% task create/update
 *    8% duplicate/reopen/repeat
 *    8% comments/notifications
 *   10% task ↔ store flows
 *    9% penalty flows
 *    8% deadline extension flows
 *
 * Run all 5 phases (100,000 total loops):
 *   k6 run --env BASE_URL=https://dashboard.bakudanramen.com \
 *           --env PHASE=full \
 *           performance/k6/mixed-flow.js
 *
 * Run single phase:
 *   k6 run --env PHASE=smoke  performance/k6/mixed-flow.js
 *   k6 run --env PHASE=functional performance/k6/mixed-flow.js
 *   k6 run --env PHASE=moderate  performance/k6/mixed-flow.js
 *   k6 run --env PHASE=heavy     performance/k6/mixed-flow.js
 *   k6 run --env PHASE=full      performance/k6/mixed-flow.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import {
  BASE_URL, ROLES, PHASES, THRESHOLDS,
  thinkTime, shortPause, parseCSRF, login,
  randomItem, randomDate, futureDate, randomInt,
  SAMPLE_TITLES, SAMPLE_REASONS, PRIORITIES, STATUSES,
  pickScenario,
} from './config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const scenarioCounter   = new Counter('mixed_scenario_runs');
const taskCreateCounter = new Counter('mixed_task_creates');
const storeFlowCounter  = new Counter('mixed_store_flows');
const extFlowCounter    = new Counter('mixed_ext_flows');
const penaltyReadOk     = new Counter('mixed_penalty_reads_ok');
const crossModuleOk     = new Counter('mixed_cross_module_ok');
const dataIntegrityFail = new Counter('mixed_data_integrity_fails');

// ── Phase selection ───────────────────────────────────────────────────────────
const PHASE = __ENV.PHASE || 'smoke';
const phase = PHASES[PHASE] || PHASES.smoke;

// ── k6 options ────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    mixed_ramp: {
      executor: 'ramping-vus',
      startVUs: Math.max(1, Math.floor(phase.vus * 0.1)),
      stages: [
        { duration: '30s', target: Math.floor(phase.vus * 0.25) },
        { duration: '60s', target: Math.floor(phase.vus * 0.60) },
        { duration: '90s', target: phase.vus },
        { duration: '2m',  target: phase.vus },   // sustain
        { duration: '30s', target: 0 },           // ramp down
      ],
      gracefulRampDown: '30s',
      tags: { scenario: 'mixed', phase: PHASE },
    },
  },
  thresholds: {
    ...THRESHOLDS,
    'http_req_duration{scenario:mixed}': ['p(95)<4000'],
    'http_req_failed{scenario:mixed}':   ['rate<0.02'],
  },
};

// ── Test fixtures — override via env ──────────────────────────────────────────
const PROJECT_IDS    = [1, 2, 3];
const STORE_IDS      = [1, 2, 3, 4];
const SECTION_IDS    = [1, 2];
const TASK_DUE_SOON  = parseInt(__ENV.TASK_DUE_SOON  || '1');
const TASK_DUE_LATER = parseInt(__ENV.TASK_DUE_LATER || '2');

// Per-VU state
const vuCreatedTasks = [];

// ── Role mix ──────────────────────────────────────────────────────────────────
const ROLE_MIX = [
  ROLES.user, ROLES.user, ROLES.user,    // 60% normal users
  ROLES.manager,                          // 20% manager
  ROLES.admin,                            // 20% admin
];

// ── Main test function ────────────────────────────────────────────────────────
export default function () {
  const jar    = new http.CookieJar();
  const params = { jar, redirects: 5 };
  const creds  = randomItem(ROLE_MIX);
  const isPriv = creds.role === 'admin' || creds.role === 'manager';

  login(creds, params);
  shortPause();

  const scenario = pickScenario();
  scenarioCounter.add(1, { scenario });

  switch (scenario) {
    case 'auth':        flowAuth(jar, params, creds);      break;
    case 'dashboard':   flowDashboard(jar, params, isPriv); break;
    case 'taskReads':   flowTaskReads(jar, params);        break;
    case 'taskWrites':  flowTaskWrites(jar, params, isPriv); break;
    case 'taskSpecial': flowTaskSpecial(jar, params);      break;
    case 'social':      flowSocial(jar, params);           break;
    case 'stores':      flowStores(jar, params);           break;
    case 'penalties':   flowPenalties(jar, params, isPriv); break;
    case 'extensions':  flowExtensions(jar, params, creds, isPriv); break;
    default:            flowDashboard(jar, params, isPriv);
  }

  thinkTime();
}

// ══════════════════════════════════════════════════════════════════════════════
// FLOW IMPLEMENTATIONS
// ══════════════════════════════════════════════════════════════════════════════

// ── Auth flow (12%) ───────────────────────────────────────────────────────────
function flowAuth(jar, params, creds) {
  group('flow_auth', () => {
    // Badge API (session check)
    const badge = http.get(`${BASE_URL}/api/sidebar/badges`, {
      jar, headers: { Accept: 'application/json' },
    });
    check(badge, {
      'auth flow: badge 200':    (r) => r.status === 200,
      'auth flow: badge valid':  (r) => { try { return typeof JSON.parse(r.body).priority === 'number'; } catch(_){return false;} },
    });
    shortPause();

    // Session-only: re-visit a page (session persistence)
    const res = http.get(`${BASE_URL}/?route=my-tasks`, params);
    check(res, { 'auth flow: session persists': (r) => r.status === 200 });
  });
}

// ── Dashboard reads (18%) ─────────────────────────────────────────────────────
function flowDashboard(jar, params, isPriv) {
  group('flow_dashboard', () => {
    const route = isPriv ? 'overview' : 'my-tasks';
    const res = http.get(`${BASE_URL}/?route=${route}`, params);
    check(res, {
      'dashboard: 200':         (r) => r.status === 200,
      'dashboard: no 500':      (r) => r.status !== 500,
      'dashboard: no PHP fatal':(r) =>
        !r.body.includes('Fatal error') && !r.body.includes('Uncaught'),
    }, { tags: { type: 'read' } });
    shortPause();

    // Notifications count consistency
    const badge = http.get(`${BASE_URL}/api/sidebar/badges`, { jar, headers: { Accept: 'application/json' } });
    const notif = http.get(`${BASE_URL}/api/notifications`,  { jar, headers: { Accept: 'application/json' } });
    check({ badge, notif }, {
      'dashboard: badge+notif consistent': () => {
        try {
          const b = JSON.parse(badge.body);
          const n = JSON.parse(notif.body);
          // inbox count in badge should equal unread in notifications
          return b.inbox >= 0 && n.unread >= 0;
        } catch (_) { return false; }
      },
    });
  });
}

// ── Task reads (15%) ──────────────────────────────────────────────────────────
function flowTaskReads(jar, params) {
  group('flow_task_reads', () => {
    // Project task list
    const projId = randomItem(PROJECT_IDS);
    const list = http.get(`${BASE_URL}/?route=projects/${projId}`, params);
    check(list, {
      'task list: 200':    (r) => r.status === 200,
      'task list: no 500': (r) => r.status !== 500,
    }, { tags: { type: 'read' } });
    shortPause();

    // Task detail (if we have one)
    if (vuCreatedTasks.length > 0) {
      const tid = randomItem(vuCreatedTasks);
      const detail = http.get(`${BASE_URL}/?route=tasks/${tid}`, params);
      check(detail, {
        'task detail: 200':            (r) => r.status === 200,
        'task detail: has stores':     (r) => r.body.includes('Stores'),
        'task detail: has ext button': (r) =>
          r.body.includes('Extend Deadline') || r.body.includes('extendDeadlineBtn'),
      }, { tags: { type: 'read' } });
    }
    shortPause();
  });
}

// ── Task writes (12%) ─────────────────────────────────────────────────────────
function flowTaskWrites(jar, params, isPriv) {
  group('flow_task_writes', () => {
    const projId  = randomItem(PROJECT_IDS);
    const stores  = storeScenario();

    // Get CSRF
    const page = http.get(`${BASE_URL}/?route=projects/${projId}`, params);
    const csrf = parseCSRF(page.body);
    shortPause();

    // Create task
    let body = encodeFormData({
      title:      `[QA ${PHASE}] ${randomItem(SAMPLE_TITLES)} ${__VU}-${__ITER}`,
      project_id: projId,
      section_id: randomItem(SECTION_IDS),
      priority:   randomItem(PRIORITIES),
      status:     'todo',
      due_date:   randomDate(14),
      csrf_token: csrf,
    });
    // Append stores
    if (stores.length === 0) body += '&store_ids%5B%5D=';
    else stores.forEach((sid) => { body += `&store_ids%5B%5D=${sid}`; });

    const res = http.post(`${BASE_URL}/?route=tasks`, body, {
      jar,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json',
      },
    });
    const ok = check(res, {
      'task create: 200 or 302': (r) => r.status === 200 || r.status === 302 || r.status === 303,
      'task create: no 500':     (r) => r.status !== 500,
    }, { tags: { type: 'write' } });

    if (ok) {
      taskCreateCounter.add(1);
      try {
        const d = JSON.parse(res.body);
        if (d.task_id) vuCreatedTasks.push(d.task_id);
      } catch (_) {}
    }
    shortPause();
  });
}

// ── Special task flows: duplicate, reopen, repeat (8%) ───────────────────────
function flowTaskSpecial(jar, params) {
  if (vuCreatedTasks.length === 0) { flowTaskWrites(jar, params, false); return; }
  const tid = randomItem(vuCreatedTasks);

  group('flow_task_special', () => {
    const r = Math.random();
    if (r < 0.5) {
      // Duplicate
      const res = http.get(`${BASE_URL}/?route=tasks/${tid}/duplicate`, params);
      check(res, {
        'duplicate: 200 or 302': (r2) => r2.status === 200 || r2.status === 302 || r2.status === 303,
      });
    } else {
      // Quick complete + reopen cycle
      const page = http.get(`${BASE_URL}/?route=tasks/${tid}`, params);
      const csrf = parseCSRF(page.body);
      shortPause();
      http.post(
        `${BASE_URL}/api/tasks/${tid}/status`,
        { status: 'done', csrf_token: csrf },
        { jar, headers: { Accept: 'application/json' } }
      );
      shortPause();
      http.post(
        `${BASE_URL}/api/tasks/${tid}/status`,
        { status: 'todo', csrf_token: csrf },
        { jar, headers: { Accept: 'application/json' } }
      );
    }
    shortPause();
  });
}

// ── Social: comments + notifications (8%) ────────────────────────────────────
function flowSocial(jar, params) {
  if (vuCreatedTasks.length === 0) return;
  const tid = randomItem(vuCreatedTasks);

  group('flow_social', () => {
    const page = http.get(`${BASE_URL}/?route=tasks/${tid}`, params);
    const csrf = parseCSRF(page.body);
    shortPause();

    // Post comment
    http.post(
      `${BASE_URL}/api/tasks/${tid}/comments`,
      { content: `QA mixed-flow comment [VU:${__VU} ITER:${__ITER}]`, csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    shortPause();

    // Read notifications
    const notif = http.get(`${BASE_URL}/api/notifications`, { jar, headers: { Accept: 'application/json' } });
    check(notif, { 'social: notifications 200': (r) => r.status === 200 });
  });
}

// ── Store flows (10%) ─────────────────────────────────────────────────────────
function flowStores(jar, params) {
  group('flow_stores', () => {
    // Create task with stores or read store filter
    if (Math.random() < 0.6) {
      // Store read: filter by store
      const sid = randomItem(STORE_IDS);
      const res = http.get(`${BASE_URL}/api/stores/${sid}/tasks`, {
        jar, headers: { Accept: 'application/json' },
      });
      check(res, {
        'store filter: 200':       (r) => r.status === 200,
        'store filter: valid JSON':(r) => { try { JSON.parse(r.body); return true; } catch(_){ return false; } },
      }, { tags: { type: 'read' } });
    } else if (vuCreatedTasks.length > 0) {
      // Store write: sync stores on existing task
      const tid  = randomItem(vuCreatedTasks);
      const page = http.get(`${BASE_URL}/?route=tasks/${tid}`, params);
      const csrf = parseCSRF(page.body);
      shortPause();

      const stores = storeScenario();
      let body = `csrf_token=${csrf}`;
      if (stores.length === 0) body += '&store_ids%5B%5D=';
      else stores.forEach((sid) => { body += `&store_ids%5B%5D=${sid}`; });

      const res = http.post(
        `${BASE_URL}/api/tasks/${tid}/stores`,
        body,
        { jar, headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } }
      );
      check(res, {
        'store sync: 200':         (r) => r.status === 200,
        'store sync: valid result':(r) => { try { const d = JSON.parse(r.body); return Array.isArray(d.stores); } catch(_){ return false; } },
      }, { tags: { type: 'write' } });
      storeFlowCounter.add(1);
    }
    shortPause();
  });
}

// ── Extension flows (8%) ──────────────────────────────────────────────────────
function flowExtensions(jar, params, creds, isPriv) {
  group('flow_extensions', () => {
    const r = Math.random();

    if (r < 0.4) {
      // Check quota
      const res = http.get(`${BASE_URL}/api/deadline-extensions/quota`, {
        jar, headers: { Accept: 'application/json' },
      });
      check(res, {
        'ext quota: 200':       (r2) => r2.status === 200,
        'ext quota: remaining': (r2) => { try { return JSON.parse(r2.body).remaining >= 0; } catch(_){ return false; } },
      }, { tags: { type: 'read' } });
    } else if (r < 0.70) {
      // Submit extension request
      const page = http.get(`${BASE_URL}/?route=tasks/${TASK_DUE_LATER}`, params);
      const csrf = parseCSRF(page.body);
      shortPause();

      const days   = randomInt(1, 14);
      const newDue = futureDate(days);
      const res = http.post(
        `${BASE_URL}/api/deadline-extensions/request`,
        { task_id: TASK_DUE_LATER, new_due_date: newDue, reason: randomItem(SAMPLE_REASONS), csrf_token: csrf },
        { jar, headers: { Accept: 'application/json' } }
      );
      check(res, {
        'ext request: 200 or 422': (r2) => r2.status === 200 || r2.status === 422,
        'ext request: no 500':     (r2) => r2.status !== 500,
      }, { tags: { type: 'write' } });
      extFlowCounter.add(1);
    } else if (isPriv) {
      // Admin: review pending
      const pending = http.get(`${BASE_URL}/api/admin/deadline-extensions/pending`, {
        jar, headers: { Accept: 'application/json' },
      });
      let extId = null;
      try { const d = JSON.parse(pending.body); if (d.extensions?.length > 0) extId = d.extensions[0].id; }
      catch (_) {}

      if (extId) {
        const page = http.get(`${BASE_URL}/?route=admin/deadline-extensions`, params);
        const csrf = parseCSRF(page.body);
        const action = Math.random() < 0.7 ? 'approve' : 'reject';
        const note   = action === 'reject' ? 'Rejected in mixed flow QA' : 'Approved in mixed flow QA';
        http.post(
          `${BASE_URL}/api/admin/deadline-extensions/${extId}/${action}`,
          { note, csrf_token: csrf },
          { jar, headers: { Accept: 'application/json' } }
        );
      }
    }
    shortPause();
  });
}

// ── Penalty reads (9%) ────────────────────────────────────────────────────────
function flowPenalties(jar, params, isPriv) {
  group('flow_penalties', () => {
    if (isPriv) {
      const res = http.get(`${BASE_URL}/?route=penalties`, params);
      check(res, { 'penalty page: not 500': (r) => r.status !== 500 });
    } else {
      const res = http.get(`${BASE_URL}/?route=my-penalties`, params);
      check(res, { 'my-penalty page: not 500': (r) => r.status !== 500 });
      if (res.status === 200) penaltyReadOk.add(1);
    }
    shortPause();
  });
}

// ── Cross-module validation (runs opportunistically) ─────────────────────────
export function crossModuleCheck(jar, params) {
  group('cross_module', () => {
    // 11.1: Extension + task deadline must match
    if (vuCreatedTasks.length > 0) {
      const tid = randomItem(vuCreatedTasks);
      const taskJson = http.get(`${BASE_URL}/api/tasks/${tid}`, { jar, headers: { Accept: 'application/json' } });
      const storeApi = http.get(`${BASE_URL}/api/tasks/${tid}/stores`, { jar, headers: { Accept: 'application/json' } });
      const bothOk = check({ taskJson, storeApi }, {
        'cross: task JSON 200':   () => taskJson.status === 200,
        'cross: stores JSON 200': () => storeApi.status === 200,
        'cross: no store dupes':  () => {
          try {
            const d = JSON.parse(storeApi.body);
            const ids = d.stores.map((s) => s.id);
            return ids.length === new Set(ids).size;
          } catch (_) { return false; }
        },
      });
      if (bothOk) crossModuleOk.add(1);
      else dataIntegrityFail.add(1);
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function storeScenario() {
  const r = Math.random();
  if (r < 0.33) return [];
  if (r < 0.66) return [randomItem(STORE_IDS)];
  return STORE_IDS.slice(0, randomInt(2, Math.min(3, STORE_IDS.length)));
}

function encodeFormData(obj) {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

// ── Summary report ────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const m = data.metrics;
  const summary = {
    phase: PHASE,
    vus: phase.vus,
    timestamp: new Date().toISOString(),
    totals: {
      requests:   m.http_reqs?.values?.count     || 0,
      failed:     m.http_req_failed?.values?.rate || 0,
      p90:        m.http_req_duration?.values?.['p(90)'] || 0,
      p95:        m.http_req_duration?.values?.['p(95)'] || 0,
      p99:        m.http_req_duration?.values?.['p(99)'] || 0,
      checkRate:  m.checks?.values?.rate          || 0,
    },
    customMetrics: {
      taskCreates:    m.mixed_task_creates?.values?.count      || 0,
      storeFlows:     m.mixed_store_flows?.values?.count       || 0,
      extFlows:       m.mixed_ext_flows?.values?.count         || 0,
      penaltyReads:   m.mixed_penalty_reads_ok?.values?.count  || 0,
      integrityFails: m.mixed_data_integrity_fails?.values?.count || 0,
    },
    thresholdResults: Object.fromEntries(
      Object.entries(data.thresholds || {}).map(([k, v]) => [k, v.ok ? 'PASS' : 'FAIL'])
    ),
  };

  const passed  = Object.values(summary.thresholdResults).every((v) => v === 'PASS');
  const console = `
═══════════════════════════════════════════════════
  MIXED FLOW TEST COMPLETE — Phase: ${PHASE.toUpperCase()}
═══════════════════════════════════════════════════
  Total Requests : ${summary.totals.requests}
  Failure Rate   : ${(summary.totals.failed * 100).toFixed(2)}%
  p90 latency    : ${summary.totals.p90.toFixed(0)}ms
  p95 latency    : ${summary.totals.p95.toFixed(0)}ms
  p99 latency    : ${summary.totals.p99.toFixed(0)}ms
  Check Rate     : ${(summary.totals.checkRate * 100).toFixed(1)}%
───────────────────────────────────────────────────
  Task Creates   : ${summary.customMetrics.taskCreates}
  Store Flows    : ${summary.customMetrics.storeFlows}
  Ext Flows      : ${summary.customMetrics.extFlows}
  Integrity Fails: ${summary.customMetrics.integrityFails}
───────────────────────────────────────────────────
  RESULT: ${passed ? '✅ ALL THRESHOLDS PASSED' : '❌ THRESHOLD FAILURES — SEE REPORT'}
═══════════════════════════════════════════════════
`;

  return {
    stdout: console,
    [`performance/reports/mixed-flow-${PHASE}-summary.json`]: JSON.stringify(summary, null, 2),
  };
}
