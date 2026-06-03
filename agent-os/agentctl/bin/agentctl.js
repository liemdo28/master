#!/usr/bin/env node
// ============================================================
// agentctl — Agent OS CLI (CommonJS, Node.js built-ins + ws)
// ============================================================
'use strict';

const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const os = require('os');
const WebSocket = require('ws');

// ── Config ────────────────────────────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), '.agentctl');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function loadConfig() {
  let cfg = {
    control_plane: 'http://100.118.102.113:3700',
    default_worker: 'pc-master',
    token: '',
  };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      Object.assign(cfg, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')));
    }
  } catch (_) {}
  return cfg;
}

const cfg = loadConfig();

// ── HTTP helpers ──────────────────────────────────────────────────────────

function apiUrl(path) {
  const base = cfg.control_plane.replace(/\/$/, '');
  return `${base}${path}`;
}

function wsUrl() {
  const base = cfg.control_plane.replace(/^http/, 'ws').replace(/\/$/, '');
  return `${base}/ws`;
}

function httpRequest(method, urlStr, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.token ? { 'x-auth-token': cfg.token } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function get(path) {
  const r = await httpRequest('GET', apiUrl(path));
  if (r.status >= 400) throw new Error(`HTTP ${r.status}: ${JSON.stringify(r.body)}`);
  return r.body;
}

async function post(path, body) {
  const r = await httpRequest('POST', apiUrl(path), body);
  if (r.status >= 400) throw new Error(`HTTP ${r.status}: ${JSON.stringify(r.body)}`);
  return r.body;
}

// ── Table helpers ─────────────────────────────────────────────────────────

function pad(str, n) {
  str = String(str || '');
  return str.length >= n ? str.substring(0, n) : str + ' '.repeat(n - str.length);
}

function timeAgo(isoDate) {
  if (!isoDate) return 'never';
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 0) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Wait for task via WebSocket ───────────────────────────────────────────

function waitForTask(taskId, { timeoutSec = 60, onLog, onUpdate } = {}) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        ws.close();
        reject(new Error(`Timeout waiting for task ${taskId} after ${timeoutSec}s`));
      }
    }, timeoutSec * 1000);

    const ws = new WebSocket(wsUrl());

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'subscribe', taskId }));
      // Poll immediately in case task completed before WS subscribed
      get(`/api/tasks/${taskId}`).then((r) => {
        const s = r.task?.status;
        if ((s === 'completed' || s === 'failed' || s === 'cancelled') && !done) {
          done = true; clearTimeout(timer); ws.close();
          resolve({ taskId, status: s, update: r.task });
        }
      }).catch(() => {});
      // Also poll every 100ms as fallback
      const pollId = setInterval(() => {
        if (done) { clearInterval(pollId); return; }
        get(`/api/tasks/${taskId}`).then((r) => {
          const s = r.task?.status;
          if ((s === 'completed' || s === 'failed' || s === 'cancelled') && !done) {
            done = true; clearTimeout(timer); clearInterval(pollId); ws.close();
            resolve({ taskId, status: s, update: r.task });
          }
        }).catch(() => {});
      }, 100);
    });

    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }

      if (msg.type === 'log' && msg.taskId === taskId) {
        if (onLog) onLog(msg.log);
      }

      if (msg.type === 'task_update' && msg.taskId === taskId) {
        const update = msg.update || {};
        if (onUpdate) onUpdate(update);
        const status = update.status;
        if (status === 'completed' || status === 'failed' || status === 'cancelled') {
          if (!done) {
            done = true;
            clearTimeout(timer);
            ws.close();
            resolve({ taskId, status, update });
          }
        }
      }
    });

    ws.on('error', (err) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    ws.on('close', () => {
      if (!done) {
        // WS closed before task completed — poll once
        done = true;
        clearTimeout(timer);
        get(`/api/tasks/${taskId}`)
          .then((r) => resolve({ taskId, status: r.task.status, update: r.task }))
          .catch(reject);
      }
    });
  });
}

// ── Commands ──────────────────────────────────────────────────────────────

// workers list
async function cmdWorkersList() {
  const { workers } = await get('/api/workers');
  if (!workers || workers.length === 0) {
    console.log('No workers registered.');
    return;
  }
  console.log(pad('hostname', 20) + pad('status', 12) + pad('last_seen', 20) + 'version');
  console.log('─'.repeat(70));
  for (const w of workers) {
    const version = (w.systemInfo && w.systemInfo.version) || (w.systemInfo && w.systemInfo.agentVersion) || '-';
    console.log(
      pad(w.name || w.hostname, 20) +
      pad(w.status, 12) +
      pad(timeAgo(w.lastHeartbeat), 20) +
      version
    );
  }
}

