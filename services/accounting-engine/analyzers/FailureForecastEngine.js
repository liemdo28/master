// analyzers/FailureForecastEngine.js - Forecast which modules/tests are likely to fail
export function forecastFailures(db, limit = 20) {
  // Recurring failure keys with recency weighting
  const recurring = db.prepare(`
    SELECT
      repeated_issue_key,
      COUNT(*) as occurrences,
      MAX(started_at) as last_seen,
      AVG(regression_score) as avg_regression,
      AVG(fix_time_minutes) as avg_fix_minutes
    FROM qa_runs
    WHERE repeated_issue_key IS NOT NULL AND completed_at IS NOT NULL
    GROUP BY repeated_issue_key
    ORDER BY occurrences DESC, last_seen DESC
    LIMIT ?
  `).all(limit);

  const now = Date.now();
  const enriched = recurring.map((r) => {
    const daysSinceLast = (now - new Date(r.last_seen).getTime()) / 86400000;
    // recency factor: 1.0 if seen today, decays over 30 days
    const recencyFactor = Math.max(0, 1 - daysSinceLast / 30);
    const forecastScore = Math.min(100, Math.round(
      (r.occurrences * 10 + recencyFactor * 40 + (r.avg_regression ?? 0) * 50)
    ));
    return {
      ...r,
      days_since_last:  Math.round(daysSinceLast * 10) / 10,
      recency_factor:   Math.round(recencyFactor * 100) / 100,
      forecast_score:   forecastScore,
      likelihood:       forecastScore > 70 ? 'HIGH' : forecastScore > 40 ? 'MEDIUM' : 'LOW',
    };
  });

  return {
    forecasts:   enriched.sort((a, b) => b.forecast_score - a.forecast_score),
    generatedAt: new Date().toISOString(),
    totalTracked: recurring.length,
  };
}

export function getModuleRiskMap(db) {
  // Derive module risk from patch_ledger affected_modules
  const patches = db.prepare(
    "SELECT affected_modules, status FROM patch_ledger WHERE affected_modules IS NOT NULL"
  ).all();

  const moduleStats = {};
  for (const { affected_modules, status } of patches) {
    let mods;
    try { mods = JSON.parse(affected_modules); } catch { continue; }
    for (const mod of mods) {
      if (!moduleStats[mod]) moduleStats[mod] = { total: 0, failures: 0, rollbacks: 0 };
      moduleStats[mod].total++;
      if (status === 'failed')      moduleStats[mod].failures++;
      if (status === 'rolled_back') moduleStats[mod].rollbacks++;
    }
  }

  return Object.entries(moduleStats)
    .map(([module, s]) => ({
      module,
      total_patches: s.total,
      failures:      s.failures,
      rollbacks:     s.rollbacks,
      risk_score:    s.total > 0 ? Math.round(((s.failures + s.rollbacks) / s.total) * 100) : 0,
    }))
    .sort((a, b) => b.risk_score - a.risk_score);
}
