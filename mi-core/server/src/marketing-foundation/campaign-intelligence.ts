import type { BrandProfile, CampaignPlan } from './types';

export function buildCampaignPlans(brands: BrandProfile[]): CampaignPlan[] {
  return brands
    .filter((brand) => brand.status === 'active')
    .map((brand) => {
      const blockers: string[] = [];
      if (brand.missingConnectors.includes('gbp')) blockers.push('GBP credentials missing.');
      if (brand.missingConnectors.includes('ga4')) blockers.push('GA4 property/config incomplete.');
      if (brand.missingConnectors.includes('gsc')) blockers.push('GSC credentials missing.');
      const channels = ['website', 'seo'];
      if (!brand.missingConnectors.includes('gbp')) channels.push('gbp');
      if (!brand.missingConnectors.includes('ga4')) channels.push('analytics');
      return {
        campaign_id: `MKT-${brand.brand_id}-local-seo`,
        brand_id: brand.brand_id,
        title: `${brand.name} local SEO content campaign`,
        objective: `Increase qualified discovery for ${brand.name} through search-ready content.`,
        channels,
        approvalRequired: true,
        publishReady: blockers.length === 0,
        blockers,
      };
    });
}
