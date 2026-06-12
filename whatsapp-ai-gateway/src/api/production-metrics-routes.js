'use strict';
/**
 * production-metrics-routes.js — Phase 2: Production Metrics Dashboard
 * Mount: app.use('/api/metrics', require('./production-metrics-routes'));
 *
 * Endpoints:
 *   GET /api/metrics/overview          — all-store summary
 *   GET /api/metrics/store/:storeId    — per-store breakdown
 *   GET /api/metrics/ocr-accuracy      — OCR confidence trend
 *   GET /api/metrics/edit-rate         — employee edit rate per store
 *   GET /api/metrics/retake-rate       — retake counts per store
 *   GET /api/metrics/manager-reviews   — manager review rate
 *   GET /api/metrics/submission-trend  — daily submission counts (last 14 days)
 *   GET /api/metrics/comparison        — Stone Oak vs Rim vs Bandera side-by-side
 */

const router = require('express').Router();
const { makeLogger } = require('../logger');
const log = makeLogger('metrics');

const STORES = ['stone_oak', 'rim', 'bandera'];

function getDb() { try { return require('../storage/sqlite'); } catch (_) { return null; } }

async function safeQuery(db, sql, params = []) {
  try { return await db.all(sql, params); }
  catch (err) { log.warn('Metrics query failed', { sql: sql.slice(0, 60), error: err.message }); return []; }
}

async function buildStoreMetrics(db, storeId, days = 14) {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const [submissions, pilotRows, alerts] = await Promise.all([
    safeQuery(db,
      `SELECT status, ocr_confidence, shift, form_date, created_at, synced_to_sheet_at
       FROM food_safety_submissions WHERE store_id = ? AND created_at >= ? ORDER BY created_at ASC`,
      [storeId, since]),
    safeQuery(db,
      `SELECT ocr_confidence, field_accuracy, needs_employee_edit, retake_count, manager_reviewed, synced_to_sheet, dashboard_visible
       FROM pilot_stone_oak WHERE 1=1`).catch(() => []),
    safeQuery(db,
      `SELECT COUNT(*) as cnt FROM manager_alerts WHERE store_id = ? AND created_at >= ?`,
      [storeId, since]),
  ]);

  const total = submissions.length;
  if (total === 0) return { store_id: storeId, total: 0, since, status: 'no_data' };

  const avgConf    = avg(submissions, 'ocr_confidence');
  const passCount  = submissions.filter(r => ['PASS','OCR_CONFIRMED'].includes(r.status)).length;
  const failCount  = submissions.filter(r => ['FAIL','UNSAFE'].includes(r.status)).length;
  const reviewCount= submissions.filter(r => ['NEEDS_REVIEW','OCR_PENDING'].includes(r.status)).length;
  const syncedCount= submissions.filter(r => r.synced_to_sheet_at).length;

  // pilot metrics (stone oak only — use pilot table if available)
  const usePilot  = storeId === 'stone_oak' && pilotRows.length > 0;
  const editRate  = usePilot ? pilotRows.filter(r => r.needs_employee_edit).length / pilotRows.length : null;
  const retakeTotal = usePilot ? pilotRows.reduce((s, r) => s + (r.retake_count || 0), 0) : null;
  const reviewRate  = usePilot ? pilotRows.filter(r => r.manager_reviewed).length / pilotRows.length : null;
  const avgAccuracy = usePilot ? avg(pilotRows.filter(r => r.field_accuracy != null), 'field_accuracy') : null;

  return {
    store_id: storeId,
    since,
    total,
    pass: passCount,
    fail: failCount,
    needs_review: reviewCount,
    synced_to_sheet: syncedCount,
    alert_count: alerts[0]?.cnt || 0,
    ocr: {
      avg_confidence:  +(avgConf * 100).toFixed(1) + '%',
      avg_accuracy:    avgAccuracy != null ? +(avgAccuracy * 100).toFixed(1) + '%' : 'N/A',
    },
    edit_rate:    editRate    != null ? +(editRate * 100).toFixed(1) + '%' : 'N/A',
    retake_total: retakeTotal != null ? retakeTotal : 'N/A',
    review_rate:  reviewRate  != null ? +(reviewRate * 100).toFixed(1) + '%' : 'N/A',
  };
}

