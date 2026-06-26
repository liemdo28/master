/**
 * Mi Company OS Master Status Registry
 */

export type MasterPhaseStatus = 'READY' | 'PARTIAL' | 'BLOCKED' | 'OPERATIONAL' | 'NOT_STARTED' | 'FUTURE' | 'IN_PROGRESS';

export interface MasterPhase {
  phase: string;
  name: string;
  status: MasterPhaseStatus;
  deliverables: string[];
  evidence: string[];
  blockers: string[];
  nextActions: string[];
}

export interface MasterStatusDashboard {
  generatedAt: string;
  phases: MasterPhase[];
  summary: Record<MasterPhaseStatus, number>;
  nextBuildOrder: string[];
  finalStatus: 'MI_COMPANY_OS_PARTIAL' | 'MI_COMPANY_OS_OPERATIONAL' | 'MI_COMPANY_OS_BLOCKED';
}
