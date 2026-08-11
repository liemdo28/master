import Database from 'better-sqlite3';
import { currentSchemaVersion } from '../operating/store';
import { applyPhase5hMigration } from '../orchestration/schema';
import { PHASE5I_SCHEMA_VERSION } from './types';

const now = (): string => new Date().toISOString();

/**
 * Applies schema v10 — additive delegation tables only. Chains through v9
 * (applyPhase5hMigration, which itself chains all the way back through v7/v8) first,
 * the same pattern every prior phase's migration uses. Idempotent: a second run
 * against an already-migrated database applies nothing (`applied: false`).
 */
export function applyPhase5iMigration(db: Database.Database): { from: number; to: number; applied: boolean } {
  const before = currentSchemaVersion(db);
  if (before < 9) applyPhase5hMigration(db);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS delegated_authorities (
        id TEXT NOT NULL,
        delegationVersion INTEGER NOT NULL,
        previousVersionId TEXT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        owner TEXT NOT NULL,
        projectId TEXT NOT NULL,
        status TEXT NOT NULL,
        allowedActionTypesJson TEXT NOT NULL,
        deniedActionTypesJson TEXT NOT NULL,
        targetRestrictionJson TEXT NOT NULL,
        riskCeiling TEXT NOT NULL,
        approvalLevelCeiling TEXT NOT NULL,
        startsAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        timezone TEXT NOT NULL,
        maxExecutions INTEGER NOT NULL,
        usedExecutions INTEGER NOT NULL DEFAULT 0,
        maxTargets INTEGER,
        usedTargets INTEGER NOT NULL DEFAULT 0,
        actionBudgetsJson TEXT NOT NULL,
        sourceGoalId TEXT,
        sourcePlanId TEXT,
        policyVersion TEXT,
        policyHash TEXT,
        delegationPayloadHash TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        approvedAt TEXT,
        activatedAt TEXT,
        revokedAt TEXT,
        exhaustedAt TEXT,
        expiredAt TEXT,
        pausedReason TEXT,
        evidenceReferencesJson TEXT NOT NULL DEFAULT '[]',
        PRIMARY KEY (id, delegationVersion)
      );
      CREATE INDEX IF NOT EXISTS idx_delegated_authorities_status ON delegated_authorities(status);
      CREATE INDEX IF NOT EXISTS idx_delegated_authorities_project ON delegated_authorities(projectId);
      CREATE INDEX IF NOT EXISTS idx_delegated_authorities_expires ON delegated_authorities(expiresAt);

      -- Immutable snapshot of exactly what was strongly approved. Created once, at
      -- the WAITING_APPROVAL -> ACTIVE transition, and never updated afterward — the
      -- application layer enforces immutability the same way action_approvals rows
      -- are never mutated after creation (Phase 5F). Any material change requires a
      -- brand new (id, delegationVersion) pair with its own fresh snapshot.
      CREATE TABLE IF NOT EXISTS delegation_versions (
        id TEXT PRIMARY KEY,
        delegationId TEXT NOT NULL,
        delegationVersion INTEGER NOT NULL,
        snapshotJson TEXT NOT NULL,
        delegationPayloadHash TEXT NOT NULL,
        policyVersion TEXT,
        policyHash TEXT,
        approver TEXT NOT NULL,
        strongConfirmationHash TEXT NOT NULL,
        approvedAt TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_delegation_versions_unique ON delegation_versions(delegationId, delegationVersion);

      CREATE TABLE IF NOT EXISTS delegation_decisions (
        id TEXT PRIMARY KEY,
        delegationId TEXT NOT NULL,
        proposalId TEXT NOT NULL,
        actionType TEXT NOT NULL,
        projectId TEXT NOT NULL,
        eligible INTEGER NOT NULL,
        reasonsJson TEXT NOT NULL,
        quotaBeforeJson TEXT NOT NULL,
        quotaAfterJson TEXT,
        targetScopeResult TEXT NOT NULL,
        timeWindowResult TEXT NOT NULL,
        riskResult TEXT NOT NULL,
        policyResult TEXT NOT NULL,
        killSwitchResult TEXT NOT NULL,
        budgetResult TEXT NOT NULL,
        decisionHash TEXT NOT NULL,
        evaluatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_delegation_decisions_delegation ON delegation_decisions(delegationId);
      CREATE INDEX IF NOT EXISTS idx_delegation_decisions_proposal ON delegation_decisions(proposalId);

      -- Append-only reservation ledger. The authoritative atomic counters live on
      -- delegated_authorities (usedExecutions/usedTargets, reserved via a conditional
      -- UPDATE ... WHERE usedExecutions < maxExecutions, mirroring the exact optimistic
      -- concurrency pattern budget.ts and action_plan_steps.claimStep already use); this
      -- table exists purely for audit/evidence, one row per successful reservation.
      CREATE TABLE IF NOT EXISTS delegation_quota_usage (
        id TEXT PRIMARY KEY,
        delegationId TEXT NOT NULL,
        proposalId TEXT NOT NULL,
        kind TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reservedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_delegation_quota_usage_delegation ON delegation_quota_usage(delegationId);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_delegation_quota_usage_proposal_kind ON delegation_quota_usage(delegationId, proposalId, kind);

      CREATE TABLE IF NOT EXISTS delegation_events (
        id TEXT PRIMARY KEY,
        delegationId TEXT NOT NULL,
        proposalId TEXT,
        eventType TEXT NOT NULL,
        summary TEXT NOT NULL,
        metadataJson TEXT NOT NULL,
        actor TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_delegation_events_delegation ON delegation_events(delegationId);
    `);
    db.prepare(`INSERT OR IGNORE INTO schema_migrations (version, appliedAt) VALUES (?, ?)`).run(PHASE5I_SCHEMA_VERSION, now());
  })();

  return { from: before, to: currentSchemaVersion(db), applied: before < PHASE5I_SCHEMA_VERSION };
}
