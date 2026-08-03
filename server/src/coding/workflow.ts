import { ProjectRegistryService } from '../project-registry/service';
import { TaskEngine } from '../task-runtime/engine';
import { TaskStore } from '../task-runtime/store';
import type { TaskRecord } from '../task-runtime/types';
import { assertPlanWithinCandidates, enforceCandidateFileLimits, selectCandidateFiles } from './candidate-selector';
import { enforceCodingContext } from './context-enforcer';
import { InternalPatchEngine } from './engines/internal-patch-engine';
import { git } from './git';
import { selectCodingModelRoles } from './model-router';
import { reviewWorktree } from './reviewer';
import type { CandidateSelection, CodingModelRoles, CodingRunResult, CodingWorkflowInput, EngineApplyResult, EnginePlan, ValidationResult } from './types';
import { buildValidationPlan, runValidationPlan } from './validation-runner';
import { prepareWorktree } from './worktree-manager';

export class CodingWorkflow {
  private adapter = new InternalPatchEngine();

  constructor(
    private taskStore = new TaskStore(),
    private registry = new ProjectRegistryService(),
    private taskEngine = new TaskEngine(taskStore)
  ) {}

  async run(input: CodingWorkflowInput): Promise<CodingRunResult> {
    const planned = await this.planTask(input);
    return this.resumeTask(planned.task.id, input.validationCommands ?? []);
  }

  async planTask(input: CodingWorkflowInput): Promise<Pick<CodingRunResult, 'task' | 'context' | 'candidates' | 'modelRoles' | 'plan'>> {
    const context = await enforceCodingContext({
      service: this.registry,
      projectId: input.projectId,
      contextPackId: input.contextPackId,
      mapVersion: input.mapVersion,
      baseCommit: input.baseCommit,
    });
    const task = this.taskEngine.createTask({
      taskKind: 'coding',
      userRequest: input.userRequest,
      projectId: context.project.id,
      mapVersion: context.contextPack.mapVersion,
      contextPackId: context.contextPack.id,
      repository: context.project.repositoryUrl,
      workingDirectory: context.project.canonicalRoot,
      baseBranch: input.baseBranch ?? context.baseBranch,
      baseCommit: context.baseCommit,
      maxRetries: input.maxRetries ?? 3,
      riskLevel: 'local-reversible',
    });
    this.event(task.id, 'coding.context.accepted', {
      projectId: context.project.id,
      mapVersion: context.contextPack.mapVersion,
      contextPackId: context.contextPack.id,
      baseCommit: context.baseCommit,
    });

    this.taskEngine.transition(task.id, 'CONTEXT_BUILDING');
    const worktree = await prepareWorktree({
      projectId: context.project.id,
      taskId: task.id,
      userRequest: input.userRequest,
      sourceRoot: context.project.canonicalRoot,
      baseBranch: input.baseBranch ?? context.baseBranch,
      baseCommit: context.baseCommit,
    });
    this.taskStore.updateCodingFields(task.id, {
      baseBranch: worktree.baseBranch,
      baseCommit: worktree.baseCommit,
      taskBranch: worktree.taskBranch,
      worktreePath: worktree.worktreePath,
      commitPolicy: input.commitPolicy ?? 'local-only',
      codingEngine: this.adapter.id,
    });
    this.event(task.id, 'coding.worktree.created', worktree);

    this.taskEngine.transition(task.id, 'PLANNING');
    const candidates = enforceCandidateFileLimits(worktree.worktreePath, selectCandidateFiles(context.contextPack, input.userRequest));
    this.taskStore.updateCodingFields(task.id, { candidateFiles: JSON.stringify(candidates) });
    this.evidence(task.id, 'coding-candidates', candidates);
    this.event(task.id, 'coding.candidates.selected', { count: candidates.candidates.length, hardLimit: candidates.hardLimit });

    const modelRoles = await selectCodingModelRoles();
    this.taskStore.updateCodingFields(task.id, {
      modelRoles: JSON.stringify(modelRoles),
      selectedModel: modelRoles.coding_primary,
      executionEngine: this.adapter.id,
    });
    this.event(task.id, 'coding.models.selected', modelRoles);

    const inspected = await this.adapter.inspect({ worktreePath: worktree.worktreePath, candidates, userRequest: input.userRequest });
    const plan = await this.adapter.plan({ worktreePath: worktree.worktreePath, candidates, userRequest: input.userRequest, modelRoles });
    assertPlanWithinCandidates(plan.filesToChange, candidates);
    this.taskStore.updateCodingFields(task.id, {
      filesRead: JSON.stringify(inspected.filesRead),
      plan: JSON.stringify(plan),
    });
    this.evidence(task.id, 'coding-plan', plan);
    this.taskEngine.transition(task.id, 'READY');
    const plannedTask = this.taskStore.getTask(task.id) as TaskRecord;
    return { task: plannedTask, context, candidates, modelRoles, plan };
  }

