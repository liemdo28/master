import { randomUUID } from 'crypto';
import { OrchestrationStore } from './store';
import { validateDag, dependencyBlockState, type DagNode } from './dag';
import { ControlledActionService } from '../actions/service';
import { assertPlainPayload, payloadHash } from '../actions/policy';
import type {
  ActionPlan, ActionPlanStep, ActionPlanStepInput, ActionPlanStepStatus, ActionPlanStatus,
  CreateActionPlanInput, PlanAdvanceResult, PlanValidationIssue, PlanValidationResult, RetryClass,
} from './types';
import { ORCHESTRATION_ALLOWED_ACTION_TYPES, PLAN_ALLOWED_TRANSITIONS, STEP_ALLOWED_TRANSITIONS } from './types';

const now = (): string => new Date().toISOString();

/** GMAIL_SEND_DRAFT and every other non-allowlisted action type is rejected here, before
 *  any proposal is ever created — this is the structural boundary that makes "plan
 *  contains unknown external action" and "arbitrary connector action" impossible. */
function isAllowedActionType(actionType: unknown): actionType is string {
  return typeof actionType === 'string' && ORCHESTRATION_ALLOWED_ACTION_TYPES.has(actionType as any);
}

function assertPlanTransition(from: ActionPlanStatus, to: ActionPlanStatus): void {
  if (!PLAN_ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`plan cannot transition from ${from} to ${to}`);
  }
}

function assertStepTransition(from: ActionPlanStepStatus, to: ActionPlanStepStatus): void {
  if (!STEP_ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`step cannot transition from ${from} to ${to}`);
  }
}

export class GovernedOrchestrationService {
  readonly store: OrchestrationStore;
  readonly controlledActions: ControlledActionService;

  constructor(root?: string) {
    this.store = new OrchestrationStore(root);
    // Same personal-os.db, same governance/store singletons the Controlled Actions
    // service already uses — never a second policy engine, never a second DB handle
    // for the same file, never a duplicated connector-execution path.
    this.controlledActions = new ControlledActionService(root);
  }

  close(): void { this.store.close(); this.controlledActions.close(); }

  // ── Create ─────────────────────────────────────────────────────────────

  createPlan(input: CreateActionPlanInput): ActionPlan {
    return this.createPlanVersion(input, 1, null);
  }

  /**
   * §9: material changes to a plan already in progress must become a NEW plan version,
   * never a silent in-place mutation. The previous version is cancelled (its own
   * WAITING_APPROVAL proposals rejected via the existing cancel() path) so exactly one
   * version of a given conceptual plan is ever live/advanceable at a time. Approvals
   * never carry over — the new version's steps start with proposalId = null.
   */
  createNewVersion(previousPlanId: string, input: CreateActionPlanInput): ActionPlan {
    const previous = this.get(previousPlanId);
    if (['COMPLETED', 'CANCELLED'].includes(previous.status)) {
      throw new Error(`cannot version a plan that is already ${previous.status}`);
    }
    const next = this.createPlanVersion(input, previous.planVersion + 1, previousPlanId);
    if (!['CANCELLED'].includes(this.get(previousPlanId).status)) {
      this.cancel(previousPlanId, `superseded by plan version ${next.planVersion} (${next.id})`);
    }
    return next;
  }

