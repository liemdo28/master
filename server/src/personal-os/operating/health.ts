/**
 * Project and service health — bounded, read-only snapshots.
 *
 * ServiceHealth calls SelfHeal's individual probe functions directly
 * (`checkPm2Service`/`checkHttpService`), never `startSelfHealingMonitor`'s loop, so
 * building a brief or plan can never trigger a restart. ProjectHealth is derived from
 * Task Runtime, the Phase 5D-2 conflict/staleness tables and Project Registry map
 * status — never from task success alone, per §13.
 */

import { checkHttpService, checkPm2Service, MONITORED_SERVICES, type ServiceCheck } from '../../company-os/self-healing-monitor';
import type { TaskStore } from '../../task-runtime/store';
import type { DocumentStore } from '../documents/store';
import type { ProjectRegistryService } from '../../project-registry/service';
import type { ProjectHealth, ProjectHealthStatus, ServiceHealth } from './types';

export async function computeServiceHealth(): Promise<ServiceHealth[]> {
  const results: ServiceHealth[] = [];
  for (const svc of MONITORED_SERVICES) {
    const healthy = await probeOnce(svc);
    results.push({
      service: svc.name,
      status: healthy === null ? 'UNKNOWN' : healthy ? 'HEALTHY' : 'UNHEALTHY',
      lastCheck: new Date().toISOString(),
      reason: healthy === false ? `${svc.type} probe reported unhealthy` : null,
      evidenceReference: `service:${svc.id}`,
    });
  }
  return results;
}

async function probeOnce(svc: ServiceCheck): Promise<boolean | null> {
  try {
    if (svc.type === 'pm2') return await checkPm2Service(svc);
    if (svc.type === 'http') return await checkHttpService(svc);
    return null;
  } catch {
    return null;
  }
}

export function computeProjectHealth(
  projectId: string,
  deps: { taskStore: TaskStore; documentStore: DocumentStore; registry: ProjectRegistryService | null },
): ProjectHealth {
  const reasons: string[] = [];
  const evidenceReferences: string[] = [`project:${projectId}`];

  let mapStatus = 'UNKNOWN';
  try {
    const project = deps.registry?.getProject(projectId);
    if (project) mapStatus = project.mapStatus;
  } catch { /* registry unavailable — reported via mapStatus staying UNKNOWN */ }

  const tasks = deps.taskStore.listTasks().filter(t => t.projectId === projectId);
  const failedTaskCount = tasks.filter(t => t.status === 'FAILED').length;
  const blockedTaskCount = tasks.filter(t => t.status === 'BLOCKED').length;
  const lastTask = [...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const lastTaskStatus = lastTask ? lastTask.status : null;

  let staleKnowledgeCount = 0;
  let openConflictCount = 0;
  try {
    staleKnowledgeCount = deps.documentStore.listDocuments('STALE', 500).filter(d => d.projectIds.includes(projectId)).length;
    openConflictCount = deps.documentStore.listConflicts('OPEN', 500).filter(c => c.projectIds.includes(projectId)).length
      + deps.documentStore.listConflicts('NEEDS_CONFIRMATION', 500).filter(c => c.projectIds.includes(projectId)).length;
  } catch { /* documents store unavailable in this environment */ }

  const pendingApprovalCount = tasks.filter(t => t.status === 'WAITING_APPROVAL').length;

  let status: ProjectHealthStatus;
  if (mapStatus === 'UNKNOWN' || mapStatus === 'NOT_GENERATED') {
    status = 'UNKNOWN';
    reasons.push('project map status is unknown or not generated');
  } else if (blockedTaskCount > 0 || mapStatus === 'FAILED') {
    status = 'BLOCKED';
    reasons.push(blockedTaskCount > 0 ? `${blockedTaskCount} blocked task(s)` : 'project map generation failed');
  } else if (failedTaskCount > 0 || openConflictCount > 0 || staleKnowledgeCount > 0 || mapStatus === 'STALE' || mapStatus === 'PARTIAL') {
    status = 'ATTENTION';
    if (failedTaskCount > 0) reasons.push(`${failedTaskCount} failed task(s)`);
    if (openConflictCount > 0) reasons.push(`${openConflictCount} open knowledge conflict(s)`);
    if (staleKnowledgeCount > 0) reasons.push(`${staleKnowledgeCount} stale document(s)`);
    if (mapStatus === 'STALE' || mapStatus === 'PARTIAL') reasons.push(`project map is ${mapStatus.toLowerCase()}`);
  } else {
    status = 'HEALTHY';
  }

  return {
    projectId, mapStatus, lastTaskStatus, failedTaskCount, blockedTaskCount,
    staleKnowledgeCount, openConflictCount, pendingApprovalCount, status, reasons, evidenceReferences,
  };
}
