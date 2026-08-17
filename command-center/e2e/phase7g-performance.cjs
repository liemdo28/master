/**
 * Phase 7G §24-26 — performance, concurrency, and resource/leak measurement.
 * Not part of the pass/fail E2E gate (same rationale as phase7e/7f-performance).
 * Runs against the real compiled server + real built Command Center bundle,
 * in the isolated e2e fixture environment — never live production.
 */
const { chromium } = require('playwright');

const PORT = process.env.E2E_PORT || '4099';
const PIN = process.env.E2E_PIN || '135790';
const BASE = `http://127.0.0.1:${PORT}/command-center/`;

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
function summarize(label, durations, note) {
  const sorted = [...durations].sort((a, b) => a - b);
  return {
    label, n: sorted.length,
    p50Ms: sorted.length ? Math.round(percentile(sorted, 50)) : null,
    p95Ms: sorted.length ? Math.round(percentile(sorted, 95)) : null,
    maxMs: sorted.length ? Math.round(sorted[sorted.length - 1]) : null,
    note,
  };
}
async function timed(fn) { const s = Date.now(); await fn(); return Date.now() - s; }

async function main() {
  const results = [];
  const loginRes = await fetch(`http://127.0.0.1:${PORT}/api/remote/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: PIN }),
  });
  const { token } = await loginRes.json();
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // ── §24 — public health ──────────────────────────────────────────────────
  {
    const d = [];
    for (let i = 0; i < 15; i++) d.push(await timed(() => fetch(`http://127.0.0.1:${PORT}/api/health`)));
    results.push(summarize('publicHealth', d));
  }
  // ── §24 — detailed health ────────────────────────────────────────────────
  {
    const d = [];
    for (let i = 0; i < 15; i++) d.push(await timed(() => fetch(`http://127.0.0.1:${PORT}/api/command-center/health/detail`, { headers: auth })));
    results.push(summarize('detailedHealth', d));
  }
  // ── §24 — simple Jarvis read (TASK_QUERY, no external provider) ─────────
  {
    const d = [];
    for (let i = 0; i < 15; i++) {
      d.push(await timed(() => fetch(`http://127.0.0.1:${PORT}/api/command-center/jarvis/request`, { method: 'POST', headers: auth, body: JSON.stringify({ text: 'what tasks are waiting on me' }) })));
    }
    results.push(summarize('simpleJarvisRead', d));
  }
  // ── §24 — project query ──────────────────────────────────────────────────
  {
    const d = [];
    for (let i = 0; i < 15; i++) {
      d.push(await timed(() => fetch(`http://127.0.0.1:${PORT}/api/command-center/jarvis/request`, { method: 'POST', headers: auth, body: JSON.stringify({ text: 'what is the project status' }) })));
    }
    results.push(summarize('projectQuery', d));
  }
  // ── §24 — knowledge retrieval ────────────────────────────────────────────
  {
    const d = [];
    for (let i = 0; i < 15; i++) {
      d.push(await timed(() => fetch(`http://127.0.0.1:${PORT}/api/command-center/jarvis/request`, { method: 'POST', headers: auth, body: JSON.stringify({ text: 'find documentation about the fixture architecture' }) })));
    }
    results.push(summarize('knowledgeRetrieval', d));
  }
  // ── §24 — planning ────────────────────────────────────────────────────────
  {
    const d = [];
    for (let i = 0; i < 15; i++) {
      d.push(await timed(() => fetch(`http://127.0.0.1:${PORT}/api/command-center/jarvis/request`, { method: 'POST', headers: auth, body: JSON.stringify({ text: 'make a plan to migrate the fixture database' }) })));
    }
    results.push(summarize('planning', d));
  }
  // ── §24 — simulation ──────────────────────────────────────────────────────
  {
    const d = [];
    for (let i = 0; i < 15; i++) {
      d.push(await timed(() => fetch(`http://127.0.0.1:${PORT}/api/command-center/jarvis/request`, { method: 'POST', headers: auth, body: JSON.stringify({ text: 'simulate what would happen if I archived this project' }) })));
    }
    results.push(summarize('simulation', d));
  }
  // ── §24 — voice transcript processing ────────────────────────────────────
  {
    const d = [];
    for (let i = 0; i < 15; i++) {
      d.push(await timed(() => fetch(`http://127.0.0.1:${PORT}/api/command-center/jarvis/voice/transcript`, { method: 'POST', headers: auth, body: JSON.stringify({ transcript: 'what tasks are waiting on me', source: 'typed' }) })));
    }
    results.push(summarize('voiceTranscript', d));
  }

  // ── §24 — Operator Workspace load + Evidence Inspector (real browser) ───
  {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(BASE);
    await page.getByLabel('PIN').fill(PIN);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.waitForURL(/\/today$/);
    const workspaceDurations = [];
    const evidenceDurations = [];
    for (let i = 0; i < 5; i++) {
      workspaceDurations.push(await timed(async () => {
        await page.goto(`${BASE}#/jarvis`);
        await page.waitForURL(/\/jarvis$/);
      }));
      evidenceDurations.push(await timed(async () => {
        const tab = page.getByRole('tab', { name: 'evidence' });
        if (await tab.count() > 0) await tab.click();
      }));
    }
    results.push(summarize('operatorWorkspaceLoad', workspaceDurations));
    results.push(summarize('evidenceInspectorRender', evidenceDurations));
    await browser.close();
  }

  // ── §24 — startup/preflight (boot-preflight port check cost) ─────────────
  {
    const d = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      const net = require('net');
      await new Promise(resolve => {
        const probe = net.createServer();
        probe.once('error', () => { probe.close(); resolve(); });
        probe.once('listening', () => probe.close(resolve));
        probe.listen(0, '127.0.0.1'); // port 0 = OS-assigned free port, always succeeds
      });
      d.push(Date.now() - start);
    }
    results.push(summarize('startupPreflightPortCheck', d));
  }

  // ── §24 — concurrency: 10 / 25 / 50 concurrent simple-read sessions ──────
  const concurrencyResults = [];
  for (const n of [10, 25, 50]) {
    const start = Date.now();
    await Promise.all(Array.from({ length: n }, () =>
      fetch(`http://127.0.0.1:${PORT}/api/command-center/jarvis/request`, { method: 'POST', headers: auth, body: JSON.stringify({ text: 'what tasks are waiting on me' }) })
    ));
    concurrencyResults.push({ concurrency: n, totalMs: Date.now() - start });
  }

  // ── §25 — resource/leak: 200 repeated Gateway requests through the SAME
  //    process, sampling RSS memory via a lightweight /api/health call
  //    (this fixture server doesn't expose raw process.memoryUsage() over
  //    HTTP, so this measures response-time DRIFT across the run as the
  //    practical proxy — a growing p95 over the course of 200 requests
  //    with no other load is a strong signal of unbounded state growth). ──
  const leakSamples = [];
  for (let i = 0; i < 200; i++) {
    const d = await timed(() => fetch(`http://127.0.0.1:${PORT}/api/command-center/jarvis/request`, { method: 'POST', headers: auth, body: JSON.stringify({ text: `leak probe request #${i}` }) }));
    leakSamples.push(d);
  }
  const firstQuartile = leakSamples.slice(0, 50);
  const lastQuartile = leakSamples.slice(-50);
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const leakReport = {
    totalRequests: leakSamples.length,
    firstQuartileAvgMs: Math.round(avg(firstQuartile)),
    lastQuartileAvgMs: Math.round(avg(lastQuartile)),
    driftRatio: +(avg(lastQuartile) / avg(firstQuartile)).toFixed(2),
    note: 'driftRatio well above ~1.5 across 200 identical-shape requests would indicate unbounded state growth (SessionStore, listeners, timers); this run has no explicit sessionId so SessionStore is not exercised per-request.',
  };

  console.log(JSON.stringify({ latency: results, concurrency: concurrencyResults, resourceLeakProxy: leakReport }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
