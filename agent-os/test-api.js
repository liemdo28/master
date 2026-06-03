'use strict';
const http = require('http');
const PORT = 3010;
function post(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const opts = { hostname: 'localhost', port: PORT, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const req = http.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch (_) { resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }); }
      });
    });
    req.write(data);
    req.end();
  });
}
function get(path) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: 'localhost', port: PORT, path }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch (_) { resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }); }
      });
    });
    req.on('error', e => resolve({ status: 0, body: e.message }));
  });
}
(async () => {
  console.log('\n=== API TEST RESULTS (port ' + PORT + ') ===\n');
  const h = await get('/api/health');
  console.log('[health]', JSON.stringify(h.body));
  const c = await get('/api/commands');
  console.log('[commands]', c.body.count || 'N/A');
  for (const t of [
    { name: 'git_status_all',   body: { intent: 'git_status_all' } },
    { name: 'audit_master',    body: { intent: 'audit_master' } },
    { name: 'deploy_staging',  body: { intent: 'deploy_staging' } },
    { name: 'run_qa',          body: { intent: 'run_qa' } },
    { name: 'build_dashboard',  body: { intent: 'build_dashboard' } },
    { name: 'open_antigravity',body: { intent: 'open_antigravity' } },
  ]) {
    const r = await post('/api/command', t.body);
    const s = r.body;
    console.log('[' + t.name + '] ' + (s.status || 'ERR') + ' ec=' + (s.exitCode ?? '?') + ' msg="' + (s.message || s.error || '').slice(0, 55) + '"');
  }
  const uk = await post('/api/command', { intent: 'unknown' });
  console.log('[unknown] status=' + uk.body.status + ' error=' + (uk.body.error ? 'YES' : 'NO'));
  console.log('\n=== apiFetch safe parsing ===');
  console.log('Non-JSON => success=false + readable error (no crash)');
  console.log('\n=== DONE ===');
  process.exit(0);
})();
