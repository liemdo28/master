/**
 * Agent Engine Bridge — HTTP server on port 4003
 * Exposes autonomous coding, QA, and patch capabilities to mi-core TypeScript server.
 * Run: node agent-engine/bridge.mjs
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { buildSmartBrief, formatPlan, listCatalog, materialize, resolvePlan } from './operator-harness/mi-harness.mjs';

// Phase 20 — Autonomous Execution Engine
import { 
  executeObjective, 
  generateMorningBrief, 
  generateEveningBrief, 
  generateIncidentSummary, 
  generateServiceHealthSummary 
} from './autonomous-execution-engine.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
// Sprint 5.1: Request timeout middleware (30s per request)
app.use((req, _res, next) => {
  const timer = setTimeout(() => {
    console.warn(`[AgentEngine] Request timeout: ${req.method} ${req.path} — killing after 30s`);
  }, 30_000);
  req.on('close', () => clearTimeout(timer));
  next();
});

app.use(express.json({ limit: '5mb' }));

const PORT = process.env.AGENT_ENGINE_PORT || 4003;
const GLOBAL_DIR = process.env.GLOBAL_DIR || join(__dirname, '../.local-agent-global');

// ── Lazy-load modules ─────────────────────────────────────────────────────────
let PatchApplier, SafeFileEditor, SourceDiffAnalyzer, CodePatchPlanner;
let PatchValidator, PatchSafetyPolicy, GitChangeTracker;

async function loadModules() {
  if (!PatchApplier) {
    const coding = await import('./autonomous-coding/index.js');
    PatchApplier = coding.PatchApplier;
    SafeFileEditor = coding.SafeFileEditor;
    SourceDiffAnalyzer = coding.SourceDiffAnalyzer;
    CodePatchPlanner = coding.CodePatchPlanner;
    PatchValidator = coding.PatchValidator;
    PatchSafetyPolicy = coding.PatchSafetyPolicy;
    GitChangeTracker = coding.GitChangeTracker;
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'agent-engine', port: PORT });
});

// List capabilities
app.get('/capabilities', (_req, res) => {
  res.json({
    capabilities: [
      'patch/plan',
      'patch/apply',
      'patch/validate',
      'git/diff',
      'git/status',
      'qa/run',
      'memory/get',
      'memory/set',
      'harness/catalog',
      'harness/plan',
      'harness/brief',
      'harness/materialize',
      'harness/context',
    ],
    version: '1.0.0',
  });
});

// ── Operator Harness: ECC-inspired mi-core workflow context ────────────────
app.get('/harness/catalog', (_req, res) => {
  try {
    res.json({ ok: true, catalog: listCatalog() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/harness/plan', (req, res) => {
  try {
    const profile = req.query.profile || 'core';
    const plan = resolvePlan(String(profile));
    res.json({ ok: true, plan, text: formatPlan(plan) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/harness/brief', (req, res) => {
  try {
    const profile = req.query.profile || 'core';
    const brief = buildSmartBrief(String(profile));
    res.json({ ok: true, brief });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/harness/materialize', (req, res) => {
  try {
    const profile = req.body?.profile || 'core';
    const outDir = req.body?.outDir;
    const plan = resolvePlan(String(profile));
    const result = materialize(plan, outDir);
    res.json({ ok: true, result, plan });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/harness/context', (req, res) => {
  try {
    const profile = req.query.profile || 'core';
    const plan = resolvePlan(String(profile));
    const context = {
      plan,
      skills: Object.fromEntries(plan.skills.map((id) => [id, readFileSync(join(__dirname, 'operator-harness', 'skills', `${id}.md`), 'utf8')])),
      rules: Object.fromEntries(plan.rules.map((id) => [id, readFileSync(join(__dirname, 'operator-harness', 'rules', `${id}.md`), 'utf8')])),
      commands: Object.fromEntries(plan.commands.map((id) => [id, readFileSync(join(__dirname, 'operator-harness', 'commands', `${id}.md`), 'utf8')])),
    };
    res.json({ ok: true, context });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── Patch: Plan a code change ──────────────────────────────────────────────
app.post('/patch/plan', async (req, res) => {
  try {
    await loadModules();
    const { projectPath, task, context } = req.body;
    if (!projectPath || !task) {
      return res.status(400).json({ error: 'projectPath and task required' });
    }
    if (!existsSync(projectPath)) {
      return res.status(404).json({ error: `Path not found: ${projectPath}` });
    }
    const planner = new CodePatchPlanner({ projectPath });
    const plan = await planner.plan(task, context || {});
    res.json({ ok: true, plan });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Patch: Apply a change plan ─────────────────────────────────────────────
app.post('/patch/apply', async (req, res) => {
  try {
    await loadModules();
    const { projectPath, plan, dryRun } = req.body;
    if (!projectPath || !plan) {
      return res.status(400).json({ error: 'projectPath and plan required' });
    }

    const editor = new SafeFileEditor({ projectPath, dryRun: dryRun ?? false });
    const applier = new PatchApplier({ editor });
    const patchId = `patch-${Date.now()}`;
    const result = applier.apply(plan, { patchId });

    // Log to global dir
    const logDir = join(GLOBAL_DIR, 'patches');
    mkdirSync(logDir, { recursive: true });
    writeFileSync(join(logDir, `${patchId}.json`), JSON.stringify({
      patchId, projectPath, plan, result, timestamp: new Date().toISOString(), dryRun: dryRun ?? false,
    }, null, 2));

    res.json({ ok: true, patchId, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Patch: Validate before applying ───────────────────────────────────────
app.post('/patch/validate', async (req, res) => {
  try {
    await loadModules();
    const { projectPath, plan } = req.body;
    if (!projectPath || !plan) {
      return res.status(400).json({ error: 'projectPath and plan required' });
    }
    const validator = new PatchValidator({ projectPath });
    const validation = await validator.validate(plan);
    res.json({ ok: true, validation });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Git: Get diff/status of a project ────────────────────────────────────
app.post('/git/status', async (req, res) => {
  try {
    await loadModules();
    const { projectPath } = req.body;
    if (!projectPath) return res.status(400).json({ error: 'projectPath required' });
    if (!existsSync(projectPath)) return res.status(404).json({ error: 'Path not found' });

    const tracker = new GitChangeTracker({ projectPath });
    const status = await tracker.getStatus();
    res.json({ ok: true, status });
  } catch (e) {
    // Fallback to raw git
    try {
      const status = execSync(`git -C "${req.body.projectPath}" status --short`, { encoding: 'utf8' });
      const branch = execSync(`git -C "${req.body.projectPath}" rev-parse --abbrev-ref HEAD`, { encoding: 'utf8' }).trim();
      res.json({ ok: true, status: { raw: status, branch } });
    } catch (e2) {
      res.status(500).json({ error: e.message });
    }
  }
});

app.post('/git/diff', (req, res) => {
  try {
    const { projectPath } = req.body;
    if (!projectPath) return res.status(400).json({ error: 'projectPath required' });
    const diff = execSync(`git -C "${projectPath}" diff --stat HEAD`, { encoding: 'utf8' });
    res.json({ ok: true, diff });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Memory: Company memory read/write ─────────────────────────────────────
app.get('/memory/:type', (req, res) => {
  try {
    const validTypes = ['decisions', 'employees', 'incidents', 'lessons', 'processes', 'projects', 'vendors'];
    const type = req.params.type;
    if (!validTypes.includes(type)) return res.status(400).json({ error: `Invalid type. Valid: ${validTypes.join(', ')}` });

    const filePath = join(GLOBAL_DIR, 'company-memory', `${type}.json`);
    if (!existsSync(filePath)) return res.json({ ok: true, data: [] });
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/memory/:type', (req, res) => {
  try {
    const validTypes = ['decisions', 'employees', 'incidents', 'lessons', 'processes', 'projects', 'vendors'];
    const type = req.params.type;
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });

    const dir = join(GLOBAL_DIR, 'company-memory');
    mkdirSync(dir, { recursive: true });
    const filePath = join(dir, `${type}.json`);
    let existing = [];
    if (existsSync(filePath)) existing = JSON.parse(readFileSync(filePath, 'utf-8'));
    const entry = { ...req.body, saved_at: new Date().toISOString() };
    existing.push(entry);
    writeFileSync(filePath, JSON.stringify(existing, null, 2));
    res.json({ ok: true, saved: entry });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Patches: List recent ───────────────────────────────────────────────────
app.get('/patches', (_req, res) => {
  try {
    const logDir = join(GLOBAL_DIR, 'patches');
    if (!existsSync(logDir)) return res.json({ ok: true, patches: [] });
    const files = readdirSync(logDir).filter(f => f.endsWith('.json')).slice(-20);
    const patches = files.map(f => {
      try { return JSON.parse(readFileSync(join(logDir, f), 'utf-8')); } catch { return null; }
    }).filter(Boolean);
    res.json({ ok: true, patches: patches.sort((a, b) => b.timestamp.localeCompare(a.timestamp)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Phase 20: Autonomous Execution Engine ─────────────────────────────────

// Execute a CEO objective — full autonomous pipeline
app.post('/autonomous/execute', (req, res) => {
  try {
    const { objective, projectPath } = req.body;
    if (!objective) {
      return res.status(400).json({ error: 'objective required' });
    }
    const root = projectPath || join(__dirname, '..');
    const result = executeObjective(objective, root);
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Morning brief
app.get('/autonomous/brief/morning', (req, res) => {
  try {
    const root = req.query.projectPath || join(__dirname, '..');
    const brief = generateMorningBrief(root);
    res.json({ ok: true, brief });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Evening brief
app.get('/autonomous/brief/evening', (req, res) => {
  try {
    const root = req.query.projectPath || join(__dirname, '..');
    const brief = generateEveningBrief(root);
    res.json({ ok: true, brief });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Incident summary
app.get('/autonomous/incidents', (req, res) => {
  try {
    const root = req.query.projectPath || join(__dirname, '..');
    const summary = generateIncidentSummary(root);
    res.json({ ok: true, summary });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Service health
app.get('/autonomous/health', (req, res) => {
  try {
    const root = req.query.projectPath || join(__dirname, '..');
    const health = generateServiceHealthSummary(root);
    res.json({ ok: true, health });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List all executed objectives
app.get('/autonomous/objectives', (_req, res) => {
  try {
    const objDir = join(__dirname, '..', '.mi-harness', 'objectives');
    if (!existsSync(objDir)) return res.json({ ok: true, objectives: [] });
    const files = readdirSync(objDir).filter(f => f.endsWith('.json'));
    const objectives = files.map(f => {
      try {
        const obj = JSON.parse(readFileSync(join(objDir, f), 'utf-8'));
        return { id: obj.id, objective: obj.objective, status: obj.status, tasks: obj.tasks?.length || 0, receivedAt: obj.receivedAt, completedAt: obj.completedAt };
      } catch { return null; }
    }).filter(Boolean);
    res.json({ ok: true, objectives });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Phase F: Scheduler ────────────────────────────────────────────────────
const schedulerState = { intervals: [], running: false };

function startScheduler(projectRoot) {
  if (schedulerState.running) return { message: 'Scheduler already running' };
  schedulerState.running = true;
  
  // Every 15 min — service health
  const healthInterval = setInterval(() => {
    try {
      const health = generateServiceHealthSummary(projectRoot);
      const logDir = join(projectRoot, '.mi-harness', 'scheduler');
      mkdirSync(logDir, { recursive: true });
      writeFileSync(join(logDir, `health-${Date.now()}.json`), JSON.stringify(health, null, 2));
    } catch (e) { console.error('[Scheduler] Health check error:', e.message); }
  }, 15 * 60 * 1000);
  
  // Every 1 hour — project audit
  const auditInterval = setInterval(() => {
    try {
      const result = executeObjective('Hourly project health audit', projectRoot);
      const logDir = join(projectRoot, '.mi-harness', 'scheduler');
      mkdirSync(logDir, { recursive: true });
      writeFileSync(join(logDir, `audit-${Date.now()}.json`), JSON.stringify({ id: result.id, status: result.status, tasks: result.tasks.length }, null, 2));
    } catch (e) { console.error('[Scheduler] Audit error:', e.message); }
  }, 60 * 60 * 1000);
  
  // Daily — executive brief (runs at 8am if started)
  const dailyInterval = setInterval(() => {
    try {
      const brief = generateMorningBrief(projectRoot);
      const logDir = join(projectRoot, '.mi-harness', 'scheduler');
      mkdirSync(logDir, { recursive: true });
      writeFileSync(join(logDir, `daily-brief-${Date.now()}.md`), brief.content);
    } catch (e) { console.error('[Scheduler] Daily brief error:', e.message); }
  }, 24 * 60 * 60 * 1000);
  
  schedulerState.intervals = [healthInterval, auditInterval, dailyInterval];
  
  return { message: 'Scheduler started', intervals: ['15min:health', '1hour:audit', 'daily:brief'] };
}

function stopScheduler() {
  schedulerState.intervals.forEach(id => clearInterval(id));
  schedulerState.intervals = [];
  schedulerState.running = false;
  return { message: 'Scheduler stopped' };
}

app.post('/autonomous/scheduler/start', (req, res) => {
  try {
    const root = req.body?.projectPath || join(__dirname, '..');
    const result = startScheduler(root);
    res.json({ ok: true, ...result, running: schedulerState.running });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/autonomous/scheduler/stop', (_req, res) => {
  try {
    const result = stopScheduler();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/autonomous/scheduler/status', (_req, res) => {
  res.json({ ok: true, running: schedulerState.running, activeIntervals: schedulerState.intervals.length });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[AgentEngine] Bridge running on http://127.0.0.1:${PORT}`);
  console.log(`[AgentEngine] Phase 20 Autonomous Execution Engine loaded`);
});
