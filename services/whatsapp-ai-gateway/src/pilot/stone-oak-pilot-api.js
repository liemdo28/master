'use strict';
/**
 * stone-oak-pilot-api.js
 * Express routes for the Stone Oak pilot dashboard.
 * Mount: app.use('/api/pilot/stone-oak', require('./stone-oak-pilot-api'));
 */

const router  = require('express').Router();
const tracker = require('./stone-oak-pilot-tracker');

// Full pilot report
router.get('/report', async (_req, res) => {
  try { res.json(await tracker.getReport()); }
  catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Force re-ingest from submissions table
router.post('/ingest', async (_req, res) => {
  try {
    const count = await tracker.ingestNew();
    const report = await tracker.getReport();
    res.json({ ok: true, ingested: count, ...report });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// Mark a specific submission
router.post('/mark/:submissionId/edit',    async (req, res) => { await tracker.markEdit(req.params.submissionId);          res.json({ ok: true }); });
router.post('/mark/:submissionId/retake',  async (req, res) => { await tracker.markRetake(req.params.submissionId);        res.json({ ok: true }); });
router.post('/mark/:submissionId/review',  async (req, res) => { await tracker.markManagerReview(req.params.submissionId); res.json({ ok: true }); });
router.post('/mark/:submissionId/synced',  async (req, res) => { await tracker.markSynced(req.params.submissionId);        res.json({ ok: true }); });
router.post('/mark/:submissionId/dashboard', async (req, res) => { await tracker.markDashboard(req.params.submissionId);  res.json({ ok: true }); });
router.post('/mark/:submissionId/accuracy', async (req, res) => {
  const pct = parseFloat(req.body?.pct);
  if (isNaN(pct) || pct < 0 || pct > 100) return res.status(400).json({ ok: false, error: 'pct must be 0-100' });
  await tracker.setAccuracy(req.params.submissionId, pct);
  res.json({ ok: true });
});

module.exports = router;
