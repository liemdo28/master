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
import { LlmCodingEngine, LLM_ENGINE_ID, shouldUseAstEditPlan } from './llm/engine';
import { reviewIndependently } from './llm/reviewer';
import { CodingEngineError } from './llm/types';
import { codingResourceController } from './resource-control';
import { classifyTask } from './strategy';
import type { CodingEngineAdapter } from './engines/adapter';
import type { CandidateSelection, CodingModelRoles, CodingRunResult, CodingWorkflowInput, EngineApplyResult, EnginePlan, ValidationResult } from './types';
import { buildValidationPlan, captureValidationArtifactBaseline, classifyValidationArtifacts, runValidationPlan } from './validation-runner';
import { prepareWorktree } from './worktree-manager';

export const INTERNAL_ENGINE_ID = 'internal-patch-engine';

/**
 * Engine selection is explicit rather than implicit. `MI_CODING_ENGINE` pins it
 * globally; a per-task `engineId` overrides that. The deterministic Phase 3
 * engine stays reachable as a fallback for tasks that must not involve a model.
 */
export function resolveEngineId(requested?: string | null): string {
  return requested || process.env.MI_CODING_ENGINE || LLM_ENGINE_ID;
}

export class CodingWorkflow {
  private adapter: CodingEngineAdapter = new InternalPatchEngine();
  private engineId = INTERNAL_ENGINE_ID;

  constructor(
    private taskStore = new TaskStore(),
    private registry = new ProjectRegistryService(),
    private taskEngine = new TaskEngine(taskStore)
  ) {}

  /** Builds the adapter for this task, giving the LLM engine its context bridge. */
  private buildAdapter(
    engineId: string,
    context: { project: CodingRunResult['context']['project']; contextPack: CodingRunResult['context']['contextPack']; baseCommit: string },
    validationCommands: string[]
  ): CodingEngineAdapter {
    if (engineId === INTERNAL_ENGINE_ID) return new InternalPatchEngine();
    if (engineId === LLM_ENGINE_ID) {
      return new LlmCodingEngine({
        project: context.project,
        contextPack: context.contextPack,
        sourceSha: context.baseCommit,
        validationCommands,
      });
    }
    throw new Error(`unknown coding engine: ${engineId}`);
  }

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

    this.engineId = resolveEngineId(input.engineId);
    this.adapter = this.buildAdapter(this.engineId, context, input.validationCommands ?? []);
    this.event(task.id, 'coding.engine.selected', { engineId: this.engineId });
    const classification = classifyTask(input.userRequest);
    this.event(task.id, 'coding.strategy.selected', {
      taskClass: classification.taskClass,
      strategy: classification.strategy,
      astFirst: this.engineId === LLM_ENGINE_ID && shouldUseAstEditPlan(classification),
      patchFallback: this.engineId === LLM_ENGINE_ID,
      diagnosticGuided: classification.strategy === 'DIAGNOSTIC_GUIDED',
      maxChangedLines: classification.maxChangedLines,
      maxOutputTokens: classification.maxOutputTokens,
      reasoning: classification.reasoning,
    });

    // Admission control exists to stop concurrent model loads from thrashing an
    // 8 GB GPU. The deterministic engine loads no weights, so gating it would
    // only serialise work that costs nothing to run in parallel.
    if (this.engineId !== INTERNAL_ENGINE_ID) {
      const admission = await codingResourceController.admit(task.id, { diskPath: context.project.canonicalRoot });
      this.event(task.id, 'coding.resources.checked', {
        admitted: admission.admitted,
        reason: admission.reason ?? null,
        freeRamGb: Number(admission.snapshot.freeRamGb.toFixed(2)),
        freeDiskGb: admission.snapshot.freeDiskGb === null ? null : Number(admission.snapshot.freeDiskGb.toFixed(2)),
        residentVramGb: Number(admission.snapshot.residentVramGb.toFixed(2)),
      });
      if (!admission.admitted) {
        this.event(task.id, 'coding.failure.classified', { category: 'RESOURCE_EXHAUSTED', message: admission.reason });
        this.taskEngine.failTask(task.id, admission.reason ?? 'resource limits exceeded');
        throw new CodingEngineError('RESOURCE_EXHAUSTED', admission.reason ?? 'resource limits exceeded');
      }
    }

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

