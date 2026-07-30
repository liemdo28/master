const http = require('http');

const MI_CORE_API_KEY = '2c6b56891f788f3836e3c6529624610f1bcce878dd556617b03b4ce690edebec';
const MI_CORE_HOST = '127.0.0.1';
const MI_CORE_PORT = 4001;

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: MI_CORE_HOST, port: MI_CORE_PORT, path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers }
    };
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

async function main() {
  // 1. Login
  const login = await post('/api/auth/login', { pin: '4452' });
  console.log('Login:', login.status, login.body);
  if (login.status !== 200) { console.error('Login failed'); process.exit(1); }
  const { token } = JSON.parse(login.body);

  // 2. Send heartbeat with session token + API key
  const hb = await post('/api/qb-agent/heartbeat', {
    machine_id: 'qb-laptop-01',
    store_code: 'raw-stockton',
    status: 'QB_READY',
    qb_open: true,
    qb_company: 'Raw Japanese Bistro and Sushi Bar',
    app_version: 'dev1-0.0.1',
    meta: { company_id: 'raw-stockton', source: 'server-side-recovery-injection' }
  }, { 'Authorization': `Bearer ${token}`, 'X-API-Key': MI_CORE_API_KEY });
  console.log('Heartbeat:', hb.status, hb.body);

  // 3. Check DB
  const Database = require('better-sqlite3');
  const db = new Database('data/qb-agent.db');
  const hb2 = db.prepare('SELECT * FROM heartbeats ORDER BY id DESC LIMIT 3').all();
  console.log('\n=== Last 3 heartbeats ===');
  hb2.forEach(h => console.log(h.id, h.received_at, h.status, 'qb_open=' + h.qb_open));
  const now = new Date();
  const last = new Date(hb2[0].received_at);
  console.log('\nMinutes since last heartbeat:', Math.round((now - last) / 60000));
}

main().catch(e => { console.error(e); process.exit(1); });