// GET /api/metrics/overview
router.get('/overview', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ ok: false, error: 'DB unavailable' });
    const days = parseInt(req.query.days, 10) || 14;
    const stores = await Promise.all(STORES.map(s => buildStoreMetrics(db, s, days)));
    const total  = stores.reduce((s, m) => s + (m.total || 0), 0);
    res.json({ ok: true, generated_at: new Date().toISOString(), period_days: days, total_submissions: total, stores });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/metrics/store/:storeId
router.get('/store/:storeId', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ ok: false, error: 'DB unavailable' });
    const days = parseInt(req.query.days, 10) || 14;
    const m = await buildStoreMetrics(db, req.params.storeId, days);
    res.json({ ok: true, ...m });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/metrics/ocr-accuracy
router.get('/ocr-accuracy', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ ok: false, error: 'DB unavailable' });
    const days = parseInt(req.query.days, 10) || 14;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const rows = await safeQuery(db,
      `SELECT store_id, date(created_at) as day, AVG(ocr_confidence) as avg_conf, COUNT(*) as cnt
       FROM food_safety_submissions WHERE created_at >= ? GROUP BY store_id, day ORDER BY day`,
      [since]);
    res.json({ ok: true, period_days: days, by_store_day: rows });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/metrics/submission-trend
router.get('/submission-trend', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ ok: false, error: 'DB unavailable' });
    const days = parseInt(req.query.days, 10) || 14;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const rows = await safeQuery(db,
      `SELECT date(created_at) as day, store_id, shift, COUNT(*) as cnt
       FROM food_safety_submissions WHERE created_at >= ?
       GROUP BY day, store_id, shift ORDER BY day, store_id`,
      [since]);
    res.json({ ok: true, period_days: days, trend: rows });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/metrics/edit-rate
router.get('/edit-rate', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ ok: false, error: 'DB unavailable' });
    const rows = await safeQuery(db,
      `SELECT 'stone_oak' as store_id,
              COUNT(*) as total,
              SUM(needs_employee_edit) as edits,
              ROUND(100.0 * SUM(needs_employee_edit) / COUNT(*), 1) as edit_pct
       FROM pilot_stone_oak`).catch(() => []);
    res.json({ ok: true, note: 'Edit rate tracked for Stone Oak pilot only until other stores complete pilot', stores: rows });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/metrics/retake-rate
router.get('/retake-rate', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ ok: false, error: 'DB unavailable' });
    const rows = await safeQuery(db,
      `SELECT 'stone_oak' as store_id, SUM(retake_count) as total_retakes, COUNT(*) as total_submissions,
              ROUND(100.0 * SUM(retake_count) / COUNT(*), 1) as retake_pct
       FROM pilot_stone_oak`).catch(() => []);
    res.json({ ok: true, stores: rows });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/metrics/manager-reviews
router.get('/manager-reviews', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ ok: false, error: 'DB unavailable' });
    const days = parseInt(req.query.days, 10) || 14;
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const rows = await safeQuery(db,
      `SELECT store_id, COUNT(*) as alerts, SUM(CASE WHEN status='SENT' THEN 1 ELSE 0 END) as sent
       FROM manager_alerts WHERE created_at >= ? GROUP BY store_id`,
      [since]);
    res.json({ ok: true, period_days: days, by_store: rows });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// GET /api/metrics/comparison
router.get('/comparison', async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ ok: false, error: 'DB unavailable' });
    const days = parseInt(req.query.days, 10) || 14;
    const stores = await Promise.all(STORES.map(s => buildStoreMetrics(db, s, days)));
    const table = stores.map(m => ({
      store:          m.store_id,
      submissions:    m.total,
      ocr_confidence: m.ocr?.avg_confidence || 'N/A',
      accuracy:       m.ocr?.avg_accuracy   || 'N/A',
      edit_rate:      m.edit_rate,
      retake_total:   m.retake_total,
      pass_rate:      m.total > 0 ? +((m.pass / m.total) * 100).toFixed(1) + '%' : 'N/A',
      synced:         m.total > 0 ? m.synced_to_sheet + '/' + m.total : 'N/A',
      pilot_status:   m.store_id === 'stone_oak' ? 'ACTIVE' : 'PENDING',
    }));
    res.json({ ok: true, period_days: days, comparison: table });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

function avg(rows, field) {
  const valid = rows.filter(r => typeof r[field] === 'number');
  return valid.length ? valid.reduce((s, r) => s + r[field], 0) / valid.length : 0;
}

module.exports = router;