  private createPlanVersion(input: CreateActionPlanInput, planVersion: number, previousVersionId: string | null): ActionPlan {
    if (!input.steps.length) throw new Error('plan must contain at least one step');
    const keys = new Set<string>();
    for (const step of input.steps) {
      if (keys.has(step.key)) throw new Error(`duplicate step key: ${step.key}`);
      keys.add(step.key);
      if (step.type === 'CONTROLLED_ACTION') {
        if (!isAllowedActionType(step.actionType)) {
          throw new Error(`step "${step.key}": actionType "${step.actionType}" is not an allowed Controlled Action type`);
        }
        if (step.actionPayload) assertPlainPayload(step.actionPayload);
      }
    }
    const createdAt = now();
    const planId = `plan-${randomUUID()}`;
    const planHash = payloadHash({
      title: input.title, objective: input.objective, projectId: input.projectId ?? null,
      steps: input.steps.map(s => ({
        key: s.key, type: s.type, description: s.description, dependsOnKeys: [...(s.dependsOnKeys ?? [])].sort(),
        actionType: s.actionType ?? null, actionPayload: s.actionPayload ?? null,
      })),
    });

    return this.store.runInTransaction(() => {
      const plan: ActionPlan = {
        id: planId, goalId: input.goalId ?? null, title: input.title, objective: input.objective,
        projectId: input.projectId ?? null, status: 'DRAFT', planVersion, previousVersionId,
        planHash, policyVersion: null, policyHash: null, createdAt, updatedAt: createdAt,
        validatedAt: null, completedAt: null, cancelledAt: null, failureReason: null, blockedReason: null,
      };
      this.store.savePlan(plan);

      // Two passes: every step row must exist before any dependency row can reference
      // it via FOREIGN KEY, and step order in the input array is not guaranteed to
      // match dependency order (a step may legitimately depend on a later-indexed one).
      const keyToId = new Map<string, string>();
      input.steps.forEach(s => keyToId.set(s.key, `step-${randomUUID()}`));
      const steps: ActionPlanStep[] = input.steps.map((s, index) => ({
        id: keyToId.get(s.key)!, planId, stepIndex: index, key: s.key, type: s.type,
        description: s.description, projectId: s.projectId ?? input.projectId ?? null,
        dependsOnStepIds: (s.dependsOnKeys ?? []).map(k => keyToId.get(k)).filter((v): v is string => !!v),
        inputs: s.inputs ?? {}, expectedOutputs: s.expectedOutputs ?? {},
        sideEffectClass: s.type === 'CONTROLLED_ACTION' ? 'EXTERNAL' : 'NONE',
        actionType: s.type === 'CONTROLLED_ACTION' ? (s.actionType as any) : null,
        actionPayload: s.actionPayload ?? null,
        riskClass: null, requiredApprovalLevel: null, policyDecisionId: null, policyDecisionResult: null,
        proposalId: null, status: 'PENDING', outputSummary: null, failureReason: null,
        createdAt, updatedAt: createdAt, startedAt: null, completedAt: null,
      }));
      for (const step of steps) this.store.saveStep(step);
      for (const step of steps) {
        for (const depId of step.dependsOnStepIds) this.store.saveDependency(planId, step.id, depId);
      }

      this.store.recordEvidence(planId, null, 'PLAN_CREATED', `Plan created with ${input.steps.length} step(s), version ${planVersion}.`, { planHash, planVersion, previousVersionId }, 'user');
      if (previousVersionId) {
        this.store.recordEvidence(planId, null, 'PLAN_VERSIONED', `New plan version created from ${previousVersionId}. Old approvals do not carry over.`, { previousVersionId }, 'user');
      }
      return plan;
    });
  }

  get(id: string): ActionPlan {
    const plan = this.store.getPlan(id);
    if (!plan) throw new Error('plan not found');
    return plan;
  }

  list(status?: ActionPlanStatus): ActionPlan[] { return this.store.listPlans(status); }

  detail(id: string): { plan: ActionPlan; steps: ActionPlanStep[] } {
    const plan = this.get(id);
    return { plan, steps: this.store.listStepsForPlan(id) };
  }

  // ── Validate (§6) ──────────────────────────────────────────────────────

