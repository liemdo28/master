/**
 * Phase 7C — project identity resolution (directive §7). Every project-
 * scoped request must resolve project identity explicitly: exact project
 * when supplied, deterministic disambiguation when safe, UNKNOWN/
 * clarification when ambiguous. Cross-project leakage target: 0.
 */
import type { ProjectRegistryService } from '../project-registry/service';

export type ProjectResolution =
  | { status: 'RESOLVED'; projectId: string }
  | { status: 'AMBIGUOUS'; candidateIds: string[] }
  | { status: 'UNKNOWN' }
  | { status: 'NOT_APPLICABLE' };

/**
 * Resolves project scope for a request. Never guesses: an explicit
 * `projectId` is verified against the registry (not merely trusted), and a
 * project name mentioned in free text is only ever resolved to a project
 * when exactly one registered project's display name appears as a whole,
 * case-insensitive match — anything less exact returns AMBIGUOUS or UNKNOWN
 * rather than picking a "closest" project.
 */
export function resolveProject(
  service: ProjectRegistryService,
  explicitProjectId: string | null | undefined,
  rawText: string,
  requiresProject: boolean,
): ProjectResolution {
  if (!requiresProject) return { status: 'NOT_APPLICABLE' };

  if (explicitProjectId) {
    const project = service.getProject(explicitProjectId);
    return project ? { status: 'RESOLVED', projectId: project.id } : { status: 'UNKNOWN' };
  }

  const projects = service.listProjects();
  const lowerText = rawText.toLowerCase();
  const matches = projects.filter(p => {
    const name = p.displayName?.toLowerCase();
    return name && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lowerText);
  });

  if (matches.length === 1) return { status: 'RESOLVED', projectId: matches[0].id };
  if (matches.length > 1) return { status: 'AMBIGUOUS', candidateIds: matches.map(p => p.id) };
  return { status: 'UNKNOWN' };
}
