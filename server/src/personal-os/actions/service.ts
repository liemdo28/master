import { randomUUID } from 'crypto';
import { ControlledActionStore } from './store';
import {
  ALLOWED_EXECUTION_RISKS,
  assertDateTime,
  assertEmail,
  assertPlainPayload,
  payloadHash,
  riskForAction,
  sanitizeText,
  shortHash,
  textPreview,
} from './policy';
import type {
  ActionApproval,
  ActionCompensation,
  ActionEvidence,
  ActionExecution,
  ActionProposal,
  ActionProposalStatus,
  ActionType,
  ApproveActionInput,
  CalendarEventPayload,
  GmailDraftPayload,
  ProviderFailureCode,
  ProposeActionInput,
  RejectActionInput,
} from './types';

const now = (): string => new Date().toISOString();
const minutesFromNow = (minutes: number): string => new Date(Date.now() + minutes * 60_000).toISOString();

const ACTION_TYPES = new Set<ActionType>([
  'GMAIL_CREATE_DRAFT',
  'GMAIL_SEND_DRAFT',
  'CALENDAR_EVENT_PROPOSAL',
  'CALENDAR_CREATE_EVENT',
  'LOCAL_TASK_DRAFT',
  'LOCAL_STATE_UPDATE',
  'CODING_TASK_APPROVAL',
]);

export class ControlledActionService {
  readonly store: ControlledActionStore;

  constructor(root?: string) {
    this.store = new ControlledActionStore(root);
  }

  close(): void { this.store.close(); }

  list(status?: ActionProposalStatus): ActionProposal[] {
    return this.store.listProposals(status);
  }

  get(id: string): ActionProposal {
    const proposal = this.store.getProposal(id);
    if (!proposal) throw new Error('proposal not found');
    return this.expireIfNeeded(proposal);
  }

  detail(id: string): {
    proposal: ActionProposal;
    approval: ActionApproval | null;
    executions: ActionExecution[];
    evidence: ActionEvidence[];
    compensations: ActionCompensation[];
  } {
    const proposal = this.get(id);
    return {
      proposal,
      approval: this.store.latestApproval(id),
      executions: this.store.listExecutions(id),
      evidence: this.store.listEvidence(id),
      compensations: this.store.listCompensations(id),
    };
  }

  propose(input: ProposeActionInput): ActionProposal {
    assertPlainPayload(input);
    if (!ACTION_TYPES.has(input.actionType)) throw new Error('unsupported action type');
    const normalizedPayload = this.normalizePayload(input.actionType, input.normalizedPayload);
    const hash = payloadHash(normalizedPayload);
    const riskClass = riskForAction(input.actionType);
    if (riskClass === 'R4') throw new Error('R4 actions are forbidden in Phase 5F');
    const preview = this.previewFor(input.actionType, normalizedPayload);
    const targetSystem = sanitizeText(input.targetSystem || defaultTargetSystem(input.actionType), 80);
    const requestedOperation = sanitizeText(input.requestedOperation || input.actionType, 120);
    const createdAt = now();
    const proposal: ActionProposal = {
      id: `action-${randomUUID()}`,
      actionType: input.actionType,
      riskClass,
      title: sanitizeText(input.title || defaultTitle(input.actionType, normalizedPayload), 240),
      description: sanitizeText(input.description || defaultDescription(input.actionType), 1000),
      reason: sanitizeText(input.reason, 1000),
      sourceGoalId: input.sourceGoalId ?? null,
      sourceTaskId: input.sourceTaskId ?? null,
      sourceBriefId: input.sourceBriefId ?? null,
      sourcePlanId: input.sourcePlanId ?? null,
      projectId: input.projectId ?? getProjectId(normalizedPayload),
      targetSystem,
      requestedOperation,
      normalizedPayload,
      payloadHash: hash,
      preview,
      sideEffects: sideEffectsFor(input.actionType),
      rollbackPlan: rollbackPlanFor(input.actionType),
      requiredApprovals: 1,
      status: 'WAITING_APPROVAL',
      evidenceReferences: (input.evidenceReferences ?? []).map(item => sanitizeText(item, 240)).slice(0, 20),
      idempotencyKey: payloadHash({ actionType: input.actionType, targetSystem, requestedOperation, normalizedPayload }),
      safeFailure: ['CALENDAR_EVENT_PROPOSAL', 'LOCAL_TASK_DRAFT', 'LOCAL_STATE_UPDATE', 'CODING_TASK_APPROVAL'].includes(input.actionType),
      createdAt,
      expiresAt: minutesFromNow(Math.max(5, Math.min(1440, input.expiresInMinutes ?? 60))),
      approvedAt: null,
      executedAt: null,
      rejectedAt: null,
      failureCode: null,
    };
    return this.store.runInTransaction(() => {
      const saved = this.store.saveProposal(proposal);
      this.recordEvidence(saved, 'action.proposed', 'Action proposal created and waiting for explicit approval.', null, {
        payloadHash: saved.payloadHash,
        payloadHashShort: shortHash(saved.payloadHash),
      }, 'system');
      this.store.saveCompensation(compensationFor(saved));
      return saved;
    });
  }

