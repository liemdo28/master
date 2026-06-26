import type { EngineeringTask, ProviderResult, ReviewResult } from './types';

export function reviewOutput(task: EngineeringTask, result: ProviderResult): ReviewResult {
  const checks = {
    syntax: result.filesChanged.length > 0,
    architecture: task.classification.complexity !== 'high' || result.filesChanged.length > 0,
    security: !/credential|secret|token/i.test(task.title + task.description),
    regression: Boolean(task.tests?.executed),
    performance: true,
    codingStandards: result.filesChanged.length > 0,
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const score = Math.round((passed / Object.values(checks).length) * 100);
  const findings: string[] = [];
  if (result.status !== 'executed') findings.push('Provider did not execute code changes.');
  if (!checks.regression) findings.push('Tests have not executed yet.');
  if (!checks.syntax) findings.push('No changed files available for syntax review.');

  return {
    score,
    decision: score >= 80 ? 'ACCEPT' : 'REJECT',
    checks,
    findings,
    capturedAt: new Date().toISOString(),
  };
}
