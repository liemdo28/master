import { randomUUID } from 'crypto';
import { GovernanceStore } from './store';
import type { GovernanceEvent, PolicyDecision } from './types';

export class GovernanceAuditService {
  constructor(private readonly store: GovernanceStore) {}

  record(input: Omit<GovernanceEvent, 'id' | 'createdAt'>): GovernanceEvent {
    return this.store.recordEvent({
      ...input,
      id: `gov-event-${randomUUID()}`,
      createdAt: new Date().toISOString(),
    });
  }

  recordDecision(eventType: string, decision: PolicyDecision, actor = 'system', metadata: Record<string, unknown> = {}): GovernanceEvent {
    return this.record({
      eventType,
      policyVersion: decision.policyVersion,
      inputHash: decision.inputHash,
      decisionHash: decision.decisionHash,
      actor,
      proposalId: decision.proposalId,
      reasons: decision.reasons,
      metadata,
    });
  }
}