  proposeGmailDraft(payload: GmailDraftPayload): ActionProposal {
    const normalized = this.normalizePayload('GMAIL_CREATE_DRAFT', payload as unknown as Record<string, unknown>);
    return this.propose({
      actionType: 'GMAIL_CREATE_DRAFT',
      title: `Create Gmail draft: ${String(normalized.subject)}`,
      description: 'Create one Gmail draft. This does not send email.',
      reason: payload.reason,
      projectId: payload.projectId ?? null,
      sourceGoalId: payload.goalId ?? null,
      targetSystem: 'gmail',
      requestedOperation: 'drafts.create',
      normalizedPayload: normalized,
      evidenceReferences: [],
    });
  }

  proposeCalendarEvent(payload: CalendarEventPayload, createExternal = false): ActionProposal {
    const actionType: ActionType = createExternal ? 'CALENDAR_CREATE_EVENT' : 'CALENDAR_EVENT_PROPOSAL';
    const normalized = this.normalizePayload(actionType, payload as unknown as Record<string, unknown>);
    return this.propose({
      actionType,
      title: `${createExternal ? 'Create calendar event' : 'Prepare calendar proposal'}: ${String(normalized.title)}`,
      description: createExternal ? 'Create one approved calendar event.' : 'Prepare a local calendar proposal only.',
      reason: 'Calendar action requested by user or daily operating loop.',
      projectId: payload.projectId ?? null,
      sourceGoalId: payload.goalId ?? null,
      targetSystem: createExternal ? 'google-calendar' : 'personal-os',
      requestedOperation: createExternal ? 'events.insert' : 'calendar.proposal.local',
      normalizedPayload: normalized,
      evidenceReferences: normalized.freeBusyEvidence ? [String(normalized.freeBusyEvidence)] : [],
    });
  }

