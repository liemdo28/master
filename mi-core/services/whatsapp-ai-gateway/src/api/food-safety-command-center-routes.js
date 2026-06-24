'use strict';
/**
 * food-safety-command-center-routes.js
 * Express routes for the Food Safety Command Center.
 * Mount with: app.use('/api/food-safety', require('./food-safety-command-center-routes'));
 */

const router = require('express').Router();
const { makeLogger } = require('../logger');
const log = makeLogger('command-center');

function getDb() { try { return require('../storage/sqlite'); } catch (_) { return null; } }

// ── Health ───────────────────────────────────────────────────────────────────

router.get('/health', async (_req, res) => {
  try {
    const db = getDb();
    const row = db ? await db.get(`SELECT COUNT(*) as count FROM food_safety_submissions`).catch(() => null) : null;
    res.json({ ok: true, submissionCount: row?.count ?? null, ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Submissions list ─────────────────────────────────────────────────────────

router.get('/submissions', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ ok: false, error: 'Database unavailable' });
    const { store, status, date_from, date_to, limit = 100 } = req.query;
    const conditions = [];
    const params = [];
    if (store)     { conditions.push('store_id = ?');            params.push(store); }
    if (status)    { conditions.push('status = ?');              params.push(status); }
    if (date_from) { conditions.push('created_at >= ?');         params.push(date_from); }
    if (date_to)   { conditions.push('created_at <= ?');         params.push(date_to); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await db.all(
      `SELECT * FROM food_safety_submissions ${where} ORDER BY created_at DESC LIMIT ?`,
      [...params, Math.min(parseInt(limit, 10) || 100, 1000)]
    );
    res.json({ ok: true, count: rows.length, submissions: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Daily summary ────────────────────────────────────────────────────────────

router.get('/summary', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ ok: false, error: 'Database unavailable' });
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const rows = await db.all(
      `SELECT store_id,
              SUM(CASE WHEN status = 'PASS' THEN 1 ELSE 0 END) as pass_count,
              SUM(CASE WHEN status IN ('FAIL','UNSAFE') THEN 1 ELSE 0 END) as fail_count,
              COUNT(*) as total
       FROM food_safety_submissions
       WHERE date(created_at) = date(?)
       GROUP BY store_id`,
      [date]
    );
    res.json({ ok: true, date, stores: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Missing submissions ───────────────────────────────────────────────────────

router.get('/missing', async (req, res) => {
  try {
    const { detectMissing } = require('../food-safety/alerts/missing-submission-detector');
    const result = await detectMissing(req.query.date || null);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Alert history ─────────────────────────────────────────────────────────────

router.get('/alerts', async (req, res) => {
  try {
    const alertSvc = require('../alerts/manager-alert-service');
    const alerts = await alertSvc.getRecentAlerts(parseInt(req.query.limit, 10) || 20);
    res.json({ ok: true, alerts });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Memory/search status ──────────────────────────────────────────────────────

router.get('/memory/status', async (_req, res) => {
  try {
    const { getMemoryStatus } = require('../agent-tools/memory/food-safety-memory-indexer');
    const status = await getMemoryStatus();
    res.json({ ok: true, ...status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Search ────────────────────────────────────────────────────────────────────

router.get('/search', async (req, res) => {
  try {
    const { searchSubmissions } = require('../agent-tools/memory/food-safety-memory-indexer');
    const { q, store, status, date_from, date_to, limit } = req.query;
    if (!q) return res.status(400).json({ ok: false, error: 'q is required' });
    const result = await searchSubmissions(q, { store, status, dateFrom: date_from, dateTo: date_to, limit: parseInt(limit, 10) || 50 });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── CSV export ────────────────────────────────────────────────────────────────

router.get('/export/csv', async (req, res) => {
  try {
    const { exportCsv } = require('../exports/food-safety-csv-exporter');
    const { date_from, date_to, store } = req.query;
    const { csv, filename } = await exportCsv({ dateFrom: date_from, dateTo: date_to, store });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Audit packages list ───────────────────────────────────────────────────────

router.get('/audit-packages', async (req, res) => {
  try {
    const path = require('path');
    const fs = require('fs');
    const auditDir = path.join(process.cwd(), 'logs', 'audit-packages');
    if (!fs.existsSync(auditDir)) return res.json({ ok: true, packages: [] });
    const files = fs.readdirSync(auditDir).filter(f => f.endsWith('.zip') || f.endsWith('.json'));
    res.json({ ok: true, packages: files });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
