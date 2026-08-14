/**
 * PROJECT_QUERY — directive §15. Direct read path against the canonical
 * Project Registry; never a second project-tracking implementation.
 */
import { projectRegistry } from '../services';
import type { JarvisResponse } from '../types';
import { baseResponse } from '../response';

export function handleProjectQuery(requestId: string, projectId: string | null): JarvisResponse {
  const response = baseResponse(requestId, 'PROJECT_QUERY', projectId);

  if (projectId) {
    const project = projectRegistry.getProject(projectId);
    if (!project) {
      response.status = 'NO_SUPPORTED_ANSWER';
      response.answer = 'Project not found.';
      return response;
    }
    response.answer = `${project.displayName}: map status ${project.mapStatus}.`;
    response.facts = [{ kind: 'FACT', statement: `${project.displayName} map status is ${project.mapStatus}.` }];
    response.evidenceRefs = [`project:${project.id}`];
    return response;
  }

  const projects = projectRegistry.listProjects();
  response.answer = projects.length === 0
    ? 'No projects registered.'
    : `${projects.length} project(s): ${projects.map(p => p.displayName).join(', ')}.`;
  response.facts = projects.map(p => ({ kind: 'FACT' as const, statement: `${p.displayName} map status is ${p.mapStatus}.` }));
  return response;
}
