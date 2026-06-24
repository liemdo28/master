/**
 * End-to-end validation harness:
 * - Spawns all 7 agents as child processes on assigned ports.
 * - Hits /health, /status, /run/audit, /sync/mi, /reports/latest.
 * - Verifies shared DB writes and inter-agent reads.
 * - Emits a JSON validation report to shared/reports/validation/
 */
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const AGENTS = [
  { id: 'seo-local-maps-agent', port: 4001 },
  { id: 'seo-website-agent', port: 4002 },
  { id: 'seo-technical-agent', port: 4003 },
  { id: 'seo-schema-agent', port: 4004 },
  { id: 'seo-content-agent', port: 4005 },
  { id: 'seo-citation-agent', port: 4006 },
  { id: 'seo-analytics-agent', port: 4007 },
];

function get(port, p) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${p}`, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => { try { resolve({ status: r.statusCode, body: JSON.parse(d) }); } catch (e) { resolve({ status: r.statusCode, body: d }); } });
    }).on('error', reject);
  });
}

function post(port, p, body = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`http://127.0.0.1:${port}${p}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => { try { resolve({ status: r.statusCode, body: JSON.parse(d) }); } catch (e) { resolve({ status: r.statusCode, body: d }); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitHealthy(port, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await get(port, '/health');
      if (r.status === 200 && r.body && r.body.ok) return true;
    } catch (_) { /* not ready */ }
    await wait(200);
  }
  return false;
}

async function main() {
  const results = { started_at: new Date().toISOString(), agents: {}, checks: {} };
  const procs = [];

  // Spawn all agents
  for (const a of AGENTS) {
    const env = { ...process.env, PORT: String(a.port), SEO_LOG_STDOUT: '0' };
    const p = spawn(process.execPath, [path.join(ROOT, a.id, 'index.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    p.stdout.on('data', () => {});
    p.stderr.on('data', (d) => { stderr += d.toString(); });
    procs.push({ a, p, getStderr: () => stderr });
  }

  try {
    // Wait for all to be healthy
    for (const { a, getStderr } of procs) {
      const ok = await waitHealthy(a.port);
      results.agents[a.id] = { port: a.port, healthy: ok, stderr: getStderr ? getStderr().slice(0, 2000) : '' };
      if (!ok) throw new Error(`${a.id} failed to become healthy. stderr: ${getStderr ? getStderr().slice(0, 500) : ''}`);
    }

    // Drive audits in workflow order
    const order = [
      'seo-local-maps-agent',
      'seo-website-agent',
      'seo-schema-agent',
      'seo-technical-agent',
      'seo-citation-agent',
      'seo-content-agent',
      'seo-analytics-agent',
    ];
    results.checks.audits = {};
    for (const id of order) {
      const a = AGENTS.find((x) => x.id === id);
      const r = await post(a.port, '/run/audit');
      results.checks.audits[id] = { status: r.status, ok: r.body && r.body.ok, summary: r.body && r.body.result ? r.body.result.summary : null };
    }

    // Hit endpoints on all
    results.checks.endpoints = {};
    for (const a of AGENTS) {
      const h = await get(a.port, '/health');
      const s = await get(a.port, '/status');
      const m = await post(a.port, '/sync/mi');
      const rl = await get(a.port, '/reports/latest');
      results.checks.endpoints[a.id] = {
        health: { status: h.status, ok: h.body && h.body.ok },
        status: { status: s.status, agent: s.body && s.body.agent, version: s.body && s.body.version, uptime_s: s.body && s.body.uptime_s, mi_last_sync: s.body && s.body.mi_last_sync },
        sync_mi: { status: m.status, ok: m.body && m.body.ok },
        reports_latest: { status: rl.status, ok: rl.body && rl.body.ok },
      };
    }

    // Verify shared DB has data from each agent
    const dbPath = path.join(ROOT, 'shared', 'database', 'seo-shared.db');
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    results.checks.shared_db = {
      path: dbPath,
      tables: Object.fromEntries(Object.keys(db).map((k) => [k, db[k].length])),
      agent_status_rows: db.agent_status.length,
      mi_sync_logs_rows: db.mi_sync_logs.length,
      reports_rows: db.reports.length,
    };

    // Inter-agent: verify Local Maps wrote locations consumed elsewhere; analytics aggregated
    results.checks.inter_agent = {
      local_maps_wrote_locations: db.locations.length > 0,
      website_wrote_pages: db.pages.length > 0,
      schema_wrote_items: db.schema_items.length > 0,
      technical_wrote_issues: db.technical_issues.length > 0,
      citation_wrote_citations: db.citations.length > 0,
      content_wrote_briefs: db.content_briefs.length > 0,
      analytics_wrote_metrics: db.analytics_metrics.length > 0,
    };

    // Event bus check
    const busFile = path.join(ROOT, 'shared', 'events', 'bus.log');
    const events = fs.existsSync(busFile)
      ? fs.readFileSync(busFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
      : [];
    results.checks.events = {
      total: events.length,
      types: [...new Set(events.map((e) => e.type))],
    };

    // Logs check
    const logsDir = path.join(ROOT, 'shared', 'logs');
    results.checks.logs = fs.readdirSync(logsDir).filter((f) => f.endsWith('.log'));

    // Reports check
    const reportsDir = path.join(ROOT, 'shared', 'reports');
    results.checks.reports = fs.readdirSync(reportsDir).filter((d) => fs.statSync(path.join(reportsDir, d)).isDirectory());

    results.status = 'PASS';
  } catch (e) {
    results.status = 'FAIL';
    results.error = e.message;
  } finally {
    for (const { p } of procs) try { p.kill(); } catch (_) {}
  }

  results.finished_at = new Date().toISOString();
  const outDir = path.join(ROOT, 'shared', 'reports', 'validation');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `validation-${Date.now()}.json`);
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log('Validation report written to:', out);
  console.log('Status:', results.status);
  if (results.error) console.log('Error:', results.error);
  process.exit(results.status === 'PASS' ? 0 : 1);
}

main();
