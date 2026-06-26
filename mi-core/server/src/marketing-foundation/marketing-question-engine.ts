import type { BrandProfile, CampaignPlan, ContentAsset, MarketingQuestionAnswer } from './types';

function normalize(input: string) {
  return input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

export function answerMarketingQuestion(
  question: string,
  brands: BrandProfile[],
  campaigns: CampaignPlan[],
  assets: ContentAsset[],
): MarketingQuestionAnswer {
  const q = normalize(question);
  const warnings = [
    ...brands.flatMap((brand) => brand.missingConnectors.map((connector) => `${brand.name}: ${connector} not ready`)),
  ];
  if (/brand|thuong hieu|connect|connector/.test(q)) {
    const active = brands.filter((brand) => brand.status === 'active');
    return {
      answered: true,
      question,
      answer: `${active.length} active marketing brands: ${active.map((brand) => brand.name).join(', ')}.`,
      source: 'SEO/shared/config/brands.json',
      warnings,
      noFakeMetrics: true,
    };
  }
  if (/campaign|chien dich|marketing/.test(q)) {
    return {
      answered: true,
      question,
      answer: `${campaigns.length} campaign plan(s) generated. ${campaigns.filter((c) => c.publishReady).length} are publish-ready; approval is required before launch.`,
      source: 'marketing-foundation/campaign-intelligence',
      warnings: campaigns.flatMap((c) => c.blockers),
      noFakeMetrics: true,
    };
  }
  if (/content|seo|bai viet|post/.test(q)) {
    return {
      answered: true,
      question,
      answer: `${assets.length} SEO draft asset(s) found locally. Drafts are not marked publish-ready without approval.`,
      source: '.local-agent-global/seo-drafts',
      warnings,
      noFakeMetrics: true,
    };
  }
  return {
    answered: false,
    question,
    answer: 'Marketing Foundation can answer brand, campaign, and content inventory questions. It does not fabricate live ad or analytics metrics.',
    source: 'marketing-foundation',
    warnings,
    noFakeMetrics: true,
  };
}