  approve(id: string, input: ApproveActionInput = {}): { proposal: ActionProposal; approval: ActionApproval; execution?: ActionExecution } {
    assertPlainPayload(input);
    return this.store.runInTransaction(() => {
      const proposal = this.requireWaitingProposal(id);
      const recomputed = payloadHash(proposal.normalizedPayload);
      if (recomputed !== proposal.payloadHash) {
        this.failProposal(proposal, 'PAYLOAD_HASH_MISMATCH', 'action.execution.failed', 'Payload hash changed before approval.');
        throw new Error('payload hash mismatch');
      }
      const approvedAt = now();
      const approval: ActionApproval = {
        id: `approval-${randomUUID()}`,
        proposalId: proposal.id,
        approver: sanitizeText(input.approver || 'user', 120),
        decision: 'APPROVE',
        payloadHash: proposal.payloadHash,
        actionType: proposal.actionType,
        targetSystem: proposal.targetSystem,
        targetSummary: targetSummary(proposal),
        riskAcknowledgement: sanitizeText(input.riskAcknowledgement || riskAcknowledgement(proposal), 1000),
        approvedAt,
        expiresAt: proposal.expiresAt,
        source: sanitizeText(input.source || 'api', 80),
        evidenceReferences: proposal.evidenceReferences,
        approvedPayloadSnapshot: proposal.normalizedPayload,
      };
      this.store.saveApproval(approval);
      const approved = this.store.updateProposalStatus(proposal.id, 'APPROVED', { approvedAt });
      this.recordEvidence(approved, 'action.approved', 'Approval bound to exact proposal, payload hash, action type, target, and expiry.', approval.id, {
        payloadHash: approval.payloadHash,
        targetSystem: approval.targetSystem,
      }, approval.approver);
      if (input.execute === true) {
        const execution = this.executeApproved(approved, approval);
        return { proposal: this.get(id), approval, execution };
      }
      return { proposal: approved, approval };
    });
  }

  reject(id: string, input: RejectActionInput = {}): ActionProposal {
    assertPlainPayload(input);
    return this.store.runInTransaction(() => {
      const proposal = this.requireWaitingProposal(id);
      const rejectedAt = now();
      const updated = this.store.updateProposalStatus(proposal.id, 'REJECTED', { rejectedAt });
      this.recordEvidence(updated, 'action.rejected', sanitizeText(input.reason || 'Action rejected.', 1000), null, {}, sanitizeText(input.approver || 'user', 120));
      return updated;
    });
  }

  cancel(id: string, actor = 'user'): ActionProposal {
    return this.store.runInTransaction(() => {
      const proposal = this.get(id);
      if (!['WAITING_APPROVAL', 'APPROVED'].includes(proposal.status)) throw new Error(`cannot cancel action in ${proposal.status}`);
      const updated = this.store.updateProposalStatus(id, 'CANCELLED');
      this.recordEvidence(updated, 'action.cancelled', 'Action cancelled before execution.', null, {}, sanitizeText(actor, 120));
      return updated;
    });
  }

  execute(id: string): ActionExecution {
    return this.store.runInTransaction(() => {
      const proposal = this.get(id);
      const approval = this.store.latestApproval(id);
      if (!approval || approval.decision !== 'APPROVE') throw new Error('missing approval');
      return this.executeApproved(proposal, approval);
    });
  }

