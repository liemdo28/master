import type { PortfolioItem, PortfolioRisk, PortfolioScore } from './types';
import { getPortfolioItems } from './portfolio-registry';

const riskPenalty: Record<PortfolioRisk, number> = {
  low: 0,
  medium: 12,
  high: 30,
  unknown: 35,
};

const costPenalty: Record<PortfolioItem['maintenance_cost'], number> = {
  low: 0,
  medium: 8,
  high: 18,
  unknown: 22,
};

function recommendation(item: PortfolioItem, score: number): PortfolioScore['recommendation'] {
  if (item.status === 'RETIRED') return 'RETIRE';
  if (item.status === 'PRODUCTION' || item.status === 'MAINTENANCE') return 'OPERATE';
  if (item.status === 'PILOT') return 'PILOT';
  if (score >= 80 && !item.approval_required) return 'APPROVE';
  if (score >= 60) return 'AUDIT';
  return 'WATCH';
}

export function scorePortfolioItem(item: PortfolioItem): PortfolioScore {
  const score = Math.max(0, Math.min(100, item.business_value - riskPenalty[item.risk] - costPenalty[item.maintenance_cost]));
  return {
    item_id: item.item_id,
    name: item.name,
    track: item.track,
    score,
    recommendation: recommendation(item, score),
  };
}

export function buildPortfolioScorecard(): PortfolioScore[] {
  return getPortfolioItems().map(scorePortfolioItem).sort((a, b) => b.score - a.score);
}

export const TECHNOLOGY_PORTFOLIO_SCORECARD_STATUS = 'TECHNOLOGY_PORTFOLIO_SCORECARD_OPERATIONAL';
