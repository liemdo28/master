import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { applyPhase5iMigration } from './schema';
import type {
  DelegatedAuthority, DelegatedAuthorityStatus, DelegationDecision, DelegationEvidence,
  DelegationEventType,
} from './types';

function dataDir(): string {
  return process.env.MI_PERSONAL_OS_DIR
    ? path.resolve(process.env.MI_PERSONAL_OS_DIR)
    : path.resolve(process.cwd(), '.local-agent-global', 'personal-os');
}

const now = (): string => new Date().toISOString();

function rowToDelegation(row: any): DelegatedAuthority {
  return {
    id: row.id,
    delegationVersion: row.delegationVersion,
    previousVersionId: row.previousVersionId ?? null,
    title: row.title,
    description: row.description,
    owner: row.owner,
    projectId: row.projectId,
    status: row.status,
    allowedActionTypes: JSON.parse(row.allowedActionTypesJson),
    deniedActionTypes: JSON.parse(row.deniedActionTypesJson),
    targetRestriction: JSON.parse(row.targetRestrictionJson),
    riskCeiling: row.riskCeiling,
    approvalLevelCeiling: row.approvalLevelCeiling,
    startsAt: row.startsAt,
    expiresAt: row.expiresAt,
    timezone: row.timezone,
    maxExecutions: row.maxExecutions,
    usedExecutions: row.usedExecutions,
    maxTargets: row.maxTargets ?? null,
    usedTargets: row.usedTargets,
    actionBudgets: JSON.parse(row.actionBudgetsJson),
    sourceGoalId: row.sourceGoalId ?? null,
    sourcePlanId: row.sourcePlanId ?? null,
    policyVersion: row.policyVersion ?? null,
    policyHash: row.policyHash ?? null,
    delegationPayloadHash: row.delegationPayloadHash,
    createdAt: row.createdAt,
    approvedAt: row.approvedAt ?? null,
    activatedAt: row.activatedAt ?? null,
    revokedAt: row.revokedAt ?? null,
    exhaustedAt: row.exhaustedAt ?? null,
    expiredAt: row.expiredAt ?? null,
    pausedReason: row.pausedReason ?? null,
    evidenceReferences: JSON.parse(row.evidenceReferencesJson ?? '[]'),
  };
}

function rowToDecision(row: any): DelegationDecision {
  return {
    id: row.id,
    delegationId: row.delegationId,
    proposalId: row.proposalId,
    actionType: row.actionType,
    projectId: row.projectId,
    eligible: !!row.eligible,
    reasons: JSON.parse(row.reasonsJson),
    quotaBefore: JSON.parse(row.quotaBeforeJson),
    quotaAfter: row.quotaAfterJson ? JSON.parse(row.quotaAfterJson) : null,
    targetScopeResult: row.targetScopeResult,
    timeWindowResult: row.timeWindowResult,
    riskResult: row.riskResult,
    policyResult: row.policyResult,
    killSwitchResult: row.killSwitchResult,
    budgetResult: row.budgetResult,
    decisionHash: row.decisionHash,
    evaluatedAt: row.evaluatedAt,
  };
}

export class DelegationStore {
  private db: Database.Database;

