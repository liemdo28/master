import type { WorkflowRisk } from './types';

const approvalRequired: Record<WorkflowRisk, boolean> = {
  READ_ONLY: false,
  SAFE_WRITE: true,
  PRODUCTION_WRITE: true,
  FINANCIAL: true,
  SECURITY: true,
};

export function requiresWorkflowApproval(risk: WorkflowRisk): boolean {
  return approvalRequired[risk];
}

export function assertWorkflowCanRun(risk: WorkflowRisk, approved: boolean): { allowed: boolean; reason: string } {
  if (!requiresWorkflowApproval(risk)) {
    return { allowed: true, reason: 'READ_ONLY workflow can run without approval.' };
  }
  if (approved) {
    return { allowed: true, reason: `${risk} workflow has approval evidence.` };
  }
  return { allowed: false, reason: `${risk} workflow requires approval before execution.` };
}
