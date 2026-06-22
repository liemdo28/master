/**
 * DEV5 — Execution Engine & Approval Orchestrator
 * 
 * Central orchestration module that ties together:
 *   E1: Action Intent Engine
 *   E2: Workflow Creation Layer
 *   E3: Approval Orchestrator
 *   E4: Execution Queue
 *   E5: SEO Pipeline
 *   E6: Idempotency Layer
 *   E7: WhatsApp Execution Response
 *   E8: Workflow Reality Proof
 * 
 * Main entry point: processCEORequest()
 */

import { classifyActionIntent, needsWorkflow, resolveEntities, type ActionIntent } from './action-intent-engine';
import { createWorkflow, getWorkflow, type ExecutionWorkflow } from './workflow-creation-layer';
import { createApprovalRequest, resolveApproval, getLatestPendingApproval, findPendingByWorkflow, type ApprovalRequest, type ApprovalAction } from './approval-orchestrator';
import { enqueueJob, hasDuplicateJob } from './execution-queue';
import { runSEOPipeline, type SEODraft } from './seo-pipeline';
import { checkDuplicate, registerMessage } from './idempotency-layer';
import { buildFullActionResponse, buildDuplicateResponse, buildDangerousActionBlockedResponse, buildActionDetectedResponse, buildWorkflowCreatedResponse } from './whatsapp-execution-response';

// ── Process CEO request (main entry) ───────────────────────────────────────

export interface ExecutionResult {
  action: 'workflow_created' | 'duplicate' | 'dangerous_blocked' | 'approval_resolved' | 'informational' | 'unknown';
  intent?: ActionIntent;
  workflow?: ExecutionWorkflow;
  draft?: SEODraft;
  approval?: ApprovalRequest;
  response_message: string;
}

export function processCEORequest(params: {
  message: string;
  sender: string;
  message_id: string;
}): ExecutionResult {
  const { message, sender, message_id } = params;

  // 1. Classify intent
  const intent = classifyActionIntent(message);

  // 2. Handle approval responses
  if (intent.message_class === 'approval_response') {
    const latestApproval = getLatestPendingApproval();
    if (latestApproval) {
      const action: ApprovalAction = /^(approve|yes|ok|duyet|dong y)/i.test(message.trim()) ? 'approve' : 'cancel';
      const resolved = resolveApproval(latestApproval.approval_id, action);
      if (resolved) {
        const verb = action === 'approve' ? 'duyệt' : 'hủy';
        return {
          action: 'approval_resolved',
          intent,
          approval: resolved,
          response_message: `Đã ${verb} bản nháp gần nhất. Em sẽ tiếp tục bước kế tiếp và báo anh khi có proof.`,
        };
      }
    }
    return {
      action: 'informational',
      intent,
      response_message: 'Không có approval nào đang chờ. Anh muốn kiểm tra gì?',
    };
  }

  // 3. Handle dangerous actions
  if (intent.message_class === 'dangerous_action') {
    return {
      action: 'dangerous_blocked',
      intent,
      response_message: buildDangerousActionBlockedResponse(intent),
    };
  }

  // 4. Handle informational questions (no workflow needed)
  if (intent.message_class === 'informational_question') {
    return {
      action: 'informational',
      intent,
      response_message: `Dang tra loi cau hoi: ${message.slice(0, 100)}`,
    };
  }

  // 5. Handle action requests
  if (intent.message_class === 'action_request' && needsWorkflow(intent)) {
    // 5a. Check idempotency
    const dupCheck = checkDuplicate({
      sender,
      message,
      target_entity: intent.target_entity || '',
      intent: intent.workflow_types[0] || 'general',
    });

    if (dupCheck.is_duplicate) {
      return {
        action: 'duplicate',
        intent,
        response_message: buildDuplicateResponse(dupCheck.existing_workflow_id),
      };
    }

    // 5b. Create workflow
    let workflow = createWorkflow({
      intent,
      source_message_id: message_id,
      sender,
      raw_message: message,
    });

    // 5c. Register for idempotency
    registerMessage({
      sender,
      message,
      target_entity: intent.target_entity || '',
      intent: intent.workflow_types[0] || 'general',
      workflow_id: workflow.workflow_id,
    });

    // 5d. Run SEO pipeline if needed
    let draft: SEODraft | undefined;
    if (intent.workflow_types.includes('SEO_CONTENT')) {
      draft = runSEOPipeline(workflow) || undefined;
      workflow = getWorkflow(workflow.workflow_id) || workflow;
    }

    // 5e. Enqueue job
    const idempotencyKey = `${workflow.workflow_id}-${intent.workflow_types[0]}`;
    if (!hasDuplicateJob(idempotencyKey)) {
      enqueueJob({
        workflow_id: workflow.workflow_id,
        workflow_type: intent.workflow_types[0],
        target_entity: intent.target_entity,
        domain: intent.domain,
        owner: sender,
        idempotency_key: idempotencyKey,
      });
    }

    // 5f. Create approval request if needed
    let approval: ApprovalRequest | undefined;
    if (workflow.approval_required) {
      approval = createApprovalRequest(workflow);
    }

    // 5g. Build response
    const response = buildFullActionResponse({ intent, workflow, draft, approval });

    return {
      action: 'workflow_created',
      intent,
      workflow,
      draft,
      approval,
      response_message: response,
    };
  }

  // 6. Unknown
  return {
    action: 'unknown',
    intent,
    response_message: 'Em chưa hiểu rõ yêu cầu. Anh có thể giải thích thêm không?',
  };
}

