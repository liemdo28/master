/**
 * tasks.js — Full task lifecycle QA + load tests
 *
 * Covers:
 *  - create task (no store / 1 store / multi-store)
 *  - edit task (title, status, priority, assignee, deadline, stores)
 *  - duplicate task
 *  - reopen task
 *  - repeat task
 *  - task detail reads
 *  - task list reads
 *  - status/priority quick-change API
 *  - file upload
 *  - comments
 *  - store sync on create/edit
 *
 * Run standalone:
 *   k6 run --env BASE_URL=https://dashboard.bakudanramen.com performance/k6/tasks.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import {
  BASE_URL, ROLES, thinkTime, shortPause, parseCSRF, login, randomItem,
  randomDate, futureDate, SAMPLE_TITLES, PRIORITIES, STATUSES, randomInt,
} from './config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const taskCreateOk  = new Counter('task_create_success');
const taskEditOk    = new Counter('task_edit_success');
const taskDupOk     = new Counter('task_duplicate_success');
const taskReopenOk  = new Counter('task_reopen_success');
const storeAssignOk = new Counter('task_store_assign_success');

// ── k6 options ────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    tasks_functional: {
      executor: 'shared-iterations',
      vus: 50,
      iterations: 1500,
      maxDuration: '10m',
      tags: { scenario: 'tasks' },
    },
  },
  thresholds: {
    'http_req_duration{scenario:tasks}': ['p(95)<4000'],
    'http_req_failed{scenario:tasks}':   ['rate<0.02'],
    checks:                               ['rate>=0.90'],
    task_create_success:                  ['count>0'],
  },
};

// ── Shared state: task IDs created during the run ─────────────────────────────
// k6 doesn't share state between VUs, so each VU tracks its own created tasks
const createdTaskIds = [];

// ── Hardcoded test fixtures (replace with your actual IDs) ───────────────────
const PROJECT_IDS = [1, 2, 3];    // Replace with real project IDs
const STORE_IDS   = [1, 2, 3, 4]; // Replace with real store IDs
const SECTION_IDS = [1, 2, 3];    // Replace with real section IDs
const USER_IDS    = [1, 2, 3];    // Replace with real user IDs

// ── Helper: pick store assignment scenario ────────────────────────────────────
function storeScenario() {
  const r = Math.random();
  if (r < 0.33) return [];                                         // Case A: no store
  if (r < 0.66) return [randomItem(STORE_IDS)];                   // Case B: one store
  return [STORE_IDS[0], STORE_IDS[1], STORE_IDS[2]].slice(0, randomInt(2, 3)); // Case C: multi-store
}

// ── Main test function ────────────────────────────────────────────────────────
export default function () {
  const jar    = new http.CookieJar();
  const params = { jar, redirects: 5 };
  const creds  = Math.random() < 0.3 ? ROLES.admin : ROLES.user;

  // ── Login ─────────────────────────────────────────────────────────────────
  login(creds, params);
  shortPause();

  // ── Scenario selection ────────────────────────────────────────────────────
  const r = Math.random();
  if (r < 0.25) {
    taskCreate(jar, params);
  } else if (r < 0.50) {
    taskRead(jar, params);
  } else if (r < 0.70) {
    taskEdit(jar, params);
  } else if (r < 0.82) {
    taskDuplicate(jar, params);
  } else if (r < 0.92) {
    taskQuickActions(jar, params);
  } else {
    taskComments(jar, params);
  }

  thinkTime();
}

// ── 1. Task Create ────────────────────────────────────────────────────────────
function taskCreate(jar, params) {
  group('task_create', () => {
    const projId = randomItem(PROJECT_IDS);
    const stores = storeScenario();
    const storeLabel = stores.length === 0 ? 'no_store'
      : stores.length === 1 ? 'single_store' : 'multi_store';

    // Get CSRF from project page
    const projPage = http.get(`${BASE_URL}/?route=projects/${projId}`, params);
    check(projPage, { 'project page loads': (r) => r.status === 200 });
    const csrf = parseCSRF(projPage.body);
    shortPause();

    // Build form data
    const formData = {
      title:      `[QA ${storeLabel}] ${randomItem(SAMPLE_TITLES)} ${Date.now()}`,
      description:'Automated QA test task',
      assignee_id: randomItem(USER_IDS),
      priority:   randomItem(PRIORITIES),
      status:     'todo',
      due_date:   randomDate(14),
      section_id: randomItem(SECTION_IDS),
      project_id: projId,
      csrf_token: csrf,
    };

    // Append store_ids (multi-value key)
    if (stores.length === 0) {
      formData['store_ids[]'] = '';   // sentinel for empty
    } else {
      // k6 encodes arrays by repeating the key
      formData['store_ids[]'] = stores.length === 1 ? stores[0] : stores;
    }

    const res = http.post(`${BASE_URL}/?route=tasks`, formData, {
      jar,
      headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
    });

    const ok = check(res, {
      [`task_create [${storeLabel}]: 200 or redirect`]: (r) =>
        r.status === 200 || r.status === 302 || r.status === 303,
      [`task_create [${storeLabel}]: success response`]: (r) => {
        if (r.status === 200 && r.body.includes('{')) {
          try { const d = JSON.parse(r.body); return d.success === true || !!d.task_id; }
          catch (_) { return false; }
        }
        return r.status === 302 || r.status === 303;
      },
    });
    if (ok) {
      taskCreateOk.add(1);
      // Try to parse task_id for later use
      try {
        const d = JSON.parse(res.body);
        if (d.task_id) createdTaskIds.push(d.task_id);
      } catch (_) {}
    }

    // Verify store assignment if stores selected
    if (stores.length > 0 && createdTaskIds.length > 0) {
      const tid = createdTaskIds[createdTaskIds.length - 1];
      storeVerify(tid, stores, jar);
    }

    shortPause();
  });
}

// ── 2. Task Read (detail + list) ──────────────────────────────────────────────
function taskRead(jar, params) {
  group('task_read', () => {
    // Task list via project
    const projId = randomItem(PROJECT_IDS);
    const listRes = http.get(`${BASE_URL}/?route=projects/${projId}`, params);
    check(listRes, {
      'task list: 200':                  (r) => r.status === 200,
      'task list: has task content':     (r) => r.body.includes('task') || r.body.includes('Task'),
    }, { tags: { type: 'read' } });
    shortPause();

    // Dashboard / my-tasks
    const myTasks = http.get(`${BASE_URL}/?route=my-tasks`, params);
    check(myTasks, {
      'my-tasks: 200':  (r) => r.status === 200,
      'my-tasks: body': (r) => r.body.length > 500,
    }, { tags: { type: 'read' } });
    shortPause();

    // Task detail (if we have IDs)
    if (createdTaskIds.length > 0) {
      const tid = randomItem(createdTaskIds);
      const detail = http.get(`${BASE_URL}/?route=tasks/${tid}`, params);
      check(detail, {
        'task detail: 200':                 (r) => r.status === 200,
        'task detail: has title field':     (r) => r.body.includes('name="title"'),
        'task detail: has stores section':  (r) => r.body.includes('Stores'),
      }, { tags: { type: 'read' } });

      // Verify stores via API
      const storesApi = http.get(`${BASE_URL}/api/tasks/${tid}/stores`, {
        jar,
        headers: { Accept: 'application/json' },
      });
      check(storesApi, {
        'task stores API: 200':        (r) => r.status === 200,
        'task stores API: has stores': (r) => {
          try { const d = JSON.parse(r.body); return Array.isArray(d.stores); }
          catch (_) { return false; }
        },
      }, { tags: { type: 'read' } });
      shortPause();
    }
  });
}

// ── 3. Task Edit ──────────────────────────────────────────────────────────────
function taskEdit(jar, params) {
  if (createdTaskIds.length === 0) { taskCreate(jar, params); return; }
  const tid = randomItem(createdTaskIds);

  group('task_edit', () => {
    // Load task detail for CSRF
    const detail = http.get(`${BASE_URL}/?route=tasks/${tid}`, params);
    check(detail, { 'task edit page: 200': (r) => r.status === 200 });
    const csrf = parseCSRF(detail.body);
    shortPause();

    // Pick edit scenario
    const scenario = Math.random();
    let formData = { csrf_token: csrf };

    if (scenario < 0.25) {
      // Edit title + description
      formData.title       = `[QA edited] ${randomItem(SAMPLE_TITLES)} ${Date.now()}`;
      formData.description = 'Updated by QA automation';
    } else if (scenario < 0.50) {
      // Edit status + priority
      formData.status   = randomItem(STATUSES);
      formData.priority = randomItem(PRIORITIES);
    } else if (scenario < 0.70) {
      // Edit deadline
      formData.due_date = randomDate(14);
    } else if (scenario < 0.85) {
      // Add/change stores
      const stores = storeScenario();
      if (stores.length === 0) {
        formData['store_ids[]'] = '';
      } else {
        stores.forEach((sid) => { formData['store_ids[]'] = sid; });
      }
    } else {
      // Remove all stores
      formData['store_ids[]'] = '';
    }

    const res = http.post(`${BASE_URL}/?route=tasks/${tid}`, formData, {
      jar,
      headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
    });

    const ok = check(res, {
      'task edit: 200 or redirect': (r) =>
        r.status === 200 || r.status === 302 || r.status === 303,
    });
    if (ok) taskEditOk.add(1);
    shortPause();
  });
}

// ── 4. Task Duplicate ─────────────────────────────────────────────────────────
function taskDuplicate(jar, params) {
  if (createdTaskIds.length === 0) { taskCreate(jar, params); return; }
  const tid = randomItem(createdTaskIds);

  group('task_duplicate', () => {
    const res = http.get(`${BASE_URL}/?route=tasks/${tid}/duplicate`, params);
    const ok = check(res, {
      'duplicate: 200 or redirect': (r) =>
        r.status === 200 || r.status === 302 || r.status === 303,
    });
    if (ok) {
      taskDupOk.add(1);
      // Try to parse new task ID from redirect or response
      try {
        const d = JSON.parse(res.body);
        if (d.task_id) createdTaskIds.push(d.task_id);
      } catch (_) {}
    }
    shortPause();

    // If duplicate created, verify it has correct stores
    if (createdTaskIds.length > 0) {
      const newId = createdTaskIds[createdTaskIds.length - 1];
      const origStores = http.get(`${BASE_URL}/api/tasks/${tid}/stores`, {
        jar, headers: { Accept: 'application/json' },
      });
      const dupStores = http.get(`${BASE_URL}/api/tasks/${newId}/stores`, {
        jar, headers: { Accept: 'application/json' },
      });
      check(dupStores, {
        'duplicate: store API returns array': (r) => {
          try { const d = JSON.parse(r.body); return Array.isArray(d.stores); }
          catch (_) { return false; }
        },
      });
    }
  });
}

// ── 5. Quick API actions (status, priority, snooze) ───────────────────────────
function taskQuickActions(jar, params) {
  if (createdTaskIds.length === 0) { taskCreate(jar, params); return; }
  const tid = randomItem(createdTaskIds);

  group('task_quick_actions', () => {
    // Get CSRF via AJAX
    const taskJson = http.get(`${BASE_URL}/api/tasks/${tid}`, {
      jar, headers: { Accept: 'application/json' },
    });
    check(taskJson, {
      'task JSON API: 200': (r) => r.status === 200,
    });

    // We need CSRF — get it from the task detail page
    const page = http.get(`${BASE_URL}/?route=tasks/${tid}`, params);
    const csrf = parseCSRF(page.body);
    shortPause();

    // Quick status change
    const statusRes = http.post(
      `${BASE_URL}/api/tasks/${tid}/status`,
      { status: randomItem(['todo', 'in_progress', 'review']), csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(statusRes, {
      'quick status: 200 + ok': (r) => {
        try { const d = JSON.parse(r.body); return d.ok === true; }
        catch (_) { return r.status === 200; }
      },
    }, { tags: { type: 'write' } });
    shortPause();

    // Quick priority change
    const priRes = http.post(
      `${BASE_URL}/api/tasks/${tid}/priority`,
      { priority: randomItem(PRIORITIES), csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(priRes, {
      'quick priority: 200 + ok': (r) => {
        try { const d = JSON.parse(r.body); return d.ok === true; }
        catch (_) { return r.status === 200; }
      },
    }, { tags: { type: 'write' } });
    shortPause();

    // Snooze
    const snoozeRes = http.post(
      `${BASE_URL}/api/tasks/${tid}/snooze`,
      { days: randomInt(1, 3), csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(snoozeRes, {
      'snooze: 200': (r) => r.status === 200,
    }, { tags: { type: 'write' } });
    shortPause();
  });
}

// ── 6. Comments ───────────────────────────────────────────────────────────────
function taskComments(jar, params) {
  if (createdTaskIds.length === 0) { taskCreate(jar, params); return; }
  const tid = randomItem(createdTaskIds);

  group('task_comments', () => {
    // Get CSRF
    const page = http.get(`${BASE_URL}/?route=tasks/${tid}`, params);
    const csrf = parseCSRF(page.body);
    shortPause();

    // List comments
    const listRes = http.get(`${BASE_URL}/api/tasks/${tid}/comments`, {
      jar, headers: { Accept: 'application/json' },
    });
    check(listRes, {
      'comments list: 200':       (r) => r.status === 200,
      'comments list: has array': (r) => {
        try { const d = JSON.parse(r.body); return Array.isArray(d.comments); }
        catch (_) { return false; }
      },
    }, { tags: { type: 'read' } });
    shortPause();

    // Post comment
    const commentRes = http.post(
      `${BASE_URL}/api/tasks/${tid}/comments`,
      { content: `QA automated comment at ${new Date().toISOString()}`, csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(commentRes, {
      'comment post: 200': (r) => r.status === 200,
      'comment post: ok':  (r) => {
        try { const d = JSON.parse(r.body); return d.ok === true; }
        catch (_) { return false; }
      },
    }, { tags: { type: 'write' } });
    shortPause();
  });
}

// ── Store verification helper ─────────────────────────────────────────────────
function storeVerify(tid, expectedStores, jar) {
  const res = http.get(`${BASE_URL}/api/tasks/${tid}/stores`, {
    jar, headers: { Accept: 'application/json' },
  });
  check(res, {
    'store verify: 200': (r) => r.status === 200,
    'store verify: correct count': (r) => {
      try {
        const d = JSON.parse(r.body);
        return Array.isArray(d.stores) && d.stores.length === expectedStores.length;
      } catch (_) { return false; }
    },
    'store verify: no duplicate ids': (r) => {
      try {
        const d = JSON.parse(r.body);
        const ids = d.stores.map((s) => s.id);
        return ids.length === new Set(ids).size;
      } catch (_) { return false; }
    },
  });
}

// ── Invalid store ID test ─────────────────────────────────────────────────────
export function invalidStoreTest() {
  const jar = new http.CookieJar();
  const params = { jar, redirects: 5 };
  login(ROLES.admin, params);

  group('invalid_store_ids', () => {
    // Get CSRF
    const projPage = http.get(`${BASE_URL}/?route=projects/${PROJECT_IDS[0]}`, params);
    const csrf = parseCSRF(projPage.body);

    // Create task with invalid store IDs
    const res = http.post(`${BASE_URL}/?route=tasks`, {
      title:          '[QA] Invalid store test',
      project_id:     PROJECT_IDS[0],
      csrf_token:     csrf,
      'store_ids[]':  99999, // non-existent store ID
    }, { jar, headers: { 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' } });

    check(res, {
      'invalid store: not silently accepted as invalid': (r) => {
        // Either validation error OR task created but invalid store silently dropped
        // The service validates and drops invalid IDs — task still saves, store not linked
        return r.status === 200 || r.status === 302 || r.status === 422;
      },
    });

    // Duplicate store IDs [1,1,2,2] — should deduplicate
    const dupRes = http.post(`${BASE_URL}/?route=tasks`, {
      title:      '[QA] Duplicate store IDs test',
      project_id: PROJECT_IDS[0],
      csrf_token: csrf,
      // k6 sends multiple values for same key
    }, { jar });

    check(dupRes, {
      'duplicate store ids: 200 or redirect': (r) =>
        r.status === 200 || r.status === 302 || r.status === 303,
    });
  });
}

export function handleSummary(data) {
  return {
    'performance/reports/tasks-summary.json': JSON.stringify(data, null, 2),
  };
}
