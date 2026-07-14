import crypto from 'crypto';
import { getById as getApprovalById, markExecuted } from '../approval/gate';
import { getSeoDb, nowIso } from './seo-db';
import { hashCanonicalSeoPayload } from './seo-canonical-payload';

export interface SeoApprovalExpectation {
  category: string;
  action: string;
  target: string;
  brand_id: string;
  location_id?: string | null;
  actor_id?: string | null;
  payload_hash?: string | null;
}

export interface SeoApprovalBinding extends SeoApprovalExpectation {
  approval_id: string;
  created_at: string;
  consumed_at?: string | null;
  consumed_by?: string | null;
  execution_result?: string | null;
}

export type SeoApprovalExecutionState =
  | 'READY'
  | 'CLAIMED'
  | 'EXECUTING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'FINALIZATION_FAILED'
  | 'CANCELLED'
  | 'STALE'
  | 'MANUAL_RECONCILED';

export interface SeoApprovalExecutionSnapshot {
  state: SeoApprovalExecutionState;
  approval_id: string;
  consumed_at?: string | null;
  result_digest?: string | null;
  operation_evidence_id?: string | null;
  resource_id?: string | null;
  correlation_id?: string | null;
  manual_reconciliation_required?: number | null;
  automatic_retry_allowed?: number | null;
  failure_code?: string | null;
  failure_detail?: string | null;
}

const APPROVAL_TTL_MS = Number(process.env.SEO_APPROVAL_TTL_MS || 24 * 60 * 60 * 1000);

export function hashPayload(payload: unknown): string | null {
  if (payload === undefined || payload === null) return null;
  return hashCanonicalSeoPayload(payload);
}

function evidenceId(): string {
  return `seo-approval-evidence-${crypto.randomUUID()}`;
}

function stringifyEvidence(evidence: unknown): string {
  return JSON.stringify(evidence ?? null);
}

export function recordSeoApprovalExecutionEvidence(
  approvalId: string,
  eventType: string,
  evidence: unknown,
  options: {
    actor_id?: string | null;
    resource_id?: string | null;
    correlation_id?: string | null;
    result_digest?: string | null;
    evidence_id?: string;
  } = {},
): string {
  const id = options.evidence_id || evidenceId();
  getSeoDb().prepare(`
    INSERT INTO seo_approval_execution_evidence
      (id, approval_id, event_type, evidence_json, actor_id, resource_id, correlation_id, result_digest, created_at)
    VALUES
      (@id, @approval_id, @event_type, @evidence_json, @actor_id, @resource_id, @correlation_id, @result_digest, @created_at)
  `).run({
    id,
    approval_id: approvalId,
    event_type: eventType,
    evidence_json: stringifyEvidence(evidence),
    actor_id: options.actor_id ?? null,
    resource_id: options.resource_id ?? null,
    correlation_id: options.correlation_id ?? null,
    result_digest: options.result_digest ?? null,
    created_at: nowIso(),
  });
  return id;
}

export function bindSeoApproval(approvalId: string, expected: SeoApprovalExpectation): void {
  const db = getSeoDb();
  const now = nowIso();
  db.transaction(() => {
    db.prepare(`
      INSERT OR REPLACE INTO seo_approval_bindings
        (approval_id, category, action_key, target, brand_id, location_id, actor_id, payload_hash, created_at)
      VALUES
        (@approval_id, @category, @action_key, @target, @brand_id, @location_id, @actor_id, @payload_hash, @created_at)
    `).run({
      approval_id: approvalId,
      category: expected.category,
      action_key: expected.action,
      target: expected.target,
      brand_id: expected.brand_id,
      location_id: expected.location_id ?? null,
      actor_id: expected.actor_id ?? null,
      payload_hash: expected.payload_hash ?? null,
      created_at: now,
    });
    db.prepare(`
      INSERT OR IGNORE INTO seo_approval_execution_state (approval_id, state, last_updated_at)
      VALUES (?, 'READY', ?)
    `).run(approvalId, now);
  }).immediate();
}