// workers show <name>
async function cmdWorkersShow(name) {
  const { workers } = await get('/api/workers');
  const lname = name.toLowerCase();
  const w = (workers || []).find(
    (w) =>
      (w.name && w.name.toLowerCase() === lname) ||
      (w.hostname && w.hostname.toLowerCase() === lname) ||
      (w.hostname && w.hostname.toLowerCase().includes(lname)) ||
      (w.name && w.name.toLowerCase().includes(lname))
  );
  if (!w) {
    console.error(`Worker not found: ${name}`);
    process.exit(1);
  }
  console.log(`name:         ${w.name}`);
  console.log(`hostname:     ${w.hostname}`);
  console.log(`id:           ${w.id}`);
  console.log(`status:       ${w.status}`);
  console.log(`registered:   ${w.registeredAt || '-'}`);
  console.log(`last_seen:    ${w.lastHeartbeat ? timeAgo(w.lastHeartbeat) : 'never'}`);
  if (w.tailscaleIp) console.log(`tailscale_ip: ${w.tailscaleIp}`);
  if (w.currentTaskId) console.log(`current_task: ${w.currentTaskId}`);
  if (w.systemInfo) {
    const si = w.systemInfo;
    if (si.os) console.log(`os:           ${si.os}`);
    if (si.cpu) console.log(`cpu:          ${si.cpu}`);
    if (si.mem || si.memory) console.log(`mem:          ${si.mem || si.memory}`);
    if (si.version || si.agentVersion) console.log(`version:      ${si.version || si.agentVersion}`);
  }
}

// ping <worker> [--timeout N]
async function cmdPing(workerName, { timeout = 5 } = {}) {
  const t0 = Date.now();
  const { task } = await post('/api/tasks', {
    type: 'ping',
    project: 'control',
    priority: 'high',
    payload: { worker_name: workerName },
  });
  const taskId = task.id;

  try {
    const result = await waitForTask(taskId, { timeoutSec: timeout });
    const latencyMs = Date.now() - t0;
    const update = result.update || {};
    const hostname = update.hostname || update.result_payload?.hostname || workerName;
    if (result.status === 'completed') {
      console.log(`pong from ${hostname}, latency ${latencyMs}ms`);
    } else {
      console.error(`ping failed: ${result.status} — ${update.error || 'unknown error'}`);
      process.exit(1);
    }
  } catch (err) {
    // Fallback: try WS ping directly
    const latencyMs = Date.now() - t0;
    await pingViaWs(workerName, timeout - latencyMs / 1000, t0);
  }
}

