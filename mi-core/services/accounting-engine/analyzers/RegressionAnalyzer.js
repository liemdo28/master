// analyzers/RegressionAnalyzer.js - QA regression trend detection
import { detectFlakyTests } from '../core/QAAccounting.js';

export function analyzeRegressions(db, projectName, windowRuns = 10) {
  const flaky = detectFlakyTests(db, projectName, windowRuns);

  const trend = db.prepare(`
    SELECT started_at, regression_score, qa_grade, failed_tests, total_tests
    FROM qa_runs
    WHERE project_name = ? AND completed_at IS NOT NULL
    ORDER BY started_at DESC LIMIT ?
  `).all(projectName, windowRuns);

  const avgRegression = trend.length
    ? trend.reduce((s, r) => s + (r.regression_score ?? 0), 0) / trend.length
    : 0;

  const failRate = trend.length
    ? trend.filter((r) => r.qa_grade === 'FAIL').length / trend.length
    : 0;

  return {
    projectName,
    windowRuns:     trend.length,
    avgRegressionScore: Math.round(avgRegression * 1000) / 1000,
    failRate:       Math.round(failRate * 1000) / 1000,
    flakyTests:     flaky,
    trend,
    riskLevel: avgRegression > 0.5 || failRate > 0.3 ? 'HIGH' : avgRegression > 0.2 ? 'MEDIUM' : 'LOW',
  };
}

export function getTopRegressions(db, limit = 20) {
  return db.prepare(`
    SELECT project_name, repeated_issue_key, COUNT(*) as occurrences,
           AVG(regression_score) as avg_regression
    FROM qa_runs
    WHERE repeated_issue_key IS NOT NULL AND completed_at IS NOT NULL
    GROUP BY project_name, repeated_issue_key
    ORDER BY occurrences DESC LIMIT ?
  `).all(limit);
}
