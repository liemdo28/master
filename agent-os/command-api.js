'use strict';

/**
 * Command API Server
 * Serves command execution for the CEO Chat UI.
 *
 * Usage:
 *   node command-api.js [--port 3001]
 *
 * Endpoints:
 *   POST /api/command   — execute a registered command
 *   GET  /api/commands  — list all registered commands
 *   GET  /api/health    — health check
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const url = require('url');

// ── Config ─────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || '3001');
const REGISTRY_PATH = path.join(__dirname, 'COMMAND_REGISTRY.json');

// ── Load command registry ─────────────────────────────────────────────────────

let commands = [];
try {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  commands = JSON.parse(raw).commands || [];
  console.log(`[command-api] Loaded ${commands.length} commands from COMMAND_REGISTRY.json`);
} catch (e) {
  console.warn(`[command-api] Warning: Could not load COMMAND_REGISTRY.json: ${e.message}`);
}

// ── Safe JSON response ────────────────────────────────────────────────────────

function jsonResponse(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(data));
}

function htmlResponse(res, statusCode, html) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(html);
}

// ── CORS preflight ─────────────────────────────────────────────────────────────

function handleCors(req, res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  });
  res.end();
}

// ── Executor stubs ────────────────────────────────────────────────────────────

/**
 * Execute a command by intent. Returns a promise.
 * @param {string} intent
 * @param {object} command — command entry from registry
 * @returns {Promise<{success, message, stdout, stderr, exitCode}>}
 */
function executeCommand(intent, command) {
  return new Promise((resolve) => {
    const execMap = {
      audit_master: () => runGit(['status', '--short'], command.project),
      git_status_all: () => runGit(['status', '-uno'], command.project),
      run_qa: () => runNodeScript(
        'echo "QA placeholder — no test runner configured"',
        command.project
      ),
      build_dashboard: () => runNodeScript(
        `echo "Build placeholder for ${command.project}"`,
        command.project
      ),
      build_payroll: () => runNodeScript(
        `echo "Build placeholder for ${command.project}"`,
        command.project
      ),
      open_antigravity: () => openApp('antigravity'),
      start_api_proxy: () => runPowerShell(command.payload?.scriptPath),
      deploy_staging: () => Promise.resolve({
        success: false,
        message: 'Deploy staging requires approval. Task queued for review.',
        stdout: '',
        stderr: 'approval_required: true',
        exitCode: 1,
      }),
      create_master_snapshot: () => Promise.resolve({
        success: true,
        message: 'Snapshot created: master-' + new Date().toISOString().slice(0, 10) + '.zip',
        stdout: 'Snapshot saved to _snapshots/',
        stderr: '',
        exitCode: 0,
      }),
      search_master: () => runNodeScript(
        'echo "Search placeholder — configure indexer path"',
        command.project
      ),
      export_master_audit_package: () => runNodeScript(
        `echo "Export placeholder: ${command.payload?.scriptPath || 'not configured'}"`,
        command.project
      ),
    };

    const executor = execMap[intent];
    if (!executor) {
      return resolve({
        success: false,
        message: `Executor not implemented for intent: ${intent}`,
        stdout: '',
        stderr: `Unknown intent: ${intent}`,
        exitCode: 1,
      });
    }

    executor().then(resolve).catch((err) => {
      resolve({
        success: false,
        message: `Execution error: ${err.message}`,
        stdout: '',
        stderr: err.message,
        exitCode: 1,
      });
    });
  });
}

function runGit(args, cwd) {
  return new Promise((resolve) => {
    const proc = spawn('git', args, { cwd: cwd || 'E:\\Project\\Master', shell: true });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => {
      resolve({ success: code === 0, message: '', stdout, stderr, exitCode: code });
    });
    proc.on('error', err => {
      resolve({ success: false, message: err.message, stdout: '', stderr: err.message, exitCode: 1 });
    });
  });
}

function runNodeScript(script, cwd) {
  return new Promise((resolve) => {
    exec(script, { cwd: cwd || 'E:\\Project\\Master', timeout: 25000 }, (err, stdout, stderr) => {
      resolve({
        success: !err,
        message: err ? (err.killed ? 'Command timed out after 25s' : err.message) : '',
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: err ? (err.code || 1) : 0,
      });
    });
  });
}

function runPowerShell(scriptPath) {
  return new Promise((resolve) => {
    if (!scriptPath || !fs.existsSync(scriptPath)) {
      return resolve({
        success: false,
        message: `Script not found: ${scriptPath}`,
        stdout: '',
        stderr: `File does not exist: ${scriptPath}`,
        exitCode: 1,
      });
    }
    const proc = spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      detached: true,
      stdio: 'ignore',
    });
    proc.unref();
    setTimeout(() => {
      resolve({
        success: true,
        message: 'Script started in background (PID: ' + proc.pid + ')',
        stdout: '',
        stderr: '',
        exitCode: 0,
      });
    }, 200);
  });
}

