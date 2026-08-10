import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { applyPhase5d3Migration, currentSchemaVersion } from '../operating/store';
import { applyPhase5gMigration } from './governance/schema';
import { PHASE5F_SCHEMA_VERSION } from './policy';
import type { ActionApproval, ActionCompensation, ActionEvidence, ActionExecution, ActionProposal, ActionProposalStatus } from './types';

function dataDir(): string {
  return process.env.MI_PERSONAL_OS_DIR
    ? path.resolve(process.env.MI_PERSONAL_OS_DIR)
    : path.resolve(process.cwd(), '.local-agent-global', 'personal-os');
}

const now = (): string => new Date().toISOString();

export function applyPhase5fMigration(db: Database.Database): { from: number; to: number; applied: boolean } {
  const before = currentSchemaVersion(db);
  if (before < 6) applyPhase5d3Migration(db);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS action_proposals (
        id TEXT PRIMARY KEY,
        actionType TEXT NOT NULL,
        riskClass TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        reason TEXT NOT NULL,
        sourceGoalId TEXT,
        sourceTaskId TEXT,
        sourceBriefId TEXT,
        sourcePlanId TEXT,
        projectId TEXT,
        targetSystem TEXT NOT NULL,
        requestedOperation TEXT NOT NULL,
        normalizedPayloadJson TEXT NOT NULL,
        payloadHash TEXT NOT NULL,
        previewJson TEXT NOT NULL,
        sideEffectsJson TEXT NOT NULL,
        rollbackPlan TEXT NOT NULL,
        requiredApprovals INTEGER NOT NULL,
        status TEXT NOT NULL,
        evidenceReferencesJson TEXT NOT NULL,
        idempotencyKey TEXT NOT NULL,
        safeFailure INTEGER NOT NULL,
        createdAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        approvedAt TEXT,
        executedAt TEXT,
        rejectedAt TEXT,
        failureCode TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_action_proposals_status ON action_proposals(status);
      CREATE INDEX IF NOT EXISTS idx_action_proposals_type ON action_proposals(actionType);
      CREATE INDEX IF NOT EXISTS idx_action_proposals_project ON action_proposals(projectId);
      CREATE INDEX IF NOT EXISTS idx_action_proposals_created ON action_proposals(createdAt);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_action_proposals_idempotency ON action_proposals(idempotencyKey);

      CREATE TABLE IF NOT EXISTS action_approvals (
        id TEXT PRIMARY KEY,
        proposalId TEXT NOT NULL,
        approver TEXT NOT NULL,
        decision TEXT NOT NULL,
        payloadHash TEXT NOT NULL,
        actionType TEXT NOT NULL,
        targetSystem TEXT NOT NULL,
        targetSummary TEXT NOT NULL,
        riskAcknowledgement TEXT NOT NULL,
        approvedAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        source TEXT NOT NULL,
        evidenceReferencesJson TEXT NOT NULL,
        approvedPayloadSnapshotJson TEXT NOT NULL,
        FOREIGN KEY (proposalId) REFERENCES action_proposals(id)
      );
      CREATE INDEX IF NOT EXISTS idx_action_approvals_proposal ON action_approvals(proposalId);

      CREATE TABLE IF NOT EXISTS action_executions (
        id TEXT PRIMARY KEY,
        proposalId TEXT NOT NULL,
        approvalId TEXT NOT NULL,
        actionType TEXT NOT NULL,
        idempotencyKey TEXT NOT NULL,
        status TEXT NOT NULL,
        attempt INTEGER NOT NULL,
        providerMode TEXT NOT NULL,
        providerRequestMetadataJson TEXT NOT NULL,
        providerResponseSummaryJson TEXT NOT NULL,
        externalObjectId TEXT,
        failureCode TEXT,
        startedAt TEXT NOT NULL,
        completedAt TEXT,
        FOREIGN KEY (proposalId) REFERENCES action_proposals(id),
        FOREIGN KEY (approvalId) REFERENCES action_approvals(id)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_action_executions_idempotency ON action_executions(idempotencyKey);
      CREATE INDEX IF NOT EXISTS idx_action_executions_proposal ON action_executions(proposalId);

      CREATE TABLE IF NOT EXISTS action_evidence (
        id TEXT PRIMARY KEY,
        proposalId TEXT NOT NULL,
        approvalId TEXT,
        executionId TEXT,
        eventType TEXT NOT NULL,
        summary TEXT NOT NULL,
        payloadHash TEXT,
        metadataJson TEXT NOT NULL,
        actor TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (proposalId) REFERENCES action_proposals(id)
      );
      CREATE INDEX IF NOT EXISTS idx_action_evidence_proposal ON action_evidence(proposalId);
      CREATE INDEX IF NOT EXISTS idx_action_evidence_event ON action_evidence(eventType);

      CREATE TABLE IF NOT EXISTS action_compensations (
        id TEXT PRIMARY KEY,
        proposalId TEXT NOT NULL,
        actionClass TEXT NOT NULL,
        available INTEGER NOT NULL,
        requiresNewApproval INTEGER NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (proposalId) REFERENCES action_proposals(id)
      );
      CREATE INDEX IF NOT EXISTS idx_action_compensations_proposal ON action_compensations(proposalId);
    `);
    db.prepare(`INSERT OR IGNORE INTO schema_migrations (version, appliedAt) VALUES (?, ?)`).run(PHASE5F_SCHEMA_VERSION, now());
  })();
  return { from: before, to: currentSchemaVersion(db), applied: before < PHASE5F_SCHEMA_VERSION };
}

export class ControlledActionStore {
  private db: Database.Database;

  constructor(readonly root = dataDir()) {
    fs.mkdirSync(root, { recursive: true });
    this.db = new Database(path.join(root, 'personal-os.db'));
    applyPhase5fMigration(this.db);
    applyPhase5gMigration(this.db);
  }

  close(): void { this.db.close(); }
  get handle(): Database.Database { return this.db; }

  runInTransaction<T>(fn: () => T): T { return this.db.transaction(fn)(); }

  saveProposal(proposal: ActionProposal): ActionProposal {
    this.db.prepare(`
      INSERT INTO action_proposals (
        id, actionType, riskClass, title, description, reason, sourceGoalId, sourceTaskId, sourceBriefId,
        sourcePlanId, projectId, targetSystem, requestedOperation, normalizedPayloadJson, payloadHash,
        previewJson, sideEffectsJson, rollbackPlan, requiredApprovals, status, evidenceReferencesJson,
        idempotencyKey, safeFailure, createdAt, expiresAt, approvedAt, executedAt, rejectedAt, failureCode
      ) VALUES (
        @id, @actionType, @riskClass, @title, @description, @reason, @sourceGoalId, @sourceTaskId, @sourceBriefId,
        @sourcePlanId, @projectId, @targetSystem, @requestedOperation, @normalizedPayloadJson, @payloadHash,
        @previewJson, @sideEffectsJson, @rollbackPlan, @requiredApprovals, @status, @evidenceReferencesJson,
        @idempotencyKey, @safeFailure, @createdAt, @expiresAt, @approvedAt, @executedAt, @rejectedAt, @failureCode
      )
    `).run(serializeProposal(proposal));
    return proposal;
  }

  listProposals(status?: ActionProposalStatus): ActionProposal[] {
    const rows = status
      ? this.db.prepare(`SELECT * FROM action_proposals WHERE status = ? ORDER BY createdAt DESC`).all(status)
      : this.db.prepare(`SELECT * FROM action_proposals ORDER BY createdAt DESC`).all();
    return (rows as any[]).map(parseProposal);
  }

  getProposal(id: string): ActionProposal | null {
    const row = this.db.prepare(`SELECT * FROM action_proposals WHERE id = ?`).get(id) as any;
    return row ? parseProposal(row) : null;
  }

  updateProposalStatus(id: string, status: ActionProposalStatus, patch: Partial<Pick<ActionProposal, 'approvedAt' | 'executedAt' | 'rejectedAt' | 'failureCode'>> = {}): ActionProposal {
    this.db.prepare(`
      UPDATE action_proposals SET status = @status, approvedAt = COALESCE(@approvedAt, approvedAt),
        executedAt = COALESCE(@executedAt, executedAt), rejectedAt = COALESCE(@rejectedAt, rejectedAt),
        failureCode = @failureCode WHERE id = @id
    `).run({ id, status, approvedAt: patch.approvedAt ?? null, executedAt: patch.executedAt ?? null, rejectedAt: patch.rejectedAt ?? null, failureCode: patch.failureCode ?? null });
    const updated = this.getProposal(id);
    if (!updated) throw new Error('proposal not found');
    return updated;
  }

  saveApproval(approval: ActionApproval): ActionApproval {
    this.db.prepare(`
      INSERT INTO action_approvals (
        id, proposalId, approver, decision, payloadHash, actionType, targetSystem, targetSummary,
        riskAcknowledgement, approvedAt, expiresAt, source, evidenceReferencesJson, approvedPayloadSnapshotJson
      ) VALUES (
        @id, @proposalId, @approver, @decision, @payloadHash, @actionType, @targetSystem, @targetSummary,
        @riskAcknowledgement, @approvedAt, @expiresAt, @source, @evidenceReferencesJson, @approvedPayloadSnapshotJson
      )
    `).run(serializeApproval(approval));
    return approval;
  }

  latestApproval(proposalId: string): ActionApproval | null {
    const row = this.db.prepare(`SELECT * FROM action_approvals WHERE proposalId = ? ORDER BY approvedAt DESC LIMIT 1`).get(proposalId) as any;
    return row ? parseApproval(row) : null;
  }

  saveExecution(execution: ActionExecution): ActionExecution {
    this.db.prepare(`
      INSERT INTO action_executions (
        id, proposalId, approvalId, actionType, idempotencyKey, status, attempt, providerMode,
        providerRequestMetadataJson, providerResponseSummaryJson, externalObjectId, failureCode, startedAt, completedAt
      ) VALUES (
        @id, @proposalId, @approvalId, @actionType, @idempotencyKey, @status, @attempt, @providerMode,
        @providerRequestMetadataJson, @providerResponseSummaryJson, @externalObjectId, @failureCode, @startedAt, @completedAt
      )
    `).run(serializeExecution(execution));
    return execution;
  }

  updateExecutionResult(
    id: string,
    patch: Pick<ActionExecution, 'status' | 'providerRequestMetadata' | 'providerResponseSummary' | 'externalObjectId' | 'failureCode' | 'completedAt'>,
  ): ActionExecution {
    this.db.prepare(`
      UPDATE action_executions SET status = @status, providerRequestMetadataJson = @providerRequestMetadataJson,
        providerResponseSummaryJson = @providerResponseSummaryJson, externalObjectId = @externalObjectId,
        failureCode = @failureCode, completedAt = @completedAt
      WHERE id = @id
    `).run({
      id,
      status: patch.status,
      providerRequestMetadataJson: JSON.stringify(patch.providerRequestMetadata),
      providerResponseSummaryJson: JSON.stringify(patch.providerResponseSummary),
      externalObjectId: patch.externalObjectId,
      failureCode: patch.failureCode,
      completedAt: patch.completedAt,
    });
    const updated = this.db.prepare(`SELECT * FROM action_executions WHERE id = ?`).get(id) as any;
    if (!updated) throw new Error('execution not found');
    return parseExecution(updated);
  }

  getExecutionByIdempotencyKey(key: string): ActionExecution | null {
    const row = this.db.prepare(`SELECT * FROM action_executions WHERE idempotencyKey = ?`).get(key) as any;
    return row ? parseExecution(row) : null;
  }

  listExecutions(proposalId: string): ActionExecution[] {
    return (this.db.prepare(`SELECT * FROM action_executions WHERE proposalId = ? ORDER BY startedAt ASC`).all(proposalId) as any[]).map(parseExecution);
  }

  saveEvidence(evidence: ActionEvidence): ActionEvidence {
    this.db.prepare(`
      INSERT INTO action_evidence (id, proposalId, approvalId, executionId, eventType, summary, payloadHash, metadataJson, actor, createdAt)
      VALUES (@id, @proposalId, @approvalId, @executionId, @eventType, @summary, @payloadHash, @metadataJson, @actor, @createdAt)
    `).run(serializeEvidence(evidence));
    return evidence;
  }

  listEvidence(proposalId: string): ActionEvidence[] {
    return (this.db.prepare(`SELECT * FROM action_evidence WHERE proposalId = ? ORDER BY createdAt ASC`).all(proposalId) as any[]).map(parseEvidence);
  }

  saveCompensation(compensation: ActionCompensation): ActionCompensation {
    this.db.prepare(`
      INSERT INTO action_compensations (id, proposalId, actionClass, available, requiresNewApproval, description, status, createdAt, updatedAt)
      VALUES (@id, @proposalId, @actionClass, @available, @requiresNewApproval, @description, @status, @createdAt, @updatedAt)
    `).run({ ...compensation, available: compensation.available ? 1 : 0, requiresNewApproval: compensation.requiresNewApproval ? 1 : 0 });
    return compensation;
  }

  listCompensations(proposalId: string): ActionCompensation[] {
    return (this.db.prepare(`SELECT * FROM action_compensations WHERE proposalId = ? ORDER BY createdAt ASC`).all(proposalId) as any[]).map(row => ({
      ...row,
      available: Boolean(row.available),
      requiresNewApproval: Boolean(row.requiresNewApproval),
    }) as ActionCompensation);
  }

  integrity(): { integrityCheck: string; foreignKeyViolations: unknown[]; schemaVersion: number } {
    const integrity = this.db.prepare(`PRAGMA integrity_check`).get() as Record<string, string>;
    return { integrityCheck: Object.values(integrity)[0], foreignKeyViolations: this.db.prepare(`PRAGMA foreign_key_check`).all(), schemaVersion: currentSchemaVersion(this.db) };
  }
}

function readJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function serializeProposal(p: ActionProposal): Record<string, unknown> {
  return {
    ...p,
    normalizedPayloadJson: JSON.stringify(p.normalizedPayload),
    previewJson: JSON.stringify(p.preview),
    sideEffectsJson: JSON.stringify(p.sideEffects),
    evidenceReferencesJson: JSON.stringify(p.evidenceReferences),
    safeFailure: p.safeFailure ? 1 : 0,
  };
}

function parseProposal(row: any): ActionProposal {
  return {
    ...row,
    normalizedPayload: readJson(row.normalizedPayloadJson, {}),
    preview: readJson(row.previewJson, { kind: 'GENERIC', text: '', fields: {} }),
    sideEffects: readJson(row.sideEffectsJson, []),
    evidenceReferences: readJson(row.evidenceReferencesJson, []),
    safeFailure: Boolean(row.safeFailure),
  } as ActionProposal;
}

function serializeApproval(a: ActionApproval): Record<string, unknown> {
  return { ...a, evidenceReferencesJson: JSON.stringify(a.evidenceReferences), approvedPayloadSnapshotJson: JSON.stringify(a.approvedPayloadSnapshot) };
}

function parseApproval(row: any): ActionApproval {
  return { ...row, evidenceReferences: readJson(row.evidenceReferencesJson, []), approvedPayloadSnapshot: readJson(row.approvedPayloadSnapshotJson, {}) } as ActionApproval;
}

function serializeExecution(e: ActionExecution): Record<string, unknown> {
  return { ...e, providerRequestMetadataJson: JSON.stringify(e.providerRequestMetadata), providerResponseSummaryJson: JSON.stringify(e.providerResponseSummary) };
}

function parseExecution(row: any): ActionExecution {
  return { ...row, providerRequestMetadata: readJson(row.providerRequestMetadataJson, {}), providerResponseSummary: readJson(row.providerResponseSummaryJson, {}) } as ActionExecution;
}

function serializeEvidence(e: ActionEvidence): Record<string, unknown> {
  return { ...e, metadataJson: JSON.stringify(e.metadata) };
}

function parseEvidence(row: any): ActionEvidence {
  return { ...row, metadata: readJson(row.metadataJson, {}) } as ActionEvidence;
}
