import type { OssCategory, OssDashboard, OssLifecycleStatus, OssRisk } from './types';
import { getOssProjects } from './oss-registry';
import { buildOssScorecard } from './oss-scorecard';

const categories: OssCategory[] = ['Engineering', 'Operator', 'Finance', 'Marketing', 'IT', 'Creative'];
const statuses: OssLifecycleStatus[] = ['Discovery', 'Audit', 'ROI', 'Architecture Review', 'Pilot', 'Production', 'Maintenance', 'Retirement'];
const risks: OssRisk[] = ['low', 'medium', 'high', 'unknown'];

export function buildOssDashboard(): OssDashboard {
  const projects = getOssProjects();
  const scorecard = buildOssScorecard();
  return {
    totalProjects: projects.length,
    byCategory: Object.fromEntries(categories.map((c) => [c, projects.filter((p) => p.category === c).length])) as Record<OssCategory, number>,
    byStatus: Object.fromEntries(statuses.map((s) => [s, projects.filter((p) => p.status === s).length])) as Record<OssLifecycleStatus, number>,
    riskSummary: Object.fromEntries(risks.map((r) => [r, projects.filter((p) => p.risk === r).length])) as Record<OssRisk, number>,
    pilotCandidates: scorecard.filter((s) => s.recommendation === 'PILOT').slice(0, 10),
    productionCandidates: scorecard.filter((s) => s.recommendation === 'ADOPT').slice(0, 10),
    blockedProjects: projects
      .filter((p) => p.license === 'UNVERIFIED' && ['Pilot', 'Production'].includes(p.status))
      .map((p) => ({ project_id: p.project_id, reason: 'License is unverified.' })),
  };
}

export const OSS_DASHBOARD_STATUS = 'OSS_DASHBOARD_OPERATIONAL';
