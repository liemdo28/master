// api/routes/costs.js - Engineering cost analytics
import { Router } from 'express';

export function costsRouter(db) {
  const router = Router();

  router.get('/', (_req, res) => {
    try {
      const qa = db.prepare(`
        SELECT
          SUM(total_cost_cents) as qa_cost_cents,
          AVG(total_cost_cents) as avg_qa_cost_cents,
          SUM(fix_time_minutes) as total_fix_minutes,
          AVG(fix_time_minutes) as avg_fix_minutes,
          COUNT(*)              as qa_runs
        FROM qa_runs WHERE completed_at IS NOT NULL
      `).get();

      const patches = db.prepare(`
        SELECT
          COUNT(*) as total_patches,
          SUM(CASE WHEN status='rolled_back' THEN 1 ELSE 0 END) as rollbacks,
          SUM(CASE WHEN status='failed'      THEN 1 ELSE 0 END) as failures
        FROM patch_ledger
      `).get();

      // Model costs
      let model = { model_cost_cents: 0, total_tokens: 0 };
      try {
        model = db.prepare(`
          SELECT SUM(cost_cents) as model_cost_cents,
                 SUM(prompt_tokens + output_tokens) as total_tokens
          FROM model_usage
        `).get() ?? model;
      } catch { /* model_usage may not exist yet */ }

      const totalCents  = (qa.qa_cost_cents ?? 0) + (model.model_cost_cents ?? 0);
      const wastedPct   = patches.total_patches > 0
        ? Math.round(((patches.rollbacks + patches.failures) / patches.total_patches) * 100)
        : 0;

      res.json({
        summary: {
          total_cost_cents: totalCents,
          total_cost_usd:   (totalCents / 100).toFixed(2),
          wasted_effort_pct: wastedPct,
        },
        qa:      qa,
        patches: patches,
        models:  model,
        timestamp: new Date().toISOString(),
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  router.get('/by-project', (_req, res) => {
    try {
      const rows = db.prepare(`
        SELECT project_name,
               COUNT(*) as runs,
               SUM(total_cost_cents) as cost_cents,
               SUM(fix_time_minutes) as fix_minutes,
               AVG(qa_score) as avg_score
        FROM qa_runs
        WHERE completed_at IS NOT NULL AND project_name IS NOT NULL
        GROUP BY project_name
        ORDER BY cost_cents DESC
      `).all();
      res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}