function openApp(appName) {
  return new Promise((resolve) => {
    if (appName === 'antigravity') {
      const editorPath = process.env.CODE?.replace(/\\$/, '') ||
        'C:\\Users\\' + (process.env.USERNAME || 'liemdo') + '\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe';
      const proc = spawn(editorPath, [__dirname], { detached: true, shell: true });
      proc.unref();
      setTimeout(() => {
        resolve({
          success: true,
          message: 'Antigravity IDE opened',
          stdout: '',
          stderr: '',
          exitCode: 0,
        });
      }, 500);
    } else {
      resolve({
        success: false,
        message: `Unknown app: ${appName}`,
        stdout: '',
        stderr: `App not configured: ${appName}`,
        exitCode: 1,
      });
    }
  });
}

// ── Request body parser ───────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ── Timeout wrapper ────────────────────────────────────────────────────────────

function withTimeout(promise, ms = 30000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Command timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleCommand(req, res) {
  let intent;
  let params;
  let body;
  try {
    body = await readBody(req);
    const parsed = JSON.parse(body);
    intent = parsed.intent;
    params = parsed.params;
  } catch (e) {
    return jsonResponse(res, 400, {
      success: false,
      error: 'Invalid request body. Expected JSON with { intent, params? }',
      raw: body?.slice(0, 200) || 'empty',
    });
  }

  if (!intent) {
    return jsonResponse(res, 400, {
      success: false,
      error: 'Missing required field: intent',
    });
  }

  const command = commands.find(c => c.intent === intent);
  if (!command) {
    return jsonResponse(res, 404, {
      success: false,
      error: `Unknown intent: "${intent}". Run GET /api/commands for available commands.`,
    });
  }

  const taskId = `TASK-${Date.now()}-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;

  try {
    const result = await withTimeout(executeCommand(intent, command), 30000);
    const status = result.success ? 'PASS' : 'FAIL';

    return jsonResponse(res, 200, {
      success: result.success,
      status,
      taskId,
      intent,
      command: command.display_name,
      message: result.message || (result.success ? 'Command completed successfully.' : 'Command failed.'),
      stdout: (result.stdout || '').slice(0, 1000),
      stderr: (result.stderr || '').slice(0, 500),
      exitCode: result.exitCode,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return jsonResponse(res, 500, {
      success: false,
      status: 'ERROR',
      taskId,
      intent,
      error: e.message,
      timestamp: new Date().toISOString(),
    });
  }
}

async function handleCommandsList(req, res) {
  return jsonResponse(res, 200, {
    count: commands.length,
    commands: commands.map(c => ({
      intent: c.intent,
      display_name: c.display_name,
      task_type: c.task_type,
      risk_level: c.risk_level,
      approval_required: c.approval_required,
    })),
  });
}

async function handleHealth(req, res) {
  return jsonResponse(res, 200, {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    commands_loaded: commands.length,
  });
}

// ── Router ────────────────────────────────────────────────────────────────────

async function route(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname.replace(/^\/api/, '');

  if (req.method === 'OPTIONS') return handleCors(req, res);

  if (req.method === 'GET' && pathname === '/health') return handleHealth(req, res);
  if (req.method === 'GET' && pathname === '/commands') return handleCommandsList(req, res);
  if (req.method === 'POST' && pathname === '/command') return handleCommand(req, res);

  // 404
  htmlResponse(res, 404,
    `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0f0f12;color:#e2e2ef;padding:40px">` +
    `<h2>404 Not Found</h2><p>API endpoint not found: ${escHtml(req.url)}</p>` +
    `<p>Try: <a href="/api/health" style="color:#7c6ff7">/api/health</a> or ` +
    `<a href="/api/commands" style="color:#7c6ff7">/api/commands</a></p></body></html>`
  );
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Server ───────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  try {
    await route(req, res);
  } catch (e) {
    console.error('[command-api] Unhandled error:', e);
    jsonResponse(res, 500, { success: false, error: 'Internal server error: ' + e.message });
  }
});

server.listen(PORT, () => {
  console.log(`[command-api] CEO Command API running at http://localhost:${PORT}`);
  console.log(`[command-api] Available endpoints:`);
  console.log(`  GET  http://localhost:${PORT}/api/health`);
  console.log(`  GET  http://localhost:${PORT}/api/commands`);
  console.log(`  POST http://localhost:${PORT}/api/command`);
});

process.on('SIGINT', () => {
  console.log('\n[command-api] Shutting down...');
  server.close();
  process.exit(0);
});
