import type { CampaignRecommendation, MarketingIntelligenceAnswer, MarketingOpportunity } from './types';

function normalize(input: string) {
  return input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

export function answerMarketingIntelligenceQuestion(
  question: string,
  opportunities: MarketingOpportunity[],
  recommendations: CampaignRecommendation[],
): MarketingIntelligenceAnswer {
  const q = normalize(question);
  const blockers = Array.from(new Set(recommendations.flatMap((r) => r.blockers)));
  if (/opportun|co hoi|uu tien|priority/.test(q)) {
    const top = opportunities[0];
    return {
      answered: true,
      question,
      answer: top ? `Top marketing opportunity is ${top.title} with score ${top.score}.` : 'No marketing opportunity is available.',
      warnings: blockers,
      noFakeMetrics: true,
    };
  }
  if (/launch|publish|dang|campaign|chien dich/.test(q)) {
    const launchable = recommendations.filter((r) => r.canLaunchNow);
    return {
      answered: true,
      question,
      answer: `${launchable.length} campaign(s) can launch now. Approval and connector blockers prevent automatic launch.`,
      warnings: blockers,
      noFakeMetrics: true,
    };
  }
  return {
    answered: false,
    question,
    answer: 'Marketing Intelligence can answer opportunity and campaign-launch readiness questions. It does not invent ad, GA4, or GSC metrics.',
    warnings: blockers,
    noFakeMetrics: true,
  };
}