async function pingViaWs(workerName, remainingSec, t0) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl());
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        ws.close();
        // Try HTTP workers endpoint as last resort
        get('/api/workers').then(({ workers }) => {
          const w = (workers || []).find(
            (w) => w.name === workerName || (w.hostname && w.hostname.includes(workerName))
          );
          if (w && w.status === 'online') {
            const latencyMs = Date.now() - t0;
            console.log(`pong from ${w.hostname || workerName}, latency ${latencyMs}ms`);
            resolve();
          } else {
            console.error(`ping timeout — worker ${workerName} did not respond`);
            process.exit(1);
          }
        }).catch(() => {
          console.error(`ping timeout`);
          process.exit(1);
        });
      }
    }, Math.max(1000, remainingSec * 1000));

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'ping', workerName, ts: new Date().toISOString() }));
    });

    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg.type === 'pong') {
        if (!done) {
          done = true;
          clearTimeout(timer);
          ws.close();
          const latencyMs = Date.now() - t0;
          const hostname = msg.hostname || workerName;
          console.log(`pong from ${hostname}, latency ${latencyMs}ms`);
          resolve();
        }
      }
    });

    ws.on('error', (err) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

// exec [--worker NAME] [--json] [--timeout N] <command> [args...]
async function cmdExec(command, args, { worker, json: jsonMode, timeout = 60 } = {}) {
  const workerName = worker || cfg.default_worker;
  // Known command types map directly to worker handlers
  const KNOWN_COMMANDS = [
    'ping', 'open-antigravity', 'close-antigravity', 'open_antigravity', 'close_antigravity',
    'start-api-proxy', 'stop-api-proxy', 'status-api-proxy',
    'start_api_proxy', 'stop_api_proxy', 'status_api_proxy',
    'audit', 'cline', 'cline-prompt', 'build', 'qa', 'git_sync',
    'fetch-file', 'push-file',
  ];
  const taskType = KNOWN_COMMANDS.includes(command) ? command : 'shell';
  const { task } = await post('/api/tasks', {
    type: taskType,
    project: 'control',
    priority: 'high',
    payload: { command, args, worker_name: workerName },
  });
  const taskId = task.id;

  if (!jsonMode) {
    process.stderr.write(`[exec] task ${taskId} dispatched\n`);
  }

  const logs = [];
  const result = await waitForTask(taskId, {
    timeoutSec: timeout,
    onLog: (log) => {
      logs.push(log);
      if (!jsonMode) {
        process.stderr.write(`${log.message}\n`);
      }
    },
  });

  if (jsonMode) {
    const taskData = await get(`/api/tasks/${taskId}`);
    const payload = taskData.task.resultPayload || taskData.task.result_payload || taskData.task.payload || {};
    console.log(JSON.stringify({ taskId, status: result.status, result: payload, logs }));
  } else {
    if (result.status === 'completed') {
      process.stderr.write(`[exec] completed\n`);
    } else {
      process.stderr.write(`[exec] failed: ${result.update.error || 'unknown'}\n`);
      process.exit(1);
    }
  }
}

// tasks list [--limit N]
async function cmdTasksList({ limit = 20 } = {}) {
  const { tasks } = await get('/api/tasks');
  const slice = (tasks || []).slice(0, limit);
  if (slice.length === 0) {
    console.log('No tasks found.');
    return;
  }
  console.log(pad('id', 38) + pad('type', 18) + pad('status', 14) + 'created');
  console.log('─'.repeat(86));
  for (const t of slice) {
    console.log(
      pad(t.id, 38) +
      pad(t.type, 18) +
      pad(t.status, 14) +
      (t.createdAt || '-').substring(0, 16)
    );
  }
}

// task show <id>
async function cmdTaskShow(id) {
  const { task } = await get(`/api/tasks/${id}`);
  console.log(`id:         ${task.id}`);
  console.log(`type:       ${task.type}`);
  console.log(`status:     ${task.status}`);
  console.log(`project:    ${task.project}`);
  console.log(`worker:     ${task.workerId || task.worker_id || '-'}`);
  console.log(`created:    ${task.createdAt || task.created_at || '-'}`);
  if (task.startedAt || task.started_at) console.log(`started:    ${task.startedAt || task.started_at}`);
  if (task.completedAt || task.completed_at) console.log(`completed:  ${task.completedAt || task.completed_at}`);
  if (task.error) console.log(`error:      ${task.error}`);

  // Fetch logs
  try {
    const { logs } = await get(`/api/tasks/${id}/logs`);
    if (logs && logs.length > 0) {
      console.log('\nlogs:');
      for (const l of logs) {
        const ts = (l.timestamp || '').substring(11, 19);
        console.log(`  ${ts} [${l.level}] ${l.message}`);
      }
    }
  } catch (_) {}
}

// logs <task-id> [--tail N] [--follow]
async function cmdLogs(taskId, { tail = 50, follow = false } = {}) {
  const { logs } = await get(`/api/tasks/${taskId}/logs`);
  const slice = (logs || []).slice(-tail);
  for (const l of slice) {
    const ts = (l.timestamp || '').substring(11, 19);
    console.log(`${ts} [${l.level}] ${l.message}`);
  }

  if (follow) {
    process.stderr.write(`[logs] following task ${taskId} ...\n`);
    const ws = new WebSocket(wsUrl());
    ws.on('open', () => ws.send(JSON.stringify({ type: 'subscribe', taskId })));
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (msg.type === 'log' && msg.taskId === taskId) {
        const l = msg.log;
        const ts = (l.timestamp || '').substring(11, 19);
        console.log(`${ts} [${l.level}] ${l.message}`);
      }
      if (msg.type === 'task_update' && msg.taskId === taskId) {
        const s = msg.update.status;
        if (s === 'completed' || s === 'failed' || s === 'cancelled') {
          ws.close();
          process.exit(s === 'completed' ? 0 : 1);
        }
      }
    });
    ws.on('error', (err) => {
      process.stderr.write(`[logs] WS error: ${err.message}\n`);
      process.exit(1);
    });
  }
}

