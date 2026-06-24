/* Auto-generated smoke test for seo-website-agent */
const http = require('http');
const assert = require('assert');
const { createAgent } = require('../shared/base/base-agent');

async function run() {
  const { server } = createAgent({
    agentId: 'seo-website-agent',
    version: '1.0.0',
    port: 0,
    agentDir: __dirname,
    runAudit: async ({ saveReport, db }) => {
      saveReport({ agentId: 'seo-website-agent', type: 'smoke', payload: { summary: 'smoke' }, db });
      return { summary: 'smoke' };
    },
    statusExtras: () => ({}),
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const get = (p) => new Promise((res, rej) => {
    http.get('http://127.0.0.1:' + port + p, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => res({ status: r.statusCode, body: JSON.parse(d) }));
    }).on('error', rej);
  });
  const post = (p) => new Promise((res, rej) => {
    const data = '{}';
    const req = http.request('http://127.0.0.1:' + port + p, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
    }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => res({ status: r.statusCode, body: JSON.parse(d) }));
    });
    req.on('error', rej);
    req.write(data);
    req.end();
  });

  const h = await get('/health'); assert.strictEqual(h.status, 200); assert.strictEqual(h.body.ok, true);
  const s = await get('/status'); assert.strictEqual(s.status, 200); assert.strictEqual(s.body.agent, 'seo-website-agent');
  const a = await post('/run/audit'); assert.strictEqual(a.status, 200); assert.strictEqual(a.body.ok, true);
  const r = await get('/reports/latest'); assert.strictEqual(r.status, 200);
  const m = await post('/sync/mi'); assert.strictEqual(m.status, 200);

  server.close();
  console.log('seo-website-agent: ALL TESTS PASSED');
}
run().catch((e) => { console.error(e); process.exit(1); });
