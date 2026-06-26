import { createRegisteredObjective } from '../executive-coordination/objective-registry';
import { createTask as createCoordinatedTask, addEvidence as addCoordinationEvidence } from '../executive-coordination/task-registry';
import { classifyEngineeringTask } from './classifier';
import { routeModel } from './model-router';
import { evaluateApprovalRequirement } from './approval-gate';
import { createEngineeringTask, saveEngineeringTask } from './engineering-queue';
import { dispatchToProvider } from './provider-layer';
import { evidenceFromProvider, evidenceFromTests } from './evidence-engine';
import { reviewOutput } from './review-engine';
import { noTestsExecuted } from './test-orchestrator';
import { generatePrDraft } from './pr-generator';
import type { EngineeringTask } from './types';

export { getModelRegistry, getModelProfile, MODEL_REGISTRY_STATUS } from './model-registry';
export { classifyEngineeringTask } from './classifier';
export { routeModel } from './model-router';
export { createEngineeringTask, getEngineeringTask, getEngineeringTasks, updateEngineeringTaskStatus } from './engineering-queue';
export { registerProvider, dispatchToProvider, getRegisteredProviders } from './provider-layer';
export { checkLocalProviderAvailability, buildPatchPrompt, runLocalProviderPatchRequest } from './provider-executor-adapter';
export { reviewOutput } from './review-engine';
export { runTestCommand, noTestsExecuted } from './test-orchestrator';
export { createEvidence, hasRequiredCloseEvidence } from './evidence-engine';
export { generatePrDraft } from './pr-generator';
export { evaluateApprovalRequirement, canMerge } from './approval-gate';
export { buildEngineeringDashboard } from './engineering-dashboard';
export { modelScorecard, MODEL_SCORECARD } from './benchmark-system';
export type * from './types';

export function runEngineeringIntake(title: string, description = title): EngineeringTask {
  const objective = createRegisteredObjective(title, 'ceo');
  const classification = classifyEngineeringTask(description);
  const selection = routeModel(classification, title);
  const approval = evaluateApprovalRequirement(`${title} ${description}`);
  const coordinationTask = createCoordinatedTask({
    objectiveId: objective.id,
    title,
    description,
    division: 'engineering',
    owner: 'engineering-division',
    approvalRequired: approval.required ? 'merge' : 'none',
  });

  const task = createEngineeringTask({
    objective_id: objective.id,
    owner: 'engineering-division',
    model: selection.selected_model,
    status: 'PENDING',
    evidence: [],
    approval,
    repo: classification.repo,
    branch: null,
    PR: null,
    title,
    description,
    classification,
    providerResult: null,
    review: null,
    tests: null,
    prDraft: null,
  });

  addCoordinationEvidence(coordinationTask.id, {
    type: 'api-output',
    url: `engineering-task:${task.task_id};model:${selection.selected_model};confidence:${selection.confidence}`,
    capturedAt: new Date().toISOString(),
  });

  return task;
}

export function runEngineeringCertificationFlow(title: string): EngineeringTask {
  const task = runEngineeringIntake(title, title);
  task.status = 'DISPATCHED';
  saveEngineeringTask(task);

  const providerResult = dispatchToProvider(task);
  task.providerResult = providerResult;
  task.evidence.push(...evidenceFromProvider(providerResult));
  task.status = providerResult.status === 'executed' ? 'REVIEW' : 'FAILED';

  task.review = reviewOutput(task, providerResult);
  task.tests = noTestsExecuted('No real provider code execution produced a testable branch.');
  task.evidence.push(evidenceFromTests(task.tests));
  task.prDraft = generatePrDraft(task);
  task.branch = providerResult.branch || null;
  task.PR = providerResult.pr || null;

  if (task.prDraft.status === 'PR_READY') {
    task.status = task.approval.required ? 'APPROVAL_REQUIRED' : 'PR_READY';
  } else {
    task.status = 'FAILED';
  }

  return saveEngineeringTask(task);
}
