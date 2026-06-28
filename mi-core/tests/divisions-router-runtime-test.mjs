/**
 * Company Divisions Router Runtime Test (Phase 5–9 wiring).
 *
 * Mounts the compiled /api/divisions router on an ephemeral Express app and
 * exercises every endpoint over real HTTP, proving the Phase 5–9 division
 * engines are actually reachable through the server (not just unit-testable).
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const SERVER = join(PROJECT_ROOT, 'server');
const require = createRequire(join(SERVER, 'index.js')); // resolve deps from server/node_modules

const express = require('express');
const { companyDivisionsRouter } = require(join(SERVER, 'dist', 'routes', 'company-divisions.js'));

let passed = 0, failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.log(`  FAIL: ${label}`); failed++; }
}

function get(server, path) {
  return req(server, 'GET', path);
}
function req(server, method, path) {
  const { port } = server.address();
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, path, method }, (res) => {
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
app.use(express.json());
app.use('/api/divisions', companyDivisionsRouter);
const server = app.listen(0);

console.log('\n=== Company Divisions Router Runtime Test ===');

try {
  console.log('\n--- Overview ---');
  const overview = await get(server, '/api/divisions/');
  assert('GET /api/divisions returns 200', overview.status === 200);
  assert('overview lists all 5 divisions', overview.body.count === 5 && overview.body.divisions.length === 5);
  assert('overview covers phases 5–9', JSON.stringify(overview.body.divisions.map(d => d.phase).sort()) === JSON.stringify([5, 6, 7, 8, 9]));
  assert('each division has a status', overview.body.divisions.every(d => typeof d.status === 'string' && d.status.length > 0));

  console.log('\n--- Per-division dashboards ---');
  for (const [key, phase] of [['it', 5], ['creative', 6], ['data-platform', 7], ['intelligence', 8], ['autonomy', 9]]) {
    const d = await get(server, `/api/divisions/${key}`);
    assert(`GET /api/divisions/${key} returns 200`, d.status === 200);
    assert(`${key} dashboard reports phase ${phase}`, d.body.phase === phase);
    assert(`${key} dashboard has a status`, ['OPERATIONAL', 'PARTIAL', 'BLOCKED', 'HEALTHY', 'DEGRADED', 'DOWN'].includes(d.body.status));
  }

  console.log('\n--- Cross-division intelligence (Phase 8) ---');
  const ask = await get(server, '/api/divisions/intelligence/ask?q=' + encodeURIComponent('What is our revenue status?'));
  assert('intelligence/ask returns 200', ask.status === 200);
  assert('intelligence/ask answers the question', ask.body.answered === true && ask.body.answer.length > 0);
  assert('intelligence/ask carries noFakeMetrics flag', ask.body.noFakeMetrics === true);
  const askEmpty = await get(server, '/api/divisions/intelligence/ask');
  assert('intelligence/ask without q returns 400', askEmpty.status === 400);

  console.log('\n--- Bootstrap (registers objective + task + evidence) ---');
  const boot = await req(server, 'POST', '/api/divisions/it/bootstrap');
  assert('POST /api/divisions/it/bootstrap returns 200', boot.status === 200);
  assert('bootstrap registers an objective', !!boot.body.objective && !!boot.body.objective.id);
  assert('bootstrap registers a task', !!boot.body.task && !!boot.body.task.id);

  console.log('\n--- Unknown division is rejected ---');
  const unknown = await get(server, '/api/divisions/marketing-ops');
  assert('unknown division returns 404', unknown.status === 404);
  assert('404 lists available divisions', Array.isArray(unknown.body.available) && unknown.body.available.length === 5);
} finally {
  server.close();
}

console.log(`\n  RESULTS: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
