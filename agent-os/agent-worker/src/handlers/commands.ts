// ============================================================
// Agent OS Worker — Command Handlers for D3-D6
// ============================================================

import { spawn, ChildProcess, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// ── Types ────────────────────────────────────────────────────────────────

export interface CommandResult {
  status: 'ok' | 'error' | 'timeout' | 'aborted';
  exitCode?: number;
  durationMs?: number;
  payload?: any;
  error?: string;
  artifacts?: Array<{ kind: string; path: string; sizeBytes?: number }>;
}

export type StreamLog = (stream: 'stdout' | 'stderr' | 'agent', data: string) => void;

// ── Service registry ─────────────────────────────────────────────────────

interface ManagedService {
  name: string;
  pid: number;
  process: ChildProcess;
  startedAt: Date;
  port?: number;
  logFile: string;
}

const services = new Map<string, ManagedService>();

// ── Paths ────────────────────────────────────────────────────────────────

const ANTIGRAVITY_EXE = 'C:\\Users\\liemdo\\AppData\\Local\\Programs\\Antigravity IDE\\Antigravity IDE.exe';
const ANTIGRAVITY_CMD = 'C:\\Users\\liemdo\\AppData\\Local\\Programs\\Antigravity IDE\\bin\\antigravity-ide.cmd';
const API_PROXY_SCRIPT = 'E:\\Project\\Master\\Agent\\agent-coding-api-keys\\start-proxy-background.ps1';
const LOGS_DIR = 'E:\\Project\\Master\\.agent-os\\logs';
const SERVICES_DIR = 'E:\\Project\\Master\\.agent-os\\services';
const REPORTS_DIR = 'E:\\Project\\Master\\.agent-os\\reports';

// Ensure directories exist
for (const dir of [LOGS_DIR, SERVICES_DIR, REPORTS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── D2: Ping ─────────────────────────────────────────────────────────────

export async function handlePing(streamLog: StreamLog): Promise<CommandResult> {
  streamLog('agent', `pong from ${os.hostname()}`);
  return {
    status: 'ok',
    payload: {
      hostname: os.hostname(),
      version: '0.2.0',
      os: `${os.platform()} ${os.release()}`,
      uptime: os.uptime(),
    },
  };
}

// ── D3: Open/Close Antigravity ───────────────────────────────────────────

export async function handleOpenAntigravity(args: string[], streamLog: StreamLog): Promise<CommandResult> {
  const folder = args[0] || 'E:\\Project\\Master';
  streamLog('agent', `Opening Antigravity IDE at ${folder}...`);

  try {
    const proc = spawn(ANTIGRAVITY_EXE, ['-n', folder], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    proc.unref();

    const pid = proc.pid;
    if (!pid) {
      return { status: 'error', error: 'Failed to get PID' };
    }

    // Wait a moment for the window to appear
    await sleep(2000);

    // Try to get window title
    let windowTitle = 'Antigravity IDE';
    try {
      const result = execSync(
        `powershell -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).MainWindowTitle"`,
        { timeout: 5000 }
      ).toString().trim();
      if (result) windowTitle = result;
    } catch { /* ignore */ }

    streamLog('agent', `Antigravity opened: PID=${pid}, title="${windowTitle}"`);

    return {
      status: 'ok',
      payload: {
        status: 'opened',
        pid,
        window_title: windowTitle,
      },
    };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}

export async function handleCloseAntigravity(args: string[], streamLog: StreamLog): Promise<CommandResult> {
  streamLog('agent', 'Closing Antigravity IDE...');

  try {
    // Find Antigravity processes
    const output = execSync(
      'powershell -Command "Get-Process | Where-Object {$_.ProcessName -like \'*Antigravity*\'} | Select-Object Id, ProcessName | ConvertTo-Json"',
      { timeout: 10000 }
    ).toString().trim();

    if (!output || output === '') {
      return { status: 'ok', payload: { status: 'closed', message: 'No Antigravity process found' } };
    }

    const processes = JSON.parse(output.startsWith('[') ? output : `[${output}]`);

    for (const proc of processes) {
      try {
        execSync(`taskkill /PID ${proc.Id} /F`, { timeout: 5000 });
        streamLog('agent', `Killed PID ${proc.Id} (${proc.ProcessName})`);
      } catch { /* ignore */ }
    }

    return {
      status: 'ok',
      payload: { status: 'closed', killed: processes.length },
    };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}

// ── D4: Start/Stop API Proxy ─────────────────────────────────────────────

export async function handleStartApiProxy(args: string[], streamLog: StreamLog): Promise<CommandResult> {
  streamLog('agent', 'Starting API Proxy...');

  const logFile = path.join(SERVICES_DIR, 'api-proxy.log');
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });

  try {
    const cwd = path.dirname(API_PROXY_SCRIPT);
    const proc = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', API_PROXY_SCRIPT], {
      cwd,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production' },
    });

    if (!proc.pid) {
      return { status: 'error', error: 'Failed to start proxy process' };
    }

    // Capture output
    const logLines: string[] = [];
    proc.stdout?.on('data', (data: Buffer) => {
      const line = data.toString();
      logLines.push(line);
      logStream.write(`[stdout] ${line}`);
      streamLog('stdout', line);
    });
    proc.stderr?.on('data', (data: Buffer) => {
      const line = data.toString();
      logLines.push(line);
      logStream.write(`[stderr] ${line}`);
      streamLog('stderr', line);
    });

    proc.unref();

    // Register as managed service
    services.set('api-proxy', {
      name: 'api-proxy',
      pid: proc.pid,
      process: proc,
      startedAt: new Date(),
      logFile,
    });

    // Wait for startup
    await sleep(3000);

    // Try to detect port from output
    let port: number | undefined;
    const portMatch = logLines.join('').match(/port\s*[:=]?\s*(\d+)/i);
    if (portMatch) port = parseInt(portMatch[1]);

    streamLog('agent', `API Proxy started: PID=${proc.pid}, port=${port || 'unknown'}`);

    return {
      status: 'ok',
      payload: {
        status: 'started',
        pid: proc.pid,
        port: port || 3456,
        log_tail: logLines.slice(-20),
      },
    };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}

export async function handleStopApiProxy(args: string[], streamLog: StreamLog): Promise<CommandResult> {
  streamLog('agent', 'Stopping API Proxy...');

  const service = services.get('api-proxy');
  if (service) {
    try {
      process.kill(service.pid);
      services.delete('api-proxy');
      streamLog('agent', `Killed PID ${service.pid}`);
      return { status: 'ok', payload: { status: 'stopped', pid: service.pid } };
    } catch { /* fall through */ }
  }

  // Try to find and kill by process name
  try {
    execSync('powershell -Command "Get-Process -Name node | Where-Object {$_.CommandLine -like \'*proxy.js*\'} | Stop-Process -Force"', { timeout: 10000 });
    services.delete('api-proxy');
    return { status: 'ok', payload: { status: 'stopped' } };
  } catch (err: any) {
    return { status: 'ok', payload: { status: 'stopped', message: 'No proxy process found' } };
  }
}

export async function handleStatusApiProxy(args: string[], streamLog: StreamLog): Promise<CommandResult> {
  const service = services.get('api-proxy');
  if (!service) {
    return { status: 'ok', payload: { state: 'stopped' } };
  }

  const uptimeSec = Math.floor((Date.now() - service.startedAt.getTime()) / 1000);

  // Read last 20 lines of log
  let lastLines: string[] = [];
  try {
    const content = fs.readFileSync(service.logFile, 'utf-8');
    lastLines = content.split('\n').slice(-20);
  } catch { /* ignore */ }

  return {
    status: 'ok',
    payload: {
      state: 'running',
      pid: service.pid,
      uptime_sec: uptimeSec,
      port: service.port || 3456,
      log_tail: lastLines,
    },
  };
}

// ── D5: Audit ────────────────────────────────────────────────────────────

export async function handleAudit(args: string[], streamLog: StreamLog): Promise<CommandResult> {
  const targetPath = args[0] || 'E:\\Project\\Master';
  streamLog('agent', `Starting audit of ${targetPath}...`);

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(REPORTS_DIR, `audit-${ts}.md`);

  try {
    // Scan the project directory
    streamLog('agent', 'Scanning project structure...');
    const stats = await scanProject(targetPath, streamLog);

    // Generate report
    const report = generateAuditReport(targetPath, stats);
    fs.writeFileSync(reportPath, report);

    streamLog('agent', `Audit complete. Report: ${reportPath}`);
    streamLog('agent', `summary: ${stats.projects} projects, ${stats.files} files, ${stats.issues} issues`);

    return {
      status: 'ok',
      payload: {
        status: 'ok',
        report_path: reportPath,
        summary: `Scanned ${stats.projects} projects, ${stats.files} files. Found ${stats.issues} issues (${stats.criticals} critical, ${stats.warnings} warnings).`,
        counts: {
          projects_scanned: stats.projects,
          files_scanned: stats.files,
          issues_found: stats.issues,
          criticals: stats.criticals,
          warnings: stats.warnings,
        },
      },
      artifacts: [{ kind: 'file', path: reportPath, sizeBytes: report.length }],
    };
  } catch (err: any) {
    return { status: 'error', error: err.message };
  }
}

interface AuditStats {
  projects: number;
  files: number;
  issues: number;
  criticals: number;
  warnings: number;
  projectList: string[];
  largeFiles: string[];
  missingReadme: string[];
  noPackageJson: string[];
}

async function scanProject(rootPath: string, streamLog: StreamLog): Promise<AuditStats> {
  const stats: AuditStats = {
    projects: 0,
    files: 0,
    issues: 0,
    criticals: 0,
    warnings: 0,
    projectList: [],
    largeFiles: [],
    missingReadme: [],
    noPackageJson: [],
  };

  if (!fs.existsSync(rootPath)) {
    throw new Error(`Path does not exist: ${rootPath}`);
  }

  // Find project directories (those with package.json, pom.xml, Cargo.toml, etc.)
  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      stats.files++;
      continue;
    }
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    const dirPath = path.join(rootPath, entry.name);
    const hasPackageJson = fs.existsSync(path.join(dirPath, 'package.json'));
    const hasReadme = fs.existsSync(path.join(dirPath, 'README.md'));

    if (hasPackageJson || fs.existsSync(path.join(dirPath, 'pom.xml')) ||
        fs.existsSync(path.join(dirPath, 'Cargo.toml')) || fs.existsSync(path.join(dirPath, 'go.mod'))) {
      stats.projects++;
      stats.projectList.push(entry.name);
      streamLog('agent', `  Found project: ${entry.name}`);

      if (!hasReadme) {
        stats.missingReadme.push(entry.name);
        stats.warnings++;
        stats.issues++;
      }
    }

    // Count files in subdirectory
    try {
      const subFiles = countFiles(dirPath);
      stats.files += subFiles;
    } catch { /* ignore permission errors */ }
  }

  // Check for critical issues
  if (stats.projects === 0) {
    stats.criticals++;
    stats.issues++;
  }

  return stats;
}

function countFiles(dirPath: string, depth = 0): number {
  if (depth > 5) return 0; // limit recursion
  let count = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      if (entry.isFile()) count++;
      else if (entry.isDirectory()) count += countFiles(path.join(dirPath, entry.name), depth + 1);
    }
  } catch { /* ignore */ }
  return count;
}