  validate(id: string): PlanValidationResult {
    const plan = this.get(id);
    assertPlanTransition(plan.status, 'VALIDATED');
    const steps = this.store.listStepsForPlan(id);
    const issues: PlanValidationIssue[] = [];

    const nodes: DagNode[] = steps.map(s => ({ key: s.id, dependsOnKeys: s.dependsOnStepIds }));
    const dag = validateDag(nodes);
    if (dag.unknownDependencyKeys.length > 0) {
      issues.push({ code: 'UNKNOWN_DEPENDENCY', message: `references unknown step id(s): ${dag.unknownDependencyKeys.join(', ')}` });
    }
    if (dag.cycleKeys.length > 0) {
      issues.push({ code: 'CYCLE', message: `dependency cycle detected among: ${dag.cycleKeys.join(', ')}` });
    }

    const policySet = this.controlledActions.policyEngine.store.activePolicySet();
    if (!policySet) issues.push({ code: 'NO_ACTIVE_POLICY', message: 'no active policy set found' });

    const budgets = this.controlledActions.policyEngine.store.listBudgets();

    for (const step of steps) {
      if (!step.description.trim()) issues.push({ code: 'MISSING_DESCRIPTION', message: 'step has no description', stepKey: step.key });
      if (step.type === 'CONTROLLED_ACTION') {
        if (!isAllowedActionType(step.actionType)) {
          issues.push({ code: 'FORBIDDEN_ACTION_TYPE', message: `action type "${step.actionType}" is not permitted (Phase 5H introduces no new external action type)`, stepKey: step.key });
          continue;
        }
        if (!step.actionPayload) {
          issues.push({ code: 'MISSING_PAYLOAD', message: 'CONTROLLED_ACTION step has no payload', stepKey: step.key });
        } else {
          try { assertPlainPayload(step.actionPayload); payloadHash(step.actionPayload); }
          catch (err: any) { issues.push({ code: 'PAYLOAD_UNHASHABLE', message: err?.message ?? 'payload cannot be hashed', stepKey: step.key }); }
        }
        if (plan.projectId && step.projectId && step.projectId !== plan.projectId) {
          issues.push({ code: 'CROSS_PROJECT', message: `step targets project "${step.projectId}" but plan is scoped to "${plan.projectId}"`, stepKey: step.key });
        }
        const hasBudget = budgets.some(b => b.actionType === step.actionType || b.actionType === null);
        if (!hasBudget) issues.push({ code: 'NO_BUDGET_CONFIGURED', message: `no budget configured to evaluate action type "${step.actionType}"`, stepKey: step.key });
        // Kill-switch state is queried (not required to be "off") purely to confirm the
        // check itself succeeds structurally — actual enforcement happens at advance().
        try { this.controlledActions.policyEngine.killSwitch.state({ projectId: step.projectId, actionType: step.actionType as any }); }
        catch (err: any) { issues.push({ code: 'KILL_SWITCH_CHECK_FAILED', message: err?.message ?? 'kill switch state could not be evaluated', stepKey: step.key }); }
      }
    }

    const valid = issues.length === 0;
    if (valid) {
      const set = policySet!;
      this.store.runInTransaction(() => {
        this.store.updatePlanStatus(id, 'VALIDATED', { validatedAt: now() });
        this.store.handle.prepare(`UPDATE action_plans SET policyVersion = ?, policyHash = ? WHERE id = ?`).run(set.version, set.contentHash, id);
        for (const step of steps) {
          const target: ActionPlanStepStatus = dependencyBlockState(steps.filter(s => step.dependsOnStepIds.includes(s.id)).map(s => s.status)) === 'SATISFIED' || step.dependsOnStepIds.length === 0 ? 'READY' : 'BLOCKED';
          assertStepTransition(step.status, target);
          this.store.updateStepStatus(step.id, target);
        }
      });
      this.store.recordEvidence(id, null, 'PLAN_VALIDATED', `Plan validated. Policy ${set.version} (${set.contentHash.slice(0, 12)}...) recorded.`, { policyVersion: set.version, topologicalOrder: dag.order }, 'system');
    } else {
      this.store.recordEvidence(id, null, 'PLAN_VALIDATION_FAILED', `${issues.length} validation issue(s) found.`, { issues }, 'system');
    }
    return { valid, issues, topologicalOrder: dag.order };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  start(id: string): ActionPlan {
    const plan = this.get(id);
    assertPlanTransition(plan.status, 'READY');
    const updated = this.store.updatePlanStatus(id, 'READY');
    this.store.recordEvidence(id, null, 'PLAN_STARTED', 'Plan started; ready to advance eligible steps.', {}, 'user');
    return updated;
  }

  pause(id: string, reason: string): ActionPlan {
    const plan = this.get(id);
    assertPlanTransition(plan.status, 'PAUSED');
    const updated = this.store.updatePlanStatus(id, 'PAUSED', { blockedReason: reason });
    this.store.recordEvidence(id, null, 'PLAN_PAUSED', reason, {}, 'user');
    return updated;
  }

  resume(id: string): ActionPlan {
    const plan = this.get(id);
    assertPlanTransition(plan.status, 'READY');
    const updated = this.store.updatePlanStatus(id, 'READY', { blockedReason: null });
    this.store.recordEvidence(id, null, 'PLAN_RESUMED', 'Plan resumed. No step is auto-executed by resuming — WAITING_APPROVAL steps still require explicit Controlled Action approval.', {}, 'user');
    return updated;
  }

  cancel(id: string, reason: string): ActionPlan {
    const plan = this.get(id);
    assertPlanTransition(plan.status, 'CANCELLED');
    const steps = this.store.listStepsForPlan(id);
    // Reject still-open proposals FIRST, outside any transaction on this store — it
    // writes through a separate ControlledActionStore connection to the same file, and
    // nesting a second connection's write transaction inside this store's own
    // transaction deadlocks SQLite (SQLITE_BUSY). A dangling proposal after its plan is
    // cancelled would be a hidden side effect waiting to happen, so this still happens
    // before the plan/step rows below are updated, just not in the same transaction.
    for (const step of steps) {
      if (step.status === 'WAITING_APPROVAL' && step.proposalId) {
        try { this.controlledActions.reject(step.proposalId, { reason: `plan ${id} cancelled` }); } catch { /* already terminal */ }
      }
    }
    return this.store.runInTransaction(() => {
      for (const step of steps) {
        if (['PENDING', 'BLOCKED', 'READY', 'WAITING_APPROVAL'].includes(step.status)) {
          this.store.updateStepStatus(step.id, 'CANCELLED');
        }
      }
      const updated = this.store.updatePlanStatus(id, 'CANCELLED', { cancelledAt: now() });
      this.store.recordEvidence(id, null, 'PLAN_CANCELLED', reason, {}, 'user');
      return updated;
    });
  }

  evidence(id: string) { return this.store.listEvidenceForPlan(id); }

  // ── Advance (§10, §16) ─────────────────────────────────────────────────

  /**
   * Advances every currently-eligible step once. Idempotent: a duplicate call with the
   * same `idempotencyKey` returns the original run's result without re-advancing
   * anything (DB UNIQUE constraint on action_plan_runs.idempotencyKey), and each
   * individual controlled-action execution is independently idempotent via the
   * existing ControlledActionService (idempotencyKey UNIQUE on action_executions).
   */
  async advance(id: string, opts: { triggeredBy?: string; idempotencyKey?: string } = {}): Promise<PlanAdvanceResult> {
    const idempotencyKey = opts.idempotencyKey || `advance-${id}-${Date.now()}-${randomUUID()}`;
    const existingRun = this.store.getRunByIdempotencyKey(idempotencyKey);
    if (existingRun && existingRun.completedAt) {
      return { plan: this.get(id), run: existingRun, stepsAdvanced: existingRun.stepsAdvanced, deduplicated: true };
    }

    const plan = this.get(id);
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(plan.status)) {
      // Terminal — advancing is a safe no-op, not an error, so a client that doesn't
      // track plan status locally (or polls after completion) never gets a surprise
      // exception, and no duplicate work is ever attempted.
      const run = this.store.saveRun({ id: `run-${randomUUID()}`, planId: id, triggeredBy: opts.triggeredBy || 'user', idempotencyKey, stepsAdvanced: 0, startedAt: now(), completedAt: now(), resultSummary: `plan already ${plan.status}` });
      return { plan, run, stepsAdvanced: 0, deduplicated: false };
    }
    if (!['READY', 'RUNNING', 'WAITING_APPROVAL'].includes(plan.status)) {
      throw new Error(`plan cannot be advanced from status ${plan.status}`);
    }

    const run = existingRun ?? this.store.saveRun({
      id: `run-${randomUUID()}`, planId: id, triggeredBy: opts.triggeredBy || 'user',
      idempotencyKey, stepsAdvanced: 0, startedAt: now(), completedAt: null, resultSummary: null,
    });

    let stepsAdvanced = 0;
    let anyWaitingApproval = false;
    let anyBlocked = false;
    let anyFailed = false;

    const steps = this.store.listStepsForPlan(id);
    const statusByStepId = new Map(steps.map(s => [s.id, s.status]));

    for (const step of steps) {
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(step.status)) continue;

      if (['PENDING', 'BLOCKED'].includes(step.status)) {
        const depStatuses = step.dependsOnStepIds.map(depId => statusByStepId.get(depId) ?? 'PENDING');
        const block = dependencyBlockState(depStatuses);
        if (block === 'BLOCKED_FAILED' || block === 'BLOCKED_CANCELLED') {
          this.store.updateStepStatus(step.id, 'FAILED', { failureReason: `blocked by ${block === 'BLOCKED_FAILED' ? 'failed' : 'cancelled'} dependency` });
          statusByStepId.set(step.id, 'FAILED');
          anyFailed = true;
          continue;
        }
        if (block !== 'SATISFIED') { anyBlocked = true; continue; }
        if (!this.store.claimStep(step.id, step.status, 'READY')) continue;
        statusByStepId.set(step.id, 'READY');
        this.store.recordEvidence(id, step.id, 'STEP_READY', 'Dependencies satisfied.', {}, 'system');
      }

      const current = this.store.getStep(step.id)!;
      // WAITING_APPROVAL steps must still be re-checked every advance() call — that is
      // how a since-granted approval (made through the existing Controlled Actions
      // surface, entirely outside this call) gets observed and the step completed.
      if (!['READY', 'WAITING_APPROVAL'].includes(current.status)) continue;

      if (current.type !== 'CONTROLLED_ACTION') {
        const advanced = await this.advanceSafeLocalStep(current);
        statusByStepId.set(step.id, advanced.status);
        if (advanced.status === 'COMPLETED') stepsAdvanced += 1;
        if (advanced.status === 'FAILED') anyFailed = true;
        continue;
      }

      const killed = this.controlledActions.policyEngine.killSwitch.state({ projectId: current.projectId, actionType: current.actionType as any });
      if (killed.blocked) {
        this.store.recordEvidence(id, step.id, 'KILL_SWITCH_BLOCKED', killed.switches[0]?.reason || 'Kill switch active.', { killSwitchState: killed }, 'system');
        anyBlocked = true;
        continue; // step stays READY — no state regression, no execution attempted
      }

      const result = await this.advanceControlledActionStep(id, current);
      statusByStepId.set(step.id, result.status);
      if (result.status === 'COMPLETED') stepsAdvanced += 1;
      if (result.status === 'WAITING_APPROVAL') anyWaitingApproval = true;
      if (result.status === 'FAILED') anyFailed = true;
    }