// Re-export all public APIs
export { classifyActionIntent, needsWorkflow, resolveEntities } from './action-intent-engine';
export type { ActionIntent, MessageClass, BusinessDomain, WorkflowType } from './action-intent-engine';
export { createWorkflow, getWorkflow, listWorkflows, getActiveWorkflows, updateWorkflowStatus } from './workflow-creation-layer';
export type { ExecutionWorkflow, WorkflowStatus, WorkflowStep } from './workflow-creation-layer';
export { createApprovalRequest, resolveApproval, getPendingApprovals, getLatestPendingApproval, formatApprovalMessage } from './approval-orchestrator';
export type { ApprovalRequest, ApprovalStatus, ApprovalAction } from './approval-orchestrator';
export { enqueueJob, startJob, completeJob, failJob, cancelJob, hasDuplicateJob } from './execution-queue';
export type { QueueJob, QueueName, JobStatus } from './execution-queue';
export { runSEOPipeline, pickTopic } from './seo-pipeline';
export type { SEODraft, SEOArticle, SEOMetadata, SEOTopic } from './seo-pipeline';
export { checkDuplicate, registerMessage, generateIdempotencyKey } from './idempotency-layer';
export { verifyWorkflowClaim, verifyDraftClaim, verifyApprovalClaim, verifyAllClaims, formatRealityReport } from './workflow-reality-proofer';
export type { RealityCheck, ClaimType } from './workflow-reality-proofer';
export { buildFullActionResponse, buildActionDetectedResponse, buildWorkflowCreatedResponse, buildDuplicateResponse, buildDangerousActionBlockedResponse } from './whatsapp-execution-response';

// DEV5: Workflow Execution Ledger & Metrics
export { recordWorkflowStart, recordWorkflowStatus, linkWorkflowChild, getLedgerEntry, getLedgerByWorkflow, getRecentEntries, getEntriesSince, getFailedEntries, backfillFromWorkflowFiles } from './workflow-execution-ledger';
export type { LedgerEntry, LedgerStatus } from './workflow-execution-ledger';
export { computeWorkflowMetrics } from './workflow-metrics';
export type { WorkflowMetrics } from './workflow-metrics';

// DEV5: CEO Language Filter
export { ceoLabel, ceoChildSummary, ceoMultiIntentSummary, stripInternalIds, sanitizeCeoResponse } from './ceo-language-filter';

// DEV5: Failure Evidence Store
export { recordFailure, remediateFailure, getFailureByWorkflow, getRecentFailures, getOpenFailures, getFailureSummary, seedKnownFailures } from './failure-evidence-store';
export type { FailureEvidence, FailureSummary, FailureType, FailureSeverity, RemediationStatus } from './failure-evidence-store';
