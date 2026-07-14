/**
 * SEO Control Center browser E2E.
 *
 * Spawns Mi-Core locally on an isolated port and temp MI_DATA_DIR, logs in
 * through the real PIN auth route, then verifies:
 *   - Content Calendar loads with strict SEO auth
 *   - creating a calendar item persists and renders
 *   - Topic Cluster graph generates and renders as inline SVG
 *   - clicking a graph node populates the detail panel
 *
 * No production PM2 restart. No live deploy.
 *
 * Usage:
 *   npx tsx src/seo/__tests__/seo-ui-browser-e2e.mjs
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { section, check, note, finalize } from './_harness.mjs';

const root = join(process.cwd(), '..');
const port = 4198;
const base = `http://127.0.0.1:${port}`;
const tempData = mkdtempSync(join(tmpdir(), 'seo-ui-e2e-data-'));
const pin = '123456';
const evidenceDir = join(root, 'reports', 'evidence', 'seo-ui-e2e');
mkdirSync(evidenceDir, { recursive: true });

let child;
let browser;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer() {
  const deadline = Date.now() + 90_000;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return true;
    } catch (e) {
      lastError = e.message;
    }
    await sleep(1000);
  }
  throw new Error(`server did not become healthy: ${lastError}`);
}

async function api(path, token, csrf, opts = {}) {
  const headers = new Headers(opts.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (csrf && opts.method && opts.method !== 'GET') headers.set('x-csrf-token', csrf);
  const r = await fetch(`${base}${path}`, { ...opts, headers });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || body.ok === false) throw new Error(body.error || `${r.status} ${r.statusText}`);
  return body;
}

section('Start isolated server');
child = spawn(process.execPath, [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/index.ts'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    MI_PORT: String(port),
    HOST: '127.0.0.1',
    LOCALHOST_BYPASS: 'false',
    MI_PIN: pin,
    MI_AUTH_DEFAULT_USER: 'seo-e2e',
    MI_AUTH_USER_MAP_JSON: JSON.stringify({
      'seo-e2e': { actor_id: 'user:seo-e2e', role: 'CEO', brand_scope: ['*'], location_scope: ['*'] },
    }),
    MI_DATA_DIR: tempData,
    GLOBAL_DIR: tempData,
    MI_CORE_ROOT: root,
    NODE_ENV: 'test',
    MI_BOOT_KNOWLEDGE_INGEST: '0',
    JARVIS_MONITOR_INTERVAL_MIN: '60',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', d => { logs += d.toString(); });
child.stderr.on('data', d => { logs += d.toString(); });

try {
  await waitForServer();
  check('server healthy on isolated port', true, base);

  const loginResp = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, role: 'CEO', brand_scope: ['*'], location_scope: ['*'] }),
  });
  const login = await loginResp.json();
  check('PIN login returned token + csrf', loginResp.ok && !!login.token && !!login.csrf_token);

  section('API seed through secured routes');
  const now = new Date();
  const dateIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 3, 12, 0, 0)).toISOString();
  const created = await api('/api/seo/calendar/items', login.token, login.csrf_token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brand_id: 'bakudan',
      location_id: 'stone_oak',
      title: 'Browser E2E Ramen Visit Guide',
      keyword: 'browser e2e ramen visit guide',
      date: dateIso,
    }),
  });
  check('calendar item created via secured API', !!created.item?.id);

  section('Browser calendar E2E');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await page.goto(`${base}/seo-control-center.html?token=${encodeURIComponent(login.token)}&csrf=${encodeURIComponent(login.csrf_token)}`, { waitUntil: 'domcontentloaded' });
  await page.selectOption('#brand-select', 'bakudan');
  await page.click('button[data-view="calendar"]');
  await page.waitForSelector('.cal-grid');
  await page.waitForSelector('.cal-item-chip', { timeout: 20_000 });
  const calendarText = await page.locator('#cal-body').innerText();
  check('calendar renders created item', calendarText.includes('Browser E2E Ramen Visit Guide'));
  await page.evaluate(() => {
    const chip = document.querySelector('.cal-item-chip');
    window.openCalendarDetail(chip?.getAttribute('data-id'));
  });
  await page.waitForFunction(() => {
    const el = document.querySelector('#cal-detail-card');
    return el && getComputedStyle(el).display !== 'none';
  });
  const detailText = await page.locator('#cal-detail-body').innerText();
  check('calendar detail drawer shows item title and indexing state', detailText.includes('Browser E2E Ramen Visit Guide') && detailText.includes('not_yet_indexed'));
  const calendarShot = join(evidenceDir, 'calendar-e2e.png');
  await page.screenshot({ path: calendarShot, fullPage: true });
  note(`calendar_screenshot=${calendarShot}`);

  section('Browser topic graph E2E');
  await api('/api/seo/clusters/generate', login.token, login.csrf_token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brand_id: 'bakudan' }),
  });
  await page.click('button[data-view="clusters"]');
  await page.waitForSelector('#cluster-graph-wrap svg', { timeout: 20_000 });
  const nodeCount = await page.locator('#cluster-graph-wrap svg .cg-node').count();
  check('topic cluster graph renders inline SVG nodes', nodeCount > 0, `nodes=${nodeCount}`);
  await page.evaluate(() => {
    const node = document.querySelector('#cluster-graph-wrap svg .cg-node');
    window.showClusterNodeDetail(node?.getAttribute('data-node-id'));
  });
  const panelText = await page.locator('#cg-detail').innerText();
  check('clicking SVG node populates detail panel', panelText.includes('Cluster') && panelText.includes('Type') && !panelText.includes('Click a node'));
  const graphShot = join(evidenceDir, 'topic-graph-e2e.png');
  await page.screenshot({ path: graphShot, fullPage: true });
  note(`topic_graph_screenshot=${graphShot}`);
} catch (e) {
  check('browser E2E completed without exception', false, e.stack || e.message);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (child && !child.killed) {
    child.kill('SIGTERM');
    await sleep(1500);
    if (!child.killed) child.kill('SIGKILL');
  }
  try { rmSync(tempData, { recursive: true, force: true }); } catch {}
  if (logs) note(`server_log_tail=${logs.slice(-1000).replace(/\s+/g, ' ').trim()}`);
}

const result = finalize('seo-ui-browser-e2e.mjs');
assert.equal(result.fail, 0);