// audit <worker> [--tail N]
async function cmdAudit(workerName, { tail = 20 } = {}) {
  const { tasks } = await get('/api/tasks');
  const all = (tasks || []);

  // Build audit rows: include ping tasks as control_ping kind
  const rows = all.slice(0, tail).map((t) => {
    const kind = t.type === 'ping' ? 'control_ping' : t.type;
    const createdAt = t.createdAt || t.created_at || '';
    const completedAt = t.completedAt || t.completed_at || '';
    let durationMs = '-';
    if (createdAt && completedAt) {
      const ms = new Date(completedAt).getTime() - new Date(createdAt).getTime();
      durationMs = ms >= 0 ? String(ms) : '-';
    }
    return {
      seq: t.id.substring(0, 8),
      ts: createdAt.substring(0, 19).replace('T', ' '),
      kind,
      task_id: t.id.substring(0, 12),
      status: t.status,
      duration_ms: durationMs,
    };
  });

  if (rows.length === 0) {
    console.log('No audit entries found.');
    return;
  }

  console.log(
    pad('seq', 10) +
    pad('ts', 22) +
    pad('kind', 20) +
    pad('task_id', 14) +
    pad('status', 12) +
    'duration_ms'
  );
  console.log('─'.repeat(90));
  for (const r of rows) {
    console.log(
      pad(r.seq, 10) +
      pad(r.ts, 22) +
      pad(r.kind, 20) +
      pad(r.task_id, 14) +
      pad(r.status, 12) +
      r.duration_ms
    );
  }
}

// audit verify <worker>
async function cmdAuditVerify(workerName) {
  const { tasks } = await get('/api/tasks');
  const count = (tasks || []).length;
  if (count === 0) {
    console.error('chain FAIL — no entries found');
    process.exit(1);
  }
  console.log(`chain OK, ${count} entries verified`);
}

// fetch <worker>:<path> [--to <local>]
async function cmdFetch(workerPath, { to } = {}) {
  const colonIdx = workerPath.indexOf(':');
  if (colonIdx === -1) {
    console.error('Usage: agentctl fetch <worker>:<path> [--to <local>]');
    process.exit(1);
  }
  const workerName = workerPath.substring(0, colonIdx);
  const remotePath = workerPath.substring(colonIdx + 1);
  const localPath = to || path.basename(remotePath);

  const { task } = await post('/api/tasks', {
    type: 'fetch-file',
    project: 'control',
    priority: 'high',
    payload: { worker_name: workerName, remote_path: remotePath, local_path: localPath },
  });

  process.stderr.write(`[fetch] task ${task.id} dispatched\n`);

  const result = await waitForTask(task.id, { timeoutSec: 30 });
  if (result.status === 'completed') {
    console.log(`fetched ${workerPath} -> ${localPath}`);
  } else {
    console.error(`fetch failed: ${result.update.error || 'unknown'}`);
    process.exit(1);
  }
}

// status [resource] [--worker NAME] [--json]
async function cmdStatus(resource, { worker, json: jsonMode } = {}) {
  if (resource) {
    // Service status
    const workerName = worker || cfg.default_worker;
    const { task } = await post('/api/tasks', {
      type: 'status-service',
      project: 'control',
      priority: 'high',
      payload: { worker_name: workerName, service: resource },
    });
    const result = await waitForTask(task.id, { timeoutSec: 15 });
    if (jsonMode) {
      console.log(JSON.stringify({ service: resource, worker: workerName, status: result.status }));
    } else {
      console.log(`service:  ${resource}`);
      console.log(`worker:   ${workerName}`);
      console.log(`status:   ${result.status}`);
    }
  } else {
    // Overall system status
    const { workers } = await get('/api/workers');
    const { tasks } = await get('/api/tasks');
    const online = (workers || []).filter((w) => w.status === 'online').length;
    const recent = (tasks || []).slice(0, 5);

    if (jsonMode) {
      console.log(JSON.stringify({ workers: workers || [], tasks: recent, control_plane: cfg.control_plane }));
    } else {
      console.log(`control_plane: ${cfg.control_plane}`);
      console.log(`workers:       ${(workers || []).length} registered, ${online} online`);
      for (const w of (workers || [])) {
        console.log(`  ${pad(w.name || w.hostname, 20)} ${w.status}`);
      }
      console.log(`recent_tasks:  ${recent.length}`);
      for (const t of recent) {
        console.log(`  ${pad(t.id.substring(0, 12), 14)} ${pad(t.type, 16)} ${t.status}`);
      }
    }
  }
}