  private executeApproved(proposal: ActionProposal, approval: ActionApproval): ActionExecution {
    if (proposal.status === 'COMPLETED') {
      const existing = this.store.getExecutionByIdempotencyKey(proposal.idempotencyKey);
      if (existing) return existing;
      throw new Error('proposal completed without execution record');
    }
    if (!['APPROVED'].includes(proposal.status)) throw new Error(`proposal is not executable from ${proposal.status}`);
    if (new Date(approval.expiresAt).getTime() <= Date.now() || new Date(proposal.expiresAt).getTime() <= Date.now()) {
      this.store.updateProposalStatus(proposal.id, 'EXPIRED');
      this.recordEvidence(proposal, 'action.expired', 'Approval expired before execution.', approval.id, {}, 'system');
      throw new Error('approval expired');
    }
    if (!ALLOWED_EXECUTION_RISKS.has(proposal.riskClass)) {
      this.failProposal(proposal, 'FORBIDDEN_RISK', 'action.execution.failed', 'Risk class is not allowed in Phase 5F.');
      throw new Error('risk class forbidden');
    }
    const recomputed = payloadHash(proposal.normalizedPayload);
    if (recomputed !== proposal.payloadHash || approval.payloadHash !== proposal.payloadHash) {
      this.failProposal(proposal, 'PAYLOAD_HASH_MISMATCH', 'action.execution.failed', 'Payload hash does not match approval.');
      throw new Error('payload hash mismatch');
    }
    const existing = this.store.getExecutionByIdempotencyKey(proposal.idempotencyKey);
    if (existing) return existing;

    const startedAt = now();
    this.store.updateProposalStatus(proposal.id, 'EXECUTING');
    this.recordEvidence(proposal, 'action.execution.started', 'Single approved execution started.', approval.id, { idempotencyKey: proposal.idempotencyKey }, 'system');
    const result = this.runProvider(proposal);
    const completedAt = now();
    const execution: ActionExecution = {
      id: `execution-${randomUUID()}`,
      proposalId: proposal.id,
      approvalId: approval.id,
      actionType: proposal.actionType,
      idempotencyKey: proposal.idempotencyKey,
      status: result.failureCode ? 'FAILED' : 'COMPLETED',
      attempt: 1,
      providerMode: result.providerMode,
      providerRequestMetadata: result.requestMetadata,
      providerResponseSummary: result.responseSummary,
      externalObjectId: result.externalObjectId,
      failureCode: result.failureCode,
      startedAt,
      completedAt,
    };
    this.store.saveExecution(execution);
    const finalStatus = execution.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED';
    this.store.updateProposalStatus(proposal.id, finalStatus, { executedAt: completedAt, failureCode: execution.failureCode });
    this.recordEvidence(proposal, execution.status === 'COMPLETED' ? 'action.execution.completed' : 'action.execution.failed', result.summary, approval.id, {
      executionId: execution.id,
      externalObjectId: execution.externalObjectId,
      providerMode: execution.providerMode,
      failureCode: execution.failureCode,
    }, 'system', execution.id);
    return execution;
  }

  private runProvider(proposal: ActionProposal): {
    providerMode: 'fixture' | 'sandbox' | 'live';
    requestMetadata: Record<string, unknown>;
    responseSummary: Record<string, unknown>;
    externalObjectId: string | null;
    failureCode: ProviderFailureCode | null;
    summary: string;
  } {
    const mode = providerMode();
    if (mode === 'live') {
      return {
        providerMode: 'live',
        requestMetadata: { targetSystem: proposal.targetSystem, blocked: true },
        responseSummary: { status: 'blocked', reason: 'live provider writes are disabled for Phase 5F local acceptance' },
        externalObjectId: null,
        failureCode: 'PROVIDER_UNAVAILABLE',
        summary: 'Live provider write was not attempted; Phase 5F uses fixtures unless a sandbox connector is explicitly configured.',
      };
    }
    if (proposal.actionType === 'GMAIL_CREATE_DRAFT') {
      const id = `gmail-draft-fixture-${shortHash(proposal.payloadHash)}`;
      return {
        providerMode: mode,
        requestMetadata: { provider: 'gmail', operation: 'drafts.create', toCount: (proposal.normalizedPayload.to as string[]).length },
        responseSummary: { status: 'draft_created', draftId: id, sent: false },
        externalObjectId: id,
        failureCode: null,
        summary: 'Gmail draft created in fixture provider. No email was sent.',
      };
    }
    if (proposal.actionType === 'CALENDAR_EVENT_PROPOSAL') {
      return {
        providerMode: 'fixture',
        requestMetadata: { provider: 'personal-os', operation: 'calendar.proposal.local' },
        responseSummary: { status: 'proposal_recorded', conflicts: proposal.normalizedPayload.conflicts ?? [] },
        externalObjectId: `calendar-proposal-${shortHash(proposal.payloadHash)}`,
        failureCode: null,
        summary: 'Calendar event proposal recorded locally. No calendar event was created.',
      };
    }
    if (proposal.actionType === 'CALENDAR_CREATE_EVENT') {
      if (Array.isArray(proposal.normalizedPayload.conflicts) && proposal.normalizedPayload.conflicts.length > 0) {
        return {
          providerMode: mode,
          requestMetadata: { provider: 'google-calendar', operation: 'events.insert', dryRunRechecked: true },
          responseSummary: { status: 'blocked', conflictChanged: true },
          externalObjectId: null,
          failureCode: 'CONFLICT_CHANGED',
          summary: 'Calendar create blocked because conflict state is not clean at execution time.',
        };
      }
      const id = `calendar-event-fixture-${shortHash(proposal.payloadHash)}`;
      return {
        providerMode: mode,
        requestMetadata: { provider: 'google-calendar', operation: 'events.insert', attendeeCount: (proposal.normalizedPayload.attendees as string[]).length },
        responseSummary: { status: 'event_created', eventId: id },
        externalObjectId: id,
        failureCode: null,
        summary: 'Calendar event created in fixture provider.',
      };
    }
    return {
      providerMode: 'fixture',
      requestMetadata: { provider: 'local', operation: proposal.requestedOperation },
      responseSummary: { status: 'completed' },
      externalObjectId: `local-action-${shortHash(proposal.payloadHash)}`,
      failureCode: null,
      summary: 'Local controlled action completed.',
    };
  }

