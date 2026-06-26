/**
 * Phase 4A - Marketing Intelligence Types
 */

export type MarketingIntelligenceStatus = 'PARTIAL' | 'OPERATIONAL';

export interface ChannelHealth {
  channel: string;
  status: 'ready' | 'configured' | 'missing_credentials' | 'needs_config' | 'inactive';
  usableForPlanning: boolean;
  usableForPublishing: boolean;
}

export interface MarketingOpportunity {
  opportunity_id: string;
  brand_id: string;
  title: string;
  score: number;
  reason: string;
  requiredEvidence: string[];
  approvalRequired: boolean;
}

export interface CampaignRecommendation {
  campaign_id: string;
  brand_id: string;
  recommendation: string;
  priority: 'low' | 'medium' | 'high';
  canLaunchNow: boolean;
  blockers: string[];
}

export interface MarketingIntelligenceAnswer {
  answered: boolean;
  question: string;
  answer: string;
  warnings: string[];
  noFakeMetrics: boolean;
}

export interface MarketingIntelligenceDashboard {
  status: MarketingIntelligenceStatus;
  channelHealth: Record<string, ChannelHealth[]>;
  opportunities: MarketingOpportunity[];
  recommendations: CampaignRecommendation[];
  answers: MarketingIntelligenceAnswer[];
  blockers: string[];
}
