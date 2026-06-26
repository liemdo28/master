import { buildCampaignPlans } from '../marketing-foundation/campaign-intelligence';
import { getBrandProfiles } from '../marketing-foundation/brand-intelligence';
import type { CampaignRecommendation } from './types';

export function buildCampaignRecommendations(): CampaignRecommendation[] {
  const brands = getBrandProfiles();
  const campaigns = buildCampaignPlans(brands);
  return campaigns.map((campaign) => ({
    campaign_id: campaign.campaign_id,
    brand_id: campaign.brand_id,
    recommendation: campaign.blockers.length
      ? `Prepare ${campaign.title}, but do not launch until blockers clear.`
      : `Launch ${campaign.title} after approval.`,
    priority: campaign.blockers.length ? 'medium' : 'high',
    canLaunchNow: campaign.publishReady && campaign.approvalRequired === false,
    blockers: campaign.approvalRequired ? [...campaign.blockers, 'approval required'] : campaign.blockers,
  }));
}
