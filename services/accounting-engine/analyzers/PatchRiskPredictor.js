// analyzers/PatchRiskPredictor.js - Predict risk for proposed patches before apply
export function scorePatchRisk(db, patchProposal) {
  const {
    affected_modules = [],
    deployment_target = 'local',
    risk_level = 'low',
    branch_name = null,
    files_changed = [],
  } = patchProposal;

  let score = 0;
  const signals = [];

  // Base risk from declared risk_level
  const baseRisk = { low: 10, medium: 30, high: 60 }[risk_level] ?? 20;
  score += baseRisk;
  signals.push({ factor: 'declared_risk', contribution: baseRisk, value: risk_level });

  // Module historical failure rate
  for (const mod of affected_modules) {
    const mStats = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status IN ('failed','rolled_back') THEN 1 ELSE 0 END) as bad
      FROM patch_ledger WHERE affected_modules LIKE ?
    `).get(`%${mod}%`);
    if (mStats.total > 0) {
      const failRate  = mStats.bad / mStats.total;
      const contrib   = Math.round(failRate * 20);
      score += contrib;
      if (contrib > 0) signals.push({ factor: `module_history:${mod}`, contribution: contrib, failRate });
    }
  }

  // Branch rollback rate
  if (branch_name) {
    const branchStats = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status='rolled_back' THEN 1 ELSE 0 END) as rollbacks
      FROM patch_ledger WHERE branch_name = ?
    `).get(branch_name);
    if (branchStats.total > 0) {
      const rate   = branchStats.rollbacks / branchStats.total;
      const contrib = Math.round(rate * 15);
      score += contrib;
      if (contrib > 0) signals.push({ factor: `branch_history:${branch_name}`, contribution: contrib, rollbackRate: rate });
    }
  }

  // Deployment target multiplier
  if (deployment_target === 'staging')    { score = Math.round(score * 1.2); signals.push({ factor: 'staging_target', contribution: 'x1.2' }); }
  if (deployment_target === 'production') { score = Math.round(score * 1.5); signals.push({ factor: 'production_target', contribution: 'x1.5' }); }

  // Files changed count signal
  if (files_changed.length > 10) {
    const contrib = Math.min(20, files_changed.length);
    score += contrib;
    signals.push({ factor: 'large_changeset', contribution: contrib, files: files_changed.length });
  }

  score = Math.min(100, score);
  return {
    risk_score:  score,
    risk_level:  score > 60 ? 'HIGH' : score > 30 ? 'MEDIUM' : 'LOW',
    signals,
    recommendation: score > 60 ? 'REVIEW_REQUIRED' : score > 30 ? 'PROCEED_WITH_CAUTION' : 'SAFE_TO_APPLY',
  };
}

export function getHighRiskPatches(db, limit = 20) {
  return db.prepare(`
    SELECT patch_id, task, risk_level, status, branch_name, affected_modules,
           deployment_target, created_at
    FROM patch_ledger
    WHERE risk_level = 'high' OR status IN ('rolled_back', 'failed')
    ORDER BY created_at DESC LIMIT ?
  `).all(limit).map((r) => ({
    ...r,
    affected_modules: (() => { try { return JSON.parse(r.affected_modules); } catch { return []; } })(),
  }));
}
