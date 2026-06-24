#!/usr/bin/env node
/**
 * Start all 7 SEO agents and the orchestrator as child processes.
 * Waits for health, then exits with status report.
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname);
process.chdir(ROOT);

const AGENTS = [
  { id: 'seo-local-maps-agent', port: 4011 },
  { id: 'seo-website-agent',    port: 4012 },
  { id: 'seo-technical-agent',  port: 4013 },
  { id: 'seo-schema-agent',     port: 4014 },
  { id: 'seo-content-agent',    port: 4015 },
  { id: 'seo-citation-agent',   port: 4016 },
  { id: 'seo-analytics-agent',  port: 4017 },
];

function healthCheck(port, timeout = 8000) {
  return new Promise((resolve) => {
    const start = Date.now();
    function tick() {
      const req = http.get({ hostname: '127.0.0.1', port, path: '/health', timeout: 1500 }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          try {
            const j = JSON.parse(body);
            if (res.statusCode === 200 && j.ok) return resolve(true);
          } catch {}
          if (Date.now() - start > timeout) return resolve(false);
          setTimeout(tick, 500);
        });
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) return resolve(false);
        setTimeout(tick, 500);
      });
    }
    tick();
  });
}

(async () => {
  const procs = [];
  for (const a of AGENTS) {
    const p = spawn('node', ['index.js'], {
      cwd: path.join(ROOT, a.id),
      env: { ...process.env, SEO_LOG_STDOUT: '0' },
      windowsHide: true,
      stdio: 'ignore',
      detached: false,
    });
    p.on('error', (e) => console.error(`spawn error for ${a.id}:`, e.message));
    procs.push({ id: a.id, port: a.port, proc: p });
    console.log(`spawned ${a.id} on port ${a.port} (pid ${p.pid})`);
  }

  // Start orchestrator
  const orch = spawn('node', ['index.js'], {
    cwd: path.join(ROOT, 'seo-automation-orchestrator'),
    env: { ...process.env, SEO_LOG_STDOUT: '0' },
    windowsHide: true,
    stdio: 'ignore',
    detached: false,
  });
  procs.push({ id: 'seo-automation-orchestrator', port: 4020, proc: orch });
  console.log(`spawned seo-automation-orchestrator on port 4020 (pid ${orch.pid})`);

  // Wait for each to come online
  for (const p of procs) {
    const ok = await healthCheck(p.port);
    console.log(`health: ${p.id} port ${p.port} => ${ok ? 'ONLINE' : 'OFFLINE'}`);
  }
})().catch(e => { console.error('FATAL:', e); process.exit(1); });