function bindingFor(approvalId: string): SeoApprovalBinding | null {
  const row = getSeoDb().prepare('SELECT * FROM seo_approval_bindings WHERE approval_id = ?').get(approvalId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    approval_id: row.approval_id as string,
    category: row.category as string,
    action: row.action_key as string,
    target: row.target as string,
    brand_id: row.brand_id as string,
    location_id: row.location_id as string | null,
    actor_id: row.actor_id as string | null,
    payload_hash: row.payload_hash as string | null,
    created_at: row.created_at as string,
    consumed_at: row.consumed_at as string | null,
    consumed_by: row.consumed_by as string | null,
    execution_result: row.execution_result as string | null,
  };
}

export function validateSeoApproval(
  approvalId: unknown,
  expected: SeoApprovalExpectation,
  now = Date.now(),
): { ok: boolean; reason?: string; binding?: SeoApprovalBinding } {
  const id = typeof approvalId === 'string' ? approvalId.trim() : '';
  if (!id) return { ok: false, reason: 'missing_approval_id' };
  const approval = getApprovalById(id);
  if (!approval) return { ok: false, reason: 'approval_not_found' };
  if (approval.status !== 'approved') return { ok: false, reason: 'approval_not_approved' };
  if (!approval.resolved_at) return { ok: false, reason: 'approval_resolved_at_missing' };
  const resolved = Date.parse(approval.resolved_at);
  if (!Number.isFinite(resolved)) return { ok: false, reason: 'approval_resolved_at_invalid' };
  if (now - resolved > APPROVAL_TTL_MS) return { ok: false, reason: 'approval_expired' };

  const binding = bindingFor(id);
  if (!binding) return { ok: false, reason: 'approval_unbound' };
  const execution = getSeoApprovalExecutionState(id);
  if (execution && execution.state !== 'READY') return { ok: false, reason: `approval_${execution.state.toLowerCase()}` };
  if (binding.consumed_at) return { ok: false, reason: 'approval_consumed' };
  if (binding.category !== expected.category) return { ok: false, reason: 'approval_category_mismatch' };
  if (binding.action !== expected.action) return { ok: false, reason: 'approval_action_mismatch' };
  if (binding.target !== expected.target) return { ok: false, reason: 'approval_target_mismatch' };
  if (binding.brand_id !== expected.brand_id) return { ok: false, reason: 'approval_brand_mismatch' };
  if ((binding.location_id || null) !== (expected.location_id || null)) return { ok: false, reason: 'approval_location_mismatch' };
  if ((binding.actor_id || null) !== (expected.actor_id || null)) return { ok: false, reason: 'approval_actor_mismatch' };
  if ((binding.payload_hash || null) !== (expected.payload_hash || null)) return { ok: false, reason: 'approval_payload_mismatch' };
  return { ok: true, binding };
}

export function consumeSeoApproval(approvalId: string, consumedBy: string, result: string): { ok: boolean; reason?: string } {
  const consumedAt = nowIso();
  const tx = getSeoDb().transaction(() => {
    const update = getSeoDb().prepare(`
      UPDATE seo_approval_bindings
      SET consumed_at = ?, consumed_by = ?, execution_result = ?
      WHERE approval_id = ? AND consumed_at IS NULL
    `).run(consumedAt, consumedBy, result, approvalId);
    if (update.changes !== 1) return false;
    markExecuted(approvalId, result);
    return true;
  });
  return tx.immediate() ? { ok: true } : { ok: false, reason: 'approval_consumed' };
}

export function claimSeoApproval(
  approvalId: unknown,
  expected: SeoApprovalExpectation,
  claimedBy: string,
  result: string,
): { ok: boolean; reason?: string; binding?: SeoApprovalBinding } {
  const id = typeof approvalId === 'string' ? approvalId.trim() : '';
  if (!id) return { ok: false, reason: 'missing_approval_id' };
  const claimTokenHash = crypto.createHash('sha256').update(`${id}:${claimedBy}:${Date.now()}:${Math.random()}`).digest('hex');

  const tx = getSeoDb().transaction(() => {
    const validation = validateSeoApproval(id, expected);
    if (!validation.ok) return validation;

    getSeoDb().prepare(`
      INSERT OR IGNORE INTO seo_approval_execution_state (approval_id, state, last_updated_at)
      VALUES (?, 'READY', ?)
    `).run(id, nowIso());
    const update = getSeoDb().prepare(`
      UPDATE seo_approval_execution_state
      SET state = 'CLAIMED', claimed_at = ?, claimed_by = ?, claim_token_hash = ?, last_updated_at = ?
      WHERE approval_id = ? AND state = 'READY'
    `).run(nowIso(), claimedBy, claimTokenHash, nowIso(), id);
    if (update.changes !== 1) return { ok: false, reason: 'approval_claim_unavailable' };
    return { ok: true, binding: validation.binding };
  });

  return tx.immediate();
}

