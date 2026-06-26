import { getEngineeringTasks } from './engineering-queue';
import { getModelRegistry } from './model-registry';
import type { CodingProvider, EngineeringDashboardSnapshot, EngineeringTaskStatus } from './types';

const PROVIDERS: CodingProvider[] = ['qwen', 'deepseek', 'claude', 'gpt', 'kimi', 'human'];
const STATUSES: EngineeringTaskStatus[] = ['PENDING', 'DISPATCHED', 'EXECUTING', 'REVIEW', 'TESTING', 'PR_READY', 'APPROVAL_REQUIRED', 'DONE', 'FAILED'];

export function buildEngineeringDashboard(): EngineeringDashboardSnapshot {
  const tasks = getEngineeringTasks();
  const assignedModels = Object.fromEntries(PROVIDERS.map((p) => [p, tasks.filter((t) => t.model === p).length])) as Record<CodingProvider, number>;
  const queueStatus = Object.fromEntries(STATUSES.map((s) => [s, tasks.filter((t) => t.status === s).length])) as Record<EngineeringTaskStatus, number>;
  const registry = getModelRegistry();
  const cost = Object.fromEntries(PROVIDERS.map((p) => [p, registry.find((m) => m.provider === p)?.cost || 'medium'])) as Record<CodingProvider, 'low' | 'medium' | 'high' | 'human'>;
  const successRate = Object.fromEntries(PROVIDERS.map((p) => {
    const owned = tasks.filter((t) => t.model === p);
    const successful = owned.filter((t) => t.status === 'DONE' || t.status === 'PR_READY').length;
    return [p, owned.length ? Math.round((successful / owned.length) * 100) : 0];
  })) as Record<CodingProvider, number>;

  return {
    activeTasks: tasks.filter((t) => !['DONE', 'FAILED'].includes(t.status)).length,
    assignedModels,
    queueStatus,
    reviewScores: tasks.filter((t) => t.review).map((t) => ({ task_id: t.task_id, score: t.review!.score })),
    testStatus: tasks.filter((t) => t.tests).map((t) => ({ task_id: t.task_id, passed: t.tests!.passed, failed: t.tests!.failed, executed: t.tests!.executed })),
    prStatus: tasks.map((t) => ({ task_id: t.task_id, status: t.prDraft?.status || 'NO_PR_DRAFT', pr: t.PR })),
    approvals: tasks.map((t) => ({ task_id: t.task_id, required: t.approval.required, reasons: t.approval.reasons })),
    failures: tasks.filter((t) => t.status === 'FAILED').map((t) => t.task_id),
    cost,
    successRate,
  };
}
