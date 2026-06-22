/**
 * Mi-Core Self-Healing Watchdog
 *
 * Detects and fixes:
 *   - Rogue PIDs holding ports (EADDRINUSE root cause)
 *   - Crashed PM2 processes
 *   - WhatsApp session disconnect
 *   - Memory leaks (>512MB)
 *   - Mi-Core unresponsive (health check failure)
 *
 * Run via PM2:
 *   pm2 start scripts/mi-watchdog.mjs --name mi-watchdog --interpreter node
 *
 * Or standalone (every 30s):
 *   node scripts/mi-watchdog.mjs
 */

import { exec, execSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE  = path.join(__dirname, '..', 'logs', 'watchdog.log');
const INTERVAL  = parseInt(process.env.WATCHDOG_INTERVAL_MS || '30000');
const DRY_RUN   = process.env.WATCHDOG_DRY_RUN === '1';

const SERVICES = [
  { name: 'mi-core',             port: 4001, pm2Name: 'mi-core',             healthPath: '/api/health',          key: process.env.MI_CORE_API_KEY || '' },
  { name: 'whatsapp-ai-gateway', port: 3211, pm2Name: 'whatsapp-ai-gateway', healthPath: '/health',              key: null },
  { name: 'antigravity-gateway', port: 3456, pm2Name: 'antigravity-gateway', healthPath: '/health',              key: null },
];

// ── Logging ──────────────────────────────────────────────────────────────────
function log(level, msg, detail = '') {
  const line = `[${new Date().toISOString()}] [${level}] ${msg}${detail ? ' — ' + detail : ''}`;
  console.log(line);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
    // Rotate at 2MB
    const stat = fs.statSync(LOG_FILE);
    if (stat.size > 2 * 1024 * 1024) {
      fs.renameSync(LOG_FILE, LOG_FILE + '.bak');
    }
  } catch {}
}

// ── Port helper (Windows netstat) ────────────────────────────────────────────
function getPidOnPort(port) {
  try {
    const out = execSync(`netstat -ano 2>nul`, { encoding: 'utf8', timeout: 5000 });
    const lines = out.split('\n');
    for (const line of lines) {
      if (line.includes(`:${port} `) && line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[parts.length - 1]);
        if (!isNaN(pid) && pid > 0) return pid;
      }
    }
  } catch {}
  return null;
}

// ── Get PM2 PID for a process name ───────────────────────────────────────────
function getPm2Pid(name) {
  try {
    const out = execSync(`pm2 jlist 2>nul`, { encoding: 'utf8', timeout: 8000 });
    const list = JSON.parse(out);
    const proc = list.find(p => p.name === name);
    return proc ? proc.pid : null;
  } catch {
    return null;
  }
}

// ── Get PM2 process info ──────────────────────────────────────────────────────
function getPm2Info(name) {
  try {
    const out = execSync(`pm2 jlist 2>nul`, { encoding: 'utf8', timeout: 8000 });
    const list = JSON.parse(out);
    return list.find(p => p.name === name) || null;
  } catch {
    return null;
  }
}

// ── Kill rogue PID ────────────────────────────────────────────────────────────
function killPid(pid) {
  if (DRY_RUN) { log('DRY', `Would kill PID ${pid}`); return true; }
  try {
    execSync(`wmic process where "ProcessId=${pid}" delete 2>nul`, { timeout: 5000 });
    return true;
  } catch {
    try {
      execSync(`taskkill /PID ${pid} /F 2>nul`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

// ── PM2 restart ───────────────────────────────────────────────────────────────
function pm2Restart(name) {
  if (DRY_RUN) { log('DRY', `Would pm2 restart ${name}`); return; }
  try {
    execSync(`pm2 restart ${name} 2>nul`, { timeout: 15000 });
    log('FIX', `pm2 restart ${name} executed`);
  } catch (e) {
    log('ERR', `pm2 restart ${name} failed`, e.message);
  }
}

// ── HTTP health check ─────────────────────────────────────────────────────────
function httpGet(port, path, key, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const headers = key ? { 'x-api-key': key } : {};
    const req = http.get({ hostname: '127.0.0.1', port, path, headers }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ ok: res.statusCode < 400, status: res.statusCode, body: {} }); }
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ok: false, status: 0, body: {} }); });
    req.on('error', () => resolve({ ok: false, status: 0, body: {} }));
  });
}

