import type { Request } from 'express';
import {
  claimSeoApproval,
  finalizeSeoApprovalFailure,
  finalizeSeoApprovalSuccess,
  markSeoApprovalFinalizationFailed,
  startSeoApprovalExecution,
} from './seo-approval-binding';
import type { SeoAuthContext } from './seo-security';

export interface ApprovedExecutionResult<T> {
  ok: boolean;
  result?: T;
  error?: string;
  status?: number;
  manual_reconciliation_required?: boolean;
  automatic_retry_allowed?: boolean;
  operation_evidence_id?: string;
  approval_id?: string;
  resource_id?: string | null;
  correlation_id?: string | null;
}

export async function executeWithSeoApproval<T extends { success?: boolean; error?: string }>(
  req: Request,
  operation: () => Promise<T> | T,
): Promise<ApprovedExecutionResult<T>> {
  const auth = (req as Request & { seoAuth?: SeoAuthContext }).seoAuth;
  const approvalId = auth?.approvalId;
  const expectation = auth?.approvalExpectation;
  if (!auth || !approvalId || !expectation) {
    return { ok: false, status: 403, error: 'seo_approval_context_missing' };
  }

  const claim = claimSeoApproval(approvalId, expectation, auth.session.actor_id, `claimed:${auth.routeKey}`);
  if (!claim.ok) return { ok: false, status: 403, error: `seo_${claim.reason}` };

  const started = startSeoApprovalExecution(approvalId);
  if (!started.ok) {
    finalizeSeoApprovalFailure(approvalId, started.reason || 'approval_start_failed');
    return { ok: false, status: 409, error: `seo_${started.reason}` };
  }

  try {
    const result = await operation();
    if (result && result.success === false) {
      finalizeSeoApprovalFailure(approvalId, result.error || 'operation_failed');
      return { ok: false, status: 400, result, error: result.error || 'operation_failed' };
    }
    const finalized = finalizeSeoApprovalSuccess(approvalId, auth.session.actor_id, result);
    if (!finalized.ok) {
      const resourceId = auth.resource?.id || expectation.target || null;
      const correlationId = String(req.headers['x-request-id'] || req.headers['x-correlation-id'] || `${approvalId}:${Date.now()}`);
      const reconciliation = markSeoApprovalFinalizationFailed(approvalId, {
        actor_id: auth.session.actor_id,
        resource_id: resourceId,
        correlation_id: correlationId,
        result,
        reason: finalized.reason || 'approval_finalize_failed',
      });
      return {
        ok: false,
        status: 503,
        result,
        error: 'operation_succeeded_finalize_failed',
        manual_reconciliation_required: true,
        automatic_retry_allowed: false,
        operation_evidence_id: reconciliation.operation_evidence_id,
        approval_id: approvalId,
        resource_id: resourceId,
        correlation_id: correlationId,
      };
    }
    return { ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finalizeSeoApprovalFailure(approvalId, 'operation_exception', message);
    return { ok: false, status: 500, error: message };
  }
}
