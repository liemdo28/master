import { createRegisteredObjective } from '../executive-coordination/objective-registry';
import { createTask, addEvidence } from '../executive-coordination/task-registry';
import { seedOssRegistry, OSS_REGISTRY_STATUS } from './oss-registry';
import { buildOssScorecard, OSS_SCORECARD_STATUS } from './oss-scorecard';
import { buildOssDashboard, OSS_DASHBOARD_STATUS } from './oss-dashboard';
import { advanceOssLifecycle, OSS_LIFECYCLE_STATUS } from './oss-lifecycle-engine';

export { seedOssRegistry, saveOssProject, getOssProject, getOssProjects, addOssEvidence, OSS_REGISTRY_STATUS } from './oss-registry';
export { buildOssScorecard, scoreOssProject, OSS_SCORECARD_STATUS } from './oss-scorecard';
export { advanceOssLifecycle, getNextLifecycleStatus, OSS_LIFECYCLE_STATUS } from './oss-lifecycle-engine';
export { buildOssDashboard, OSS_DASHBOARD_STATUS } from './oss-dashboard';
export type * from './types';

export function runOpenSourceGovernanceBootstrap() {
  const objective = createRegisteredObjective('Phase 0.5 Open Source Governance', 'ceo');
  const task = createTask({
    objectiveId: objective.id,
    title: 'Create OSS Registry, Scorecard, Lifecycle Engine, and Dashboard',
    description: 'Govern open source projects as company resources through Executive Coordination.',
    division: 'engineering',
    owner: 'open-source-governance',
    approvalRequired: 'none',
  });

  const registry = seedOssRegistry();
  const scorecard = buildOssScorecard();
  const dashboard = buildOssDashboard();
  addEvidence(task.id, {
    type: 'api-output',
    url: `oss-governance:${registry.length}:projects;scorecard:${scorecard.length};dashboard:${dashboard.totalProjects}`,
    capturedAt: new Date().toISOString(),
  });

  return {
    objective,
    task,
    statuses: {
      registry: OSS_REGISTRY_STATUS,
      scorecard: OSS_SCORECARD_STATUS,
      lifecycle: OSS_LIFECYCLE_STATUS,
      dashboard: OSS_DASHBOARD_STATUS,
    },
    registry,
    scorecard,
    dashboard,
    lifecycleProbe: advanceOssLifecycle('OSS-playwright'),
  };
}
