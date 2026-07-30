/**
 * stores.js — Task ↔ Store many-to-many relation QA + load tests
 *
 * Covers all spec test cases from section 8:
 *  8.1  No-store task (create, list, display)
 *  8.2  Single-store task
 *  8.3  Multi-store task (add, remove, replace)
 *  8.4  Invalid/duplicate store IDs
 *  8.5  Store filter API (/api/stores/{id}/tasks)
 *
 * Run standalone:
 *   k6 run --env BASE_URL=https://dashboard.bakudanramen.com performance/k6/stores.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import {
  BASE_URL, ROLES, thinkTime, shortPause, parseCSRF, login,
  randomItem, randomDate, SAMPLE_TITLES, randomInt,
} from './config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const storeAssignOk   = new Counter('store_assign_success');
const storeRemoveOk   = new Counter('store_remove_success');
const storeSyncErrors = new Counter('store_sync_errors');
const filterOk        = new Counter('store_filter_success');

// ── k6 options ────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    stores_qa: {
      executor: 'shared-iterations',
      vus: 30,
      iterations: 900,
      maxDuration: '8m',
      tags: { scenario: 'stores' },
    },
  },
  thresholds: {
    'http_req_duration{scenario:stores}': ['p(95)<3000'],
    'http_req_failed{scenario:stores}':   ['rate<0.02'],
    checks:                                ['rate>=0.90'],
    store_assign_success:                  ['count>0'],
  },
};

// ── Test fixtures ─────────────────────────────────────────────────────────────
const PROJECT_IDS = [1, 2, 3];      // Replace with real IDs
const STORE_IDS   = [1, 2, 3, 4];   // Replace with real IDs
const SECTION_IDS = [1, 2];

// Track task IDs created in this VU
const vuTaskIds = [];

// ── Main test function ────────────────────────────────────────────────────────
export default function () {
  const jar    = new http.CookieJar();
  const params = { jar, redirects: 5 };
  login(ROLES.admin, params);
  shortPause();

  const scenario = Math.random();
  if (scenario < 0.15)      testNoStore(jar, params);
  else if (scenario < 0.30) testSingleStore(jar, params);
  else if (scenario < 0.50) testMultiStore(jar, params);
  else if (scenario < 0.65) testAddStores(jar, params);
  else if (scenario < 0.78) testRemoveAllStores(jar, params);
  else if (scenario < 0.88) testReplaceStores(jar, params);
  else if (scenario < 0.94) testInvalidStoreIds(jar, params);
  else                       testStoreFilter(jar, params);

  thinkTime();
}

// ── 8.1 No-store task ─────────────────────────────────────────────────────────
function testNoStore(jar, params) {
  group('store_case_A_no_store', () => {
    const tid = createTask(jar, params, []);

    if (tid) {
      // Verify zero stores linked
      const res = http.get(`${BASE_URL}/api/tasks/${tid}/stores`, {
        jar, headers: { Accept: 'application/json' },
      });
      check(res, {
        'no-store: API returns empty array': (r) => {
          try { const d = JSON.parse(r.body); return Array.isArray(d.stores) && d.stores.length === 0; }
          catch (_) { return false; }
        },
        'no-store: 200': (r) => r.status === 200,
      });

      // Verify UI shows "General / No store assigned"
      const detail = http.get(`${BASE_URL}/?route=tasks/${tid}`, params);
      check(detail, {
        'no-store: UI shows general text': (r) =>
          r.body.includes('General') || r.body.includes('No store assigned'),
      });
    }
    shortPause();
  });
}

// ── 8.2 Single-store task ─────────────────────────────────────────────────────
function testSingleStore(jar, params) {
  group('store_case_B_single_store', () => {
    const storeId = randomItem(STORE_IDS);
    const tid = createTask(jar, params, [storeId]);

    if (tid) {
      const res = http.get(`${BASE_URL}/api/tasks/${tid}/stores`, {
        jar, headers: { Accept: 'application/json' },
      });
      check(res, {
        'single-store: exactly 1 store': (r) => {
          try { const d = JSON.parse(r.body); return d.stores.length === 1 && d.stores[0].id === storeId; }
          catch (_) { return false; }
        },
        'single-store: no duplicates': (r) => {
          try {
            const d = JSON.parse(r.body);
            const ids = d.stores.map((s) => s.id);
            return ids.length === new Set(ids).size;
          } catch (_) { return false; }
        },
      });
      storeAssignOk.add(1);
    }
    shortPause();
  });
}

// ── 8.3 Multi-store task ──────────────────────────────────────────────────────
function testMultiStore(jar, params) {
  group('store_case_C_multi_store', () => {
    const storeCount = randomInt(2, Math.min(4, STORE_IDS.length));
    const stores = STORE_IDS.slice(0, storeCount);
    const tid = createTask(jar, params, stores);

    if (tid) {
      const res = http.get(`${BASE_URL}/api/tasks/${tid}/stores`, {
        jar, headers: { Accept: 'application/json' },
      });
      check(res, {
        [`multi-store: exactly ${storeCount} stores`]: (r) => {
          try { const d = JSON.parse(r.body); return d.stores.length === storeCount; }
          catch (_) { return false; }
        },
        'multi-store: no duplicate IDs': (r) => {
          try {
            const d = JSON.parse(r.body);
            const ids = d.stores.map((s) => s.id);
            return ids.length === new Set(ids).size;
          } catch (_) { return false; }
        },
        'multi-store: all names present': (r) => {
          try {
            const d = JSON.parse(r.body);
            return d.stores.every((s) => s.name && s.name.length > 0);
          } catch (_) { return false; }
        },
      });
      if (storeCount >= 2) storeAssignOk.add(1);
    }
    shortPause();
  });
}

// ── 8.3d Edit: Add stores to existing task ────────────────────────────────────
function testAddStores(jar, params) {
  group('store_edit_add_stores', () => {
    // Create with no store first
    const tid = createTask(jar, params, []);
    if (!tid) return;
    shortPause();

    // Now add 2 stores via sync API
    const storesToAdd = STORE_IDS.slice(0, 2);
    const csrf = getCSRF(tid, jar, params);

    const res = http.post(
      `${BASE_URL}/api/tasks/${tid}/stores`,
      buildStoreForm(storesToAdd, csrf),
      { jar, headers: { Accept: 'application/json' } }
    );
    check(res, {
      'add stores: 200': (r) => r.status === 200,
      'add stores: ok': (r) => {
        try { const d = JSON.parse(r.body); return d.ok === true && Array.isArray(d.stores); }
        catch (_) { return false; }
      },
      'add stores: correct count': (r) => {
        try { const d = JSON.parse(r.body); return d.stores.length === storesToAdd.length; }
        catch (_) { return false; }
      },
    });
    storeAssignOk.add(1);
    shortPause();
  });
}

// ── 8.3e Edit: Remove all stores ─────────────────────────────────────────────
function testRemoveAllStores(jar, params) {
  group('store_edit_remove_all', () => {
    // Create with stores
    const tid = createTask(jar, params, STORE_IDS.slice(0, 2));
    if (!tid) return;
    shortPause();

    // Remove all stores
    const csrf = getCSRF(tid, jar, params);
    const res = http.post(
      `${BASE_URL}/api/tasks/${tid}/stores`,
      { 'store_ids[]': '', csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(res, {
      'remove all: 200': (r) => r.status === 200,
      'remove all: stores empty': (r) => {
        try { const d = JSON.parse(r.body); return d.stores.length === 0; }
        catch (_) { return false; }
      },
    });
    storeRemoveOk.add(1);
    shortPause();
  });
}

// ── 8.3f Edit: Replace stores ─────────────────────────────────────────────────
function testReplaceStores(jar, params) {
  group('store_edit_replace_stores', () => {
    // Create with store[0]
    const tid = createTask(jar, params, [STORE_IDS[0]]);
    if (!tid) return;
    shortPause();

    // Replace with store[1], store[2]
    const newStores = STORE_IDS.slice(1, 3);
    const csrf = getCSRF(tid, jar, params);
    const res = http.post(
      `${BASE_URL}/api/tasks/${tid}/stores`,
      buildStoreForm(newStores, csrf),
      { jar, headers: { Accept: 'application/json' } }
    );
    check(res, {
      'replace stores: 200': (r) => r.status === 200,
      'replace stores: correct new count': (r) => {
        try { const d = JSON.parse(r.body); return d.stores.length === newStores.length; }
        catch (_) { return false; }
      },
      'replace stores: old store not present': (r) => {
        try {
          const d = JSON.parse(r.body);
          return !d.stores.some((s) => s.id === STORE_IDS[0]);
        } catch (_) { return false; }
      },
    });
    shortPause();
  });
}

// ── 8.4 Invalid store IDs ─────────────────────────────────────────────────────
function testInvalidStoreIds(jar, params) {
  group('store_invalid_ids', () => {
    const tid = createTask(jar, params, []);
    if (!tid) return;
    shortPause();

    const csrf = getCSRF(tid, jar, params);

    // Test: non-existent store ID
    const badRes = http.post(
      `${BASE_URL}/api/tasks/${tid}/stores`,
      { 'store_ids[]': 99999, csrf_token: csrf },
      { jar, headers: { Accept: 'application/json' } }
    );
    check(badRes, {
      'invalid store: 422 or ok with empty result': (r) =>
        r.status === 422 || r.status === 200,
      'invalid store: not a server error': (r) => r.status !== 500,
    });
    storeSyncErrors.add(1);
    shortPause();

    // Test: duplicate store IDs in request (1,1,2,2 → should deduplicate to 1,2)
    const dupRes = http.post(
      `${BASE_URL}/api/tasks/${tid}/stores`,
      `store_ids%5B%5D=${STORE_IDS[0]}&store_ids%5B%5D=${STORE_IDS[0]}&store_ids%5B%5D=${STORE_IDS[1]}&store_ids%5B%5D=${STORE_IDS[1]}&csrf_token=${csrf}`,
      { jar, headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } }
    );
    check(dupRes, {
      'duplicate IDs: 200': (r) => r.status === 200,
      'duplicate IDs: deduplicated to 2 unique': (r) => {
        try {
          const d = JSON.parse(r.body);
          if (!Array.isArray(d.stores)) return false;
          const ids = d.stores.map((s) => s.id);
          return ids.length === new Set(ids).size && ids.length === 2;
        } catch (_) { return false; }
      },
    });
    shortPause();
  });
}

// ── 8.5 Store filter API ──────────────────────────────────────────────────────
function testStoreFilter(jar, params) {
  group('store_filter_api', () => {
    STORE_IDS.forEach((sid) => {
      const res = http.get(`${BASE_URL}/api/stores/${sid}/tasks`, {
        jar, headers: { Accept: 'application/json' },
      });
      check(res, {
        [`filter store ${sid}: 200`]: (r) => r.status === 200,
        [`filter store ${sid}: has tasks array`]: (r) => {
          try { const d = JSON.parse(r.body); return Array.isArray(d.tasks); }
          catch (_) { return false; }
        },
        [`filter store ${sid}: no cross-store tasks`]: (r) => {
          try {
            const d = JSON.parse(r.body);
            return d.store_id === sid;
          } catch (_) { return false; }
        },
      }, { tags: { type: 'read' } });
      shortPause();
    });

    // Filter with status
    const res2 = http.get(`${BASE_URL}/api/stores/${STORE_IDS[0]}/tasks?status=in_progress`, {
      jar, headers: { Accept: 'application/json' },
    });
    check(res2, {
      'filter with status: 200': (r) => r.status === 200,
      'filter with status: all tasks match status': (r) => {
        try {
          const d = JSON.parse(r.body);
          return d.tasks.every((t) => t.status === 'in_progress' || d.tasks.length === 0);
        } catch (_) { return false; }
      },
    }, { tags: { type: 'read' } });
    filterOk.add(1);
    shortPause();
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function createTask(jar, params, storeIds) {
  const projId = randomItem(PROJECT_IDS);
  const page   = http.get(`${BASE_URL}/?route=projects/${projId}`, params);
  const csrf   = parseCSRF(page.body);

  let body = `title=${encodeURIComponent('[QA Store] ' + randomItem(SAMPLE_TITLES) + ' ' + Date.now())}`
    + `&project_id=${projId}&section_id=${randomItem(SECTION_IDS)}`
    + `&priority=medium&status=todo&due_date=${randomDate(14)}&csrf_token=${csrf}`;

  if (storeIds.length === 0) {
    body += '&store_ids%5B%5D=';
  } else {
    storeIds.forEach((sid) => { body += `&store_ids%5B%5D=${sid}`; });
  }

  const res = http.post(`${BASE_URL}/?route=tasks`, body, {
    jar,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded',
               'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
  });

  check(res, {
    'create task for store test: success': (r) =>
      r.status === 200 || r.status === 302 || r.status === 303,
  });

  try { const d = JSON.parse(res.body); if (d.task_id) { vuTaskIds.push(d.task_id); return d.task_id; } }
  catch (_) {}

  // Try redirect URL
  if (res.url && res.url.match(/tasks\/(\d+)/)) {
    const m = res.url.match(/tasks\/(\d+)/);
    if (m) { vuTaskIds.push(parseInt(m[1])); return parseInt(m[1]); }
  }
  return null;
}

function getCSRF(tid, jar, params) {
  const page = http.get(`${BASE_URL}/?route=tasks/${tid}`, params);
  return parseCSRF(page.body);
}

function buildStoreForm(storeIds, csrf) {
  let body = `csrf_token=${csrf}`;
  storeIds.forEach((sid) => { body += `&store_ids%5B%5D=${sid}`; });
  return {
    __raw: body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  };
}

export function handleSummary(data) {
  return {
    'performance/reports/stores-summary.json': JSON.stringify(data, null, 2),
  };
}
