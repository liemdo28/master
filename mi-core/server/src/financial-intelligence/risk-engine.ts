import type { FinanceRisk, FinanceSourceHealth, RevenueSummary } from './types';

export function evaluateFinanceRisk(sourceHealth: FinanceSourceHealth, summary: RevenueSummary): FinanceRisk {
  const reasons: string[] = [];
  if (sourceHealth.status !== 'healthy') reasons.push(`Finance source is ${sourceHealth.status}.`);
  if (!sourceHealth.certified) reasons.push('QuickBooks source is not certified.');
  if (sourceHealth.freshnessMinutes !== null && sourceHealth.freshnessMinutes > 1440) reasons.push('QuickBooks sync is older than 24 hours.');
  if (summary.totalRevenue <= 0) reasons.push('Revenue summary has no positive revenue.');
  if (sourceHealth.gaps.length > 0) reasons.push(...sourceHealth.gaps.slice(0, 3));

  const level = reasons.some((r) => /missing|not certified|older than 24|needs|stale/i.test(r)) ? 'high'
    : reasons.length > 0 ? 'medium'
      : 'low';

  return {
    level,
    reasons,
    actionRequired: level !== 'low',
  };
}
