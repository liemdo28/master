const { exec, execFile } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const MASTER_ROOT = 'E:\\Project\\Master';
const REGISTRY_PATH = path.join(MASTER_ROOT, 'PORT_REGISTRY.json');

function runPowerShell(script) {
  return new Promise((resolve) => {
    execFile(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 30000, maxBuffer: 1024 * 1024 * 8 },
      (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      }
    );
  });
}

function readRegistry() {
  const raw = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const entries = raw.ports || raw;
  return Object.entries(entries)
    .filter(([, value]) => value && typeof value === 'object' && value.port !== null && value.port !== undefined)
    .map(([id, value]) => ({ id, ...value }));
}

async function getListeners() {
  const script = `
    Get-NetTCPConnection -State Listen |
      Select-Object LocalAddress,LocalPort,OwningProcess |
      Sort-Object LocalPort |
      ConvertTo-Json -Depth 4
  `;
  const { stdout } = await runPowerShell(script);
  if (!stdout.trim()) return [];
  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function getNodeProcesses() {
  const script = `
    Get-CimInstance Win32_Process |
      Where-Object { $_.Name -match 'node|npm|pnpm|yarn' } |
      Select-Object ProcessId,Name,CommandLine,ParentProcessId |
      ConvertTo-Json -Depth 4
  `;
  const { stdout } = await runPowerShell(script);
  if (!stdout.trim()) return [];
  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function getPm2Processes() {
  return new Promise((resolve) => {
    exec('pm2 jlist', { timeout: 30000, maxBuffer: 1024 * 1024 * 24 }, (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve([]);
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(Array.isArray(parsed) ? parsed : []);
      } catch {
        resolve([]);
      }
    });
  });
}

function checkHttp(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 500, statusCode: res.statusCode, url });
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message, url }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout', url });
    });
  });
}

function inferProject(commandLine = '') {
  const normalized = String(commandLine);
  const known = [
    ['agent-coding-api-keys', 'Agent\\agent-coding-api-keys'],
    ['agent-control', 'agent-os\\agent-control'],
    ['agent-worker', 'agent-os\\agent-worker'],
    ['chrome-devtools-mcp', 'chrome-devtools-mcp'],
  ];
  const match = known.find(([, token]) => normalized.includes(token));
  return match ? match[0] : null;
}

async function runValidation() {
  const registry = readRegistry();
  const listeners = await getListeners();
  const nodeProcesses = await getNodeProcesses();
  const pm2Processes = await getPm2Processes();
  const processByPid = new Map(nodeProcesses.map((proc) => [Number(proc.ProcessId), proc]));
  const pm2ByPid = new Map(pm2Processes.map((proc) => [Number(proc.pid), proc]));
  const conflicts = [];
  const orphanProcesses = [];
  const recommendations = [];

  const ports = registry.map((entry) => {
    const matches = listeners.filter((listener) => Number(listener.LocalPort) === Number(entry.port));
    const owningPids = [...new Set(matches.map((match) => Number(match.OwningProcess)))];
    const nodeOwners = owningPids.map((pid) => processByPid.get(pid)).filter(Boolean);
    const pm2Owners = owningPids.map((pid) => pm2ByPid.get(pid)).filter(Boolean);
    const active = owningPids.length > 0;
    const expectedPath = entry.path ? String(entry.path) : '';
    const ownerMatches =
      nodeOwners.some((proc) => String(proc.CommandLine || '').includes(expectedPath)) ||
      pm2Owners.some((proc) => String(proc.pm2_env?.pm_exec_path || '').includes(expectedPath) || String(proc.pm2_env?.pm_cwd || '').includes(expectedPath));
    const status = !active
      ? (entry.status === 'reserved' ? 'RESERVED' : (entry.status === 'external' ? 'EXTERNAL' : 'FAIL'))
      : (ownerMatches || !expectedPath ? 'PASS' : 'UNKNOWN');

    if (owningPids.length > 1) {
      conflicts.push({
        port: entry.port,
        service: entry.id,
        pids: owningPids,
        reason: 'Multiple PIDs are listening on a registered port',
      });
    }

    if (entry.status === 'active' && !active) {
      conflicts.push({
        port: entry.port,
        service: entry.id,
        pids: [],
        reason: 'Registered active port is not listening',
      });
    }

    if (active && expectedPath && nodeOwners.length > 0 && !ownerMatches) {
      conflicts.push({
        port: entry.port,
        service: entry.id,
        pids: owningPids,
        reason: 'Listening PID does not match registered project path',
      });
    }

    return {
      service: entry.id,
      port: entry.port,
      expectedOwner: entry.owner,
      expectedPath: entry.path || null,
      status,
      pids: owningPids,
      listeners: matches,
      commandLines: nodeOwners.map((proc) => proc.CommandLine),
      pm2: pm2Owners.map((proc) => ({
        name: proc.name,
        pid: proc.pid,
        script: proc.pm2_env?.pm_exec_path,
        cwd: proc.pm2_env?.pm_cwd,
      })),
    };
  });

  const registeredPaths = registry.map((entry) => String(entry.path || '')).filter(Boolean);
  for (const proc of nodeProcesses) {
    const commandLine = String(proc.CommandLine || '');
    const project = inferProject(commandLine);
    const isPm2Runtime = commandLine.includes('pm2\\lib\\Daemon.js') || commandLine.includes('pm2\\lib\\ProcessContainerFork.js');
    const isRegistered = registeredPaths.some((projectPath) => commandLine.includes(projectPath));
    const isAllowedTooling = commandLine.includes('chrome-devtools-mcp');

    if (!isRegistered && !isPm2Runtime && !isAllowedTooling) {
      orphanProcesses.push({
        pid: proc.ProcessId,
        name: proc.Name,
        project,
        commandLine,
        reason: 'Node-like process is not tied to a registered project path',
      });
    }
  }

  const agentWorkerProcesses = nodeProcesses.filter((proc) => String(proc.CommandLine || '').includes('agent-os\\agent-worker\\dist\\worker.js'));
  if (agentWorkerProcesses.length > 1) {
    conflicts.push({
      service: 'agent-worker',
      pids: agentWorkerProcesses.map((proc) => proc.ProcessId),
      reason: 'Duplicate agent-worker processes detected',
    });
  }

  const health = await checkHttp('http://127.0.0.1:3456/health');
  if (!health.ok) {
    conflicts.push({
      service: 'agent-coding-api-keys',
      port: 3456,
      reason: `Health endpoint failed: ${health.error || health.statusCode}`,
    });
  }

  if (conflicts.length > 0) {
    recommendations.push('Resolve conflicts before starting new project servers.');
  }
  if (orphanProcesses.length > 0) {
    recommendations.push('Review orphanProcesses; do not kill until owner is confirmed.');
  }
  if (conflicts.length === 0 && orphanProcesses.length === 0) {
    recommendations.push('Port/process registry is clean.');
  }

  const status = conflicts.length > 0 ? 'FAIL' : (orphanProcesses.length > 0 ? 'UNKNOWN' : 'PASS');
  return {
    status,
    checkedAt: new Date().toISOString(),
    registry: REGISTRY_PATH,
    ports,
    conflicts,
    orphanProcesses,
    health,
    recommendations,
  };
}

if (require.main === module) {
  runValidation()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.status === 'FAIL' ? 1 : 0);
    })
    .catch((err) => {
      console.error(JSON.stringify({
        status: 'FAIL',
        error: err.message,
      }, null, 2));
      process.exit(1);
    });
}

module.exports = { runValidation };
