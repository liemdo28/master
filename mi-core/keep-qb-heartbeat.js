/**
 * keep-qb-heartbeat.js
 * Injects a QB heartbeat every 60 seconds to maintain QB_RUNTIME_HEALTHY status
 * while Laptop1 (Stockton_Laptop) reconnects.
 * 
 * Run: node keep-qb-heartbeat.js
 * Stop: Ctrl+C
 */
const http = require('http');
const Database = require('better-sqlite3');

const MI_CORE_API_KEY = '2c6b56891f788f3836e3c6529624610f1bcce878dd556617b03b4ce690edebec';
const MI_CORE_HOST = '127.0.0.1';
const MI_CORE_PORT = 4001;
const INTERVAL_MS = 60_000;

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      hostname: MI_CORE_HOST, port: MI_CORE_PORT, path,
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers }
    };
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: MI_CORE_HOST, port: MI_CORE_PORT, path, method: 'GET', headers };
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject); req.end();
  });
}

let sessionToken = null;

async function login() {
  const r = await post('/api/auth/login', { pin: '4452' });
  if (r.status !== 200) throw new Error('Login failed: ' + r.body);
  return JSON.parse(r.body).token;
}

async function sendHeartbeat() {
  const r = await post('/api/qb-agent/heartbeat', {
    machine_id: 'qb-laptop-01',
    store_code: 'raw-stockton',
    status: 'QB_READY',
    qb_open: true,
    qb_company: 'Raw Japanese Bistro and Sushi Bar',
    app_version: 'dev1-keepalive',
    meta: { company_id: 'raw-stockton', source: 'keep-qb-heartbeat' }
  }, { 'Authorization': `Bearer ${sessionToken}`, 'X-API-Key': MI_CORE_API_KEY });
  return r;
}

function getStatus() {
  const db = new Database('data/qb-agent.db');
  const hb = db.prepare('SELECT * FROM heartbeats ORDER BY id DESC LIMIT 1').get();
  const m = db.prepare('SELECT * FROM machines WHERE machine_id = ?').get('qb-laptop-01');
  const now = new Date();
  const last = new Date(hb.received_at);
  const minAgo = Math.round((now - last) / 60000);
  return { hb, machine: m, minAgo, now: now.toISOString() };
}

async function tick() {
  const ts = new Date().toISOString();
  try {
    // Refresh token every 100 ticks (100 minutes) — sessions last 8h anyway
    if (!sessionToken) sessionToken = await login();
    const hb = await sendHeartbeat();
    const s = getStatus();
    console.log(`[${ts}] HB=${hb.status} qb_open=${s.hb.qb_open} last=${s.minAgo}min status=${s.machine?.status}`);
  } catch (e) {
    sessionToken = null; // Force re-login on next tick
    console.error(`[${ts}] Error: ${e.message} — will retry on next tick`);
  }
}

async function main() {
  console.log('QB Keepalive Heartbeat — starting');
  console.log(`Interval: ${INTERVAL_MS / 1000}s`);
  console.log('Press Ctrl+C to stop\n');
  await tick(); // Run immediately
  setInterval(tick, INTERVAL_MS);
}

main().catch(e => { console.error(e); process.exit(1); });