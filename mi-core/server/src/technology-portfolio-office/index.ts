import { createRegisteredObjective } from '../executive-coordination/objective-registry';
import { createTask, addEvidence } from '../executive-coordination/task-registry';
import { seedPortfolioRegistry, TECHNOLOGY_PORTFOLIO_REGISTRY_STATUS } from './portfolio-registry';
import { buildPortfolioScorecard, TECHNOLOGY_PORTFOLIO_SCORECARD_STATUS } from './portfolio-scorecard';
import { buildPortfolioDashboard, TECHNOLOGY_PORTFOLIO_DASHBOARD_STATUS } from './portfolio-dashboard';

export { seedPortfolioRegistry, getPortfolioItems, getPortfolioItem, savePortfolioItem, addPortfolioEvidence, TECHNOLOGY_PORTFOLIO_REGISTRY_STATUS } from './portfolio-registry';
export { buildPortfolioScorecard, scorePortfolioItem, TECHNOLOGY_PORTFOLIO_SCORECARD_STATUS } from './portfolio-scorecard';
export { buildPortfolioDashboard, TECHNOLOGY_PORTFOLIO_DASHBOARD_STATUS } from './portfolio-dashboard';
export type * from './types';

export function runTechnologyPortfolioBootstrap() {
  const objective = createRegisteredObjective('Phase 0.6 Technology Portfolio Office', 'ceo');
  const task = createTask({
    objectiveId: objective.id,
    title: 'Create Technology Portfolio Office',
    description: 'Track Open Source, AI Models, SaaS, and Internal Projects under Executive Coordination.',
    division: 'engineering',
    owner: 'technology-portfolio-office',
    approvalRequired: 'none',
  });
  const registry = seedPortfolioRegistry();
  const scorecard = buildPortfolioScorecard();
  const dashboard = buildPortfolioDashboard();
  addEvidence(task.id, {
    type: 'api-output',
    url: `technology-portfolio:${registry.length}:items;scorecard:${scorecard.length};dashboard:${dashboard.totalItems}`,
    capturedAt: new Date().toISOString(),
  });
  return {
    objective,
    task,
    statuses: {
      registry: TECHNOLOGY_PORTFOLIO_REGISTRY_STATUS,
      scorecard: TECHNOLOGY_PORTFOLIO_SCORECARD_STATUS,
      dashboard: TECHNOLOGY_PORTFOLIO_DASHBOARD_STATUS,
    },
    registry,
    scorecard,
    dashboard,
  };
}
