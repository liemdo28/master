import { randomUUID } from 'crypto';
import { GovernanceStore } from './store';
import type { ActionProposal } from '../types';
import type { GovernanceAnomaly } from './types';

export class GovernanceAnomalyDetector {
  constructor(private readonly store: GovernanceStore) {}

  detectForProposal(proposal: ActionProposal): GovernanceAnomaly[] {
    const anomalies: GovernanceAnomaly[] = [];
    const recentSameType = this.store.listEvents(200).filter(event =>
      event.proposalId !== proposal.id &&
      event.eventType.startsWith('policy.') &&
      (Date.now() - new Date(event.createdAt).getTime()) < 60_000
    );
    if (recentSameType.length >= 10) {
      anomalies.push(this.record({
        type: 'unusual_policy_volume',
        severity: 'WARNING',
        proposalId: proposal.id,
        projectId: proposal.projectId,
        description: 'Unusual number of policy evaluations in a short window.',
        evidence: { count: recentSameType.length, windowMs: 60_000 },
      }));
    }
    return anomalies;
  }

  record(input: Omit<GovernanceAnomaly, 'id' | 'detectedAt' | 'status'>): GovernanceAnomaly {
    return this.store.saveAnomaly({
      ...input,
      id: `anomaly-${randomUUID()}`,
      detectedAt: new Date().toISOString(),
      status: 'OPEN',
    });
  }
}