export function startSeoApprovalExecution(approvalId: string): { ok: boolean; reason?: string } {
  const now = nowIso();
  const update = getSeoDb().prepare(`
    UPDATE seo_approval_execution_state
    SET state = 'EXECUTING', execution_started_at = ?, last_updated_at = ?
    WHERE approval_id = ? AND state = 'CLAIMED'
  `).run(now, now, approvalId);
  return update.changes === 1 ? { ok: true } : { ok: false, reason: 'approval_not_claimed' };
}

export function finalizeSeoApprovalSuccess(approvalId: string, consumedBy: string, result: unknown): { ok: boolean; reason?: string } {
  const now = nowIso();
  const digest = hashPayload(result) || null;
  const tx = getSeoDb().transaction(() => {
    const bindUpdate = getSeoDb().prepare(`
      UPDATE seo_approval_bindings
      SET consumed_at = ?, consumed_by = ?, execution_result = ?
      WHERE approval_id = ? AND consumed_at IS NULL
    `).run(now, consumedBy, digest, approvalId);
    if (bindUpdate.changes !== 1) return 'approval_binding_not_consumable';

    const stateUpdate = getSeoDb().prepare(`
      UPDATE seo_approval_execution_state
      SET state = 'SUCCEEDED',
          execution_completed_at = ?,
          result_digest = ?,
          manual_reconciliation_required = 0,
          automatic_retry_allowed = 0,
          last_updated_at = ?
      WHERE approval_id = ? AND state = 'EXECUTING'
    `).run(now, digest, now, approvalId);
    if (stateUpdate.changes !== 1) return 'approval_not_executing';

    markExecuted(approvalId, digest || 'succeeded');
    return 'ok';
  });
  const resultCode = tx.immediate();
  return resultCode === 'ok' ? { ok: true } : { ok: false, reason: resultCode };
}

export function finalizeSeoApprovalFailure(approvalId: string, failureCode: string, failureDetail?: string): { ok: boolean; reason?: string } {
  const now = nowIso();
  const update = getSeoDb().prepare(`
    UPDATE seo_approval_execution_state
    SET state = 'FAILED', execution_failed_at = ?, failure_code = ?, failure_detail = ?, last_updated_at = ?
    WHERE approval_id = ? AND state IN ('CLAIMED', 'EXECUTING')
  `).run(now, failureCode, failureDetail || null, now, approvalId);
  return update.changes === 1 ? { ok: true } : { ok: false, reason: 'approval_not_active' };
}

export function markSeoApprovalFinalizationFailed(
  approvalId: string,
  params: {
    actor_id?: string | null;
    resource_id?: string | null;
    correlation_id?: string | null;
    result: unknown;
    reason?: string;
  },
): { ok: boolean; reason?: string; operation_evidence_id?: string; result_digest?: string | null } {
  const now = nowIso();
  const digest = hashPayload(params.result) || null;
  const evidence = {
    approval_id: approvalId,
    actor_id: params.actor_id ?? null,
    resource_id: params.resource_id ?? null,
    correlation_id: params.correlation_id ?? null,
    result_digest: digest,
    finalization_failure_reason: params.reason || 'approval_finalize_failed',
    operation_result: params.result,
    automatic_retry_allowed: false,
    manual_reconciliation_required: true,
    recorded_at: now,
  };
  const tx = getSeoDb().transaction(() => {
    const id = recordSeoApprovalExecutionEvidence(approvalId, 'FINALIZATION_FAILED', evidence, {
      actor_id: params.actor_id,
      resource_id: params.resource_id,
      correlation_id: params.correlation_id,
      result_digest: digest,
    });
    const update = getSeoDb().prepare(`
      UPDATE seo_approval_execution_state
      SET state = 'FINALIZATION_FAILED',
          execution_failed_at = ?,
          failure_code = 'operation_succeeded_finalize_failed',
          failure_detail = ?,
          result_digest = ?,
          operation_evidence_id = ?,
          resource_id = ?,
          correlation_id = ?,
          manual_reconciliation_required = 1,
          automatic_retry_allowed = 0,
          last_updated_at = ?
      WHERE approval_id = ? AND state IN ('EXECUTING', 'FINALIZATION_FAILED')
    `).run(
      now,
      params.reason || 'approval_finalize_failed',
      digest,
      id,
      params.resource_id ?? null,
      params.correlation_id ?? null,
      now,
      approvalId,
    );
    return update.changes === 1 ? { ok: true, operation_evidence_id: id, result_digest: digest } : { ok: false, reason: 'approval_not_executing' };
  });
  return tx.immediate();
}

