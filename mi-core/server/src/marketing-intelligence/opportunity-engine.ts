import { getActiveBrandProfiles } from '../marketing-foundation/brand-intelligence';
import { listContentAssets } from '../marketing-foundation/content-factory';
import type { MarketingOpportunity } from './types';

export function buildMarketingOpportunities(): MarketingOpportunity[] {
  const brands = getActiveBrandProfiles();
  const assets = listContentAssets(100);
  return brands.map((brand) => {
    const brandAssets = assets.filter((asset) => asset.brand.toLowerCase().includes(brand.name.split(' ')[0].toLowerCase()));
    const missingPenalty = brand.missingConnectors.length * 10;
    const contentBoost = Math.min(30, brandAssets.length);
    const score = Math.max(0, Math.min(100, 60 + contentBoost - missingPenalty));
    return {
      opportunity_id: `MKT-OPP-${brand.brand_id}-content-refresh`,
      brand_id: brand.brand_id,
      title: `${brand.name} content refresh opportunity`,
      score,
      reason: `${brandAssets.length} local SEO draft(s) available; ${brand.missingConnectors.length} connector blocker(s).`,
      requiredEvidence: ['approved content draft', 'brand connector status', 'publishing approval'],
      approvalRequired: true,
    };
  }).sort((a, b) => b.score - a.score);
}
