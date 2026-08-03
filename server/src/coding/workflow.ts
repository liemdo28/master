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
import type { CodingRunResult, CodingWorkflowInput, ValidationResult } from './types';
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
    this.taskEngine.transition(task.id, 'RUNNING');

    const apply = await this.adapter.apply({ worktreePath: worktree.worktreePath, plan, userRequest: input.userRequest });
    this.taskStore.updateCodingFields(task.id, { filesChanged: JSON.stringify(apply.changedFiles) });
    this.evidence(task.id, 'coding-apply', apply);
    this.event(task.id, 'coding.engine.applied', { engineId: apply.engineId, changedFiles: apply.changedFiles });

    this.taskEngine.transition(task.id, 'VALIDATING');
    const validationPlan = buildValidationPlan(context.project, worktree.worktreePath, input.validationCommands ?? []);
    this.taskStore.updateCodingFields(task.id, { validationPlan: JSON.stringify(validationPlan) });
    let validation = await runValidationPlan(validationPlan);
    let attempts = 0;
    while (!validationPassed(validation) && attempts < (input.maxRetries ?? 3)) {
      attempts += 1;
      this.taskStore.updateCodingFields(task.id, { retryCount: attempts, validationResults: JSON.stringify(validation) });
      this.event(task.id, 'coding.repair.attempted', { attempt: attempts, failed: failedValidationNames(validation) });
      this.taskEngine.transition(task.id, 'RECOVERING');
      this.taskEngine.transition(task.id, 'RUNNING');
      await this.adapter.continue({
        worktreePath: worktree.worktreePath,
        plan,
        attempt: attempts,
        validationSummary: failedValidationNames(validation).join(', '),
      });
      this.taskEngine.transition(task.id, 'VALIDATING');
      validation = await runValidationPlan(validationPlan);
    }
    this.taskStore.updateCodingFields(task.id, { validationResults: JSON.stringify(validation) });
    this.evidence(task.id, 'coding-validation', validation);

    const review = await reviewWorktree(worktree.worktreePath, validation);
    this.taskStore.updateCodingFields(task.id, { reviewStatus: review.status });
    this.evidence(task.id, 'coding-review', review);
    this.event(task.id, 'coding.review.completed', review);
    if (!validationPassed(validation) || review.status !== 'PASS') {
      const failed = this.taskEngine.failTask(task.id, 'Coding workflow failed validation or review.');
      return { task: failed, context, candidates, modelRoles, plan, apply, validation, review, commitSha: null };
    }

    const commitSha = input.commitPolicy === 'no-commit' ? null : await this.commitLocal(worktree.worktreePath, input.userRequest);
    this.taskStore.updateCodingFields(task.id, { commitSha });
    this.event(task.id, 'coding.commit.created', { commitSha, policy: input.commitPolicy ?? 'local-only' });
    const completed = this.taskEngine.completeTask(task.id, 'Coding workflow completed with local validation and review.');
    return { task: completed, context, candidates, modelRoles, plan, apply, validation, review, commitSha };
  }

  getTask(id: string): TaskRecord | null {
    return this.taskStore.getTask(id);
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

function validationPassed(results: ValidationResult[]): boolean {
  return results.every(result => !result.configured || result.exitCode === 0);
}

function failedValidationNames(results: ValidationResult[]): string[] {
  return results.filter(result => result.configured && result.exitCode !== 0).map(result => result.name);
}