  private requireWaitingProposal(id: string): ActionProposal {
    const proposal = this.get(id);
    if (proposal.status !== 'WAITING_APPROVAL') throw new Error(`proposal is not waiting for approval: ${proposal.status}`);
    return proposal;
  }

  private expireIfNeeded(proposal: ActionProposal): ActionProposal {
    if (proposal.status === 'WAITING_APPROVAL' && new Date(proposal.expiresAt).getTime() <= Date.now()) {
      const expired = this.store.updateProposalStatus(proposal.id, 'EXPIRED');
      this.recordEvidence(expired, 'action.expired', 'Proposal expired before approval.', null, {}, 'system');
      return expired;
    }
    return proposal;
  }

  private failProposal(proposal: ActionProposal, code: ProviderFailureCode, eventType: string, summary: string): void {
    this.store.updateProposalStatus(proposal.id, 'FAILED', { failureCode: code });
    this.recordEvidence(proposal, eventType, summary, null, { failureCode: code }, 'system');
  }

  private recordEvidence(proposal: ActionProposal, eventType: string, summary: string, approvalId: string | null, metadata: Record<string, unknown>, actor: string, executionId: string | null = null): ActionEvidence {
    return this.store.saveEvidence({
      id: `evidence-${randomUUID()}`,
      proposalId: proposal.id,
      approvalId,
      executionId,
      eventType,
      summary,
      payloadHash: proposal.payloadHash,
      metadata,
      actor,
      createdAt: now(),
    });
  }

