/**
 * Phase 7E — performance measurement for the Operator Workspace (§24).
 * Not part of the pass/fail E2E acceptance chain (latency here is
 * environment-dependent, same rationale as phase7b-performance.ts) — a
 * one-shot script whose output feeds docs/releases/PHASE7E_ACCEPTANCE.md.
 * Measures against the real compiled server + real built Command Center
 * bundle (must already be running via `E2E_PORT=... E2E_PIN=... node
 * e2e/seed-and-serve.cjs`), driven by a real Chromium browser — never
 * simulated numbers. External-provider (INFORMATION-intent) latency is
 * reported separately, not folded into the other measurements, since it is
 * dominated by provider reachability in this dev checkout, not by the
 * workspace's own code.
 */
const { chromium } = require('playwright');

const PORT = process.env.E2E_PORT || '4099';
const PIN = process.env.E2E_PIN || '135790';
const BASE = `http://127.0.0.1:${PORT}/command-center/`;

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarize(label, durations) {
  const sorted = [...durations].sort((a, b) => a - b);
  return {
    label,
    n: sorted.length,
    p50Ms: Math.round(percentile(sorted, 50)),
    p95Ms: Math.round(percentile(sorted, 95)),
    maxMs: Math.round(sorted[sorted.length - 1]),
    allMs: sorted.map(v => Math.round(v)),
  };
}

async function login(page) {
  await page.goto(BASE);
  await page.getByLabel('PIN').fill(PIN);
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.waitForURL(/\/today$/);
}

async function main() {
  const browser = await chromium.launch();
  const results = [];

  // ── 1. Initial workspace load — full navigation to /jarvis from a fresh
  //    page context (real network + real bundle parse + real first render),
  //    logged in fresh each time so no browser cache/session carries over. ──
  {
    const durations = [];
    for (let i = 0; i < 5; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page);
      const start = Date.now();
      await page.goto(`${BASE}jarvis`);
      await page.getByRole('region', { name: 'Current interaction' }).waitFor({ state: 'visible' });
      durations.push(Date.now() - start);
      await context.close();
    }
    results.push(summarize('initialWorkspaceLoad', durations));
  }

  // ── Shared session for the remaining measurements (real login once). ──
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page);
  await page.goto(`${BASE}jarvis`);
  const current = page.getByRole('region', { name: 'Current interaction' });
  await current.waitFor({ state: 'visible' });

  // ── 2. Simple conversation round trip — a project-scoped TASK_QUERY,
  //    which never calls an external model provider (unlike INFORMATION),
  //    so this measures the workspace's own gateway/UI cost cleanly. ──
  {
    const durations = [];
    const input = page.getByPlaceholder(/ask about health/i);
    await page.getByRole('combobox').selectOption({ label: 'Mi Core System' });
    for (let i = 0; i < 8; i++) {
      await input.fill(`what tasks are waiting on me (perf run ${i})`);
      const start = Date.now();
      const [response] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/api/command-center/jarvis/request') && resp.request().method() === 'POST'),
        page.getByRole('button', { name: 'Ask', exact: true }).click(),
      ]);
      await response.finished();
      durations.push(Date.now() - start);
    }
    results.push(summarize('simpleConversationRoundTrip', durations));
  }

  // ── INFORMATION intent, reported separately — external-provider-bound,
  //    not hidden inside the other numbers per §24's explicit instruction. ──
  {
    const durations = [];
    const input = page.getByPlaceholder(/ask about health/i);
    for (let i = 0; i < 5; i++) {
      await input.fill(`tell me something interesting (perf run ${i})`);
      const start = Date.now();
      const [response] = await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/api/command-center/jarvis/request') && resp.request().method() === 'POST'),
        page.getByRole('button', { name: 'Ask', exact: true }).click(),
      ]);
      await response.finished();
      durations.push(Date.now() - start);
    }
    results.push(summarize('informationIntentRoundTrip_externalProviderBound', durations));
  }

  // ── 3. Evidence Inspector — ask a question with real evidence refs
  //    (TASK_QUERY on the seeded project), then click the Evidence tab and
  //    measure time to render the fetched inspector content. ──
  {
    const durations = [];
    const input = page.getByPlaceholder(/ask about health/i);
    await page.getByRole('combobox').selectOption({ label: 'Mi Core System' });
    for (let i = 0; i < 6; i++) {
      await input.fill(`what tasks are waiting on me (evidence run ${i})`);
      await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/api/command-center/jarvis/request') && resp.request().method() === 'POST'),
        page.getByRole('button', { name: 'Ask', exact: true }).click(),
      ]);
      const start = Date.now();
      await page.getByRole('tab', { name: 'evidence' }).click();
      await page.getByRole('region', { name: 'Evidence' }).waitFor({ state: 'visible' });
      durations.push(Date.now() - start);
      await page.getByRole('tab', { name: 'context' }).click();
    }
    results.push(summarize('evidenceInspectorRender', durations));
  }

  // ── 4. Simulation Inspector — a SIMULATION-intent request, then measure
  //    time to fetch+render the real GET /simulation/:id data. ──
  {
    const durations = [];
    const input = page.getByPlaceholder(/ask about health/i);
    for (let i = 0; i < 6; i++) {
      await input.fill(`simulate what would happen if I archived this project (run ${i})`);
      await Promise.all([
        page.waitForResponse(resp => resp.url().includes('/api/command-center/jarvis/request') && resp.request().method() === 'POST'),
        page.getByRole('button', { name: 'Ask', exact: true }).click(),
      ]);
      const simTab = page.getByRole('tab', { name: 'simulation' });
      const start = Date.now();
      await simTab.click();
      // String match (not regex) — Playwright's string getByText is
      // case-insensitive/whitespace-normalized by default; the real DOM
      // text is "Simulation — no live execution" (CSS uppercases it visually).
      await page.getByText('SIMULATION — NO LIVE EXECUTION').waitFor({ state: 'visible' });
      durations.push(Date.now() - start);
    }
    results.push(summarize('simulationInspectorRender', durations));
  }

  await context.close();
  await browser.close();

  const report = {
    note: 'Measured against the real compiled server (server/dist/index.js) and the real built Command Center bundle via a real Chromium browser (Playwright), not simulated. simpleConversationRoundTrip uses TASK_QUERY, which never calls an external model provider. informationIntentRoundTrip is reported separately because it is dominated by external-provider reachability in this dev checkout, not by workspace code, per the explicit instruction not to hide that latency inside fake local numbers.',
    measuredAt: new Date().toISOString(),
    results,
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
