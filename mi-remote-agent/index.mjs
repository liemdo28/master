/**
 * Mi Remote Agent
 * Deploy this on any remote machine (laptop/PC).
 * Exposes secure HTTP API for Mi-Core to pull project data and push approved actions.
 *
 * SETUP:
 *   1. Copy this folder to remote machine
 *   2. npm install
 *   3. Set env: MI_REMOTE_TOKEN=<same-as-mi-core> PROJECT_ROOT=<path> PROJECT_NAME=<name>
 *   4. node index.mjs
 *   5. In mi-core .env: INTEGRATION_SYSTEM_HOST=<ip> INTEGRATION_SYSTEM_PORT=4005
 *
 * SECURITY: LAN/Tailscale only. Token auth required on all write endpoints.
 */

import express    from 'express';
import { execSync, exec } from 'child_process';
import fs          from 'fs';
import path        from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT         = parseInt(process.env.MI_REMOTE_PORT   || '4005');
const TOKEN        = process.env.MI_REMOTE_TOKEN || 'mi-remote-changeme';
const PROJECT_ROOT = process.env.PROJECT_ROOT    || process.cwd();
const PROJECT_NAME = process.env.PROJECT_NAME    || path.basename(PROJECT_ROOT);
const HOST         = process.env.MI_REMOTE_HOST  || '0.0.0.0';  // LAN/Tailscale only — do not expose to internet

const app = express();
app.use(express.json({ limit: '5mb' }));

// ── Auth middleware ──────────────────────────────────────────────────────────
function requireToken(req, res, next) {
  const token = req.headers['x-mi-token'] || req.query.token;
  if (token !== TOKEN) return res.status(401).json({ error: 'Unauthorized — token mismatch' });
  next();
}

// ── Health (public — no auth needed for discovery) ───────────────────────────
app.get('/health', (req, res) => {
  res.json({
    ok:           true,
    service:      'mi-remote-agent',
    version:      '1.0.0',
    project:      PROJECT_NAME,
    project_root: PROJECT_ROOT,
    machine:      process.env.COMPUTERNAME || process.env.HOSTNAME || 'unknown',
    uptime_s:     Math.round(process.uptime()),
    timestamp:    new Date().toISOString(),
  });
});

