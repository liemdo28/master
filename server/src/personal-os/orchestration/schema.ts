import Database from 'better-sqlite3';
import { currentSchemaVersion } from '../operating/store';
import { applyPhase5gMigration } from '../actions/governance/schema';
import { PHASE5H_SCHEMA_VERSION } from './types';

const now = (): string => new Date().toISOString();

/**
 * Applies schema v9 — additive orchestration tables only. Chains through v8 (Phase 5G
 * governance) first, same pattern every prior phase in this database uses. Idempotent:
 * a second run against an already-migrated database applies nothing (`applied: false`).
 */
export function applyPhase5hMigration(db: Database.Database): { from: number; to: number; applied: boolean } {
  const before = currentSchemaVersion(db);
  if (before < 8) applyPhase5gMigration(db);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS action_plans (
        id TEXT PRIMARY KEY,
        goalId TEXT,
        title TEXT NOT NULL,
        objective TEXT NOT NULL,
        projectId TEXT,
        status TEXT NOT NULL,
        planVersion INTEGER NOT NULL,
        previousVersionId TEXT,
        planHash TEXT NOT NULL,
        policyVersion TEXT,
        policyHash TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        validatedAt TEXT,
        completedAt TEXT,
        cancelledAt TEXT,
        failureReason TEXT,
        blockedReason TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_action_plans_status ON action_plans(status);
      CREATE INDEX IF NOT EXISTS idx_action_plans_project ON action_plans(projectId);
      CREATE INDEX IF NOT EXISTS idx_action_plans_goal ON action_plans(goalId);

      CREATE TABLE IF NOT EXISTS action_plan_steps (
        id TEXT PRIMARY KEY,
        planId TEXT NOT NULL,
        stepIndex INTEGER NOT NULL,
        key TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        projectId TEXT,
        inputsJson TEXT NOT NULL,
        expectedOutputsJson TEXT NOT NULL,
        sideEffectClass TEXT NOT NULL,
        actionType TEXT,
        actionPayloadJson TEXT,
        riskClass TEXT,
        requiredApprovalLevel TEXT,
        policyDecisionId TEXT,
        policyDecisionResult TEXT,
        proposalId TEXT,
        status TEXT NOT NULL,
        outputSummaryJson TEXT,
        failureReason TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        startedAt TEXT,
        completedAt TEXT,
        FOREIGN KEY (planId) REFERENCES action_plans(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_action_plan_steps_plan_key ON action_plan_steps(planId, key);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_action_plan_steps_plan_index ON action_plan_steps(planId, stepIndex);
      CREATE INDEX IF NOT EXISTS idx_action_plan_steps_plan ON action_plan_steps(planId);
      CREATE INDEX IF NOT EXISTS idx_action_plan_steps_status ON action_plan_steps(status);
      CREATE INDEX IF NOT EXISTS idx_action_plan_steps_proposal ON action_plan_steps(proposalId);

      CREATE TABLE IF NOT EXISTS action_plan_dependencies (
        id TEXT PRIMARY KEY,
        planId TEXT NOT NULL,
        stepId TEXT NOT NULL,
        dependsOnStepId TEXT NOT NULL,
        FOREIGN KEY (planId) REFERENCES action_plans(id),
        FOREIGN KEY (stepId) REFERENCES action_plan_steps(id),
        FOREIGN KEY (dependsOnStepId) REFERENCES action_plan_steps(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_action_plan_deps_unique ON action_plan_dependencies(stepId, dependsOnStepId);
      CREATE INDEX IF NOT EXISTS idx_action_plan_deps_step ON action_plan_dependencies(stepId);
      CREATE INDEX IF NOT EXISTS idx_action_plan_deps_dependson ON action_plan_dependencies(dependsOnStepId);

      CREATE TABLE IF NOT EXISTS action_plan_runs (
        id TEXT PRIMARY KEY,
        planId TEXT NOT NULL,
        triggeredBy TEXT NOT NULL,
        idempotencyKey TEXT NOT NULL,
        stepsAdvanced INTEGER NOT NULL,
        startedAt TEXT NOT NULL,
        completedAt TEXT,
        resultSummary TEXT,
        FOREIGN KEY (planId) REFERENCES action_plans(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_action_plan_runs_idempotency ON action_plan_runs(idempotencyKey);
      CREATE INDEX IF NOT EXISTS idx_action_plan_runs_plan ON action_plan_runs(planId);

      CREATE TABLE IF NOT EXISTS action_plan_step_attempts (
        id TEXT PRIMARY KEY,
        stepId TEXT NOT NULL,
        attempt INTEGER NOT NULL,
        idempotencyKey TEXT NOT NULL,
        status TEXT NOT NULL,
        retryClass TEXT,
        startedAt TEXT NOT NULL,
        completedAt TEXT,
        errorMessage TEXT,
        FOREIGN KEY (stepId) REFERENCES action_plan_steps(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_action_plan_step_attempts_idempotency ON action_plan_step_attempts(idempotencyKey);
      CREATE INDEX IF NOT EXISTS idx_action_plan_step_attempts_step ON action_plan_step_attempts(stepId);

      CREATE TABLE IF NOT EXISTS action_plan_evidence (
        id TEXT PRIMARY KEY,
        planId TEXT NOT NULL,
        stepId TEXT,
        eventType TEXT NOT NULL,
        summary TEXT NOT NULL,
        metadataJson TEXT NOT NULL,
        actor TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (planId) REFERENCES action_plans(id)
      );
      CREATE INDEX IF NOT EXISTS idx_action_plan_evidence_plan ON action_plan_evidence(planId);
      CREATE INDEX IF NOT EXISTS idx_action_plan_evidence_step ON action_plan_evidence(stepId);
    `);
    db.prepare(`INSERT OR IGNORE INTO schema_migrations (version, appliedAt) VALUES (?, ?)`).run(PHASE5H_SCHEMA_VERSION, now());
  })();

  return { from: before, to: currentSchemaVersion(db), applied: before < PHASE5H_SCHEMA_VERSION };
}