    // Retrieval evidence explains why each candidate is in the pack. Recorded
    // per task so a ranking can be audited after the fact rather than inferred.
    const retrieval = this.registry.getLastRetrieval();
    if (retrieval) {
      this.event(task.id, 'coding.retrieval.completed', {
        intent: {
          action: retrieval.intent.action,
          artifactType: retrieval.intent.artifactType,
          routePaths: retrieval.intent.routePaths,
          symbols: retrieval.intent.symbols.slice(0, 10),
          confidence: retrieval.intent.confidence,
        },
        stats: retrieval.stats,
      });
      for (const candidate of retrieval.selected) {
        this.event(task.id, 'coding.retrieval.candidate.selected', {
          path: candidate.path,
          rank: candidate.rank,
          score: candidate.score,
          structuralRole: candidate.structuralRole,
          matchedRoutes: candidate.matchedRoutes,
          matchedSymbols: candidate.matchedSymbols,
          evidence: candidate.evidence.map(item => ({ kind: item.kind, value: item.value, weight: item.weight })),
        });
      }
      for (const candidate of retrieval.excluded.slice(0, 10)) {
        this.event(task.id, 'coding.retrieval.candidate.excluded', {
          path: candidate.path,
          rank: candidate.rank,
          score: candidate.score,
          exclusionReasons: candidate.exclusionReasons,
        });
      }
      this.evidence(task.id, 'coding-retrieval', {
        intent: retrieval.intent,
        selected: retrieval.selected,
        excluded: retrieval.excluded.slice(0, 20),
        stats: retrieval.stats,
      });
    }

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

    let inspected: { filesRead: string[] };
    let plan: EnginePlan;
    try {
      inspected = await codingResourceController.withModelSlot(() =>
        this.adapter.inspect({ worktreePath: worktree.worktreePath, candidates, userRequest: input.userRequest, modelRoles } as never)
      );
      const expansions = (inspected as { expansions?: unknown[] }).expansions ?? [];
      if (expansions.length) this.event(task.id, 'coding.context.expanded', { expansions });

      plan = await codingResourceController.withModelSlot(() =>
        this.adapter.plan({ worktreePath: worktree.worktreePath, candidates, userRequest: input.userRequest, modelRoles })
      );
    } catch (err) {
      codingResourceController.release(task.id);
      this.recordFailure(task.id, err);
      this.taskEngine.failTask(task.id, err instanceof Error ? err.message : String(err));
      throw err;
    }
    assertPlanWithinCandidates(plan.filesToChange, candidates);
    const hallucinated = (plan as EnginePlan & { hallucinatedPaths?: string[] }).hallucinatedPaths ?? [];
    if (hallucinated.length) this.event(task.id, 'coding.plan.hallucinated_paths', { paths: hallucinated });
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

