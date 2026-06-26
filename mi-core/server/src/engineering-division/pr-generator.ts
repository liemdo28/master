import type { EngineeringTask, PullRequestDraft } from './types';
import { hasRequiredCloseEvidence } from './evidence-engine';

export function generatePrDraft(task: EngineeringTask): PullRequestDraft {
  const hasPr = hasRequiredCloseEvidence(task);
  return {
    title: `${task.title}`,
    rootCause: `Engineering task classified as ${task.classification.domain}/${task.classification.framework}. Root cause must be confirmed from provider output before merge.`,
    solution: task.providerResult?.summary || 'No provider execution completed.',
    risks: task.approval.reasons.length ? task.approval.reasons : ['standard regression risk'],
    rollback: 'Revert the implementation commit or close the branch before deployment.',
    evidence: task.evidence,
    status: hasPr ? 'PR_READY' : 'BLOCKED_NO_REAL_PR',
  };
}