  async resumeTask(taskId: string, validationCommands: string[] = []): Promise<CodingRunResult> {
    const task = this.mustGetCodingTask(taskId);
    const project = this.registry.getProject(task.projectId as string);
    if (!project) throw new Error(`project not found: ${task.projectId}`);
    const contextPack = this.registry.getContextPack(project.id, task.contextPackId as string);
    if (!contextPack) throw new Error('context pack not found for project');
    const context = { project, contextPack, baseCommit: task.baseCommit as string, baseBranch: task.baseBranch as string };
    const candidates = parseJson<CandidateSelection>(task.candidateFiles, 'candidateFiles');
    const modelRoles = parseJson<CodingModelRoles>(task.modelRoles, 'modelRoles');
    const plan = parseJson<EnginePlan>(task.plan, 'plan');
    const worktreePath = task.worktreePath as string;
    if (!worktreePath) throw new Error('coding task has no worktree path');

    if (task.status === 'READY') {
      await enforceCodingContext({
        service: this.registry,
        projectId: project.id,
        contextPackId: contextPack.id,
        mapVersion: task.mapVersion,
        baseCommit: task.baseCommit,
      });
      this.taskEngine.transition(task.id, 'RUNNING');
    } else if (task.status !== 'RUNNING' && task.status !== 'VALIDATING' && task.status !== 'RECOVERING') {
      throw new Error(`coding task cannot resume from ${task.status}`);
    }

    let apply: EngineApplyResult | null = parseJsonOrNull(task.filesChanged)
      ? { engineId: this.adapter.id, changedFiles: parseJson<string[]>(task.filesChanged, 'filesChanged'), evidence: { resumed: true } }
      : null;
    if (!apply) {
      apply = await this.adapter.apply({ worktreePath, plan, userRequest: task.userRequest });
      this.taskStore.updateCodingFields(task.id, { filesChanged: JSON.stringify(apply.changedFiles) });
      this.evidence(task.id, 'coding-apply', apply);
      this.event(task.id, 'coding.engine.applied', { engineId: apply.engineId, changedFiles: apply.changedFiles });
    } else {
      this.event(task.id, 'coding.engine.apply_skipped_on_resume', { changedFiles: apply.changedFiles });
    }

    const latestBeforeValidation = this.mustGetCodingTask(task.id);
    if (latestBeforeValidation.status !== 'VALIDATING') this.taskEngine.transition(task.id, 'VALIDATING');
    const validationPlan = buildValidationPlan(context.project, worktreePath, validationCommands);
    this.taskStore.updateCodingFields(task.id, { validationPlan: JSON.stringify(validationPlan) });
    let validation = await runValidationPlan(validationPlan, { isCancelled: () => this.taskStore.getTask(task.id)?.status === 'CANCELLED' });
    if (this.taskStore.getTask(task.id)?.status === 'CANCELLED') {
      return { task: this.mustGetCodingTask(task.id), context, candidates, modelRoles, plan, apply, validation, review: { status: 'FAIL', findings: ['task cancelled'] }, commitSha: null };
    }
    let attempts = 0;
    const maxRetries = this.mustGetCodingTask(task.id).maxRetries;
    while (!validationPassed(validation) && attempts < maxRetries) {
      attempts += 1;
      this.taskStore.updateCodingFields(task.id, { retryCount: attempts, validationResults: JSON.stringify(validation) });
      this.event(task.id, 'coding.repair.attempted', { attempt: attempts, failed: failedValidationNames(validation) });
      this.taskEngine.transition(task.id, 'RECOVERING');
      this.taskEngine.transition(task.id, 'RUNNING');
      await this.adapter.continue({
        worktreePath,
        plan,
        attempt: attempts,
        validationSummary: failedValidationNames(validation).join(', '),
      });
      this.taskEngine.transition(task.id, 'VALIDATING');
      validation = await runValidationPlan(validationPlan, { isCancelled: () => this.taskStore.getTask(task.id)?.status === 'CANCELLED' });
      if (this.taskStore.getTask(task.id)?.status === 'CANCELLED') {
        return { task: this.mustGetCodingTask(task.id), context, candidates, modelRoles, plan, apply, validation, review: { status: 'FAIL', findings: ['task cancelled'] }, commitSha: null };
      }
    }
    this.taskStore.updateCodingFields(task.id, { validationResults: JSON.stringify(validation) });
    this.evidence(task.id, 'coding-validation', validation);

    const review = await reviewWorktree(worktreePath, validation);
    this.taskStore.updateCodingFields(task.id, { reviewStatus: review.status });
    this.evidence(task.id, 'coding-review', review);
    this.event(task.id, 'coding.review.completed', review);
    if (!validationPassed(validation) || review.status !== 'PASS') {
      const failed = this.taskEngine.failTask(task.id, 'Coding workflow failed validation or review.');
      return { task: failed, context, candidates, modelRoles, plan, apply, validation, review, commitSha: null };
    }

    const commitSha = task.commitPolicy === 'no-commit' ? null : await this.commitLocal(worktreePath, task.userRequest);
    this.taskStore.updateCodingFields(task.id, { commitSha });
    this.event(task.id, 'coding.commit.created', { commitSha, policy: task.commitPolicy ?? 'local-only' });
    const completed = this.taskEngine.completeTask(task.id, 'Coding workflow completed with local validation and review.');
    return { task: completed, context, candidates, modelRoles, plan, apply, validation, review, commitSha };
  }

