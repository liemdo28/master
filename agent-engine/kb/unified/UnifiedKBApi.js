// kb/unified/UnifiedKBApi.js — Express router for Unified Knowledge DB V2 UI controls
// Provides: rebuild, incremental sync, search, stats, last indexed, stale projects
import { Router } from 'express';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const DB_PATH = join(ROOT, '.local-agent', 'ukv', 'knowledge.db');
const KB_MODULES = '../kb/unified';

const router = Router();
let asyncPending = null;

async function ukv(mod) {
  return await import(`${KB_MODULES}/${mod}.js`);
}

function mkdirForDb() {
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
import { mkdirSync } from 'fs';

// ── GET /api/ukv/stats ──
router.get('/ukv/stats', async (req, res) => {
  try {
    const { openUKV, getUKVStats } = await ukv('UnifiedKnowledgeDatabase');
    if (!existsSync(DB_PATH)) return res.json({ success: true, data: { initialized: false } });
    const db = openUKV(DB_PATH);
    const stats = getUKVStats(db);
    db.close();
    res.json({ success: true, data: { ...stats, initialized: true } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/ukv/rebuild ──
router.post('/ukv/rebuild', (req, res) => {
  if (asyncPending) return res.json({ success: false, error: `Operation already running: ${asyncPending.type}`, pending: asyncPending });
  mkdirForDb();
  asyncPending = { type: 'rebuild', started_at: new Date().toISOString() };
  const { spawn } = await_import_child_process();
  const child = spawn(process.execPath, [join(ROOT, 'bin', 'ukv.js'), 'rebuild'], { cwd: ROOT, detached: true, stdio: 'ignore' });
  child.unref();
  child.on('exit', () => { asyncPending = null; });
  res.json({ success: true, message: 'UKV rebuild started in background. Use stats to check progress.', pending: asyncPending });
});

// ── POST /api/ukv/sync ──
router.post('/ukv/sync', (req, res) => {
  if (asyncPending) return res.json({ success: false, error: `Operation already running: ${asyncPending.type}`, pending: asyncPending });
  mkdirForDb();
  asyncPending = { type: 'sync', started_at: new Date().toISOString() };
  const { spawn } = await_import_child_process();
  const child = spawn(process.execPath, [join(ROOT, 'bin', 'ukv.js'), 'sync'], { cwd: ROOT, detached: true, stdio: 'ignore' });
  child.unref();
  child.on('exit', () => { asyncPending = null; });
  res.json({ success: true, message: 'UKV incremental sync started.', pending: asyncPending });
});

// ── GET /api/ukv/search?q=...&kind=...&topK=... ──
router.get('/ukv/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ success: false, error: 'Missing query: q' });
    if (!existsSync(DB_PATH)) return res.status(404).json({ success: false, error: 'DB not built. Run rebuild first.' });
    const { openUKV } = await ukv('UnifiedKnowledgeDatabase');
    const { searchKnowledge } = await ukv('SearchEngine');
    const db = openUKV(DB_PATH);
    const results = searchKnowledge(db, q, { topK: parseInt(req.query.topK || '10', 10), kind: req.query.kind || null });
    db.close();
    res.json({ success: true, query: q, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/ukv/search ──
router.post('/ukv/search', async (req, res) => {
  try {
    const { q, query, kind, topK = 10 } = req.body || {};
    const text = (q || query || '').trim();
    if (!text) return res.status(400).json({ success: false, error: 'Missing q or query in body' });
    if (!existsSync(DB_PATH)) return res.status(404).json({ success: false, error: 'DB not built. Run rebuild first.' });
    const { openUKV } = await ukv('UnifiedKnowledgeDatabase');
    const { searchKnowledge } = await ukv('SearchEngine');
    const db = openUKV(DB_PATH);
    const results = searchKnowledge(db, text, { topK: parseInt(topK, 10), kind });
    db.close();
    res.json({ success: true, query: text, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/ukv/projects ──
router.get('/ukv/projects', async (req, res) => {
  try {
    const { openUKV, listProjects } = await ukv('UnifiedKnowledgeDatabase');
    const db = openUKV(DB_PATH);
    const projects = listProjects(db, { stale: req.query.stale === 'true' ? true : null });
    db.close();
    res.json({ success: true, count: projects.length, data: projects });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/ukv/stale-projects ──
router.get('/ukv/stale-projects', async (req, res) => {
  try {
    const { openUKV, listProjects } = await ukv('UnifiedKnowledgeDatabase');
    const db = openUKV(DB_PATH);
    const stale = listProjects(db, { stale: true });
    db.close();
    res.json({ success: true, count: stale.length, data: stale });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/ukv/last-indexed ──
router.get('/ukv/last-indexed', async (req, res) => {
  try {
    const { openUKV, getMeta } = await ukv('UnifiedKnowledgeDatabase');
    if (!existsSync(DB_PATH)) return res.json({ success: true, data: { last_indexed: null } });
    const db = openUKV(DB_PATH);
    const lastIndexed = getMeta(db, 'last_indexed_at');
    const duration = getMeta(db, 'last_indexed_duration_ms');
    db.close();
    res.json({ success: true, data: { last_indexed: lastIndexed, duration_ms: duration ? parseInt(duration, 10) : null } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/ukv/retrieve?q=... ──
router.get('/ukv/retrieve', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ success: false, error: 'Missing query: q' });
    const { RetrievalLayer } = await ukv('RetrievalLayer');
    const layer = new RetrievalLayer(DB_PATH);
    const result = layer.retrieve(q);
    layer.close();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/ukv/projects/:id/source-map ──
router.get('/ukv/projects/:id/source-map', async (req, res) => {
  try {
    const { openUKV } = await ukv('UnifiedKnowledgeDatabase');
    const { getSourceMapForProject } = await ukv('SearchEngine');
    const db = openUKV(DB_PATH);
    const sm = getSourceMapForProject(db, parseInt(req.params.id, 10), req.query.ext || null);
    db.close();
    res.json({ success: true, count: sm.length, data: sm });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/ukv/ingest-logs ──
router.get('/ukv/ingest-logs', async (req, res) => {
  try {
    const { openUKV, getRecentIngestLogs } = await ukv('UnifiedKnowledgeDatabase');
    const db = openUKV(DB_PATH);
    const logs = getRecentIngestLogs(db, parseInt(req.query.limit || '50', 10));
    db.close();
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Inline spawn since child_process is CJS interop
function await_import_child_process() {
  return { spawn: (await_import_child_process)._spawn || ((exec, args, opts) => {
    const { spawn } = require('child_process');
    (await_import_child_process)._spawn = spawn;
    return spawn(exec, args, opts);
  })};
}
function require(mod) { return module.require(mod); }

export default router;
