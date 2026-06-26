/**
 * Phase 3B - Financial Intelligence Types
 */

export type FinanceSourceStatus = 'healthy' | 'degraded' | 'missing' | 'stale';
export type FinanceRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RevenueRecord {
  store: string;
  source: string;
  business_date: string;
  revenue: number;
  transactions: number;
  source_certified: boolean;
}

export interface RevenueSummary {
  totalRevenue: number;
  totalTransactions: number;
  stores: Array<{ store: string; revenue: number; transactions: number; source_certified: boolean }>;
  sourceStatus: FinanceSourceStatus;
  warnings: string[];
}

export interface StoreRanking {
  store: string;
  revenue: number;
  transactions: number;
  rank: number;
}

export interface FinanceSourceHealth {
  source: string;
  status: FinanceSourceStatus;
  certified: boolean;
  lastSuccessfulSync: string | null;
  freshnessMinutes: number | null;
  gaps: string[];
  actionRequired: boolean;
}

export interface FinanceRisk {
  level: FinanceRiskLevel;
  reasons: string[];
  actionRequired: boolean;
}

export interface FinanceQuestionAnswer {
  answered: boolean;
  question: string;
  answer: string;
  source: string;
  sourceStatus: FinanceSourceStatus;
  noMockData: boolean;
  warnings: string[];
}

export interface FinancialIntelligenceDashboard {
  sourceHealth: FinanceSourceHealth;
  revenue: RevenueSummary;
  rankings: StoreRanking[];
  risk: FinanceRisk;
  questionExamples: FinanceQuestionAnswer[];
}