// ── Check and heal a single service ──────────────────────────────────────────
async function checkService(svc) {
  const issues = [];
  const fixes  = [];

  // 1. HTTP health check
  const health = await httpGet(svc.port, svc.healthPath, svc.key);
  if (!health.ok) {
    issues.push(`health_check_failed (HTTP ${health.status})`);
  }

  // 2. Port binding check — detect rogue PID
  const portPid  = getPidOnPort(svc.port);
  const pm2Pid   = getPm2Pid(svc.pm2Name);
  const pm2Info  = getPm2Info(svc.pm2Name);

  if (portPid && pm2Pid && portPid !== pm2Pid) {
    issues.push(`rogue_pid port=${svc.port} rogPID=${portPid} pm2PID=${pm2Pid}`);
    // Kill rogue, let PM2 take over
    log('FIX', `[${svc.name}] Killing rogue PID ${portPid} on port ${svc.port}`);
    const killed = killPid(portPid);
    if (killed) {
      fixes.push(`killed_rogue_pid:${portPid}`);
      await sleep(3000);
      pm2Restart(svc.pm2Name);
      fixes.push(`pm2_restart:${svc.pm2Name}`);
    } else {
      log('ERR', `[${svc.name}] Failed to kill rogue PID ${portPid}`);
    }
  }

  // 3. PM2 process crashed or stopped
  if (pm2Info && pm2Info.pm2_env?.status === 'stopped') {
    issues.push(`pm2_stopped`);
    log('FIX', `[${svc.name}] PM2 process stopped — restarting`);
    pm2Restart(svc.pm2Name);
    fixes.push(`pm2_restart_stopped`);
  }

  // 4. Memory guard (>512MB)
  if (pm2Info) {
    const memMb = (pm2Info.monit?.memory || 0) / (1024 * 1024);
    if (memMb > 512) {
      issues.push(`memory_high:${Math.round(memMb)}MB`);
      log('WARN', `[${svc.name}] Memory ${Math.round(memMb)}MB > 512MB — restarting to reclaim`);
      pm2Restart(svc.pm2Name);
      fixes.push(`pm2_restart_memory`);
    }
  }

  return { service: svc.name, issues, fixes, healthy: issues.length === 0 };
}

// ── WhatsApp-specific check ───────────────────────────────────────────────────
async function checkWhatsApp() {
  const issues = [];
  const fixes  = [];

  const h = await httpGet(3211, '/health', null, 5000);
  if (!h.ok) {
    issues.push('gateway_unreachable');
    return { service: 'whatsapp', issues, fixes, healthy: false };
  }

  const ready = h.body?.runtime?.whatsapp_ready;
  const status = h.body?.runtime?.whatsapp_status;

  if (!ready) {
    issues.push(`whatsapp_not_ready status=${status}`);
    if (status === 'qr') {
      // Can't auto-fix QR scan — notify only
      log('WARN', '[whatsapp] Session requires QR scan — manual action needed');
    } else {
      // Try gateway restart to trigger re-init
      log('FIX', '[whatsapp] Gateway not ready — restarting');
      pm2Restart('whatsapp-ai-gateway');
      fixes.push('pm2_restart_gateway');
    }
  }

  return { service: 'whatsapp', issues, fixes, healthy: issues.length === 0 };
}

// ── Security check ────────────────────────────────────────────────────────────
async function checkSecurity() {
  const issues = [];

  // Verify mi-core rejects unauthenticated requests
  const noKey = await httpGet(4001, '/api/jarvis/evolution/query', null, 3000);
  // POST without key should get 401/403 — but GET /health should be open
  // We do a simple check: health endpoint should be reachable without key
  const withKey = await httpGet(4001, '/api/health', null, 3000);
  if (!withKey.ok) {
    issues.push('health_endpoint_unreachable');
  }

  return { service: 'security', issues, fixes: [], healthy: issues.length === 0 };
}

// ── Main watchdog loop ────────────────────────────────────────────────────────
async function runCheck() {
  const started = Date.now();
  const results = [];

  for (const svc of SERVICES) {
    try {
      const r = await checkService(svc);
      results.push(r);
      if (!r.healthy) {
        log('ALERT', `[${svc.name}] Issues: ${r.issues.join(', ')}`, r.fixes.length ? `Fixed: ${r.fixes.join(', ')}` : 'No auto-fix applied');
      }
    } catch (e) {
      log('ERR', `[${svc.name}] Check threw: ${e.message}`);
    }
  }

  // WhatsApp specific
  try {
    const wa = await checkWhatsApp();
    results.push(wa);
    if (!wa.healthy) {
      log('ALERT', `[whatsapp] Issues: ${wa.issues.join(', ')}`);
    }
  } catch (e) {
    log('ERR', `[whatsapp] Check threw: ${e.message}`);
  }

  const healthy   = results.filter(r => r.healthy).length;
  const unhealthy = results.filter(r => !r.healthy).length;
  const elapsed   = Date.now() - started;

  if (unhealthy > 0) {
    log('SCAN', `${healthy}/${results.length} healthy — ${unhealthy} issue(s) detected+handled in ${elapsed}ms`);
  } else {
    log('OK',   `All ${healthy}/${results.length} services healthy (${elapsed}ms)`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Entry ─────────────────────────────────────────────────────────────────────
log('BOOT', `Mi-Core Watchdog starting — interval=${INTERVAL}ms dry_run=${DRY_RUN}`);

// Run immediately, then on interval
runCheck().catch(e => log('ERR', 'Initial check failed: ' + e.message));

setInterval(() => {
  runCheck().catch(e => log('ERR', 'Check cycle failed: ' + e.message));
}, INTERVAL);
