import type { OssProject, OssRisk, OssScore } from './types';
import { getOssProjects } from './oss-registry';

const riskPenalty: Record<OssRisk, number> = {
  low: 0,
  medium: 12,
  high: 28,
  unknown: 35,
};

const maintenancePenalty: Record<OssProject['maintenance_cost'], number> = {
  low: 0,
  medium: 8,
  high: 18,
  unknown: 22,
};

function recommendation(project: OssProject, score: number): OssScore['recommendation'] {
  if (project.status === 'Retirement') return 'RETIRE';
  if (project.status === 'Production' || project.status === 'Maintenance') return 'ADOPT';
  if (score >= 80 && project.license !== 'UNVERIFIED') return 'PILOT';
  if (score >= 60) return 'AUDIT';
  return 'WATCH';
}

export function scoreOssProject(project: OssProject): OssScore {
  const score = Math.max(0, Math.min(100, project.roi - riskPenalty[project.risk] - maintenancePenalty[project.maintenance_cost]));
  return {
    project_id: project.project_id,
    name: project.name,
    category: project.category,
    roi: project.roi,
    risk: project.risk,
    maintenance_cost: project.maintenance_cost,
    score,
    recommendation: recommendation(project, score),
  };
}

export function buildOssScorecard(): OssScore[] {
  return getOssProjects().map(scoreOssProject).sort((a, b) => b.score - a.score);
}

export const OSS_SCORECARD_STATUS = 'OSS_SCORECARD_OPERATIONAL';
