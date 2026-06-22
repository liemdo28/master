// analyzers/ProductivityAnalyzer.js - Engineering productivity intelligence
export function getProductivityReport(db, days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const patchVelocity = db.prepare(`
    SELECT
      DATE(created_at) as day,
      COUNT(*) as patches_created,
      SUM(CASE WHEN status='applied'     THEN 1 ELSE 0 END) as applied,
      SUM(CASE WHEN status='rolled_back' THEN 1 ELSE 0 END) as rolled_back,
      SUM(CASE WHEN status='failed'      THEN 1 ELSE 0 END) as failed
    FROM patch_ledger WHERE created_at > ?
    GROUP BY day ORDER BY day DESC LIMIT ?
  `).all(since, days);

  const qaVelocity = db.prepare(`
    SELECT
      DATE(started_at) as day,
      COUNT(*) as qa_runs,
      AVG(qa_score) as avg_score,
      SUM(fix_time_minutes) as total_fix_minutes,
      SUM(CASE WHEN qa_grade='PASS' THEN 1 ELSE 0 END) as passes
    FROM qa_runs WHERE started_at > ? AND completed_at IS NOT NULL
    GROUP BY day ORDER BY day DESC LIMIT ?
  `).all(since, days);

  const overallPatch = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status='applied'     THEN 1 ELSE 0 END) as applied,
      SUM(CASE WHEN status='rolled_back' THEN 1 ELSE 0 END) as rolled_back
    FROM patch_ledger WHERE created_at > ?
  `).get(since);

  const successRate = overallPatch.total > 0
    ? Math.round((overallPatch.applied / overallPatch.total) * 100)
    : 0;

  const overallQA = db.prepare(`
    SELECT AVG(qa_score) as avg_score, AVG(fix_time_minutes) as avg_fix_min,
           SUM(fix_time_minutes) as total_fix_min
    FROM qa_runs WHERE started_at > ? AND completed_at IS NOT NULL
  `).get(since);

  return {
    period_days:       days,
    patch_success_rate: successRate,
    avg_qa_score:      Math.round((overallQA.avg_score ?? 0) * 10) / 10,
    total_fix_hours:   Math.round(((overallQA.total_fix_min ?? 0) / 60) * 10) / 10,
    avg_fix_minutes:   Math.round((overallQA.avg_fix_min ?? 0) * 10) / 10,
    patch_velocity:    patchVelocity,
    qa_velocity:       qaVelocity,
    overall_patches:   overallPatch,
    timestamp:         new Date().toISOString(),
  };
}
