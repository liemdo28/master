/**
 * Phase 0.5 - Open Source Governance Types
 *
 * Mi recruits open source projects like employees, but no project can bypass
 * Executive Coordination, approval, or evidence.
 */

export type OssCategory = 'Engineering' | 'Operator' | 'Finance' | 'Marketing' | 'IT' | 'Creative';

export type OssLifecycleStatus =
  | 'Discovery'
  | 'Audit'
  | 'ROI'
  | 'Architecture Review'
  | 'Pilot'
  | 'Production'
  | 'Maintenance'
  | 'Retirement';

export type OssRisk = 'low' | 'medium' | 'high' | 'unknown';

export interface OssProject {
  project_id: string;
  name: string;
  category: OssCategory;
  github: string;
  owner_division: string;
  status: OssLifecycleStatus;
  roi: number;
  maintenance_cost: 'low' | 'medium' | 'high' | 'unknown';
  license: string;
  risk: OssRisk;
  evidence: OssEvidence[];
  createdAt: string;
  updatedAt: string;
}

export interface OssEvidence {
  type: 'registry' | 'audit' | 'roi' | 'architecture-review' | 'pilot' | 'production' | 'maintenance' | 'retirement';
  value: string;
  capturedAt: string;
}

export interface OssScore {
  project_id: string;
  name: string;
  category: OssCategory;
  roi: number;
  risk: OssRisk;
  maintenance_cost: OssProject['maintenance_cost'];
  score: number;
  recommendation: 'WATCH' | 'AUDIT' | 'PILOT' | 'ADOPT' | 'RETIRE';
}

export interface OssDashboard {
  totalProjects: number;
  byCategory: Record<OssCategory, number>;
  byStatus: Record<OssLifecycleStatus, number>;
  riskSummary: Record<OssRisk, number>;
  pilotCandidates: OssScore[];
  productionCandidates: OssScore[];
  blockedProjects: Array<{ project_id: string; reason: string }>;
}
