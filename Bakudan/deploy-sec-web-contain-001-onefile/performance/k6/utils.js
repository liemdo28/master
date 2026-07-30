/**
 * Shared utilities for all k6 scenarios.
 */
import http  from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, EMAIL, PASSWORD } from './config.js';

// ── CSRF extraction ───────────────────────────────────────────
// The main layout outputs CSRF in two places:
//   <meta name="csrf-token" content="TOKEN">
//   window.CSRF_TOKEN = "TOKEN";
export function extractCsrf(body) {
  if (!body) return '';
  let m = body.match(/name="csrf-token"\s+content="([^"]{20,})"/);
  if (m) return m[1];
  m = body.match(/window\.CSRF_TOKEN\s*=\s*"([^"]{20,})"/);
  if (m) return m[1];
  // Fallback: inline JS var used in some sub-pages
  m = body.match(/var\s+CSRF\s*=\s*'([^']{20,})'/);
  if (m) return m[1];
  return '';
}

// ── Login ─────────────────────────────────────────────────────
// Returns { ok: bool, csrf: string }
// The login form has no CSRF token — only email + password.
// After successful login the redirect target (my-tasks / overview)
// is rendered with the full main layout which contains CSRF.
export function doLogin(email, password) {
  email    = email    || EMAIL;
  password = password || PASSWORD;

  // 1. Hit login page (establishes session cookie)
  const loginPage = http.get(`${BASE_URL}/login`, {
    tags: { name: 'GET /login', endpoint: 'read' },
  });
  check(loginPage, { 'GET /login → 200': r => r.status === 200 });

  // 2. Submit credentials (no CSRF required on this route)
  const res = http.post(
    `${BASE_URL}/login`,
    { email: email, password: password },
    { redirects: 5, tags: { name: 'POST /login', endpoint: 'write' } }
  );

  const ok = check(res, {
    'login → 200':                 r => r.status === 200,
    'redirected away from /login': r => !r.url.includes('/login'),
  });

  const csrf = extractCsrf(res.body);
  return { ok, csrf };
}

// ── HTTP helpers ──────────────────────────────────────────────
export function get(path, tag) {
  return http.get(`${BASE_URL}${path}`, {
    tags: { name: tag || path, endpoint: 'read' },
  });
}

export function post(path, body, csrf, tag) {
  const payload = Object.assign({}, body, { csrf_token: csrf });
  return http.post(`${BASE_URL}${path}`, payload, {
    headers: { 'X-CSRF-TOKEN': csrf },
    tags: { name: tag || path, endpoint: 'write' },
  });
}

export function apiGet(path, tag) {
  return http.get(`${BASE_URL}${path}`, {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    tags: { name: tag || path, endpoint: 'read' },
  });
}

export function apiPost(path, body, csrf, tag) {
  const payload = Object.assign({}, body, { csrf_token: csrf });
  return http.post(`${BASE_URL}${path}`, payload, {
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRF-TOKEN': csrf,
    },
    tags: { name: tag || path, endpoint: 'write' },
  });
}

// ── Randomness ────────────────────────────────────────────────
export function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Weighted random: weights=[30,20,15] → returns 0, 1, or 2
export function weightedRandom(weights) {
  const total = weights.reduce(function(a, b) { return a + b; }, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

// Random think-time sleep (seconds)
export function thinkTime(min, max) {
  sleep(min + Math.random() * (max - min));
}

// Random future date string YYYY-MM-DD (1–30 days from today)
export function futureDate(maxDays) {
  maxDays = maxDays || 30;
  const d = new Date();
  d.setDate(d.getDate() + Math.floor(Math.random() * maxDays) + 1);
  return d.toISOString().slice(0, 10);
}