    const finalSteps = this.store.listStepsForPlan(id);
    const allTerminal = finalSteps.every(s => ['COMPLETED', 'CANCELLED'].includes(s.status));
    const anyStepFailed = finalSteps.some(s => s.status === 'FAILED');

    let nextStatus: ActionPlanStatus = plan.status;
    if (allTerminal) nextStatus = 'COMPLETED';
    else if (anyStepFailed && !anyWaitingApproval && !anyBlocked) nextStatus = 'FAILED';
    else if (anyWaitingApproval) nextStatus = 'WAITING_APPROVAL';
    else nextStatus = 'RUNNING';

    if (nextStatus !== plan.status) {
      assertPlanTransition(plan.status, nextStatus);
      this.store.updatePlanStatus(id, nextStatus, {
        completedAt: nextStatus === 'COMPLETED' ? now() : undefined,
        failureReason: nextStatus === 'FAILED' ? 'one or more steps failed' : undefined,
      });
      if (nextStatus === 'COMPLETED' || nextStatus === 'FAILED') {
        this.store.recordEvidence(id, null, nextStatus === 'COMPLETED' ? 'PLAN_COMPLETED' : 'PLAN_FAILED', `Plan transitioned to ${nextStatus}.`, {}, 'system');
      }
    }

    this.store.completeRun(run.id, stepsAdvanced, `${stepsAdvanced} step(s) advanced; plan status ${nextStatus}`);
    return { plan: this.get(id), run: { ...run, stepsAdvanced, completedAt: now() }, stepsAdvanced, deduplicated: false };
  }

  private async advanceSafeLocalStep(step: ActionPlanStep): Promise<ActionPlanStep> {
    if (!this.store.claimStep(step.id, 'READY', 'RUNNING')) return this.store.getStep(step.id)!;
    this.store.recordEvidence(step.planId, step.id, 'STEP_STARTED', `${step.type} step started.`, {}, 'system');
    // READ_ONLY/LOCAL_COMPUTE steps are, by construction (validated at plan-creation
    // time), side-effect-free — they never call an external connector. This phase's
    // local-compute contract is deliberately minimal: it echoes `inputs` into
    // `outputSummary` as proof-of-execution for fixtures/tests; real read/compute
    // integrations (Knowledge retrieval, Personal OS reads) are wired in by callers
    // through `inputs` before the step runs, not invented here.
    const outputSummary = { echo: step.inputs, note: 'read-only/local-compute step — no external side effect' };
    const updated = this.store.updateStepStatus(step.id, 'COMPLETED', { outputSummary, completedAt: now() });
    this.store.recordEvidence(step.planId, step.id, 'STEP_EXECUTED', `${step.type} step completed with no external side effect.`, {}, 'system');
    return updated;
  }

  private async advanceControlledActionStep(planId: string, step: ActionPlanStep): Promise<ActionPlanStep> {
    if (!isAllowedActionType(step.actionType)) {
      // Defense in depth — createPlanVersion() and validate() already reject this, so
      // this branch should be unreachable, but the execution boundary never trusts that.
      const failed = this.store.updateStepStatus(step.id, 'FAILED', { failureReason: 'forbidden action type' });
      this.store.recordEvidence(planId, step.id, 'STEP_FAILED', 'Forbidden action type rejected at execution boundary.', { actionType: step.actionType }, 'system');
      return failed;
    }

    // Step 1: no proposal yet — create one through the existing Controlled Actions
    // surface (this call itself evaluates ActionPolicyEngine at the 'proposal' stage).
    if (!step.proposalId) {
      if (!this.store.claimStep(step.id, 'READY', 'RUNNING')) return this.store.getStep(step.id)!;
      let proposal;
      try {
        proposal = this.controlledActions.propose({
          actionType: step.actionType as any,
          reason: step.description,
          sourcePlanId: planId,
          projectId: step.projectId,
          normalizedPayload: step.actionPayload ?? {},
        });
      } catch (err: any) {
        const failed = this.store.updateStepStatus(step.id, 'FAILED', { failureReason: err?.message ?? 'proposal creation failed' });
        this.store.recordEvidence(planId, step.id, 'STEP_FAILED', `Proposal creation failed: ${err?.message ?? 'unknown error'}`, {}, 'system');
        return failed;
      }
      const decision = this.controlledActions.policyEngine.store.latestDecision(proposal.id);
      const waiting = this.store.updateStepStatus(step.id, 'WAITING_APPROVAL', {
        proposalId: proposal.id, riskClass: proposal.riskClass,
        policyDecisionId: decision?.id ?? null, policyDecisionResult: decision?.decision ?? null,
        requiredApprovalLevel: decision?.requiredApprovalLevel ?? null,
      });
      this.store.recordEvidence(planId, step.id, 'STEP_WAITING_APPROVAL', `Controlled Action proposal ${proposal.id} created; waiting for explicit approval through the existing Controlled Actions surface. This step's approval can never authorize any other step.`, { proposalId: proposal.id, actionType: proposal.actionType }, 'system');
      return waiting;
    }

    // Step 2: a proposal already exists — reflect its current governed status. Never
    // call approve() here (that would be the orchestration layer approving its own
    // action); only call execute(), which itself requires a prior human APPROVE and is
    // idempotent no-op if already executed.
    const proposal = this.controlledActions.get(step.proposalId);
    if (proposal.status === 'WAITING_APPROVAL') return step; // still waiting on a human
    if (proposal.status === 'APPROVED') {
      const approval = this.controlledActions.store.latestApproval(step.proposalId);
      const attemptSeq = this.store.countAttemptsForStep(step.id) + 1;
      const attemptIdempotencyKey = payloadHash({ stepId: step.id, proposalId: step.proposalId, attempt: attemptSeq });
      const attempt = this.store.saveStepAttempt({
        id: `attempt-${randomUUID()}`, stepId: step.id, attempt: attemptSeq,
        idempotencyKey: attemptIdempotencyKey, status: 'RUNNING', retryClass: null,
        startedAt: now(), completedAt: null, errorMessage: null,
      });
      if (approval) {
        this.store.recordEvidence(planId, step.id, 'APPROVAL_BOUND', `Approval ${approval.id} bound to exact proposal ${step.proposalId}, payload hash, action type, and target — this approval authorizes only this proposal.`, { approvalId: approval.id, proposalId: step.proposalId, payloadHash: approval.payloadHash }, 'system');
      }
      try {
        const execution = await this.controlledActions.execute(step.proposalId);
        if (attempt) this.store.completeStepAttempt(attempt.id, 'SUCCEEDED', null, null);
        const completed = this.store.updateStepStatus(step.id, 'COMPLETED', {
          outputSummary: { executionId: execution.id, externalObjectId: execution.externalObjectId },
          completedAt: now(),
        });
        this.store.recordEvidence(planId, step.id, 'STEP_EXECUTED', `Controlled Action executed via proposal ${step.proposalId}.`, { executionId: execution.id }, 'system');
        return completed;
      } catch (err: any) {
        const message = err?.message ?? 'execution failed';
        if (message.includes('BLOCK_BUDGET')) {
          if (attempt) this.store.completeStepAttempt(attempt.id, 'FAILED', 'BUDGET_DENIED', message);
          this.store.recordEvidence(planId, step.id, 'BUDGET_BLOCKED', message, {}, 'system');
          return step; // stays WAITING_APPROVAL — retryable once the budget window resets; zero side effect consumed
        }
        if (message.includes('policy blocked') || message.includes('FORBIDDEN_RISK')) {
          if (attempt) this.store.completeStepAttempt(attempt.id, 'FAILED', 'POLICY_DENIED', message);
          const failed = this.store.updateStepStatus(step.id, 'FAILED', { failureReason: message });
          this.store.recordEvidence(planId, step.id, 'POLICY_DENIED', message, {}, 'system');
          return failed;
        }
        if (attempt) this.store.completeStepAttempt(attempt.id, 'FAILED', 'NON_RETRYABLE', message);
        const failed = this.store.updateStepStatus(step.id, 'FAILED', { failureReason: message });
        this.store.recordEvidence(planId, step.id, 'STEP_FAILED', `Execution failed: ${message}`, {}, 'system');
        return failed;
      }
    }
    if (proposal.status === 'COMPLETED') {
      const completed = this.store.updateStepStatus(step.id, 'COMPLETED', { completedAt: now() });
      return completed;
    }
    if (['REJECTED', 'EXPIRED', 'FAILED', 'CANCELLED'].includes(proposal.status)) {
      const failed = this.store.updateStepStatus(step.id, 'FAILED', { failureReason: `underlying proposal ${proposal.status}` });
      this.store.recordEvidence(planId, step.id, 'STEP_FAILED', `Underlying Controlled Action proposal ended as ${proposal.status}.`, {}, 'system');
      return failed;
    }
    return step; // EXECUTING — in progress, nothing to do this advance
  }
}
