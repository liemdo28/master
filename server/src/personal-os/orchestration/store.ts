import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { applyPhase5hMigration } from './schema';
import type {
  ActionPlan, ActionPlanEvidence, ActionPlanRun, ActionPlanStatus, ActionPlanStep,
  ActionPlanStepAttempt, ActionPlanStepStatus, PlanEvidenceEventType,
} from './types';

function dataDir(): string {
  return process.env.MI_PERSONAL_OS_DIR
    ? path.resolve(process.env.MI_PERSONAL_OS_DIR)
    : path.resolve(process.cwd(), '.local-agent-global', 'personal-os');
}

const now = (): string => new Date().toISOString();

function rowToPlan(row: any): ActionPlan {
  return {
    id: row.id,
    goalId: row.goalId ?? null,
    title: row.title,
    objective: row.objective,
    projectId: row.projectId ?? null,
    status: row.status,
    planVersion: row.planVersion,
    previousVersionId: row.previousVersionId ?? null,
    planHash: row.planHash,
    policyVersion: row.policyVersion ?? null,
    policyHash: row.policyHash ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    validatedAt: row.validatedAt ?? null,
    completedAt: row.completedAt ?? null,
    cancelledAt: row.cancelledAt ?? null,
    failureReason: row.failureReason ?? null,
    blockedReason: row.blockedReason ?? null,
  };
}

function rowToStep(row: any): ActionPlanStep {
  return {
    id: row.id,
    planId: row.planId,
    stepIndex: row.stepIndex,
    key: row.key,
    type: row.type,
    description: row.description,
    projectId: row.projectId ?? null,
    dependsOnStepIds: JSON.parse(row.dependsOnStepIdsJson ?? '[]'),
    inputs: JSON.parse(row.inputsJson),
    expectedOutputs: JSON.parse(row.expectedOutputsJson),
    sideEffectClass: row.sideEffectClass,
    actionType: row.actionType ?? null,
    actionPayload: row.actionPayloadJson ? JSON.parse(row.actionPayloadJson) : null,
    riskClass: row.riskClass ?? null,
    requiredApprovalLevel: row.requiredApprovalLevel ?? null,
    policyDecisionId: row.policyDecisionId ?? null,
    policyDecisionResult: row.policyDecisionResult ?? null,
    proposalId: row.proposalId ?? null,
    status: row.status,
    outputSummary: row.outputSummaryJson ? JSON.parse(row.outputSummaryJson) : null,
    failureReason: row.failureReason ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    startedAt: row.startedAt ?? null,
    completedAt: row.completedAt ?? null,
  };
}

export class OrchestrationStore {
  private db: Database.Database;

  constructor(readonly root = dataDir()) {
    fs.mkdirSync(root, { recursive: true });
    this.db = new Database(path.join(root, 'personal-os.db'));
    applyPhase5hMigration(this.db);
  }

  close(): void { this.db.close(); }
  get handle(): Database.Database { return this.db; }
  runInTransaction<T>(fn: () => T): T { return this.db.transaction(fn)(); }

  integrity(): { integrityCheck: string; foreignKeyViolations: unknown[]; schemaVersion: number } {
    const integrity = this.db.prepare(`PRAGMA integrity_check`).get() as Record<string, string>;
    return {
      integrityCheck: Object.values(integrity)[0],
      foreignKeyViolations: this.db.prepare(`PRAGMA foreign_key_check`).all(),
      schemaVersion: (this.db.prepare(`SELECT MAX(version) AS v FROM schema_migrations`).get() as { v: number | null }).v ?? 0,
    };
  }

  // ── Plans ──────────────────────────────────────────────────────────────

  savePlan(plan: ActionPlan): ActionPlan {
    this.db.prepare(`
      INSERT INTO action_plans (
        id, goalId, title, objective, projectId, status, planVersion, previousVersionId,
        planHash, policyVersion, policyHash, createdAt, updatedAt, validatedAt,
        completedAt, cancelledAt, failureReason, blockedReason
      ) VALUES (
        @id, @goalId, @title, @objective, @projectId, @status, @planVersion, @previousVersionId,
        @planHash, @policyVersion, @policyHash, @createdAt, @updatedAt, @validatedAt,
        @completedAt, @cancelledAt, @failureReason, @blockedReason
      )
    `).run(plan);
    return plan;
  }

  getPlan(id: string): ActionPlan | null {
    const row = this.db.prepare(`SELECT * FROM action_plans WHERE id = ?`).get(id);
    return row ? rowToPlan(row) : null;
  }

  listPlans(status?: ActionPlanStatus): ActionPlan[] {
    const rows = status
      ? this.db.prepare(`SELECT * FROM action_plans WHERE status = ? ORDER BY createdAt DESC`).all(status)
      : this.db.prepare(`SELECT * FROM action_plans ORDER BY createdAt DESC`).all();
    return (rows as any[]).map(rowToPlan);
  }

