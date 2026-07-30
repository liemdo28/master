// api/routes/risks.js - Risk intelligence: high-risk patches, rollback hotspots, QA danger zones
import { Router } from 'express';

export function risksRouter(db) {
  const router = Router();

  router.get('/', (_req, res) => {
    try {
      const highRiskPatches = db.prepare(`
        SELECT patch_id, task, risk_level, status, branch_name, deployment_target, created_at
        FROM patch_ledger WHERE risk_level = 'high'
        ORDER BY created_at DESC LIMIT 20
      `).all();

      const rollbackHotspots = db.prepare(`
        SELECT branch_name,
               COUNT(*) as total,
               SUM(CASE WHEN status='rolled_back' THEN 1 ELSE 0 END) as rollbacks,
               ROUND(SUM(CASE WHEN status='rolled_back' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as rollback_rate_pct
        FROM patch_ledger
        WHERE branch_name IS NOT NULL
        GROUP BY branch_name
        HAVING rollbacks > 0
        ORDER BY rollback_rate_pct DESC LIMIT 10
      `).all();

      const qaRiskProjects = db.prepare(`
        SELECT project_name,
               COUNT(*) as runs,
               SUM(CASE WHEN qa_grade='FAIL' THEN 1 ELSE 0 END) as failures,
               AVG(regression_score) as avg_regression,
               ROUND(SUM(CASE WHEN qa_grade='FAIL' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as fail_rate_pct
        FROM qa_runs
        WHERE completed_at IS NOT NULL AND project_name IS NOT NULL
        GROUP BY project_name
        HAVING failures > 0
        ORDER BY fail_rate_pct DESC LIMIT 10
      `).all();

      const flakyTests = db.prepare(`
        SELECT repeated_issue_key, COUNT(*) as occurrences, AVG(regression_score) as avg_regression
        FROM qa_runs
        WHERE repeated_issue_key IS NOT NULL AND completed_at IS NOT NULL
        GROUP BY repeated_issue_key
        ORDER BY occurrences DESC LIMIT 20
      `).all();

      // Compute overall risk score 0–100
      const patchStats = db.prepare(
        "SELECT COUNT(*) as t, SUM(CASE WHEN status IN ('rolled_back','failed') THEN 1 ELSE 0 END) as b FROM patch_ledger"
      ).get();
      const qaStats = db.prepare(
        "SELECT COUNT(*) as t, SUM(CASE WHEN qa_grade='FAIL' THEN 1 ELSE 0 END) as f FROM qa_runs WHERE completed_at IS NOT NULL"
      ).get();
      const rollbackRate = patchStats.t > 0 ? patchStats.b / patchStats.t : 0;
      const failRate     = qaStats.t    > 0 ? qaStats.f    / qaStats.t    : 0;
      const riskScore    = Math.round((rollbackRate * 0.5 + failRate * 0.5) * 100);

      res.json({
        riskScore,
        riskLevel: riskScore > 40 ? 'HIGH' : riskScore > 20 ? 'MEDIUM' : 'LOW',
        highRiskPatches,
        rollbackHotspots,
        qaRiskProjects,
        flakyTests,
        timestamp: new Date().toISOString(),
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}
