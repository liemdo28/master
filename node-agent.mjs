#!/usr/bin/env node
/**
 * Mi Node Agent — Phase 6
 * Run this on any secondary device (laptop, Mac, server) to join the Mi network.
 * The agent self-registers with the central Mi server and sends heartbeats.
 *
 * Usage:
 *   node node-agent.mjs --server http://192.168.1.x:4001 --name "MacBook-Pro"
 *   node node-agent.mjs --server http://100.x.x.x:4001  --name "Laptop-Win"
 *
 * Environment overrides:
 *   MI_SERVER_URL   — central Mi server URL
 *   MI_NODE_ID      — unique node id (default: hostname)
 *   MI_NODE_NAME    — display name
 *   MI_NODE_PORT    — port this agent listens on (default: 4002)
 *   MI_CAPABILITIES — comma-separated list of capabilities
 */

import os from 'os';
import http from 'http';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ── Config ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const SERVER_URL    = getArg('--server') || process.env.MI_SERVER_URL || 'http://127.0.0.1:4001';
const NODE_NAME     = getArg('--name')   || process.env.MI_NODE_NAME  || os.hostname();
const NODE_PORT     = parseInt(getArg('--port') || process.env.MI_NODE_PORT || '4002');
const NODE_ID       = process.env.MI_NODE_ID || `node-${os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
// Phase 7A.1: default trimmed to what this file actually implements — it never
// had a /file route, and /exec is retired (see the handler below).
const CAPABILITIES  = (process.env.MI_CAPABILITIES || 'health-report').split(',').map(s => s.trim());
const HB_INTERVAL   = 30_000; // 30s heartbeat

let registered = false;
let hbCount = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const opts = {
      hostname: u.hostname, port: u.port || 80, path: u.pathname,
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', d => { raw += d; });
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve(raw); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (!net.internal && net.family === 'IPv4') return net.address;
    }
  }
  return '127.0.0.1';
}

// ── Registration ──────────────────────────────────────────────────────────────

async function register() {
  const ip = getLocalIP();
  const payload = {
    node_id:      NODE_ID,
    node_name:    NODE_NAME,
    node_url:     `http://${ip}:${NODE_PORT}`,
    port:         NODE_PORT,
    platform:     os.platform(),
    node_version: process.version,
    capabilities: CAPABILITIES,
    metadata: {
      hostname:    os.hostname(),
      arch:        os.arch(),
      cpus:        os.cpus().length,
      memory_gb:   Math.round(os.totalmem() / 1_073_741_824 * 10) / 10,
      uptime_h:    Math.floor(os.uptime() / 3600),
    },
  };

  try {
    const result = await post(`${SERVER_URL}/api/nodes/register`, payload);
    if (result.registered) {
      registered = true;
      console.log(`[NodeAgent] ✅ Registered as "${NODE_NAME}" (${NODE_ID}) → ${SERVER_URL}`);
      console.log(`[NodeAgent]    Capabilities: ${CAPABILITIES.join(', ')}`);
      console.log(`[NodeAgent]    IP: ${ip}:${NODE_PORT}`);
    } else {
      console.error('[NodeAgent] Registration failed:', result);
    }
  } catch (e) {
    console.error(`[NodeAgent] Cannot reach Mi server at ${SERVER_URL} — will retry`);
  }
}

async function heartbeat() {
  if (!registered) { await register(); return; }
  hbCount++;
  try {
    await post(`${SERVER_URL}/api/nodes/${NODE_ID}/heartbeat`, {
      uptime_s: process.uptime(),
      memory_free_mb: Math.round(os.freemem() / 1_048_576),
      hb_count: hbCount,
    });
    if (hbCount % 10 === 0) console.log(`[NodeAgent] 💓 Heartbeat #${hbCount}`);
  } catch {
    registered = false; // will re-register on next interval
    console.warn(`[NodeAgent] ⚠️ Heartbeat failed — will re-register`);
  }
}

// ── Local HTTP listener (for Mi to ping back) ─────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health' && req.method === 'GET') {
    res.end(JSON.stringify({
      node_id:    NODE_ID,
      node_name:  NODE_NAME,
      status:     'online',
      uptime_s:   Math.floor(process.uptime()),
      memory_free_mb: Math.round(os.freemem() / 1_048_576),
      platform:   os.platform(),
      capabilities: CAPABILITIES,
      hb_count:   hbCount,
    }));
    return;
  }

  if (req.url === '/exec' && req.method === 'POST') {
    // Phase 7A.1: retired. This endpoint ran arbitrary shell commands on a
    // 0.0.0.0-bound listener with no authentication and only a trivially
    // bypassable denylist (e.g. 'Remove-Item' was never blocked by 'rm ').
    // Unrestricted shell execution is not an approved authority (Phase 6G),
    // so this is retired rather than gated behind a shared secret — adding
    // auth here would still leave a general remote-shell capability that
    // was never reviewed or approved. mi-core's own dispatch path for this
    // (POST /api/nodes/:id/exec) already quarantines the request before it
    // would ever reach here (Phase 6B legacyAuthorityBoundary).
    res.statusCode = 410;
    res.end(JSON.stringify({ error: 'EXEC_RETIRED', reason: 'Remote shell execution was retired in Phase 7A.1 — unauthenticated and ungoverned, and unrestricted shell execution remains an unapproved authority.' }));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'NOT_FOUND' }));
});

// ── Boot ──────────────────────────────────────────────────────────────────────

server.listen(NODE_PORT, '0.0.0.0', () => {
  console.log(`\n[NodeAgent] ════════════════════════════════`);
  console.log(`[NodeAgent] Mi Node Agent starting`);
  console.log(`[NodeAgent] Node ID:   ${NODE_ID}`);
  console.log(`[NodeAgent] Node Name: ${NODE_NAME}`);
  console.log(`[NodeAgent] Server:    ${SERVER_URL}`);
  console.log(`[NodeAgent] Listening: 0.0.0.0:${NODE_PORT}`);
  console.log(`[NodeAgent] ════════════════════════════════\n`);

  register().then(() => {
    setInterval(heartbeat, HB_INTERVAL);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[NodeAgent] Port ${NODE_PORT} in use. Set MI_NODE_PORT to a different port.`);
    process.exit(1);
  }
  console.error('[NodeAgent] Server error:', err);
});

process.on('SIGTERM', () => {
  console.log('[NodeAgent] Shutting down');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('[NodeAgent] Shutting down');
  server.close(() => process.exit(0));
});
