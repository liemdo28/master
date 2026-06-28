/**
 * Agent OS Router Runtime Test (Phase 12–20 wiring).
 *
 * Mounts the compiled /api/agent-os router on an ephemeral Express app and
 * proves the server can actually load and summarize all nine Phase 12–20
 * agent-engine orchestrators (ESM) over real HTTP — the CommonJS→ESM bridge
 * works end-to-end, not just in unit isolation.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const SERVER = join(PROJECT_ROOT, 'server');
const require = createRequire(join(SERVER, 'index.js'));

const express = require('express');
const { agentOsRouter } = require(join(SERVER, 'dist', 'routes', 'agent-os.js'));

let passed = 0, failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

function get(server, path) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    r.end();
  });
}

const app = express();
app.use('/api/agent-os', agentOsRouter);
const server = app.listen(0);

console.log('\n=== Agent OS Router Runtime Test (Phase 12–20) ===');

try {
  console.log('\n--- Overview: all 9 phases load ---');
  const overview = await get(server, '/api/agent-os/');
  assert('GET /api/agent-os returns 200', overview.status === 200);
  assert('overview reports 9 phases', overview.body.count === 9);
  assert('ALL 9 phases loaded from ESM', overview.body.loaded === 9);
  assert('every phase exposes an orchestrator class name', overview.body.phases.every(p => p.loaded && typeof p.orchestrator === 'string' && p.orchestrator.length > 0));
  assert('every phase reports its public API surface', overview.body.phases.every(p => Array.isArray(p.api) && p.api.length > 0));
  assert('phase ids span 12–20', JSON.stringify(overview.body.phases.map(p => p.phase)) === JSON.stringify([12, 13, 14, 15, 16, 17, 18, 19, 20]));

  console.log('\n--- Per-phase live summaries ---');
  const expectSummary = { 12: 'scorecard', 13: 'scorecard', 14: 'pending', 16: 'fleetReport', 17: 'crossCompanyReport', 18: 'stats', 20: 'dashboard' };
  for (const id of [12, 13, 14, 15, 16, 17, 18, 19, 20]) {
    const r = await get(server, `/api/agent-os/${id}`);
    assert(`GET /api/agent-os/${id} returns 200`, r.status === 200);
    assert(`phase ${id} loaded`, r.body.loaded === true);
    if (expectSummary[id]) {
      assert(`phase ${id} ran ${expectSummary[id]}() and returned a summary`, r.body.summaryMethod === expectSummary[id] && r.body.summary !== null && typeof r.body.summary === 'object');
    }
  }

  console.log('\n--- Capstone Phase 20 dashboard shape ---');
  const p20 = await get(server, '/api/agent-os/20');
  assert('phase 20 orchestrator is CEOControlPanel', p20.body.orchestrator === 'CEOControlPanel');
  assert('phase 20 dashboard has a posture', ['GREEN', 'AMBER', 'RED'].includes(p20.body.summary.posture));
  assert('phase 20 dashboard reports killSwitch state', typeof p20.body.summary.killSwitchTripped === 'boolean');

  console.log('\n--- Unknown phase is rejected ---');
  const unknown = await get(server, '/api/agent-os/99');
  assert('unknown phase returns 404', unknown.status === 404);
  assert('404 lists available phases', Array.isArray(unknown.body.available) && unknown.body.available.length === 9);
} finally {
  server.close();
}

console.log(`\n  RESULTS: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