  private normalizePayload(actionType: ActionType, payload: Record<string, unknown>): Record<string, unknown> {
    assertPlainPayload(payload);
    if (actionType === 'GMAIL_CREATE_DRAFT') {
      const to = normalizeEmailArray(payload.to, 'to', 20);
      const cc = normalizeEmailArray(payload.cc ?? [], 'cc', 20);
      const bcc = normalizeEmailArray(payload.bcc ?? [], 'bcc', 0);
      return {
        to,
        cc,
        bcc,
        subject: sanitizeText(String(payload.subject ?? ''), 240),
        body: sanitizeText(String(payload.body ?? ''), 8000),
        threadId: payload.threadId ? sanitizeText(String(payload.threadId), 200) : null,
        projectId: payload.projectId ? sanitizeText(String(payload.projectId), 120) : null,
        goalId: payload.goalId ? sanitizeText(String(payload.goalId), 120) : null,
        reason: sanitizeText(String(payload.reason ?? 'Create Gmail draft'), 1000),
        sensitivity: ['PUBLIC', 'INTERNAL', 'PRIVATE'].includes(String(payload.sensitivity)) ? String(payload.sensitivity) : 'PRIVATE',
      };
    }
    if (actionType === 'CALENDAR_EVENT_PROPOSAL' || actionType === 'CALENDAR_CREATE_EVENT') {
      const start = assertDateTime(String(payload.start ?? ''), 'start');
      const end = assertDateTime(String(payload.end ?? ''), 'end');
      if (new Date(end).getTime() <= new Date(start).getTime()) throw new Error('calendar end must be after start');
      return {
        title: sanitizeText(String(payload.title ?? ''), 240),
        start,
        end,
        timezone: sanitizeText(String(payload.timezone ?? 'Asia/Saigon'), 80),
        attendees: normalizeEmailArray(payload.attendees ?? [], 'attendees', 25),
        location: payload.location ? sanitizeText(String(payload.location), 240) : null,
        description: payload.description ? sanitizeText(String(payload.description), 4000) : '',
        projectId: payload.projectId ? sanitizeText(String(payload.projectId), 120) : null,
        goalId: payload.goalId ? sanitizeText(String(payload.goalId), 120) : null,
        conflicts: Array.isArray(payload.conflicts) ? payload.conflicts.slice(0, 10) : [],
        freeBusyEvidence: payload.freeBusyEvidence ? sanitizeText(String(payload.freeBusyEvidence), 240) : null,
      };
    }
    if (actionType === 'GMAIL_SEND_DRAFT') {
      throw new Error('GMAIL_SEND_DRAFT is documented but not implemented until draft creation is proven');
    }
    return JSON.parse(JSON.stringify(payload));
  }

  private previewFor(actionType: ActionType, payload: Record<string, unknown>) {
    if (actionType === 'GMAIL_CREATE_DRAFT') {
      return textPreview('EMAIL', {
        To: payload.to as string[],
        Cc: payload.cc as string[],
        Bcc: (payload.bcc as string[]).length ? payload.bcc as string[] : 'none',
        Subject: String(payload.subject),
        Body: String(payload.body).slice(0, 2000),
        'External recipients': (payload.to as string[]).filter(email => !email.endsWith('@mi.local')),
        Sends: false,
      });
    }
    if (actionType === 'CALENDAR_EVENT_PROPOSAL' || actionType === 'CALENDAR_CREATE_EVENT') {
      return textPreview('CALENDAR', {
        Title: String(payload.title),
        Time: `${payload.start} - ${payload.end}`,
        Timezone: String(payload.timezone),
        Attendees: payload.attendees as string[],
        Location: String(payload.location ?? ''),
        Conflict: Array.isArray(payload.conflicts) && payload.conflicts.length ? 'conflicts present' : 'none recorded',
      });
    }
    return textPreview('GENERIC', { Action: actionType, Target: String(payload.target ?? '') });
  }
}

function normalizeEmailArray(value: unknown, label: string, max: number): string[] {
  if (!Array.isArray(value)) {
    if (typeof value === 'string' && value.trim()) return max === 0 ? rejectArray(label) : [assertEmail(value)];
    if (max === 0) return [];
    throw new Error(`${label} must be an array`);
  }
  if (max === 0 && value.length > 0) throw new Error(`${label} is not allowed by default`);
  if (value.length > max) throw new Error(`${label} has too many recipients`);
  return [...new Set(value.map(item => assertEmail(String(item))))];
}

function rejectArray(label: string): string[] {
  throw new Error(`${label} is not allowed by default`);
}

function defaultTargetSystem(actionType: ActionType): string {
  if (actionType.startsWith('GMAIL')) return 'gmail';
  if (actionType.startsWith('CALENDAR')) return 'google-calendar';
  if (actionType.startsWith('CODING')) return 'task-runtime';
  return 'personal-os';
}

function defaultTitle(actionType: ActionType, payload: Record<string, unknown>): string {
  if (actionType === 'GMAIL_CREATE_DRAFT') return `Create Gmail draft: ${payload.subject}`;
  if (actionType.startsWith('CALENDAR')) return `Calendar action: ${payload.title}`;
  return actionType;
}

