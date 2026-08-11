import { randomUUID, createHash } from 'crypto';
import type { Response } from 'express';
import { ControlledActionService } from '../personal-os/actions/service';
import type { ActionProposal, ActionType, CalendarEventPayload, GmailDraftPayload, ProposeActionInput } from '../personal-os/actions/types';
import { payloadHash } from '../personal-os/actions/policy';
import { generateAuthorityManifest } from './scanner';
import { isMutation } from './registry';
import type { AuthorityManifest, AuthoritySurface, LegacyDisposition } from './types';

export type LegacyAdapterResultCode =
  | 'ADAPTED'
  | 'QUARANTINED'
  | 'FORBIDDEN'
  | 'UNSUPPORTED_SEMANTICS'
  | 'AUTHORITY_DENIED'
  | 'CANONICAL_VALIDATION_FAILED';

export interface LegacyAdapterResult {
  code: LegacyAdapterResultCode;
  surfaceId: string;
  canonicalOwner: string | null;
  canonicalProposalId: string | null;
  canonicalActionType: ActionType | null;
  canonicalPayloadHash: string | null;
  reason: string;
  correlationId: string;
  status: number;
  legacyCompatible: Record<string, unknown>;
}

type AdapterInput = {
  surfaceId: string;
  body?: Record<string, unknown>;
  actor?: string;
  projectId?: string | null;
  root?: string;
  service?: ControlledActionService;
};

export const LEGACY_CONTROLLED_ACTION_TYPES = new Set<ActionType>([
  'GMAIL_CREATE_DRAFT',
  'CALENDAR_EVENT_PROPOSAL',
  'CALENDAR_CREATE_EVENT',
]);

const FORBIDDEN_ACTION_WORDS = [
  'send',
  'reply',
  'forward',
  'payment',
  'transfer',
  'purchase',
  'invoice_payment',
  'shell',
  'powershell',
  'cmd',
  'deploy',
  'merge',
];

const adaptedProposalCache = new Map<string, { proposalId: string; actionType: ActionType; payloadHash: string }>();

export class LegacyAuthorityAdapter {
  readonly manifest: AuthorityManifest;

  constructor(repoRoot = process.cwd()) {
    this.manifest = generateAuthorityManifest(repoRoot);
  }

  disposition(surfaceId: string): AuthoritySurface | null {
    return this.manifest.surfaces.find(surface => surface.id === surfaceId) ?? null;
  }

  migrationSummary() {
    const legacy = legacyMutationSurfaces(this.manifest);
    return {
      legacyMutations: legacy.length,
      adapted: legacy.filter(isAdaptedDisposition).length,
      quarantined: legacy.filter(isQuarantineDisposition).length,
      disabledDead: legacy.filter(surface => surface.phase6bDisposition === 'DEAD_UNWIRED').length,
      unresolved: legacy.filter(surface => !surface.phase6bDisposition).length,
      byOwner: groupCount(legacy.map(surface => surface.canonicalOwner)),
    };
  }

