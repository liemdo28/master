// analyzers/RegressionPredictor.js - Predict regression risk from historical QA trends
export function predictRegressionRisk(db, projectName, lookaheadRuns = 3) {
  const history = db.prepare(`
    SELECT regression_score, qa_score, failed_tests, flaky_tests, qa_reruns, started_at
    FROM qa_runs
    WHERE project_name = ? AND completed_at IS NOT NULL
    ORDER BY started_at DESC LIMIT 20
  `).all(projectName);

  if (history.length < 3) {
    return { projectName, risk: 'UNKNOWN', confidence: 0, reason: 'Insufficient data (need ≥3 runs)' };
  }

  // Simple linear trend on regression_score
  const scores  = history.slice(0, Math.min(10, history.length)).map((r) => r.regression_score ?? 0);
  const n       = scores.length;
  const meanX   = (n - 1) / 2;
  const meanY   = scores.reduce((s, v) => s + v, 0) / n;
  let   covXY   = 0, varX = 0;
  for (let i = 0; i < n; i++) {
    covXY += (i - meanX) * (scores[i] - meanY);
    varX  += (i - meanX) ** 2;
  }
  const slope     = varX > 0 ? covXY / varX : 0;
  const projected = meanY + slope * (n + lookaheadRuns - 1 - meanX);

  const avgFlaky    = history.slice(0, 5).reduce((s, r) => s + (r.flaky_tests ?? 0), 0) / Math.min(5, history.length);
  const avgFailed   = history.slice(0, 5).reduce((s, r) => s + (r.failed_tests ?? 0), 0) / Math.min(5, history.length);
  const trend       = slope > 0.05 ? 'worsening' : slope < -0.05 ? 'improving' : 'stable';

  const riskScore   = Math.min(100, Math.max(0, Math.round(projected * 100)));
  const risk        = riskScore > 60 ? 'HIGH' : riskScore > 30 ? 'MEDIUM' : 'LOW';
  const confidence  = Math.min(95, Math.round((n / 10) * 80 + 15));

  return {
    projectName,
    risk,
    riskScore,
    confidence,
    trend,
    projectedRegressionScore: Math.round(projected * 1000) / 1000,
    avgFlakyTests:   Math.round(avgFlaky  * 10) / 10,
    avgFailedTests:  Math.round(avgFailed * 10) / 10,
    basedOnRuns:     history.length,
    reason: `Trend is ${trend} (slope=${slope.toFixed(4)}), projected score=${projected.toFixed(3)}`,
  };
}

export function predictAllProjects(db) {
  const projects = db.prepare(
    "SELECT DISTINCT project_name FROM qa_runs WHERE project_name IS NOT NULL"
  ).all().map((r) => r.project_name);
  return projects.map((p) => predictRegressionRisk(db, p));
}
