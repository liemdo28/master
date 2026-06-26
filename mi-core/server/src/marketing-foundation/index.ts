import { createRegisteredObjective } from '../executive-coordination/objective-registry';
import { createTask, addEvidence } from '../executive-coordination/task-registry';
import { getBrandProfiles } from './brand-intelligence';
import { buildCampaignPlans } from './campaign-intelligence';
import { listContentAssets } from './content-factory';
import { answerMarketingQuestion } from './marketing-question-engine';
import type { MarketingFoundationDashboard } from './types';

export { getBrandProfiles, getActiveBrandProfiles } from './brand-intelligence';
export { buildCampaignPlans } from './campaign-intelligence';
export { listContentAssets } from './content-factory';
export { answerMarketingQuestion } from './marketing-question-engine';
export type * from './types';

export function buildMarketingFoundationDashboard(): MarketingFoundationDashboard {
  const brands = getBrandProfiles();
  const campaigns = buildCampaignPlans(brands);
  const contentAssets = listContentAssets();
  const sourceWarnings = [
    ...brands.flatMap((brand) => brand.missingConnectors.map((connector) => `${brand.name}: ${connector} not ready`)),
    ...campaigns.flatMap((campaign) => campaign.blockers.map((blocker) => `${campaign.title}: ${blocker}`)),
  ];
  const questionExamples = [
    answerMarketingQuestion('Which brands are active?', brands, campaigns, contentAssets),
    answerMarketingQuestion('What campaigns are ready?', brands, campaigns, contentAssets),
    answerMarketingQuestion('How many SEO content drafts exist?', brands, campaigns, contentAssets),
  ];
  return {
    brands,
    campaigns,
    contentAssets,
    questionExamples,
    sourceWarnings,
    status: sourceWarnings.length === 0 ? 'OPERATIONAL' : 'PARTIAL',
  };
}

export function runMarketingFoundationBootstrap() {
  const objective = createRegisteredObjective('Phase 4 Marketing Foundation', 'ceo');
  const task = createTask({
    objectiveId: objective.id,
    title: 'Create Marketing Foundation Engines',
    description: 'Brand Intelligence, Campaign Intelligence, Content Factory, and Marketing Questions.',
    division: 'marketing',
    owner: 'marketing-foundation',
    approvalRequired: 'none',
  });
  const dashboard = buildMarketingFoundationDashboard();
  addEvidence(task.id, {
    type: 'api-output',
    url: `marketing-foundation:brands:${dashboard.brands.length};campaigns:${dashboard.campaigns.length};content:${dashboard.contentAssets.length};status:${dashboard.status}`,
    capturedAt: new Date().toISOString(),
  });
  return { objective, task, dashboard };
}