// ── Project status ───────────────────────────────────────────────────────────
app.get('/project/status', requireToken, (req, res) => {
  try {
    const pkg = readJson(path.join(PROJECT_ROOT, 'package.json'));
    const gitBranch  = runSafe(`git -C "${PROJECT_ROOT}" rev-parse --abbrev-ref HEAD`);
    const gitDirty   = runSafe(`git -C "${PROJECT_ROOT}" status --porcelain`).length > 0;
    const lastCommit = runSafe(`git -C "${PROJECT_ROOT}" log -1 --pretty=format:"%s (%ar)"`);

    res.json({
      project:     PROJECT_NAME,
      root:        PROJECT_ROOT,
      git_branch:  gitBranch,
      git_dirty:   gitDirty,
      last_commit: lastCommit,
      version:     pkg.version || 'unknown',
      node_version:process.version,
      disk_mb:     getDiskUsageMB(PROJECT_ROOT),
      timestamp:   new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Project logs ─────────────────────────────────────────────────────────────
app.get('/project/logs', requireToken, (req, res) => {
  const limit = parseInt(req.query.limit || '50');
  const logs = [];

  const logCandidates = [
    path.join(PROJECT_ROOT, 'logs', 'app.log'),
    path.join(PROJECT_ROOT, 'logs', 'server.log'),
    path.join(PROJECT_ROOT, 'gateway.log'),
    path.join(PROJECT_ROOT, 'proxy.log'),
  ];

  for (const lf of logCandidates) {
    if (fs.existsSync(lf)) {
      try {
        const lines = fs.readFileSync(lf, 'utf-8').split('\n').filter(Boolean).slice(-limit);
        logs.push(...lines.map(l => ({ source: path.basename(lf), line: l })));
      } catch { /* ignore */ }
    }
  }

  res.json({ logs: logs.slice(-limit), total: logs.length });
});

// ── Project errors ───────────────────────────────────────────────────────────
app.get('/project/errors', requireToken, (req, res) => {
  const errors = [];

  const errorCandidates = [
    path.join(PROJECT_ROOT, 'logs', 'error.log'),
    path.join(PROJECT_ROOT, 'errors.log'),
  ];

  for (const ef of errorCandidates) {
    if (fs.existsSync(ef)) {
      try {
        const lines = fs.readFileSync(ef, 'utf-8').split('\n')
          .filter(l => /error|exception|fatal/i.test(l))
          .slice(-20);
        errors.push(...lines);
      } catch { /* ignore */ }
    }
  }

  res.json({ errors, total: errors.length });
});

// ── Pull (git pull) ──────────────────────────────────────────────────────────
app.post('/project/pull', requireToken, (req, res) => {
  try {
    const output = execSync(`git -C "${PROJECT_ROOT}" pull --rebase`, { encoding: 'utf-8', timeout: 30000 });
    res.json({ ok: true, output: output.slice(0, 2000) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── QA ───────────────────────────────────────────────────────────────────────
app.post('/project/qa', requireToken, async (req, res) => {
  try {
    const pkg = readJson(path.join(PROJECT_ROOT, 'package.json'));
    const testCmd = pkg.scripts?.test || pkg.scripts?.qa;

    if (!testCmd) {
      return res.json({ ok: true, score: null, message: 'No test command found', skipped: true });
    }

    exec(`cd "${PROJECT_ROOT}" && ${testCmd}`, { timeout: 120000, encoding: 'utf-8' }, (err, stdout, stderr) => {
      const passed = !err;
      const output = (stdout + stderr).slice(0, 3000);
      res.json({ ok: true, passed, score: passed ? 100 : 0, output, command: testCmd });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Command preview (dry-run, no execution) ──────────────────────────────────
app.post('/project/command-preview', requireToken, (req, res) => {
  const { command } = req.body || {};
  if (!command) return res.status(400).json({ error: 'command required' });

  // Safety check — block dangerous commands
  const BLOCKED = ['rm -rf', 'del /s', 'format', 'DROP TABLE', 'truncate', '--force-with-lease'];
  if (BLOCKED.some(b => command.toLowerCase().includes(b.toLowerCase()))) {
    return res.json({ ok: false, blocked: true, reason: 'Dangerous command requires Level 3 approval', command });
  }

  res.json({
    ok: true,
    command,
    preview: `[DRY RUN] Would execute in ${PROJECT_ROOT}: ${command}`,
    requires_approval: true,
    risk_level: guessRiskLevel(command),
  });
});

// ── Execute approved action ──────────────────────────────────────────────────
app.post('/project/execute-approved-action', requireToken, (req, res) => {
  const { command, approval_id, params } = req.body || {};
  if (!command) return res.status(400).json({ error: 'command required' });
  if (!approval_id) return res.status(400).json({ error: 'approval_id required — all write actions need approval' });

  // Additional safety for Level 3
  const LEVEL3 = ['delete', 'deploy', 'git push', 'migration', 'drop', 'kill'];
  const needsLevel3 = LEVEL3.some(k => command.toLowerCase().includes(k));
  if (needsLevel3 && !req.body.double_confirmed) {
    return res.status(403).json({ error: 'Level 3 action requires double_confirmed: true', command });
  }

  exec(`cd "${PROJECT_ROOT}" && ${command}`, { timeout: 60000, encoding: 'utf-8' }, (err, stdout, stderr) => {
    const output = (stdout + stderr).slice(0, 3000);
    if (err) return res.status(500).json({ ok: false, error: err.message, output });
    res.json({ ok: true, command, approval_id, output });
  });
});

// ── Utils ────────────────────────────────────────────────────────────────────
function runSafe(cmd) {
  try { return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim(); }
  catch { return ''; }
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return {}; }
}

function getDiskUsageMB(dir) {
  try {
    const out = execSync(`du -sm "${dir}" 2>/dev/null || echo 0`, { encoding: 'utf-8', timeout: 5000 });
    return parseInt(out) || 0;
  } catch { return 0; }
}

function guessRiskLevel(cmd) {
  if (/delete|drop|rm|kill|format/i.test(cmd))  return 3;
  if (/deploy|push|migrate|publish/i.test(cmd)) return 2;
  return 1;
}

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log(`[Mi Remote Agent] Running on http://${HOST}:${PORT}`);
  console.log(`[Mi Remote Agent] Project: ${PROJECT_NAME} @ ${PROJECT_ROOT}`);
  console.log(`[Mi Remote Agent] Token: ${TOKEN.slice(0, 6)}...`);
  console.log(`[Mi Remote Agent] SECURITY: Ensure firewall blocks port ${PORT} from public internet`);
});
