/**
 * Phase 4 - Marketing Foundation Types
 */

export type MarketingSourceStatus = 'ready' | 'configured' | 'missing_credentials' | 'needs_config' | 'inactive';

export interface BrandProfile {
  brand_id: string;
  name: string;
  domain: string;
  status: string;
  industry: string;
  cuisine?: string;
  connectorStatus: Record<string, MarketingSourceStatus>;
  missingConnectors: string[];
}

export interface CampaignPlan {
  campaign_id: string;
  brand_id: string;
  title: string;
  objective: string;
  channels: string[];
  approvalRequired: boolean;
  publishReady: boolean;
  blockers: string[];
}

export interface ContentAsset {
  asset_id: string;
  brand: string;
  topic: string;
  keywords: string[];
  path: string;
  generatedAt: string | null;
  publishReady: boolean;
}

export interface MarketingQuestionAnswer {
  answered: boolean;
  question: string;
  answer: string;
  source: string;
  warnings: string[];
  noFakeMetrics: boolean;
}

export interface MarketingFoundationDashboard {
  brands: BrandProfile[];
  campaigns: CampaignPlan[];
  contentAssets: ContentAsset[];
  questionExamples: MarketingQuestionAnswer[];
  sourceWarnings: string[];
  status: 'PARTIAL' | 'OPERATIONAL';
}