  constructor(readonly root = dataDir()) {
    fs.mkdirSync(root, { recursive: true });
    this.db = new Database(path.join(root, 'personal-os.db'));
    applyPhase5iMigration(this.db);
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

  // ── Delegated authorities ──────────────────────────────────────────────

  saveDelegation(d: DelegatedAuthority): DelegatedAuthority {
    this.db.prepare(`
      INSERT INTO delegated_authorities (
        id, delegationVersion, previousVersionId, title, description, owner, projectId, status,
        allowedActionTypesJson, deniedActionTypesJson, targetRestrictionJson, riskCeiling,
        approvalLevelCeiling, startsAt, expiresAt, timezone, maxExecutions, usedExecutions,
        maxTargets, usedTargets, actionBudgetsJson, sourceGoalId, sourcePlanId, policyVersion,
        policyHash, delegationPayloadHash, createdAt, approvedAt, activatedAt, revokedAt,
        exhaustedAt, expiredAt, pausedReason, evidenceReferencesJson
      ) VALUES (
        @id, @delegationVersion, @previousVersionId, @title, @description, @owner, @projectId, @status,
        @allowedActionTypesJson, @deniedActionTypesJson, @targetRestrictionJson, @riskCeiling,
        @approvalLevelCeiling, @startsAt, @expiresAt, @timezone, @maxExecutions, @usedExecutions,
        @maxTargets, @usedTargets, @actionBudgetsJson, @sourceGoalId, @sourcePlanId, @policyVersion,
        @policyHash, @delegationPayloadHash, @createdAt, @approvedAt, @activatedAt, @revokedAt,
        @exhaustedAt, @expiredAt, @pausedReason, @evidenceReferencesJson
      )
    `).run({
      ...d,
      allowedActionTypesJson: JSON.stringify(d.allowedActionTypes),
      deniedActionTypesJson: JSON.stringify(d.deniedActionTypes),
      targetRestrictionJson: JSON.stringify(d.targetRestriction),
      actionBudgetsJson: JSON.stringify(d.actionBudgets),
      evidenceReferencesJson: JSON.stringify(d.evidenceReferences),
    });
    return d;
  }

  getDelegation(id: string): DelegatedAuthority | null {
    const row = this.db.prepare(`SELECT * FROM delegated_authorities WHERE id = ? ORDER BY delegationVersion DESC LIMIT 1`).get(id);
    return row ? rowToDelegation(row) : null;
  }

  getDelegationVersion(id: string, version: number): DelegatedAuthority | null {
    const row = this.db.prepare(`SELECT * FROM delegated_authorities WHERE id = ? AND delegationVersion = ?`).get(id, version);
    return row ? rowToDelegation(row) : null;
  }

  listDelegations(status?: DelegatedAuthorityStatus): DelegatedAuthority[] {
    // Only the latest version of each delegation id is a "current" row for listing purposes.
    const rows = status
      ? this.db.prepare(`
          SELECT da.* FROM delegated_authorities da
          INNER JOIN (SELECT id, MAX(delegationVersion) AS maxV FROM delegated_authorities GROUP BY id) latest
            ON da.id = latest.id AND da.delegationVersion = latest.maxV
          WHERE da.status = ? ORDER BY da.createdAt DESC
        `).all(status)
      : this.db.prepare(`
          SELECT da.* FROM delegated_authorities da
          INNER JOIN (SELECT id, MAX(delegationVersion) AS maxV FROM delegated_authorities GROUP BY id) latest
            ON da.id = latest.id AND da.delegationVersion = latest.maxV
          ORDER BY da.createdAt DESC
        `).all();
    return (rows as any[]).map(rowToDelegation);
  }

  updateDelegationStatus(id: string, version: number, status: DelegatedAuthorityStatus, patch: Partial<DelegatedAuthority> = {}): DelegatedAuthority {
    this.db.prepare(`
      UPDATE delegated_authorities SET status = @status,
        approvedAt = COALESCE(@approvedAt, approvedAt),
        activatedAt = COALESCE(@activatedAt, activatedAt),
        revokedAt = COALESCE(@revokedAt, revokedAt),
        exhaustedAt = COALESCE(@exhaustedAt, exhaustedAt),
        expiredAt = COALESCE(@expiredAt, expiredAt),
        pausedReason = @pausedReason
      WHERE id = @id AND delegationVersion = @version
    `).run({
      id, version, status,
      approvedAt: patch.approvedAt ?? null,
      activatedAt: patch.activatedAt ?? null,
      revokedAt: patch.revokedAt ?? null,
      exhaustedAt: patch.exhaustedAt ?? null,
      expiredAt: patch.expiredAt ?? null,
      pausedReason: patch.pausedReason ?? null,
    });
    return this.getDelegationVersion(id, version)!;
  }

  /**
   * Atomically reserves one execution slot (and optionally N target slots) — the UPDATE
   * only succeeds if the current usage is still strictly below both ceilings, mirroring
   * claimStep()'s conditional-UPDATE pattern (orchestration/store.ts) and
   * BudgetManager.reserveExecution() (Phase 5G). Only one of several concurrent racers
   * can ever win the last slot.
   */
  reserveQuota(id: string, version: number, targetsRequested: number): boolean {
    const result = this.db.prepare(`
      UPDATE delegated_authorities
      SET usedExecutions = usedExecutions + 1, usedTargets = usedTargets + @targetsRequested
      WHERE id = @id AND delegationVersion = @version
        AND usedExecutions < maxExecutions
        AND (maxTargets IS NULL OR usedTargets + @targetsRequested <= maxTargets)
    `).run({ id, version, targetsRequested });
    return result.changes === 1;
  }

  recordQuotaUsage(delegationId: string, proposalId: string, kind: 'EXECUTION' | 'TARGET', amount: number): void {
    try {
      this.db.prepare(`
        INSERT INTO delegation_quota_usage (id, delegationId, proposalId, kind, amount, reservedAt)
        VALUES (@id, @delegationId, @proposalId, @kind, @amount, @reservedAt)
      `).run({ id: `dqu-${randomUUID()}`, delegationId, proposalId, kind, amount, reservedAt: now() });
    } catch (err: any) {
      if (!String(err?.message ?? '').includes('UNIQUE')) throw err; // duplicate reservation for same proposal is a safe no-op
    }
  }

  // ── Immutable version snapshots ────────────────────────────────────────

  saveVersionSnapshot(input: {
    delegationId: string; delegationVersion: number; snapshot: unknown; delegationPayloadHash: string;
    policyVersion: string | null; policyHash: string | null; approver: string; strongConfirmationHash: string;
  }): void {
    this.db.prepare(`
      INSERT INTO delegation_versions (id, delegationId, delegationVersion, snapshotJson, delegationPayloadHash, policyVersion, policyHash, approver, strongConfirmationHash, approvedAt)
      VALUES (@id, @delegationId, @delegationVersion, @snapshotJson, @delegationPayloadHash, @policyVersion, @policyHash, @approver, @strongConfirmationHash, @approvedAt)
    `).run({
      id: `dver-${randomUUID()}`, delegationId: input.delegationId, delegationVersion: input.delegationVersion,
      snapshotJson: JSON.stringify(input.snapshot), delegationPayloadHash: input.delegationPayloadHash,
      policyVersion: input.policyVersion, policyHash: input.policyHash, approver: input.approver,
      strongConfirmationHash: input.strongConfirmationHash, approvedAt: now(),
    });
  }

  getVersionSnapshot(delegationId: string, delegationVersion: number): any | null {
    const row = this.db.prepare(`SELECT * FROM delegation_versions WHERE delegationId = ? AND delegationVersion = ?`).get(delegationId, delegationVersion) as any;
    return row ? { ...row, snapshot: JSON.parse(row.snapshotJson) } : null;
  }

  // ── Decisions ───────────────────────────────────────────────────────────

  saveDecision(d: DelegationDecision): DelegationDecision {
    this.db.prepare(`
      INSERT INTO delegation_decisions (
        id, delegationId, proposalId, actionType, projectId, eligible, reasonsJson,
        quotaBeforeJson, quotaAfterJson, targetScopeResult, timeWindowResult, riskResult,
        policyResult, killSwitchResult, budgetResult, decisionHash, evaluatedAt
      ) VALUES (
        @id, @delegationId, @proposalId, @actionType, @projectId, @eligible, @reasonsJson,
        @quotaBeforeJson, @quotaAfterJson, @targetScopeResult, @timeWindowResult, @riskResult,
        @policyResult, @killSwitchResult, @budgetResult, @decisionHash, @evaluatedAt
      )
    `).run({
      ...d, eligible: d.eligible ? 1 : 0, reasonsJson: JSON.stringify(d.reasons),
      quotaBeforeJson: JSON.stringify(d.quotaBefore), quotaAfterJson: d.quotaAfter ? JSON.stringify(d.quotaAfter) : null,
    });
    return d;
  }

  listDecisionsForDelegation(delegationId: string): DelegationDecision[] {
    const rows = this.db.prepare(`SELECT * FROM delegation_decisions WHERE delegationId = ? ORDER BY evaluatedAt ASC`).all(delegationId);
    return (rows as any[]).map(rowToDecision);
  }

  latestDecisionForProposal(proposalId: string): DelegationDecision | null {
    const row = this.db.prepare(`SELECT * FROM delegation_decisions WHERE proposalId = ? ORDER BY evaluatedAt DESC LIMIT 1`).get(proposalId);
    return row ? rowToDecision(row) : null;
  }

  // ── Events ──────────────────────────────────────────────────────────────

  recordEvent(delegationId: string, proposalId: string | null, eventType: DelegationEventType, summary: string, metadata: Record<string, unknown>, actor: string): DelegationEvidence {
    const evidence: DelegationEvidence = { id: `deleg-evidence-${randomUUID()}`, delegationId, proposalId, eventType, summary, metadata, actor, createdAt: now() };
    this.db.prepare(`
      INSERT INTO delegation_events (id, delegationId, proposalId, eventType, summary, metadataJson, actor, createdAt)
      VALUES (@id, @delegationId, @proposalId, @eventType, @summary, @metadataJson, @actor, @createdAt)
    `).run({ ...evidence, metadataJson: JSON.stringify(evidence.metadata) });
    return evidence;
  }

  listEventsForDelegation(delegationId: string): DelegationEvidence[] {
    const rows = this.db.prepare(`SELECT * FROM delegation_events WHERE delegationId = ? ORDER BY createdAt ASC`).all(delegationId);
    return (rows as any[]).map(r => ({ ...r, metadata: JSON.parse(r.metadataJson) }));
  }

  // ── Expiry sweep (called defensively before every eligibility check) ──

  /** Transitions any ACTIVE/PAUSED* delegation whose expiresAt has passed into EXPIRED.
   *  Deterministic, no scheduler required — evaluated inline on every relevant call. */
  sweepExpired(nowIso: string = now()): number {
    const result = this.db.prepare(`
      UPDATE delegated_authorities SET status = 'EXPIRED', expiredAt = @nowIso
      WHERE status IN ('ACTIVE', 'PAUSED', 'PAUSED_POLICY_CHANGED') AND expiresAt <= @nowIso
    `).run({ nowIso });
    return result.changes;
  }
}