  adapt(input: AdapterInput): LegacyAdapterResult {
    const surface = this.requireSurface(input.surfaceId);
    const body = input.body ?? {};
    const correlationId = correlationFor(input.surfaceId, body);
    const actionType = legacyActionType(body);
    if (!actionType) {
      return this.unsupported(surface, 'Legacy request does not declare an existing canonical Controlled Action type.', correlationId);
    }
    if (!LEGACY_CONTROLLED_ACTION_TYPES.has(actionType)) {
      return this.forbidden(surface, `${actionType} is not an eligible Phase 6B Controlled Action adapter target.`, correlationId);
    }
    if (containsForbiddenSemantics(body)) {
      return this.forbidden(surface, 'Legacy request contains unsupported send/reply/forward/financial/process semantics.', correlationId);
    }
    const service = input.service ?? new ControlledActionService(input.root);
    const ownService = !input.service;
    try {
      const cached = adaptedProposalCache.get(correlationId);
      if (cached?.actionType === actionType) {
        const existing = service.get(cached.proposalId);
        if (existing.payloadHash === cached.payloadHash) {
          const result = adaptedResult(surface, existing, correlationId, 'Legacy request matched an existing canonical Controlled Action proposal.');
          recordAdapterEvidence('legacy.adapter.idempotent', result, input.actor ?? 'legacy-adapter');
          return result;
        }
      }
      const proposal = proposeCanonical(service, actionType, body, surface, input.projectId);
      adaptedProposalCache.set(correlationId, { proposalId: proposal.id, actionType: proposal.actionType, payloadHash: proposal.payloadHash });
      const result = adaptedResult(surface, proposal, correlationId, 'Legacy request translated to canonical Controlled Action proposal and left WAITING_APPROVAL.');
      recordAdapterEvidence('legacy.adapter.mapped', result, input.actor ?? 'legacy-adapter');
      return result;
    } catch (err) {
      const result: LegacyAdapterResult = {
        code: 'CANONICAL_VALIDATION_FAILED',
        surfaceId: surface.id,
        canonicalOwner: 'ControlledActionService',
        canonicalProposalId: null,
        canonicalActionType: actionType,
        canonicalPayloadHash: null,
        reason: err instanceof Error ? err.message : String(err),
        correlationId,
        status: 400,
        legacyCompatible: {},
      };
      recordAdapterEvidence('legacy.adapter.rejected', result, input.actor ?? 'legacy-adapter');
      return result;
    } finally {
      if (ownService) service.close();
    }
  }

  quarantine(surfaceId: string, reason: string, actor = 'legacy-adapter', status = 409): LegacyAdapterResult {
    const surface = this.disposition(surfaceId);
    const result: LegacyAdapterResult = {
      code: surface?.phase6bDisposition === 'REQUIRES_FUTURE_AUTHORIZATION' ? 'AUTHORITY_DENIED' : 'QUARANTINED',
      surfaceId,
      canonicalOwner: surface?.canonicalOwner ?? null,
      canonicalProposalId: null,
      canonicalActionType: null,
      canonicalPayloadHash: null,
      reason,
      correlationId: correlationFor(surfaceId, { reason }),
      status,
      legacyCompatible: {
        error: 'LEGACY_AUTHORITY_QUARANTINED',
        surfaceId,
        canonicalMigrationTarget: surface?.migrationTarget ?? null,
        message: 'This legacy mutation is denied by the Phase 6B authority boundary.',
      },
    };
    recordAdapterEvidence('legacy.quarantine.blocked', result, actor);
    return result;
  }

  unsupported(surface: AuthoritySurface, reason: string, correlationId = correlationFor(surface.id, { reason })): LegacyAdapterResult {
    const result: LegacyAdapterResult = {
      code: 'UNSUPPORTED_SEMANTICS',
      surfaceId: surface.id,
      canonicalOwner: surface.canonicalOwner,
      canonicalProposalId: null,
      canonicalActionType: null,
      canonicalPayloadHash: null,
      reason,
      correlationId,
      status: 422,
      legacyCompatible: {
        error: 'LEGACY_AUTHORITY_UNSUPPORTED_SEMANTICS',
        surfaceId: surface.id,
        canonicalMigrationTarget: surface.migrationTarget,
        message: reason,
      },
    };
    recordAdapterEvidence('legacy.semantic.unsupported', result, 'legacy-adapter');
    return result;
  }

  forbidden(surface: AuthoritySurface, reason: string, correlationId = correlationFor(surface.id, { reason })): LegacyAdapterResult {
    const result: LegacyAdapterResult = {
      code: 'FORBIDDEN',
      surfaceId: surface.id,
      canonicalOwner: surface.canonicalOwner,
      canonicalProposalId: null,
      canonicalActionType: null,
      canonicalPayloadHash: null,
      reason,
      correlationId,
      status: 403,
      legacyCompatible: {
        error: 'LEGACY_AUTHORITY_FORBIDDEN',
        surfaceId: surface.id,
        canonicalMigrationTarget: surface.migrationTarget,
        message: reason,
      },
    };
    recordAdapterEvidence('legacy.adapter.rejected', result, 'legacy-adapter');
    return result;
  }