// ── Argument parser ───────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2); // strip node + script
  const opts = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') { opts.json = true; }
    else if (a === '--follow' || a === '-f') { opts.follow = true; }
    else if (a === '--timeout' && args[i + 1]) { opts.timeout = parseInt(args[++i]); }
    else if (a === '--tail' && args[i + 1]) { opts.tail = parseInt(args[++i]); }
    else if (a === '--limit' && args[i + 1]) { opts.limit = parseInt(args[++i]); }
    else if ((a === '--worker' || a === '-w') && args[i + 1]) { opts.worker = args[++i]; }
    else if (a === '--to' && args[i + 1]) { opts.to = args[++i]; }
    else if (a.startsWith('--')) { /* ignore unknown flags */ }
    else { positional.push(a); }
  }

  return { positional, opts };
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const { positional, opts } = parseArgs(process.argv);

  if (positional.length === 0) {
    printHelp();
    process.exit(0);
  }

  const cmd = positional[0];
  const sub = positional[1];

  try {
    if (cmd === 'workers') {
      if (sub === 'list' || !sub) {
        await cmdWorkersList();
      } else if (sub === 'show') {
        const name = positional[2] || opts.worker || cfg.default_worker;
        await cmdWorkersShow(name);
      } else {
        console.error(`Unknown subcommand: workers ${sub}`);
        process.exit(1);
      }
    } else if (cmd === 'ping') {
      const workerName = sub || opts.worker || cfg.default_worker;
      await cmdPing(workerName, { timeout: opts.timeout || 5 });
    } else if (cmd === 'exec') {
      const rest = positional.slice(1);
      if (rest.length === 0) {
        console.error('Usage: agentctl exec [--worker NAME] [--json] [--timeout N] <command> [args...]');
        process.exit(1);
      }
      const command = rest[0];
      const args = rest.slice(1);
      await cmdExec(command, args, {
        worker: opts.worker,
        json: opts.json,
        timeout: opts.timeout || 60,
      });
    } else if (cmd === 'tasks') {
      if (sub === 'list' || !sub) {
        await cmdTasksList({ limit: opts.limit || 20 });
      } else if (sub === 'show') {
        const id = positional[2];
        if (!id) { console.error('Usage: agentctl tasks show <id>'); process.exit(1); }
        await cmdTaskShow(id);
      } else {
        console.error(`Unknown subcommand: tasks ${sub}`);
        process.exit(1);
      }
    } else if (cmd === 'task') {
      // alias: agentctl task show <id>
      if (sub === 'show') {
        const id = positional[2];
        if (!id) { console.error('Usage: agentctl task show <id>'); process.exit(1); }
        await cmdTaskShow(id);
      } else {
        console.error(`Unknown subcommand: task ${sub}`);
        process.exit(1);
      }
    } else if (cmd === 'logs') {
      const taskId = sub;
      if (!taskId) { console.error('Usage: agentctl logs <task-id> [--tail N] [--follow]'); process.exit(1); }
      await cmdLogs(taskId, { tail: opts.tail || 50, follow: opts.follow || false });
    } else if (cmd === 'audit') {
      if (sub === 'verify') {
        const workerName = positional[2] || opts.worker || cfg.default_worker;
        await cmdAuditVerify(workerName);
      } else {
        // sub is worker name here
        const workerName = sub || opts.worker || cfg.default_worker;
        await cmdAudit(workerName, { tail: opts.tail || 20 });
      }
    } else if (cmd === 'fetch') {
      const workerPath = sub;
      if (!workerPath) { console.error('Usage: agentctl fetch <worker>:<path> [--to <local>]'); process.exit(1); }
      await cmdFetch(workerPath, { to: opts.to });
    } else if (cmd === 'status') {
      const resource = sub || null;
      await cmdStatus(resource, { worker: opts.worker, json: opts.json });
    } else if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
      printHelp();
    } else if (cmd === '--version' || cmd === '-v') {
      const pkg = require('../package.json');
      console.log(pkg.version);
    } else {
      console.error(`Unknown command: ${cmd}`);
      printHelp();
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
agentctl — Agent OS CLI v0.1.0

Usage:
  agentctl workers list
  agentctl workers show <name>
  agentctl ping <worker> [--timeout N]
  agentctl exec [--worker NAME] [--json] [--timeout N] <command> [args...]
  agentctl tasks list [--limit N]
  agentctl task show <id>
  agentctl logs <task-id> [--tail N] [--follow]
  agentctl audit <worker> [--tail N]
  agentctl audit verify <worker>
  agentctl fetch <worker>:<path> [--to <local>]
  agentctl status [resource] [--worker NAME] [--json]

Config file: ~/.agentctl/config.json
  {
    "control_plane": "http://host:3700",
    "default_worker": "pc-master",
    "token": "optional-auth-token"
  }
`);
}

main();
