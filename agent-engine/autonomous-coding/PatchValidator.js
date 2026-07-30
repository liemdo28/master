import { classifyFileRisk, detectForbiddenAction, toAbsoluteInside } from './PatchSafetyPolicy.js';

export class PatchValidator {
  constructor({ workspaceRoot, maxFiles = 20 } = {}) {
    this.workspaceRoot = workspaceRoot;
    this.maxFiles = maxFiles;
  }

  validatePlan(plan) {
    const errors = [];
    const warnings = [];
    const approvals = [];
    const changes = Array.isArray(plan?.changes) ? plan.changes : [];

    if (!this.workspaceRoot) errors.push('workspaceRoot is required');
    if (!plan) errors.push('patch plan is required');
    if (changes.length === 0) errors.push('patch plan has no changes');
    if (changes.length > this.maxFiles) errors.push(`more than ${this.maxFiles} files modified`);

    const actionCheck = detectForbiddenAction(JSON.stringify(plan || {}));
    if (actionCheck.blocked) errors.push(`forbidden action detected: ${actionCheck.pattern}`);

    const seen = new Set();
    for (const change of changes) {
      if (!change?.filePath) {
        errors.push('change is missing filePath');
        continue;
      }

      let rel;
      try {
        ({ relative: rel } = toAbsoluteInside(this.workspaceRoot, change.filePath));
      } catch (err) {
        errors.push(err.message);
        continue;
      }

      seen.add(rel);
      const risk = classifyFileRisk(rel);
      if (risk.level === 'blocked') errors.push(`${rel}: ${risk.reason}`);
      if (risk.level === 'approval-required') approvals.push(`${rel}: ${risk.reason}`);
      if (risk.level === 'medium') warnings.push(`${rel}: ${risk.reason}`);
      if (!['replace', 'regexReplace', 'append', 'write'].includes(change.type)) {
        errors.push(`${rel}: unsupported change type ${change.type}`);
      }
    }

    return {
      ok: errors.length === 0 && approvals.length === 0,
      requiresApproval: approvals.length > 0,
      errors,
      warnings,
      approvals,
      changedFileCount: seen.size,
      risk: errors.length ? 'blocked' : approvals.length ? 'approval-required' : warnings.length ? 'medium' : 'low',
    };
  }
}