function generateAuditReport(rootPath: string, stats: AuditStats): string {
  const ts = new Date().toISOString();
  return `# Audit Report — ${rootPath}

**Generated:** ${ts}
**Agent OS Worker:** ${os.hostname()} v0.2.0

---

## Summary

| Metric | Value |
|--------|-------|
| Projects scanned | ${stats.projects} |
| Files scanned | ${stats.files} |
| Issues found | ${stats.issues} |
| Critical | ${stats.criticals} |
| Warnings | ${stats.warnings} |

## Projects Found

${stats.projectList.map(p => `- ${p}`).join('\n')}

## Issues

${stats.missingReadme.length > 0 ? `### Missing README.md (warning)\n${stats.missingReadme.map(p => `- ${p}`).join('\n')}\n` : ''}
${stats.noPackageJson.length > 0 ? `### Missing package.json (info)\n${stats.noPackageJson.map(p => `- ${p}`).join('\n')}\n` : ''}
${stats.criticals === 0 && stats.warnings === 0 ? '✓ No critical issues found.\n' : ''}

## Recommendations

1. Add README.md to projects missing documentation
2. Review large files for potential optimization
3. Ensure all projects have proper dependency manifests

---

*Report generated by Agent OS Worker on ${os.hostname()}*
`;
}

// ── D6: Cline Prompt ─────────────────────────────────────────────────────

export async function handleClinePrompt(args: string[], streamLog: StreamLog): Promise<CommandResult> {
  // Parse args: --project <path> --prompt <text>
  let projectPath = 'E:\\Project\\Master\\Agent';
  let prompt = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project' && args[i + 1]) {
      projectPath = args[++i];
    } else if (args[i] === '--prompt' && args[i + 1]) {
      prompt = args[++i];
    } else if (!prompt) {
      prompt = args[i];
    }
  }

  if (!prompt) {
    return { status: 'error', error: 'No prompt provided. Use --prompt "your prompt"' };
  }

  streamLog('agent', `Cline prompt: project=${projectPath}, prompt="${prompt}"`);
  streamLog('agent', 'Dispatching to AI gateway...');

  // Use the existing cline handler approach — call AI gateway directly
  const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || 'http://localhost:3456';
  const AI_GATEWAY_KEY = process.env.AI_GATEWAY_KEY || 'antigravity-local';
  const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

  try {
    const axios = (await import('axios')).default;

    const systemPrompt = `You are an AI coding assistant working on the project at ${projectPath}. Execute the following task and report results.`;

    const response = await axios.post(`${AI_GATEWAY_URL}/v1/messages`, {
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': AI_GATEWAY_KEY,
        'anthropic-version': '2023-06-01',
      },
      timeout: 120000,
    });

    const content = response.data?.content?.[0]?.text || JSON.stringify(response.data);
    streamLog('stdout', content);
    streamLog('agent', 'Cline task completed');

    return {
      status: 'ok',
      payload: {
        status: 'ok',
        task_id: `cline-${Date.now()}`,
        output: content.substring(0, 500),
      },
    };
  } catch (err: any) {
    const errMsg = err.response?.data?.error?.message || err.message;
    streamLog('stderr', `AI gateway error: ${errMsg}`);
    return { status: 'error', error: errMsg };
  }
}

// ── Shell command ────────────────────────────────────────────────────────

export async function handleShell(args: string[], streamLog: StreamLog): Promise<CommandResult> {
  const command = args.join(' ');
  streamLog('agent', `Executing: ${command}`);

  const blocked = explainBlockedShellCommand(command);
  if (blocked) {
    streamLog('stderr', blocked);
    return { status: 'error', exitCode: 126, error: blocked };
  }

  return new Promise((resolve) => {
    const proc = spawn('cmd.exe', ['/c', command], {
      cwd: 'E:\\Project\\Master',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      streamLog('stdout', chunk);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      streamLog('stderr', chunk);
    });

    proc.on('close', (code) => {
      resolve({
        status: code === 0 ? 'ok' : 'error',
        exitCode: code || 0,
        payload: { stdout: stdout.trim(), stderr: stderr.trim() },
      });
    });

    proc.on('error', (err) => {
      resolve({ status: 'error', error: err.message });
    });
  });
}

function explainBlockedShellCommand(command: string): string | null {
  const normalized = command.toLowerCase().replace(/\s+/g, ' ').trim();
  const globalNodeKill =
    /taskkill\b.*\/im\s+node(\.exe)?\b/.test(normalized) ||
    /\bkillall\s+node\b/.test(normalized) ||
    /\bpkill\s+.*\bnode\b/.test(normalized);

  if (globalNodeKill) {
    return 'BLOCKED_UNSAFE_COMMAND: global Node kill is not allowed. Identify exact PID by port/project path and kill only that PID.';
  }

  return null;
}

// ── Run script ───────────────────────────────────────────────────────────

export async function handleRunScript(args: string[], streamLog: StreamLog): Promise<CommandResult> {
  const scriptPath = args[0];
  if (!scriptPath || !fs.existsSync(scriptPath)) {
    return { status: 'error', error: `Script not found: ${scriptPath}` };
  }

  streamLog('agent', `Running script: ${scriptPath}`);
  const cwd = path.dirname(scriptPath);

  return new Promise((resolve) => {
    const proc = spawn('cmd.exe', ['/c', scriptPath, ...args.slice(1)], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      streamLog('stdout', chunk);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      streamLog('stderr', chunk);
    });

    proc.on('close', (code) => {
      resolve({
        status: code === 0 ? 'ok' : 'error',
        exitCode: code || 0,
        payload: { stdout: stdout.trim(), stderr: stderr.trim() },
      });
    });

    proc.on('error', (err) => {
      resolve({ status: 'error', error: err.message });
    });
  });
}

// ── Fetch file ───────────────────────────────────────────────────────────

export async function handleFetchFile(args: string[], streamLog: StreamLog): Promise<CommandResult> {
  const filePath = args[0];
  if (!filePath || !fs.existsSync(filePath)) {
    return { status: 'error', error: `File not found: ${filePath}` };
  }

  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'base64');

  streamLog('agent', `Fetching ${filePath} (${stat.size} bytes)`);

  return {
    status: 'ok',
    payload: {
      path: filePath,
      sizeBytes: stat.size,
      encoding: 'base64',
      content,
    },
  };
}

// ── Command router ───────────────────────────────────────────────────────

export async function routeCommand(command: string, args: string[], streamLog: StreamLog): Promise<CommandResult> {
  switch (command) {
    case 'ping':
      return handlePing(streamLog);
    case 'open-antigravity':
      return handleOpenAntigravity(args, streamLog);
    case 'close-antigravity':
      return handleCloseAntigravity(args, streamLog);
    case 'start-api-proxy':
      return handleStartApiProxy(args, streamLog);
    case 'stop-api-proxy':
      return handleStopApiProxy(args, streamLog);
    case 'status-api-proxy':
      return handleStatusApiProxy(args, streamLog);
    case 'audit':
      return handleAudit(args, streamLog);
    case 'cline-prompt':
      return handleClinePrompt(args, streamLog);
    case 'shell':
      return handleShell(args, streamLog);
    case 'run-script':
      return handleRunScript(args, streamLog);
    case 'fetch-file':
      return handleFetchFile(args, streamLog);
    default:
      return { status: 'error', error: `Unknown command: ${command}` };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
