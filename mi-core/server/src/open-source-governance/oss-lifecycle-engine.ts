import type { OssEvidence, OssLifecycleStatus } from './types';
import { addOssEvidence, getOssProject, saveOssProject } from './oss-registry';

const flow: OssLifecycleStatus[] = [
  'Discovery',
  'Audit',
  'ROI',
  'Architecture Review',
  'Pilot',
  'Production',
  'Maintenance',
  'Retirement',
];

const requiredEvidence: Partial<Record<OssLifecycleStatus, OssEvidence['type']>> = {
  Audit: 'audit',
  ROI: 'roi',
  'Architecture Review': 'architecture-review',
  Pilot: 'pilot',
  Production: 'production',
  Maintenance: 'maintenance',
  Retirement: 'retirement',
};

export function getNextLifecycleStatus(status: OssLifecycleStatus): OssLifecycleStatus | null {
  const index = flow.indexOf(status);
  if (index < 0 || index === flow.length - 1) return null;
  return flow[index + 1];
}

export function advanceOssLifecycle(projectId: string, evidence?: Omit<OssEvidence, 'capturedAt'>): { advanced: boolean; reason: string; status?: OssLifecycleStatus } {
  const project = getOssProject(projectId);
  if (!project) return { advanced: false, reason: 'Project not found.' };
  const next = getNextLifecycleStatus(project.status);
  if (!next) return { advanced: false, reason: 'Project is already at final lifecycle status.', status: project.status };

  const required = requiredEvidence[next];
  if (required && evidence?.type !== required) {
    return { advanced: false, reason: `${next} requires ${required} evidence.`, status: project.status };
  }
  if ((next === 'Pilot' || next === 'Production') && project.license === 'UNVERIFIED') {
    return { advanced: false, reason: `${next} blocked until license is audited.`, status: project.status };
  }

  project.status = next;
  saveOssProject(project);
  if (evidence) addOssEvidence(projectId, evidence);
  return { advanced: true, reason: `Advanced to ${next}.`, status: next };
}

export const OSS_LIFECYCLE_STATUS = 'OSS_LIFECYCLE_ENGINE_OPERATIONAL';