  updatePlanStatus(id: string, status: ActionPlanStatus, patch: Partial<ActionPlan> = {}): ActionPlan {
    const updatedAt = now();
    this.db.prepare(`
      UPDATE action_plans SET status = @status, updatedAt = @updatedAt,
        validatedAt = COALESCE(@validatedAt, validatedAt),
        completedAt = COALESCE(@completedAt, completedAt),
        cancelledAt = COALESCE(@cancelledAt, cancelledAt),
        failureReason = COALESCE(@failureReason, failureReason),
        blockedReason = @blockedReason
      WHERE id = @id
    `).run({
      id, status, updatedAt,
      validatedAt: patch.validatedAt ?? null,
      completedAt: patch.completedAt ?? null,
      cancelledAt: patch.cancelledAt ?? null,
      failureReason: patch.failureReason ?? null,
      blockedReason: patch.blockedReason ?? null,
    });
    return this.getPlan(id)!;
  }

  // ── Steps ──────────────────────────────────────────────────────────────

  saveStep(step: ActionPlanStep): ActionPlanStep {
    this.db.prepare(`
      INSERT INTO action_plan_steps (
        id, planId, stepIndex, key, type, description, projectId, inputsJson,
        expectedOutputsJson, sideEffectClass, actionType, actionPayloadJson, riskClass,
        requiredApprovalLevel, policyDecisionId, policyDecisionResult, proposalId, status,
        outputSummaryJson, failureReason, createdAt, updatedAt, startedAt, completedAt
      ) VALUES (
        @id, @planId, @stepIndex, @key, @type, @description, @projectId, @inputsJson,
        @expectedOutputsJson, @sideEffectClass, @actionType, @actionPayloadJson, @riskClass,
        @requiredApprovalLevel, @policyDecisionId, @policyDecisionResult, @proposalId, @status,
        @outputSummaryJson, @failureReason, @createdAt, @updatedAt, @startedAt, @completedAt
      )
    `).run({
      id: step.id, planId: step.planId, stepIndex: step.stepIndex, key: step.key,
      type: step.type, description: step.description, projectId: step.projectId,
      inputsJson: JSON.stringify(step.inputs), expectedOutputsJson: JSON.stringify(step.expectedOutputs),
      sideEffectClass: step.sideEffectClass, actionType: step.actionType,
      actionPayloadJson: step.actionPayload ? JSON.stringify(step.actionPayload) : null,
      riskClass: step.riskClass, requiredApprovalLevel: step.requiredApprovalLevel,
      policyDecisionId: step.policyDecisionId, policyDecisionResult: step.policyDecisionResult,
      proposalId: step.proposalId, status: step.status,
      outputSummaryJson: step.outputSummary ? JSON.stringify(step.outputSummary) : null,
      failureReason: step.failureReason, createdAt: step.createdAt, updatedAt: step.updatedAt,
      startedAt: step.startedAt, completedAt: step.completedAt,
    });
    return step;
  }

  getStep(id: string): ActionPlanStep | null {
    const row = this.db.prepare(`
      SELECT s.*, (
        SELECT json_group_array(dependsOnStepId) FROM action_plan_dependencies WHERE stepId = s.id
      ) AS dependsOnStepIdsJson
      FROM action_plan_steps s WHERE s.id = ?
    `).get(id);
    return row ? rowToStep(row) : null;
  }

  listStepsForPlan(planId: string): ActionPlanStep[] {
    const rows = this.db.prepare(`
      SELECT s.*, (
        SELECT json_group_array(dependsOnStepId) FROM action_plan_dependencies WHERE stepId = s.id
      ) AS dependsOnStepIdsJson
      FROM action_plan_steps s WHERE s.planId = ? ORDER BY s.stepIndex ASC
    `).all(planId);
    return (rows as any[]).map(rowToStep);
  }

  /**
   * Atomically claims a step for advancement: the UPDATE only succeeds if the step is
   * still in `fromStatus`. If two workers race, only one UPDATE affects a row — the
   * loser sees `changes === 0` and backs off. DB-constraint-based, not an in-memory lock.
   */
  claimStep(id: string, fromStatus: ActionPlanStepStatus, toStatus: ActionPlanStepStatus): boolean {
    const updatedAt = now();
    const startedAt = toStatus === 'RUNNING' ? updatedAt : null;
    const result = this.db.prepare(`
      UPDATE action_plan_steps SET status = @toStatus, updatedAt = @updatedAt,
        startedAt = COALESCE(@startedAt, startedAt)
      WHERE id = @id AND status = @fromStatus
    `).run({ id, fromStatus, toStatus, updatedAt, startedAt });
    return result.changes === 1;
  }