    // A resume may land in a fresh process, so rebuild the adapter the task was
    // planned with rather than whatever the current default happens to be.
    this.engineId = task.codingEngine || resolveEngineId(null);
    this.adapter = this.buildAdapter(this.engineId, context, validationCommands);

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
      try {
        apply = await codingResourceController.withModelSlot(() =>
          this.adapter.apply({ worktreePath, plan, userRequest: task.userRequest, modelRoles } as never)
        );
      } catch (err) {
        codingResourceController.release(task.id);
        this.recordFailure(task.id, err);
        const failed = this.taskEngine.failTask(task.id, err instanceof Error ? err.message : String(err));
        return {
          task: failed, context, candidates, modelRoles, plan,
          apply: { engineId: this.adapter.id, changedFiles: [], evidence: {} },
          validation: [], review: { status: 'FAIL', findings: [String(err instanceof Error ? err.message : err)] }, commitSha: null,
        };
      }
      this.taskStore.updateCodingFields(task.id, { filesChanged: JSON.stringify(apply.changedFiles) });
      this.evidence(task.id, 'coding-apply', apply);
      this.event(task.id, 'coding.engine.applied', { engineId: apply.engineId, changedFiles: apply.changedFiles });
    } else {
      this.event(task.id, 'coding.engine.apply_skipped_on_resume', { changedFiles: apply.changedFiles });
    }

    const latestBeforeValidation = this.mustGetCodingTask(task.id);
    if (latestBeforeValidation.status !== 'VALIDATING') this.taskEngine.transition(task.id, 'VALIDATING');
    let artifactBaseline = captureValidationArtifactBaseline(worktreePath);
    const validationPlan = buildValidationPlan(context.project, worktreePath, validationCommands);
    this.taskStore.updateCodingFields(task.id, { validationPlan: JSON.stringify(validationPlan) });
    let validation = await runValidationPlan(validationPlan, { isCancelled: () => this.taskStore.getTask(task.id)?.status === 'CANCELLED' });
    if (this.taskStore.getTask(task.id)?.status === 'CANCELLED') {
      return { task: this.mustGetCodingTask(task.id), context, candidates, modelRoles, plan, apply, validation, review: { status: 'FAIL', findings: ['task cancelled'] }, commitSha: null };
    }
    let attempts = 0;
    const maxRetries = this.mustGetCodingTask(task.id).maxRetries;
    // Stop after the same failure signature repeats: a third identical run is
    // evidence the model cannot see the cause, not that it needs another go.
    const failureSignatures = new Map<string, number>();
    while (!validationPassed(validation) && attempts < maxRetries) {
      const signature = failureSignature(validation);
      const seen = (failureSignatures.get(signature) ?? 0) + 1;
      failureSignatures.set(signature, seen);
      if (seen > 2) {
        this.event(task.id, 'coding.repair.abandoned', { reason: 'identical failure repeated', signature, attempts });
        break;
      }

      attempts += 1;
      this.taskStore.updateCodingFields(task.id, { retryCount: attempts, validationResults: JSON.stringify(validation) });
      this.event(task.id, 'coding.repair.attempted', { attempt: attempts, failed: failedValidationNames(validation), signature });
      this.taskEngine.transition(task.id, 'RECOVERING');
      this.taskEngine.transition(task.id, 'RUNNING');
      try {
        const repaired = await codingResourceController.withModelSlot(() =>
          this.adapter.continue({
            worktreePath,
            plan,
            attempt: attempts,
            validationSummary: failedValidationNames(validation).join(', '),
            validationOutput: validationOutputText(validation),
            userRequest: task.userRequest,
            modelRoles,
          } as never)
        );
        const symbolsExpanded = (repaired.evidence as { symbolsExpanded?: unknown[] } | undefined)?.symbolsExpanded ?? [];
        if (symbolsExpanded.length) {
          this.event(task.id, 'coding.context.symbols.expanded', { attempt: attempts, symbols: symbolsExpanded });
        }
        artifactBaseline = includeTaskChangedFilesInArtifactBaseline(artifactBaseline, captureValidationArtifactBaseline(worktreePath), repaired.changedFiles);
      } catch (err) {
        this.recordFailure(task.id, err);
        this.event(task.id, 'coding.repair.failed', { attempt: attempts, message: err instanceof Error ? err.message : String(err) });
        break;
      }
      this.taskEngine.transition(task.id, 'VALIDATING');
      validation = await runValidationPlan(validationPlan, { isCancelled: () => this.taskStore.getTask(task.id)?.status === 'CANCELLED' });
      if (this.taskStore.getTask(task.id)?.status === 'CANCELLED') {
        codingResourceController.release(task.id);
        return { task: this.mustGetCodingTask(task.id), context, candidates, modelRoles, plan, apply, validation, review: { status: 'FAIL', findings: ['task cancelled'] }, commitSha: null };
      }
    }
    this.taskStore.updateCodingFields(task.id, { validationResults: JSON.stringify(validation) });
    this.evidence(task.id, 'coding-validation', validation);
    const artifactReport = classifyValidationArtifacts({ project: context.project, worktreePath, before: artifactBaseline });
    this.evidence(task.id, 'coding-validation-artifacts', artifactReport);
    this.event(task.id, 'coding.validation.artifacts.classified', artifactReport);
    if (!artifactReport.baseCheckoutUnchanged) {
      this.event(task.id, 'coding.failure.classified', {
        category: 'VALIDATION_ARTIFACTS_UNEXPECTED',
        message: artifactReport.unexpectedChanges.join(', '),
      });
      codingResourceController.release(task.id);
      const failed = this.taskEngine.failTask(task.id, 'Validation produced unexpected workspace changes.');
      return { task: failed, context, candidates, modelRoles, plan, apply, validation, review: { status: 'FAIL', findings: ['validation produced unexpected workspace changes'] }, commitSha: null };
    }

    // The deterministic engine keeps the Phase 3 reviewer. A model-authored diff
    // gets the stricter two-layer review with an independent model pass.
    const review = this.engineId === LLM_ENGINE_ID
      ? await codingResourceController.withModelSlot(() =>
          reviewIndependently({
            worktreePath,
            userRequest: task.userRequest,
            validation,
            // The approved boundary is the candidate set, which is what the
            // patch layer enforces; reviewing against the plan alone would flag
            // legitimate edits the model simply failed to predict.
            allowedFiles: candidates.candidates.map(candidate => candidate.path),
            modelRoles,
          })
        )
      : await reviewWorktree(worktreePath, validation);

    this.taskStore.updateCodingFields(task.id, { reviewStatus: review.status });
    this.evidence(task.id, 'coding-review', review);
    this.event(task.id, 'coding.review.completed', review);
    if (!validationPassed(validation) || review.status !== 'PASS') {
      if (!validationPassed(validation)) {
        this.event(task.id, 'coding.failure.classified', { category: 'VALIDATION_FAILED', message: failedValidationNames(validation).join(', ') });
      }
      codingResourceController.release(task.id);
      const failed = this.taskEngine.failTask(task.id, 'Coding workflow failed validation or review.');
      return { task: failed, context, candidates, modelRoles, plan, apply, validation, review, commitSha: null };
    }

    const commitSha = task.commitPolicy === 'no-commit' ? null : await this.commitLocal(worktreePath, task.userRequest);
    this.taskStore.updateCodingFields(task.id, { commitSha });
    this.event(task.id, 'coding.commit.created', { commitSha, policy: task.commitPolicy ?? 'local-only' });
    codingResourceController.release(task.id);
    const completed = this.taskEngine.completeTask(task.id, 'Coding workflow completed with local validation and review.');
    return { task: completed, context, candidates, modelRoles, plan, apply, validation, review, commitSha };
  }

  /** Classifies and records an engine failure so the API can report a category. */
  private recordFailure(taskId: string, err: unknown): void {
    const category = err instanceof CodingEngineError ? err.category : 'ENGINE_CRASHED';
    const message = err instanceof Error ? err.message : String(err);
    this.event(taskId, 'coding.failure.classified', { category, message });
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

function includeTaskChangedFilesInArtifactBaseline(
  baseline: { status: string[]; diff: string },
  current: { status: string[]; diff: string },
  changedFiles: string[]
): { status: string[]; diff: string } {
  const changed = new Set(changedFiles.map(file => file.replace(/\\/g, '/')));
  const merged = new Set(baseline.status);
  for (const entry of current.status) {
    const file = entry.slice(3).replace(/\\/g, '/');
    if (changed.has(file)) merged.add(entry);
  }
  return { status: [...merged], diff: baseline.diff };
}

function failedValidationNames(results: ValidationResult[]): string[] {
  return results.filter(result => result.configured && result.exitCode !== 0).map(result => result.name);
}

/** Concatenated output of the failing commands, for the repair prompt. */
function validationOutputText(results: ValidationResult[]): string {
  return results
    .filter(result => result.configured && result.exitCode !== 0)
    .map(result => `$ ${result.name}\n${result.stdout}\n${result.stderr}`)
    .join('\n\n')
    .slice(0, 12000);
}

/**
 * A stable fingerprint of a failure. Absolute paths, line/column numbers and
 * durations are stripped so the same underlying error compares equal across runs.
 */
function failureSignature(results: ValidationResult[]): string {
  return results
    .filter(result => result.configured && result.exitCode !== 0)
    .map(result => {
      const normalized = `${result.stdout}\n${result.stderr}`
        .replace(/[A-Za-z]:\\[^\s:]+|\/[^\s:]+\//g, '<path>')
        .replace(/:\d+:\d+/g, ':<pos>')
        .replace(/\d+(\.\d+)?\s*ms\b/gi, '<ms>')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 600);
      return `${result.name}::${normalized}`;
    })
    .join('||');
}
