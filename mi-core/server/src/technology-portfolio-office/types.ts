/**
 * Phase 0.6 - Technology Portfolio Office Types
 */

export type PortfolioTrack = 'Open Source' | 'AI Models' | 'SaaS' | 'Internal Projects';
export type PortfolioStatus = 'DISCOVERY' | 'AUDIT' | 'APPROVED' | 'PILOT' | 'PRODUCTION' | 'MAINTENANCE' | 'RETIRED';
export type PortfolioRisk = 'low' | 'medium' | 'high' | 'unknown';

export interface PortfolioItem {
  item_id: string;
  name: string;
  track: PortfolioTrack;
  owner_division: string;
  status: PortfolioStatus;
  business_value: number;
  maintenance_cost: 'low' | 'medium' | 'high' | 'unknown';
  risk: PortfolioRisk;
  source_ref: string;
  approval_required: boolean;
  evidence: PortfolioEvidence[];
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioEvidence {
  type: 'registry' | 'audit' | 'approval' | 'pilot' | 'production' | 'maintenance' | 'retirement';
  value: string;
  capturedAt: string;
}

export interface PortfolioScore {
  item_id: string;
  name: string;
  track: PortfolioTrack;
  score: number;
  recommendation: 'WATCH' | 'AUDIT' | 'APPROVE' | 'PILOT' | 'OPERATE' | 'RETIRE';
}

export interface PortfolioDashboard {
  totalItems: number;
  byTrack: Record<PortfolioTrack, number>;
  byStatus: Record<PortfolioStatus, number>;
  riskSummary: Record<PortfolioRisk, number>;
  approvalRequired: number;
  topItems: PortfolioScore[];
  blockedItems: Array<{ item_id: string; reason: string }>;
}