  private requireSurface(surfaceId: string): AuthoritySurface {
    const surface = this.disposition(surfaceId);
    if (!surface) throw new Error(`unknown authority surface: ${surfaceId}`);
    if (!surface.phase6bDisposition) throw new Error(`legacy surface is unresolved: ${surfaceId}`);
    if (!isAdaptedDisposition(surface)) throw new Error(`legacy surface is not adapter eligible: ${surfaceId}`);
    return surface;
  }
}

export function respondWithLegacyResult(res: Response, result: LegacyAdapterResult): void {
  res.status(result.status).json({
    ...result.legacyCompatible,
    adapter: {
      code: result.code,
      surfaceId: result.surfaceId,
      canonicalOwner: result.canonicalOwner,
      canonicalProposalId: result.canonicalProposalId,
      canonicalActionType: result.canonicalActionType,
      canonicalPayloadHash: result.canonicalPayloadHash,
      correlationId: result.correlationId,
      reason: result.reason,
    },
  });
}

export function legacyMutationSurfaces(manifest: AuthorityManifest): AuthoritySurface[] {
  return manifest.surfaces.filter(surface =>
    isMutation(surface.method, surface.effectClass) &&
    (surface.legacyReason !== null || surface.authorityClass === 'LEGACY_QUARANTINED')
  );
}

export function isAdaptedDisposition(surface: AuthoritySurface): boolean {
  return surface.phase6bDisposition === 'ADAPT_SAFE' || surface.phase6bDisposition === 'ADAPT_WITH_BEHAVIOR_CHANGE';
}

export function isQuarantineDisposition(surface: AuthoritySurface): boolean {
  return surface.phase6bDisposition === 'QUARANTINE_ONLY' || surface.phase6bDisposition === 'REQUIRES_FUTURE_AUTHORIZATION';
}

export function validateLegacyAuthorityRuntime(manifest: AuthorityManifest): void {
  const legacy = legacyMutationSurfaces(manifest);
  const unresolved = legacy.filter(surface => !surface.phase6bDisposition);
  if (unresolved.length) throw new Error(`LEGACY_AUTHORITY_UNRESOLVED: ${unresolved.map(surface => surface.id).join(', ')}`);
  const badAdapters = legacy.filter(surface => isAdaptedDisposition(surface) && !surface.adapterTarget);
  if (badAdapters.length) throw new Error(`LEGACY_AUTHORITY_ADAPTER_MISSING: ${badAdapters.map(surface => surface.id).join(', ')}`);
  const badQuarantine = legacy.filter(surface => isQuarantineDisposition(surface) && !surface.quarantineHandler);
  if (badQuarantine.length) throw new Error(`LEGACY_AUTHORITY_QUARANTINE_HANDLER_MISSING: ${badQuarantine.map(surface => surface.id).join(', ')}`);
  const unsafeAdapted = legacy.filter(surface =>
    isAdaptedDisposition(surface) &&
    (surface.effectClass === 'PROCESS_CONTROL' || surface.effectClass === 'SERVICE_CONTROL' || surface.effectClass === 'EXTERNAL_IRREVERSIBLE')
  );
  if (unsafeAdapted.length) throw new Error(`LEGACY_AUTHORITY_UNSAFE_ADAPTER: ${unsafeAdapted.map(surface => surface.id).join(', ')}`);
}

function legacyActionType(body: Record<string, unknown>): ActionType | null {
  const direct = typeof body.actionType === 'string' ? body.actionType : typeof body.category === 'string' ? body.category : '';
  const normalized = direct.toUpperCase().replace(/[-\s]/g, '_');
  if (normalized === 'GMAIL_DRAFT' || normalized === 'GMAIL_CREATE_DRAFT') return 'GMAIL_CREATE_DRAFT';
  if (normalized === 'CALENDAR_PROPOSAL' || normalized === 'CALENDAR_EVENT_PROPOSAL') return 'CALENDAR_EVENT_PROPOSAL';
  if (normalized === 'CALENDAR_CREATE' || normalized === 'CALENDAR_CREATE_EVENT' || normalized === 'CALENDAR_EVENT_CREATE') return 'CALENDAR_CREATE_EVENT';
  if (normalized === 'GMAIL_SEND' || normalized === 'GMAIL_SEND_DRAFT') return 'GMAIL_SEND_DRAFT';
  return null;
}

