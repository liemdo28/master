import { createRegisteredObjective } from '../executive-coordination/objective-registry';
import { createTask, addEvidence } from '../executive-coordination/task-registry';
import { buildChannelHealth } from './channel-health';
import { buildMarketingOpportunities } from './opportunity-engine';
import { buildCampaignRecommendations } from './recommendation-engine';
import { answerMarketingIntelligenceQuestion } from './question-engine';
import type { MarketingIntelligenceDashboard } from './types';

export { buildChannelHealth } from './channel-health';
export { buildMarketingOpportunities } from './opportunity-engine';
export { buildCampaignRecommendations } from './recommendation-engine';
export { answerMarketingIntelligenceQuestion } from './question-engine';
export type * from './types';

export function buildMarketingIntelligenceDashboard(): MarketingIntelligenceDashboard {
  const channelHealth = buildChannelHealth();
  const opportunities = buildMarketingOpportunities();
  const recommendations = buildCampaignRecommendations();
  const blockers = Array.from(new Set(recommendations.flatMap((r) => r.blockers)));
  const answers = [
    answerMarketingIntelligenceQuestion('What is the top marketing opportunity?', opportunities, recommendations),
    answerMarketingIntelligenceQuestion('Can we launch campaigns now?', opportunities, recommendations),
  ];
  return {
    status: blockers.length ? 'PARTIAL' : 'OPERATIONAL',
    channelHealth,
    opportunities,
    recommendations,
    answers,
    blockers,
  };
}

export function runMarketingIntelligenceBootstrap() {
  const objective = createRegisteredObjective('Phase 4A Marketing Intelligence', 'ceo');
  const task = createTask({
    objectiveId: objective.id,
    title: 'Create Marketing Intelligence Engines',
    description: 'Channel health, opportunity scoring, campaign recommendations, and marketing intelligence questions.',
    division: 'marketing',
    owner: 'marketing-intelligence',
    approvalRequired: 'none',
  });
  const dashboard = buildMarketingIntelligenceDashboard();
  addEvidence(task.id, {
    type: 'api-output',
    url: `marketing-intelligence:opportunities:${dashboard.opportunities.length};recommendations:${dashboard.recommendations.length};status:${dashboard.status}`,
    capturedAt: new Date().toISOString(),
  });
  return { objective, task, dashboard };
}
