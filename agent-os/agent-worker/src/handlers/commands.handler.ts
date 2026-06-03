// ============================================================
// Agent OS Worker — Task-based Command Handlers (D2-D6)
// These handlers are registered in the task handlers map and
// return a payload object that is forwarded to the control plane.
// ============================================================

import { spawn } from 'child_process';
import * as os from 'os';
import { execCommand } from '../worker';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ── Helper: bound log function injected by executeTask ───────────────────
// The task handlers receive the raw task object; we derive a simple log fn
// from the module-level log export.
type LogFn = (level: string, message: string) => void;

// ── D2: ping ─────────────────────────────────────────────────────────────

export async function handlePing(task: any): Promise<any> {
  return {
    status: 'pong',
    hostname: os.hostname(),
    worker_name: process.env.WORKER_NAME ?? os.hostname(),
    version: '0.1.0',
    ts: new Date().toISOString(),
  };
}

// ── D3: open-antigravity ─────────────────────────────────────────────────

const ANTIGRAVITY_PATH = 'C:\\Users\\liemdo\\AppData\\Local\\Programs\\Antigravity IDE\\Antigravity IDE.exe';

async function getWindowTitle(processName: string): Promise<string | null> {
  const result = await execCommand(
    `powershell -Command "Get-Process '${processName}' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty MainWindowTitle"`,
    process.cwd(),
  );
  return result.stdout.trim() || null;
}

export async function handleOpenAntigravity(task: any): Promise<any> {
  const proc = spawn(ANTIGRAVITY_PATH, [], { detached: true, stdio: 'ignore' });
  proc.unref();
  const pid = proc.pid;

  await sleep(2000);
  const title = await getWindowTitle('Antigravity');

  return {
    status: 'opened',
    pid,
    window_title: title ?? 'Antigravity IDE',
    path: ANTIGRAVITY_PATH,
  };
}

// ── D3: close-antigravity ────────────────────────────────────────────────

export async function handleCloseAntigravity(task: any): Promise<any> {
  await execCommand(
    'powershell -Command "Get-Process \'Antigravity IDE\' -ErrorAction SilentlyContinue | Stop-Process -Force"',
    process.cwd(),
  );
  return { status: 'closed' };
}

// ── D4: start-api-proxy ──────────────────────────────────────────────────

const PROXY_SCRIPT_PATH = 'E:\\Project\\Master\\Agent\\agent-coding-api-keys\\start-proxy-background.ps1';
const PROXY_LOG_FILE = 'E:\\Project\\Master\\artifact-registry\\logs\\api-proxy.log';

async function getProxyPid(): Promise<number | null> {
  const r = await execCommand(
    'powershell -Command "(Get-NetTCPConnection -LocalPort 3456 -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess"',
    process.cwd(),
  );
  return parseInt(r.stdout.trim()) || null;
}

async function getProxyLogs(n: number): Promise<string[]> {
  const r = await execCommand(
    `powershell -Command "Get-Content '${PROXY_LOG_FILE}' -Tail ${n} -ErrorAction SilentlyContinue"`,
    process.cwd(),
  );
  return r.stdout.split('\n').filter(Boolean).slice(-n);
}

export async function handleStartApiProxy(task: any): Promise<any> {
  // Check if already running on port 3456
  const checkResult = await execCommand(
    'powershell -Command "Get-NetTCPConnection -LocalPort 3456 -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count"',
    process.cwd(),
  );
  const alreadyRunning = parseInt(checkResult.stdout.trim()) > 0;

  if (alreadyRunning) {
    const logTail = await getProxyLogs(20);
    return {
      status: 'started',
      pid: await getProxyPid(),
      port: 3456,
      log_tail: logTail,
      note: 'already_running',
    };
  }

  const proc = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PROXY_SCRIPT_PATH], {
    cwd: 'E:\\Project\\Master\\Agent\\agent-coding-api-keys',
    detached: true,
    stdio: 'ignore',
  });
  proc.unref();

  // Wait for the port to open
  await sleep(5000);

  const logTail = await getProxyLogs(20);
  const pid = await getProxyPid();

  return { status: 'started', pid, port: 3456, log_tail: logTail };
}

// ── D4: stop-api-proxy ───────────────────────────────────────────────────

export async function handleStopApiProxy(task: any): Promise<any> {
  const pid = await getProxyPid();
  if (!pid) return { status: 'stopped', note: 'was not running' };

  await execCommand(
    `powershell -Command "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`,
    process.cwd(),
  );
  return { status: 'stopped', pid };
}

// ── D4: status-api-proxy ─────────────────────────────────────────────────

export async function handleStatusApiProxy(task: any): Promise<any> {
  const pid = await getProxyPid();
  if (!pid) return { state: 'stopped' };

  const uptimeResult = await execCommand(
    `powershell -Command "(Get-Date) - (Get-Process -Id ${pid}).StartTime | Select-Object -ExpandProperty TotalSeconds"`,
    process.cwd(),
  );
  const uptime_sec = Math.floor(parseFloat(uptimeResult.stdout.trim())) || 0;
  const logTail = await getProxyLogs(5);

  return { state: 'running', pid, port: 3456, uptime_sec, log_tail: logTail };
}
