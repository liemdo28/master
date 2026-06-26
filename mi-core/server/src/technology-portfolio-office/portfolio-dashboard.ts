import type { PortfolioDashboard, PortfolioRisk, PortfolioStatus, PortfolioTrack } from './types';
import { getPortfolioItems } from './portfolio-registry';
import { buildPortfolioScorecard } from './portfolio-scorecard';

const tracks: PortfolioTrack[] = ['Open Source', 'AI Models', 'SaaS', 'Internal Projects'];
const statuses: PortfolioStatus[] = ['DISCOVERY', 'AUDIT', 'APPROVED', 'PILOT', 'PRODUCTION', 'MAINTENANCE', 'RETIRED'];
const risks: PortfolioRisk[] = ['low', 'medium', 'high', 'unknown'];

export function buildPortfolioDashboard(): PortfolioDashboard {
  const items = getPortfolioItems();
  const scorecard = buildPortfolioScorecard();
  return {
    totalItems: items.length,
    byTrack: Object.fromEntries(tracks.map((t) => [t, items.filter((i) => i.track === t).length])) as Record<PortfolioTrack, number>,
    byStatus: Object.fromEntries(statuses.map((s) => [s, items.filter((i) => i.status === s).length])) as Record<PortfolioStatus, number>,
    riskSummary: Object.fromEntries(risks.map((r) => [r, items.filter((i) => i.risk === r).length])) as Record<PortfolioRisk, number>,
    approvalRequired: items.filter((i) => i.approval_required).length,
    topItems: scorecard.slice(0, 8),
    blockedItems: items
      .filter((i) => i.approval_required && ['APPROVED', 'PILOT', 'PRODUCTION'].includes(i.status) && !i.evidence.some((e) => e.type === 'approval'))
      .map((i) => ({ item_id: i.item_id, reason: 'Approval-required item lacks approval evidence.' })),
  };
}

export const TECHNOLOGY_PORTFOLIO_DASHBOARD_STATUS = 'TECHNOLOGY_PORTFOLIO_DASHBOARD_OPERATIONAL';
