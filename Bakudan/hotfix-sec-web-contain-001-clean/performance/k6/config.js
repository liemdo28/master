/**
 * config.js — Shared configuration for all k6 test scripts
 *
 * Usage: import { BASE_URL, ROLES, thinkTime, parseCSRF, formHeaders } from './config.js';
 *
 * Environment variables (override via: k6 run --env BASE_URL=https://... script.js):
 *   BASE_URL    Default: https://dashboard.bakudanramen.com
 *   ADMIN_EMAIL / ADMIN_PASS
 *   MANAGER_EMAIL / MANAGER_PASS
 *   USER_EMAIL  / USER_PASS
 */

import { sleep } from 'k6';
import http from 'k6/http';
import { check } from 'k6';

// ── Base URL ──────────────────────────────────────────────────────────────────
export const BASE_URL = (__ENV.BASE_URL || 'https://dashboard.bakudanramen.com').replace(/\/$/, '');

// ── Test credentials (override via env vars) ──────────────────────────────────
export const ROLES = {
  admin: {
    email:    __ENV.ADMIN_EMAIL   || 'admin@bakudanramen.com',
    password: __ENV.ADMIN_PASS    || 'admin123',
    role: 'admin',
  },
  manager: {
    email:    __ENV.MANAGER_EMAIL || 'manager@bakudanramen.com',
    password: __ENV.MANAGER_PASS  || 'manager123',
    role: 'manager',
  },
  user: {
    email:    __ENV.USER_EMAIL    || 'staff@bakudanramen.com',
    password: __ENV.USER_PASS     || 'staff123',
    role: 'user',
  },
};

// ── Phase targets ─────────────────────────────────────────────────────────────
export const PHASES = {
  smoke:    { vus: 20,  iterations: 2000 },
  functional:{ vus: 50, iterations: 8000 },
  moderate: { vus: 100, iterations: 20000 },
  heavy:    { vus: 250, iterations: 30000 },
  full:     { vus: 500, iterations: 40000 },
};

// ── Performance thresholds ────────────────────────────────────────────────────
export const THRESHOLDS = {
  // Reads: p95 < 2500ms
  'http_req_duration{type:read}':  ['p(95)<2500'],
  // Writes: p95 < 4000ms
  'http_req_duration{type:write}': ['p(95)<4000'],
  // Overall error rate < 1%
  'http_req_failed':               ['rate<0.01'],
  // All checks pass >= 95%
  'checks':                        ['rate>=0.95'],
};

// ── Traffic mix weights (must sum to 1.0) ────────────────────────────────────
// auth(12%), dashboard(18%), taskReads(15%), taskWrites(12%),
// duplicate/reopen/repeat(8%), comments/notifications(8%),
// stores(10%), penalties(9%), extensions(8%)
export const TRAFFIC_WEIGHTS = [
  { name: 'auth',          weight: 0.12 },
  { name: 'dashboard',     weight: 0.18 },
  { name: 'taskReads',     weight: 0.15 },
  { name: 'taskWrites',    weight: 0.12 },
  { name: 'taskSpecial',   weight: 0.08 },
  { name: 'social',        weight: 0.08 },
  { name: 'stores',        weight: 0.10 },
  { name: 'penalties',     weight: 0.09 },
  { name: 'extensions',    weight: 0.08 },
];

/**
 * Pick a scenario based on weighted random selection.
 * @returns {string} scenario name
 */
export function pickScenario() {
  const r = Math.random();
  let cumulative = 0;
  for (const { name, weight } of TRAFFIC_WEIGHTS) {
    cumulative += weight;
    if (r < cumulative) return name;
  }
  return 'dashboard';
}

// ── Think time helpers ────────────────────────────────────────────────────────
/** Realistic think time between actions: 0.5–3 seconds */
export function thinkTime() { sleep(0.5 + Math.random() * 2.5); }
/** Short pause between reads */
export function shortPause() { sleep(0.2 + Math.random() * 0.8); }

// ── CSRF token extraction ────────────────────────────────────────────────────
/**
 * Extract CSRF token from an HTML response body.
 * The app injects it as a JS variable: csrf_token: 'xxxx'
 * or in hidden input: <input ... name="csrf_token" value="xxxx">
 */
export function parseCSRF(body) {
  // Try hidden input first
  let m = body.match(/name=["']csrf_token["'][^>]+value=["']([0-9a-f]+)["']/i);
  if (m) return m[1];
  m = body.match(/value=["']([0-9a-f]+)["'][^>]+name=["']csrf_token["']/i);
  if (m) return m[1];
  // Try JS variable
  m = body.match(/csrf_token['":\s]+['"]([0-9a-f]{64})['"]/);
  if (m) return m[1];
  return '';
}

// ── Common request headers ────────────────────────────────────────────────────
export const JSON_HEADERS = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
export function formHeaders(csrfToken) {
  return { 'Content-Type': 'application/x-www-form-urlencoded' };
}
export const AJAX_HEADERS = { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' };

// ── Login helper ─────────────────────────────────────────────────────────────
/**
 * Login and return the response. Cookies are automatically managed by k6's jar.
 * @param {object} creds  { email, password }
 * @param {object} params  optional k6 http params
 * @returns {Response}
 */
export function login(creds, params = {}) {
  // First GET to obtain CSRF
  const loginPage = http.get(`${BASE_URL}/?route=login`, params);
  const csrf = parseCSRF(loginPage.body);

  const res = http.post(
    `${BASE_URL}/?route=login`,
    { email: creds.email, password: creds.password, csrf_token: csrf },
    params
  );
  check(res, {
    'login: 200 or redirect': (r) => r.status === 200 || r.status === 302 || r.status === 303,
    'login: not error page':  (r) => !r.body.includes('Invalid email or password'),
  });
  return res;
}

// ── Random pick helpers ───────────────────────────────────────────────────────
export function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
export function randomItem(arr)     { return arr[Math.floor(Math.random() * arr.length)]; }
export function randomDate(daysFromNow = 7) {
  const d = new Date();
  d.setDate(d.getDate() + randomInt(1, daysFromNow));
  return d.toISOString().slice(0, 10);
}
export function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Sample test data ──────────────────────────────────────────────────────────
export const SAMPLE_TITLES = [
  'Review monthly report',
  'Check invoice accuracy',
  'Verify daily sales',
  'Update permission policy',
  'Audit vendor contracts',
  'Fix printer issue',
  'Staff schedule review',
  'Health inspection prep',
  'POS system update',
  'Training documentation',
  'Monthly reconciliation',
  'Equipment maintenance check',
  'Supply reorder',
  'Customer feedback review',
  'Safety compliance check',
];

export const SAMPLE_REASONS = [
  'Awaiting vendor response',
  'Additional documents required',
  'Team bandwidth constraints',
  'Approval process delayed',
  'Equipment delivery postponed',
  'Awaiting manager review',
  'External dependency',
  'Holiday schedule impact',
];

export const PRIORITIES  = ['low', 'medium', 'high', 'urgent'];
export const STATUSES     = ['todo', 'in_progress', 'review', 'done'];