  updateStepStatus(id: string, status: ActionPlanStepStatus, patch: Partial<ActionPlanStep> = {}): ActionPlanStep {
    const updatedAt = now();
    this.db.prepare(`
      UPDATE action_plan_steps SET status = @status, updatedAt = @updatedAt,
        proposalId = COALESCE(@proposalId, proposalId),
        policyDecisionId = COALESCE(@policyDecisionId, policyDecisionId),
        policyDecisionResult = COALESCE(@policyDecisionResult, policyDecisionResult),
        riskClass = COALESCE(@riskClass, riskClass),
        requiredApprovalLevel = COALESCE(@requiredApprovalLevel, requiredApprovalLevel),
        outputSummaryJson = COALESCE(@outputSummaryJson, outputSummaryJson),
        failureReason = @failureReason,
        completedAt = COALESCE(@completedAt, completedAt)
      WHERE id = @id
    `).run({
      id, status, updatedAt,
      proposalId: patch.proposalId ?? null,
      policyDecisionId: patch.policyDecisionId ?? null,
      policyDecisionResult: patch.policyDecisionResult ?? null,
      riskClass: patch.riskClass ?? null,
      requiredApprovalLevel: patch.requiredApprovalLevel ?? null,
      outputSummaryJson: patch.outputSummary ? JSON.stringify(patch.outputSummary) : null,
      failureReason: patch.failureReason ?? null,
      completedAt: patch.completedAt ?? null,
    });
    return this.getStep(id)!;
  }

  // ── Dependencies ───────────────────────────────────────────────────────

  saveDependency(planId: string, stepId: string, dependsOnStepId: string): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO action_plan_dependencies (id, planId, stepId, dependsOnStepId)
      VALUES (@id, @planId, @stepId, @dependsOnStepId)
    `).run({ id: `dep-${randomUUID()}`, planId, stepId, dependsOnStepId });
  }

  // ── Runs (advance-call idempotency) ───────────────────────────────────

  saveRun(run: ActionPlanRun): ActionPlanRun {
    this.db.prepare(`
      INSERT INTO action_plan_runs (id, planId, triggeredBy, idempotencyKey, stepsAdvanced, startedAt, completedAt, resultSummary)
      VALUES (@id, @planId, @triggeredBy, @idempotencyKey, @stepsAdvanced, @startedAt, @completedAt, @resultSummary)
    `).run(run);
    return run;
  }

  getRunByIdempotencyKey(key: string): ActionPlanRun | null {
    const row = this.db.prepare(`SELECT * FROM action_plan_runs WHERE idempotencyKey = ?`).get(key);
    return row as ActionPlanRun | null;
  }

  completeRun(id: string, stepsAdvanced: number, resultSummary: string): void {
    this.db.prepare(`
      UPDATE action_plan_runs SET completedAt = @completedAt, stepsAdvanced = @stepsAdvanced, resultSummary = @resultSummary WHERE id = @id
    `).run({ id, completedAt: now(), stepsAdvanced, resultSummary });
  }

  // ── Step attempts (per-execution idempotency) ─────────────────────────

  saveStepAttempt(attempt: ActionPlanStepAttempt): ActionPlanStepAttempt | null {
    try {
      this.db.prepare(`
        INSERT INTO action_plan_step_attempts (id, stepId, attempt, idempotencyKey, status, retryClass, startedAt, completedAt, errorMessage)
        VALUES (@id, @stepId, @attempt, @idempotencyKey, @status, @retryClass, @startedAt, @completedAt, @errorMessage)
      `).run(attempt);
      return attempt;
    } catch (err: any) {
      if (String(err?.message ?? '').includes('UNIQUE')) return null; // duplicate — caller should look up existing
      throw err;
    }
  }

  getStepAttemptByIdempotencyKey(key: string): ActionPlanStepAttempt | null {
    const row = this.db.prepare(`SELECT * FROM action_plan_step_attempts WHERE idempotencyKey = ?`).get(key);
    return row as ActionPlanStepAttempt | null;
  }

  completeStepAttempt(id: string, status: 'SUCCEEDED' | 'FAILED', retryClass: string | null, errorMessage: string | null): void {
    this.db.prepare(`
      UPDATE action_plan_step_attempts SET status = @status, retryClass = @retryClass, completedAt = @completedAt, errorMessage = @errorMessage WHERE id = @id
    `).run({ id, status, retryClass, completedAt: now(), errorMessage });
  }

  countAttemptsForStep(stepId: string): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS c FROM action_plan_step_attempts WHERE stepId = ?`).get(stepId) as { c: number };
    return row.c;
  }

  // ── Evidence ───────────────────────────────────────────────────────────

  recordEvidence(planId: string, stepId: string | null, eventType: PlanEvidenceEventType, summary: string, metadata: Record<string, unknown>, actor: string): ActionPlanEvidence {
    const evidence: ActionPlanEvidence = {
      id: `plan-evidence-${randomUUID()}`,
      planId, stepId, eventType, summary, metadata, actor, createdAt: now(),
    };
    this.db.prepare(`
      INSERT INTO action_plan_evidence (id, planId, stepId, eventType, summary, metadataJson, actor, createdAt)
      VALUES (@id, @planId, @stepId, @eventType, @summary, @metadataJson, @actor, @createdAt)
    `).run({ ...evidence, metadataJson: JSON.stringify(evidence.metadata) });
    return evidence;
  }

  listEvidenceForPlan(planId: string): ActionPlanEvidence[] {
    const rows = this.db.prepare(`SELECT * FROM action_plan_evidence WHERE planId = ? ORDER BY createdAt ASC`).all(planId);
    return (rows as any[]).map(r => ({ ...r, metadata: JSON.parse(r.metadataJson) }));
  }
}
