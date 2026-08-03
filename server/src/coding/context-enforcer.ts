import * as path from 'path';
import { ProjectRegistryService } from '../project-registry/service';
import type { CodingContext } from './types';
import { git } from './git';

export async function enforceCodingContext(input: {
  service: ProjectRegistryService;
  projectId: string;
  contextPackId?: string | null;
  mapVersion?: string | null;
  baseCommit?: string | null;
}): Promise<CodingContext> {
  const project = input.service.getProject(input.projectId);
  if (!project) throw new Error(`project not found: ${input.projectId}`);
  if (project.status !== 'ACTIVE') throw new Error(`project ${project.id} is not ACTIVE`);

  const mapStatus = input.service.getMapStatus(project.id);
  if (mapStatus.mapStatus !== 'FRESH' || !mapStatus.mapVersion) {
    throw new Error(`project ${project.id} requires a fresh map before coding`);
  }
  if (input.mapVersion && input.mapVersion !== mapStatus.mapVersion) {
    throw new Error('requested mapVersion does not match active project map');
  }

  const contextPackId = input.contextPackId;
  if (!contextPackId) throw new Error('contextPackId is required for coding tasks');
  const contextPack = input.service.getContextPack(project.id, contextPackId);
  if (!contextPack) throw new Error('context pack not found for project');
  if (contextPack.mapVersion !== mapStatus.mapVersion) throw new Error('context pack mapVersion is not current');
  if (contextPack.mapStatus !== 'FRESH' || contextPack.policy === 'REMAP_REQUIRED') {
    throw new Error('context pack is not usable for coding');
  }

  const root = path.resolve(project.canonicalRoot);
  const baseCommit = input.baseCommit || await git(root, ['rev-parse', 'HEAD']);
  if (mapStatus.sourceSha && mapStatus.sourceSha !== baseCommit) {
    throw new Error('active project map source SHA does not match the requested base commit');
  }
  const baseBranch = project.defaultBranch || await git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return { project, contextPack, baseCommit, baseBranch };
}
