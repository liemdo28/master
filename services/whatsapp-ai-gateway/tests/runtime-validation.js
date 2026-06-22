'use strict';
/**
 * runtime-validation.js
 * Validates the 5 required production endpoints.
 * Connects to a running server (DASHBOARD_PORT) or uses module-level checks as fallback.
 *
 *   node tests/runtime-validation.js [--port 3210] [--module-only]
 */

require('dotenv').config();
const http  = require('http');
const https = require('https');
const path  = require('path');
const fs    = require('fs');

const PORT        = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || process.env.DASHBOARD_PORT || '3210', 10);
const MODULE_ONLY = process.argv.includes('--module-only');
const BASE_URL    = `http://localhost:${PORT}`;
const LOG_PATH    = path.resolve('./logs/runtime-validation.json');

const ENDPOINTS = [
  { name: 'WhatsApp Session',     method: 'GET', path: '/api/whatsapp/session' },
  { name: 'Router Status',        method: 'GET', path: '/api/router/status' },
  { name: 'Router Validate',      method: 'GET', path: '/api/router/validate' },
  { name: 'Clients List',         method: 'GET', path: '/api/clients' },
  { name: 'Audit Messages',       method: 'GET', path: '/api/audit/messages' },
];

// ── HTTP helper ──────────────────────────────────────────────────────────────

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 8000 }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }); }
        catch (_) { resolve({ statusCode: res.statusCode, body: { raw: data.slice(0, 200) } }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── Module-level checks (fallback when server not running) ────────────────────

function moduleCheck(name, fn) {
  try {
    fn();
    return { name, pass: true, mode: 'module', detail: 'Module loaded and exports verified' };
  } catch (err) {
    return { name, pass: false, mode: 'module', detail: err.message };
  }
}

function runModuleChecks() {
  return [
    moduleCheck('WhatsApp Session — session-manager exports getDetailedStatus', () => {
      const sm = require('../src/whatsapp/session-manager');
      if (typeof sm.getDetailedStatus !== 'function') throw new Error('getDetailedStatus missing');
      if (typeof sm.getStatus !== 'function') throw new Error('getStatus missing');
      const s = sm.getDetailedStatus ? sm.getDetailedStatus() : sm.getStatus();
      if (!s || typeof s !== 'object') throw new Error('status not an object');
    }),

    moduleCheck('Router Status — agent-mi-router exports isAgentCommand + isMiCommand', () => {
      const r = require('../src/commands/agent-mi-router');
      if (typeof r.isAgentCommand !== 'function') throw new Error('isAgentCommand missing');
      if (typeof r.isMiCommand !== 'function') throw new Error('isMiCommand missing');
      if (!r.isAgentCommand('/agent hello')) throw new Error('/agent not detected');
      if (!r.isMiCommand('/mi status')) throw new Error('/mi not detected');
    }),

    moduleCheck('Router Validate — no cross-routing', () => {
      const r = require('../src/commands/agent-mi-router');
      if (r.isMiCommand('/agent hello')) throw new Error('/agent cross-routed to mi!');
      if (r.isAgentCommand('/mi status')) throw new Error('/mi cross-routed to agent!');
      if (r.isAgentCommand('plain food safety photo')) throw new Error('plain message mis-routed to agent');
      if (r.isMiCommand('plain food safety photo')) throw new Error('plain message mis-routed to mi');
    }),

    moduleCheck('Clients — project-client-registry exports listClients', () => {
      const reg = require('../src/security/project-client-registry');
      if (typeof reg.listClients !== 'function') throw new Error('listClients missing');
      if (typeof reg.getClient !== 'function') throw new Error('getClient missing');
      if (typeof reg.rotateClientKey !== 'function') throw new Error('rotateClientKey missing');
      if (typeof reg.revokeClient !== 'function') throw new Error('revokeClient missing');
    }),

    moduleCheck('Audit Messages — api-key-audit-log exports getLogs', () => {
      const audit = require('../src/security/api-key-audit-log');
      if (typeof audit.getLogs !== 'function') throw new Error('getLogs missing');
      if (typeof audit.record !== 'function') throw new Error('record missing');
    }),
  ];
}

// ── HTTP checks ───────────────────────────────────────────────────────────────

async function runHttpChecks() {
  const results = [];
  for (const ep of ENDPOINTS) {
    const start = Date.now();
    try {
      const r = await httpGet(`${BASE_URL}${ep.path}`);
      const latency = Date.now() - start;
      const body = r.body;
      const pass = r.statusCode >= 200 && r.statusCode < 400;
      results.push({
        name: ep.name,
        pass,
        mode: 'http',
        path: ep.path,
        status_code: r.statusCode,
        latency_ms: latency,
        body_ok: body?.ok !== false,
        body_keys: Object.keys(body || {}).slice(0, 10),
        body_sample: JSON.stringify(body).slice(0, 300),
        detail: pass ? `HTTP ${r.statusCode} in ${latency}ms` : `HTTP ${r.statusCode}`,
      });
    } catch (err) {
      results.push({
        name: ep.name,
        pass: false,
        mode: 'http',
        path: ep.path,
        status_code: null,
        latency_ms: Date.now() - start,
        body_ok: false,
        body_sample: '',
        detail: `Error: ${err.message}`,
      });
    }
  }
  return results;
}

// ── Runner ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n=== RUNTIME VALIDATION ===\n');

  let serverReachable = false;
  let results = [];

  if (!MODULE_ONLY) {
    try {
      const probe = await httpGet(`${BASE_URL}/api/health`);
      serverReachable = probe.statusCode >= 200 && probe.statusCode < 400;
    } catch (_) {
      serverReachable = false;
    }
  }

  if (serverReachable) {
    console.log(`  Server reachable at ${BASE_URL}. Running HTTP checks...\n`);
    results = await runHttpChecks();
  } else {
    console.log(`  Server not reachable at ${BASE_URL}. Running module-level checks...\n`);
    results = runModuleChecks();
  }

  const pass    = results.filter(r => r.pass).length;
  const fail    = results.filter(r => !r.pass).length;
  const verdict = fail === 0 ? 'PASS' : 'FAIL';

  results.forEach(r => {
    const tag = r.pass ? '[PASS]' : '[FAIL]';
    console.log(`  ${tag} ${r.name}`);
    console.log(`         ${r.detail}`);
    if (r.body_sample && r.mode === 'http') {
      const preview = r.body_sample.slice(0, 120);
      console.log(`         Body: ${preview}${r.body_sample.length > 120 ? '...' : ''}`);
    }
    console.log('');
  });

  console.log(`  Mode: ${serverReachable ? 'HTTP (live server)' : 'Module (no server)'}`);
  console.log(`  Results: ${pass} PASS, ${fail} FAIL`);
  console.log(`  Verdict: ${verdict}\n`);

  const report = {
    generated_at: new Date().toISOString(),
    mode: serverReachable ? 'http' : 'module',
    server_url: BASE_URL,
    server_reachable: serverReachable,
    summary: { total: results.length, pass, fail, verdict },
    results,
  };

  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.writeFileSync(LOG_PATH, JSON.stringify(report, null, 2));
    console.log(`  JSON written to: ${LOG_PATH}\n`);
  } catch (_) {}

  if (fail > 0) process.exitCode = 1;
  return report;
}

run().catch(err => { console.error('Validation error:', err.message); process.exit(1); });