  getTask(id: string): TaskRecord | null {
    return this.taskStore.getTask(id);
  }

  private mustGetCodingTask(taskId: string): TaskRecord {
    const task = this.taskStore.getTask(taskId);
    if (!task || task.taskKind !== 'coding') throw new Error(`coding task not found: ${taskId}`);
    return task;
  }

  close(): void {
    this.registry.close();
    this.taskStore.close();
  }

  private async commitLocal(worktreePath: string, userRequest: string): Promise<string> {
    await git(worktreePath, ['add', '--', '.']);
    await git(worktreePath, ['-c', 'user.name=Mi Coding Workflow', '-c', 'user.email=mi-coding@example.invalid', 'commit', '-m', `coding task: ${userRequest.slice(0, 72)}`]);
    return git(worktreePath, ['rev-parse', 'HEAD']);
  }

  private event(taskId: string, type: string, detail: unknown): void {
    this.taskStore.appendEvent(taskId, type, detail);
  }

  private evidence(taskId: string, evidenceId: string, payload: unknown): void {
    const evidence = this.taskStore.writeEvidence(taskId, evidenceId, payload);
    this.taskStore.appendEvent(taskId, 'coding.evidence.written', { evidenceId, relativePath: evidence.relativePath });
  }
}

function parseJson<T>(value: string | null, label: string): T {
  if (!value) throw new Error(`coding task missing ${label}`);
  return JSON.parse(value) as T;
}

function parseJsonOrNull(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function validationPassed(results: ValidationResult[]): boolean {
  return results.every(result => !result.configured || result.exitCode === 0);
}

function failedValidationNames(results: ValidationResult[]): string[] {
  return results.filter(result => result.configured && result.exitCode !== 0).map(result => result.name);
}
