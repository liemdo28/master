/**
 * PLANNING — directive §16. Reuses the canonical Phase 5H
 * GovernedOrchestrationService exclusively; never a second planner (no
 * "JarvisPlannerV2" — see PHASE7C_COMPONENT_AUDIT.md §4 for the 6 existing
 * duplicate planners this must not become a 7th of).
 *
 * This handler is deliberately advisory/read-only: it surfaces existing
 * plans relevant to the project rather than fabricating a new structured
 * multi-step plan from unstructured free text (translating free text into
 * governed ActionPlanStepInput[] safely is out of scope for this phase —
 * plan creation with real steps remains a Command Center / API-key
 * operation against personal-os/orchestration/router.ts directly).
 */
import { orchestration } from '../services';
import type { JarvisResponse } from '../types';
import { baseResponse } from '../response';

export function handlePlanning(requestId: string, projectId: string | null): JarvisResponse {
  const response = baseResponse(requestId, 'PLANNING', projectId);
  const plans = orchestration.list().filter(p => !projectId || p.projectId === projectId);
  const active = plans.filter(p => p.status === 'RUNNING' || p.status === 'READY' || p.status === 'WAITING_APPROVAL');

  response.answer = active.length > 0
    ? [`${active.length} active plan(s):`, ...active.slice(0, 10).map(p => `- [${p.status}] ${p.title}`)].join('\n')
    : 'No active governed plan for this scope yet. Creating a new structured plan with real steps requires the Command Center Plans page or the orchestration API directly — the Gateway does not fabricate plan steps from free text.';
  response.suggestedNextSteps = active.length === 0
    ? ['Open Command Center → Plans to create a governed plan with explicit steps.']
    : [];
  response.evidenceRefs = active.slice(0, 10).map(p => `plan:${p.id}`);
  response.status = active.length > 0 ? 'ANSWERED' : 'NO_SUPPORTED_ANSWER';
  return response;
}
