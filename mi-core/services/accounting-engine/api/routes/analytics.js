// api/routes/analytics.js - /analytics/* endpoints
// Project Health Score formula (from docs/database/engineering-accounting-db.md):
//   QA stability 30% | patch success 20% | rollback rate 15% |
//   bug recurrence 15% | resource efficiency 10% | security/audit risk 10%
import { Router }             from 'express';
import { analyzeRegressions } from '../../analyzers/RegressionAnalyzer.js';

export function analyticsRouter(db) {
  const router = Router();

  // GET /analytics/overview — aggregate health score + key metrics
  router.get('/overview', (_req, res) => {
    try {
      const patch = db.prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status='applied'     THEN 1 ELSE 0 END) AS applied,
          SUM(CASE WHEN status='rolled_back' THEN 1 ELSE 0 END) AS rolled_back,
          SUM(CASE WHEN risk_level='high'    THEN 1 ELSE 0 END) AS high_risk
        FROM patch_ledger
      `).get();

      const qa = db.prepare(`
        SELECT
          COUNT(*)              AS runs,
          AVG(qa_score)         AS avg_score,
          AVG(regression_score) AS avg_regression,
          SUM(CASE WHEN qa_grade='FAIL' THEN 1 ELSE 0 END) AS fails
        FROM qa_runs WHERE completed_at IS NOT NULL
      `).get();

      const patchSuccessRate = patch.total > 0 ? patch.applied / patch.total : 1;
      const rollbackRate     = patch.applied > 0 ? patch.rolled_back / patch.applied : 0;
      const qaStability      = Math.max(0, Math.min(100, qa.avg_score ?? 50));
      const bugRecurrence    = qa.avg_regression != null ? Math.max(0, 100 - qa.avg_regression * 100) : 85;
      const securityScore    = patch.high_risk > 5 ? 70 : 90;

      const healthScore = Math.round(
        (qaStability       / 100) * 30 +
        patchSuccessRate          * 20 +
        (1 - rollbackRate)        * 15 +
        (bugRecurrence / 100)     * 15 +
        0.90                      * 10 +   // resource efficiency placeholder
        (securityScore / 100)     * 10
      );

      res.json({
        health_score: healthScore,
        components: {
          qa_stability:       Math.round(qaStability),
          patch_success_rate: Math.round(patchSuccessRate * 100),
          rollback_rate:      Math.round(rollbackRate * 100),
          security_score:     securityScore,
        },
        patch_stats: patch,
        qa_stats:    qa,
        generated_at: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /analytics/project-health[?project=name]
  router.get('/project-health', (req, res) => {
    try {
      const project = req.query.project ?? null;
      const where   = project ? 'WHERE project_name = ?' : '';
      const args    = project ? [project] : [];
      const rows    = db.prepare(`
        SELECT
          project_name,
          COUNT(*)              AS runs,
          AVG(qa_score)         AS avg_score,
          AVG(regression_score) AS avg_regression,
          SUM(CASE WHEN qa_grade='FAIL' THEN 1 ELSE 0 END) AS fails,
          SUM(total_cost_cents) AS total_cost_cents
        FROM qa_runs ${where} GROUP BY project_name ORDER BY avg_score DESC
      `).all(...args);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /analytics/qa-trends[?project=name&window=10]
  router.get('/qa-trends', (req, res) => {
    try {
      const project = req.query.project ?? null;
      const window  = Math.min(parseInt(req.query.window ?? 10, 10), 50);
      if (project) {
        res.json(analyzeRegressions(db, project, window));
      } else {
        const projects = db.prepare(
          'SELECT DISTINCT project_name FROM qa_runs WHERE project_name IS NOT NULL LIMIT 20'
        ).all().map((r) => r.project_name);
        res.json(projects.map((p) => analyzeRegressions(db, p, window)));
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /analytics/patch-risk
  router.get('/patch-risk', (_req, res) => {
    try {
      const byRisk = db.prepare(`
        SELECT risk_level, approval_status, COUNT(*) AS count
        FROM patch_ledger
        GROUP BY risk_level, approval_status
        ORDER BY risk_level, count DESC
      `).all();

      const timeline = db.prepare(`
        SELECT DATE(created_at) AS day, risk_level, COUNT(*) AS patches
        FROM patch_ledger
        GROUP BY day, risk_level
        ORDER BY day DESC LIMIT 90
      `).all();

      res.json({ by_risk: byRisk, timeline });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /analytics/bug-cost
  router.get('/bug-cost', (_req, res) => {
    try {
      const repeated = db.prepare(`
        SELECT
          repeated_issue_key,
          COUNT(*)              AS occurrences,
          SUM(fix_time_minutes) AS total_fix_minutes,
          SUM(total_cost_cents) AS total_cost_cents
        FROM qa_runs
        WHERE repeated_issue_key IS NOT NULL AND completed_at IS NOT NULL
        GROUP BY repeated_issue_key
        ORDER BY occurrences DESC LIMIT 30
      `).all();
      res.json({ repeated_issues: repeated });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /analytics/model-efficiency — placeholder until model_runtime_usage table exists
  router.get('/model-efficiency', (_req, res) => {
    try {
      // Derived from qa_runs cost and timing as a proxy until a models table is added
      const rows = db.prepare(`
        SELECT
          project_name,
          AVG(fix_time_minutes)  AS avg_fix_minutes,
          AVG(total_cost_cents)  AS avg_cost_cents,
          AVG(qa_score)          AS avg_qa_score,
          COUNT(*)               AS runs
        FROM qa_runs
        WHERE completed_at IS NOT NULL
        GROUP BY project_name
        ORDER BY avg_cost_cents DESC
      `).all();
      res.json({ note: 'Derived from qa_runs; dedicated model_runtime_usage table planned in Phase 6', data: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /analytics/resource-cost[?session=id]
  router.get('/resource-cost', (req, res) => {
    try {
      const session = req.query.session ?? null;
      if (session) {
        const metrics = db.prepare(`
          SELECT
            session_id,
            AVG(cpu_pct)   AS avg_cpu_pct,
            AVG(memory_mb) AS avg_memory_mb,
            MAX(cpu_pct)   AS peak_cpu_pct,
            MAX(memory_mb) AS peak_memory_mb,
            COUNT(*)       AS samples,
            MIN(timestamp) AS from_ts,
            MAX(timestamp) AS to_ts
          FROM resource_metrics WHERE session_id = ?
        `).get(session);
        res.json(metrics);
      } else {
        const metrics = db.prepare(`
          SELECT
            session_id,
            AVG(cpu_pct)   AS avg_cpu_pct,
            AVG(memory_mb) AS avg_memory_mb,
            COUNT(*)       AS samples
          FROM resource_metrics
          GROUP BY session_id
          ORDER BY samples DESC LIMIT 20
        `).all();
        res.json(metrics);
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
