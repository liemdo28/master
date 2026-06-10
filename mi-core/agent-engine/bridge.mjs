/**
 * Agent Engine Bridge — HTTP server on port 4003
 * Exposes autonomous coding, QA, and patch capabilities to mi-core TypeScript server.
 * Run: node agent-engine/bridge.mjs
 */

import express from 'express';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execSync, exec } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
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
    ],
    version: '1.0.0',
  });
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
    const { readdirSync } = await import('fs');
    const files = readdirSync(logDir).filter(f => f.endsWith('.json')).slice(-20);
    const patches = files.map(f => {
      try { return JSON.parse(readFileSync(join(logDir, f), 'utf-8')); } catch { return null; }
    }).filter(Boolean);
    res.json({ ok: true, patches: patches.sort((a, b) => b.timestamp.localeCompare(a.timestamp)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[AgentEngine] Bridge running on http://127.0.0.1:${PORT}`);
});
