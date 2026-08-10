export type ActionRiskClass = 'R0' | 'R1' | 'R2' | 'R3' | 'R4';

export type ActionProposalStatus =
  | 'DRAFT'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'RECOVERY_REQUIRED';

export type ActionApprovalDecision = 'APPROVE' | 'REJECT';

export type ActionType =
  | 'GMAIL_CREATE_DRAFT'
  | 'GMAIL_SEND_DRAFT'
  | 'CALENDAR_EVENT_PROPOSAL'
  | 'CALENDAR_CREATE_EVENT'
  | 'LOCAL_TASK_DRAFT'
  | 'LOCAL_STATE_UPDATE'
  | 'CODING_TASK_APPROVAL';

export type ProviderFailureCode =
  | 'AUTH_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'RATE_LIMITED'
  | 'INVALID_TARGET'
  | 'STALE_PREVIEW'
  | 'CONFLICT_CHANGED'
  | 'PROVIDER_UNAVAILABLE'
  | 'ALREADY_EXECUTED'
  | 'FORBIDDEN_RISK'
  | 'MISSING_APPROVAL'
  | 'PAYLOAD_HASH_MISMATCH'
  | 'UNSUPPORTED_ACTION'
  | 'UNKNOWN';

export interface ActionPreview {
  kind: 'EMAIL' | 'CALENDAR' | 'LOCAL_TASK' | 'CODING' | 'GENERIC';
  text: string;
  fields: Record<string, string | string[] | number | boolean | null>;
}

export interface ActionProposal {
  id: string;
  actionType: ActionType;
  riskClass: ActionRiskClass;
  title: string;
  description: string;
  reason: string;
  sourceGoalId: string | null;
  sourceTaskId: string | null;
  sourceBriefId: string | null;
  sourcePlanId: string | null;
  projectId: string | null;
  targetSystem: string;
  requestedOperation: string;
  normalizedPayload: Record<string, unknown>;
  payloadHash: string;
  preview: ActionPreview;
  sideEffects: string[];
  rollbackPlan: string;
  requiredApprovals: number;
  status: ActionProposalStatus;
  evidenceReferences: string[];
  idempotencyKey: string;
  safeFailure: boolean;
  createdAt: string;
  expiresAt: string;
  approvedAt: string | null;
  executedAt: string | null;
  rejectedAt: string | null;
  failureCode: ProviderFailureCode | null;
}

export interface ActionApproval {
  id: string;
  proposalId: string;
  approver: string;
  decision: ActionApprovalDecision;
  payloadHash: string;
  actionType: ActionType;
  targetSystem: string;
  targetSummary: string;
  riskAcknowledgement: string;
  approvedAt: string;
  expiresAt: string;
  source: string;
  evidenceReferences: string[];
  approvedPayloadSnapshot: Record<string, unknown>;
}

export interface ActionExecution {
  id: string;
  proposalId: string;
  approvalId: string;
  actionType: ActionType;
  idempotencyKey: string;
  status: 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'RECOVERY_REQUIRED';
  attempt: number;
  providerMode: 'fixture' | 'sandbox' | 'live';
  providerRequestMetadata: Record<string, unknown>;
  providerResponseSummary: Record<string, unknown>;
  externalObjectId: string | null;
  failureCode: ProviderFailureCode | null;
  startedAt: string;
  completedAt: string | null;
}

export interface ActionEvidence {
  id: string;
  proposalId: string;
  approvalId: string | null;
  executionId: string | null;
  eventType: string;
  summary: string;
  payloadHash: string | null;
  metadata: Record<string, unknown>;
  actor: string;
  createdAt: string;
}

export interface ActionCompensation {
  id: string;
  proposalId: string;
  actionClass: string;
  available: boolean;
  requiresNewApproval: boolean;
  description: string;
  status: 'NOT_AVAILABLE' | 'AVAILABLE' | 'PROPOSED' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;
}

export interface ProposeActionInput {
  actionType: ActionType;
  title?: string;
  description?: string;
  reason: string;
  sourceGoalId?: string | null;
  sourceTaskId?: string | null;
  sourceBriefId?: string | null;
  sourcePlanId?: string | null;
  projectId?: string | null;
  targetSystem?: string;
  requestedOperation?: string;
  normalizedPayload: Record<string, unknown>;
  evidenceReferences?: string[];
  expiresInMinutes?: number;
}

export interface ApproveActionInput {
  approver?: string;
  riskAcknowledgement?: string;
  strongConfirmation?: string;
  source?: string;
  execute?: boolean;
}

export interface RejectActionInput {
  approver?: string;
  reason?: string;
  source?: string;
}

export interface GmailDraftPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  threadId?: string | null;
  projectId?: string | null;
  goalId?: string | null;
  reason: string;
  sensitivity?: 'PUBLIC' | 'INTERNAL' | 'PRIVATE';
}

export interface CalendarEventPayload {
  title: string;
  start: string;
  end: string;
  timezone: string;
  attendees?: string[];
  location?: string | null;
  description?: string;
  projectId?: string | null;
  goalId?: string | null;
  conflicts?: Array<{ eventId: string; title: string; start: string; end: string }>;
  freeBusyEvidence?: string | null;
}