export function inspectApprovalExecution(approvalId: string): (SeoApprovalExecutionSnapshot & { evidence: Array<Record<string, unknown>> }) | null {
  const state = getSeoApprovalExecutionState(approvalId);
  if (!state) return null;
  const evidence = getSeoDb().prepare(`
    SELECT id, approval_id, event_type, evidence_json, actor_id, resource_id, correlation_id, result_digest, created_at
    FROM seo_approval_execution_evidence
    WHERE approval_id = ?
    ORDER BY created_at ASC
  `).all(approvalId) as Array<Record<string, unknown>>;
  return { ...state, evidence };
}

export function markApprovalReconciled(
  approvalId: string,
  evidence: unknown,
  actor: { actor_id: string; role: string },
): { ok: boolean; reason?: string; operation_evidence_id?: string } {
  if (actor.role !== 'CEO') return { ok: false, reason: 'ceo_permission_required' };
  const now = nowIso();
  const tx = getSeoDb().transaction(() => {
    const id = recordSeoApprovalExecutionEvidence(approvalId, 'MANUAL_RECONCILED', evidence, {
      actor_id: actor.actor_id,
    });
    const update = getSeoDb().prepare(`
      UPDATE seo_approval_execution_state
      SET state = 'MANUAL_RECONCILED',
          reconciled_at = ?,
          reconciled_by = ?,
          operation_evidence_id = ?,
          manual_reconciliation_required = 0,
          automatic_retry_allowed = 0,
          last_updated_at = ?
      WHERE approval_id = ? AND state = 'FINALIZATION_FAILED'
    `).run(now, actor.actor_id, id, now, approvalId);
    return update.changes === 1 ? { ok: true, operation_evidence_id: id } : { ok: false, reason: 'approval_not_reconcilable' };
  });
  return tx.immediate();
}

export function cancelStaleApproval(
  approvalId: string,
  reason: string,
  actor: { actor_id: string; role: string },
): { ok: boolean; reason?: string } {
  if (actor.role !== 'CEO') return { ok: false, reason: 'ceo_permission_required' };
  const now = nowIso();
  const tx = getSeoDb().transaction(() => {
    recordSeoApprovalExecutionEvidence(approvalId, 'CANCELLED', { reason, actor_id: actor.actor_id, recorded_at: now }, {
      actor_id: actor.actor_id,
    });
    const update = getSeoDb().prepare(`
      UPDATE seo_approval_execution_state
      SET state = 'CANCELLED',
          cancelled_at = ?,
          cancelled_by = ?,
          cancel_reason = ?,
          manual_reconciliation_required = 0,
          automatic_retry_allowed = 0,
          last_updated_at = ?
      WHERE approval_id = ? AND state IN ('READY', 'CLAIMED', 'STALE')
    `).run(now, actor.actor_id, reason, now, approvalId);
    return update.changes === 1 ? { ok: true } : { ok: false, reason: 'approval_not_cancellable' };
  });
  return tx.immediate();
}

export function getSeoApprovalExecutionState(approvalId: string): SeoApprovalExecutionSnapshot | null {
  const row = getSeoDb().prepare(`
    SELECT
      s.approval_id,
      s.state,
      s.result_digest,
      s.operation_evidence_id,
      s.resource_id,
      s.correlation_id,
      s.manual_reconciliation_required,
      s.automatic_retry_allowed,
      s.failure_code,
      s.failure_detail,
      b.consumed_at
    FROM seo_approval_execution_state s
    LEFT JOIN seo_approval_bindings b ON b.approval_id = s.approval_id
    WHERE s.approval_id = ?
  `).get(approvalId) as SeoApprovalExecutionSnapshot | undefined;
  return row || null;
}
