import type { Division, ApprovalType } from '../executive-coordination/types';

export type CompanyOSOperationalStatus = 'MI_COMPANY_OS_OPERATIONAL' | 'MI_COMPANY_OS_PARTIAL';
export type Phase10SubsystemStatus = 'OPERATIONAL' | 'PARTIAL' | 'BLOCKED';

export interface ObjectiveTaskTemplate {
  title: string;
  description: string;
  division: Division;
  owner: string;
  approvalRequired: ApprovalType;
  dependencies?: string[];
  metric: string;
}

export interface ExecutiveObjectivePlan {
  objectiveId: string;
  objective: string;
  strategy: string;
  projects: string[];
  tasks: ObjectiveTaskTemplate[];
  divisions: Division[];
  approvalTypes: ApprovalType[];
  metrics: string[];
  truthWarnings: string[];
}

export interface ObjectiveRoutingProof {
  objectiveId: string;
  objective: string;
  taskIds: string[];
  divisionsRouted: Division[];
  evidenceStored: boolean;
  approvalsRequested: number;
  noOrphanTasks: boolean;
  metricsTracked: string[];
}

export interface CommandCenterSnapshot {
  generatedAt: string;
  status: CompanyOSOperationalStatus;
  finance: {
    revenue: string;
    labor: string;
    payroll: string;
    risk: string[];
  };
  marketing: {
    traffic: string;
    conversions: string;
    reviews: string;
    campaigns: string;
  };
  operations: {
    foodSafety: string;
    doordash: string;
    toast: string;
    quickbooks: string;
  };
  it: {
    services: string;
    ports: string;
    backups: string;
    incidents: string;
  };
  creative: {
    assets: string;
    approvals: string;
    campaignSupport: string;
  };
  truthBlockers: string[];
}

export interface CrossDivisionCoordinationReport {
  generatedAt: string;
  duplicateTasks: number;
  orphanTasks: number;
  conflictingOwners: number;
  workflowDuplicates: number;
  dependencyChains: number;
  pendingApprovals: number;
  ownerCoverage: Record<string, number>;
  healthy: boolean;
}

export interface ExecutiveReport {
  id: string;
  generatedAt: string;
  period: 'daily' | 'weekly' | 'incident';
  whatHappened: string[];
  blocked: string[];
  lateProjects: string[];
  overloadedDivisions: string[];
  revenueRisks: string[];
  unhealthySystems: string[];
  ceoFocus: string[];
  status: CompanyOSOperationalStatus;
}

export interface ExecutiveQuestionAnswer {
  question: string;
  answer: string;
  confidence: number;
  evidence: string[];
  warnings: string[];
}

export interface OssGlobalRegistry {
  generatedAt: string;
  projects: Array<{
    name: string;
    category: string;
    lifecycle: 'candidate' | 'approved' | 'pilot' | 'production' | 'blocked';
    owner: string;
    score: number;
    dependencies: string[];
  }>;
  categories: string[];
}

export type ScenarioId = 'scenario_1' | 'scenario_2' | 'scenario_3' | 'scenario_4' | 'scenario_5';

export interface ScenarioProof {
  scenarioId: ScenarioId;
  scenarioName: string;
  objective: string;
  objectiveCreated: boolean;
  tasksCreated: number;
  divisionRouted: boolean;
  evidenceStored: boolean;
  approvalRequired: boolean;
  metricsUpdated: boolean;
  executiveReportGenerated: boolean;
  passed: boolean;
  blockers: string[];
}

export interface OperationalCertification {
  status: CompanyOSOperationalStatus;
  generatedAt: string;
  scenarios: ScenarioProof[];
  passedScenarios: number;
  totalScenarios: number;
  blockers: string[];
}

export interface Phase10RuntimeStatus {
  status: CompanyOSOperationalStatus;
  generatedAt: string;
  objectiveId: string;
  bootstrapTaskId: string;
  commandCenter: CommandCenterSnapshot;
  coordination: CrossDivisionCoordinationReport;
  executiveReport: ExecutiveReport;
  ossProjectCount: number;
  certification: OperationalCertification;
  blockers: string[];
}