function defaultDescription(actionType: ActionType): string {
  if (actionType === 'GMAIL_CREATE_DRAFT') return 'Create a Gmail draft without sending it.';
  if (actionType === 'CALENDAR_EVENT_PROPOSAL') return 'Create a local calendar proposal without writing to Google Calendar.';
  if (actionType === 'CALENDAR_CREATE_EVENT') return 'Create one Google Calendar event after exact approval.';
  return 'Controlled local action.';
}

function sideEffectsFor(actionType: ActionType): string[] {
  if (actionType === 'GMAIL_CREATE_DRAFT') return ['Creates one Gmail draft. Does not send email.'];
  if (actionType === 'GMAIL_SEND_DRAFT') return ['Sends one external email. Irreversible.'];
  if (actionType === 'CALENDAR_EVENT_PROPOSAL') return ['Stores a local calendar proposal only.'];
  if (actionType === 'CALENDAR_CREATE_EVENT') return ['Creates one Google Calendar event. May notify attendees according to provider settings.'];
  return ['Updates local Personal OS state only.'];
}

function rollbackPlanFor(actionType: ActionType): string {
  if (actionType === 'GMAIL_CREATE_DRAFT') return 'A draft delete is a separate compensation action requiring new approval.';
  if (actionType === 'GMAIL_SEND_DRAFT') return 'IRREVERSIBLE: sent email cannot be rolled back.';
  if (actionType === 'CALENDAR_CREATE_EVENT') return 'Deleting the event is a separate compensation action requiring new approval.';
  if (actionType === 'CALENDAR_EVENT_PROPOSAL') return 'Local proposal can be cancelled before external create.';
  return 'State reversal must use the legal Task Runtime or Personal OS transition for that record.';
}

function compensationFor(proposal: ActionProposal): ActionCompensation {
  const createdAt = now();
  const available = proposal.actionType === 'GMAIL_CREATE_DRAFT' || proposal.actionType === 'CALENDAR_CREATE_EVENT' || proposal.riskClass === 'R1';
  return {
    id: `compensation-${randomUUID()}`,
    proposalId: proposal.id,
    actionClass: proposal.actionType,
    available,
    requiresNewApproval: proposal.actionType !== 'CALENDAR_EVENT_PROPOSAL',
    description: rollbackPlanFor(proposal.actionType),
    status: available ? 'AVAILABLE' : 'NOT_AVAILABLE',
    createdAt,
    updatedAt: createdAt,
  };
}

function riskAcknowledgement(proposal: ActionProposal): string {
  if (proposal.actionType === 'GMAIL_CREATE_DRAFT') return 'This will create one Gmail draft and will not send email.';
  if (proposal.actionType === 'CALENDAR_CREATE_EVENT') return 'This will create one external calendar event.';
  return `I approve this ${proposal.riskClass} controlled action.`;
}

function targetSummary(proposal: ActionProposal): string {
  if (proposal.actionType === 'GMAIL_CREATE_DRAFT') return `gmail:${(proposal.normalizedPayload.to as string[]).join(',')}:${proposal.normalizedPayload.subject}`;
  if (proposal.actionType.startsWith('CALENDAR')) return `calendar:${proposal.normalizedPayload.title}:${proposal.normalizedPayload.start}`;
  return `${proposal.targetSystem}:${proposal.requestedOperation}`;
}

function getProjectId(payload: Record<string, unknown>): string | null {
  return typeof payload.projectId === 'string' ? payload.projectId : null;
}

function providerMode(): 'fixture' | 'sandbox' | 'live' {
  const mode = String(process.env.MI_CONTROLLED_ACTION_PROVIDER_MODE || 'fixture').toLowerCase();
  if (mode === 'sandbox') return 'sandbox';
  if (mode === 'live') return 'live';
  return 'fixture';
}