function proposeCanonical(service: ControlledActionService, actionType: ActionType, body: Record<string, unknown>, surface: AuthoritySurface, projectId?: string | null): ActionProposal {
  const payload = payloadFromLegacy(body, projectId);
  if (actionType === 'GMAIL_CREATE_DRAFT') return service.proposeGmailDraft(payload as unknown as GmailDraftPayload);
  if (actionType === 'CALENDAR_EVENT_PROPOSAL') return service.proposeCalendarEvent(payload as unknown as CalendarEventPayload, false);
  if (actionType === 'CALENDAR_CREATE_EVENT') return service.proposeCalendarEvent(payload as unknown as CalendarEventPayload, true);
  const canonical: ProposeActionInput = {
    actionType,
    title: `Legacy adapter request from ${surface.runtimeMount}`,
    description: 'Legacy request translated to canonical proposal.',
    reason: 'Legacy authority adapter request.',
    projectId: projectId ?? null,
    targetSystem: 'personal-os',
    requestedOperation: actionType,
    normalizedPayload: payload,
    evidenceReferences: [`legacy:${surface.id}`],
  };
  return service.propose(canonical);
}

function adaptedResult(surface: AuthoritySurface, proposal: ActionProposal, correlationId: string, reason: string): LegacyAdapterResult {
  return {
    code: 'ADAPTED',
    surfaceId: surface.id,
    canonicalOwner: 'ControlledActionService',
    canonicalProposalId: proposal.id,
    canonicalActionType: proposal.actionType,
    canonicalPayloadHash: proposal.payloadHash,
    reason,
    correlationId,
    status: 201,
    legacyCompatible: {
      queued: true,
      status: proposal.status,
      approval_id: proposal.id,
      canonicalProposalId: proposal.id,
      actionType: proposal.actionType,
      payloadHash: proposal.payloadHash,
    },
  };
}

function payloadFromLegacy(body: Record<string, unknown>, projectId?: string | null): Record<string, unknown> {
  const payload = isPlainObject(body.payload) ? body.payload : body;
  return {
    ...payload,
    projectId: typeof payload.projectId === 'string' ? payload.projectId : projectId ?? null,
    reason: typeof payload.reason === 'string' ? payload.reason : typeof body.description === 'string' ? body.description : 'Legacy adapter request',
  };
}

function containsForbiddenSemantics(value: unknown): boolean {
  const text = JSON.stringify(value).toLowerCase();
  return FORBIDDEN_ACTION_WORDS.some(word => text.includes(word));
}

function correlationFor(surfaceId: string, body: Record<string, unknown>): string {
  return `legacy-${createHash('sha256').update(surfaceId).update(payloadHash(body)).digest('hex').slice(0, 16)}`;
}

function recordAdapterEvidence(eventType: string, result: LegacyAdapterResult, actor: string): void {
  if (process.env.MI_AUTHORITY_EVIDENCE_DISABLED === '1') return;
  try {
    const service = new ControlledActionService();
    try {
      service.policyEngine.audit.record({
        eventType,
        policyVersion: null,
        inputHash: result.canonicalPayloadHash,
        decisionHash: null,
        actor,
        proposalId: result.canonicalProposalId,
        reasons: [result.reason],
        metadata: {
          surfaceId: result.surfaceId,
          canonicalOwner: result.canonicalOwner,
          canonicalActionType: result.canonicalActionType,
          correlationId: result.correlationId,
          result: result.code,
          eventId: `legacy-authority-${randomUUID()}`,
        },
      });
    } finally {
      service.close();
    }
  } catch {
    // Denial/adaptation response must not depend on audit DB availability.
  }
}

function groupCount(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
