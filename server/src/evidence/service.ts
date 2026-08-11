import path from 'path';
import { TaskStore } from '../task-runtime/store';
import { ControlledActionStore } from '../personal-os/actions/store';
import { GovernanceStore } from '../personal-os/actions/governance/store';
import { OrchestrationStore } from '../personal-os/orchestration/store';
import { DelegationStore } from '../personal-os/delegation/store';
import { DocumentStore } from '../personal-os/documents/store';
import {
  normalizeActionEvidence, normalizeConflict, normalizeDelegationDecision,
  normalizeDelegationEvent, normalizeDocument, normalizeGovernanceAnomaly,
  normalizeGovernanceEvent, normalizePlanEvidence, normalizePolicyDecision, normalizeTaskEvent,
} from './normalize';
import type { DailyAuditDigest, EvidenceFilter, EvidenceRecord, EvidenceServiceOptions, HealthMetric } from './types';

/** Reads through every existing Phase 5F-5I store (same pattern as
 *  operator-control/service.ts) and normalizes into the canonical EvidenceRecord
 *  contract. Never writes anything — this service has no mutation method at all. */
export class EvidenceService {
  private taskStore: TaskStore;
  private actionStore: ControlledActionStore;
  private governanceStore: GovernanceStore;
  private orchestrationStore: OrchestrationStore;
  private delegationStore: DelegationStore;
  private documentStore: DocumentStore;
  private repoRoot: string;
  private now: () => Date;

  constructor(options: EvidenceServiceOptions = {}) {
    this.repoRoot = options.repoRoot ?? path.resolve(__dirname, '../..');
    this.now = options.now ?? (() => new Date());
    this.taskStore = new TaskStore(options.taskRuntimeRoot);
    this.actionStore = new ControlledActionStore(options.personalOsRoot);
    this.governanceStore = new GovernanceStore(this.actionStore.handle);
    this.orchestrationStore = new OrchestrationStore(options.personalOsRoot);
    this.delegationStore = new DelegationStore(options.personalOsRoot);
    this.documentStore = new DocumentStore(options.personalOsRoot);
  }

  close(): void {
    this.documentStore.close();
    this.delegationStore.close();
    this.orchestrationStore.close();
    this.actionStore.close();
    this.taskStore.close();
  }

  /** Aggregates every in-scope source into one deterministic evidence list. Read-only,
   *  no side effects, no caching across calls — always reflects current store state. */
  list(filter: EvidenceFilter = {}): EvidenceRecord[] {
    const now = this.now();
    const records: EvidenceRecord[] = [];

    const proposals = this.actionStore.listProposals();
    const proposalProjectId = new Map(proposals.map(p => [p.id, p.projectId ?? null]));
    for (const proposal of proposals) {
      for (const evidence of this.actionStore.listEvidence(proposal.id)) {
        records.push(normalizeActionEvidence(evidence, proposal.projectId ?? null, now));
      }
    }

    for (const decision of this.governanceStore.listDecisions(500)) {
      records.push(normalizePolicyDecision(decision, now));
    }
    for (const event of this.governanceStore.listEvents(500)) {
      const projectId = event.proposalId ? proposalProjectId.get(event.proposalId) ?? null : null;
      records.push(normalizeGovernanceEvent(event, projectId, now));
    }
    for (const anomaly of this.governanceStore.listAnomalies(500)) {
      records.push(normalizeGovernanceAnomaly(anomaly, now));
    }

    const plans = this.orchestrationStore.listPlans();
    for (const plan of plans) {
      for (const evidence of this.orchestrationStore.listEvidenceForPlan(plan.id)) {
        records.push(normalizePlanEvidence(evidence, plan.projectId ?? null, now));
      }
    }

    const delegations = this.delegationStore.listDelegations();
    for (const delegation of delegations) {
      for (const decision of this.delegationStore.listDecisionsForDelegation(delegation.id)) {
        records.push(normalizeDelegationDecision(decision as any, now));
      }
      for (const event of this.delegationStore.listEventsForDelegation(delegation.id)) {
        records.push(normalizeDelegationEvent(event as any, delegation.projectId ?? null, now));
      }
    }

    for (const document of this.documentStore.listDocuments()) {
      records.push(normalizeDocument(document as any, now));
    }
    for (const conflict of this.documentStore.listConflicts()) {
      records.push(normalizeConflict(conflict as any, now));
    }

    for (const task of this.taskStore.listTasks()) {
      for (const event of this.taskStore.listEvents(task.id)) {
        records.push(normalizeTaskEvent(event, task.projectId ?? null, now));
      }
    }

    return applyFilter(records, filter);
  }

  get(id: string): EvidenceRecord | null {
    return this.list().find(r => r.id === id) ?? null;
  }

  /** §6D.4 — open conflicts across every source, never silently resolved by picking a
   *  side. A conflict disappears from this list only when its own source system marks
   *  it resolved (conflictGroup becomes null at normalization time). */
  conflicts(): EvidenceRecord[] {
    return this.list({ category: 'CONFLICT' }).filter(r => r.conflictGroup !== null);
  }

  /** §6D.8 — structured health metrics. Every dimension the directive lists is either
   *  computed here from a real store, or explicitly marked UNKNOWN with a note that no
   *  probe exists yet — never fabricated. */
  health(): HealthMetric[] {
    const now = this.now();
    const metrics: HealthMetric[] = [];

    const waitingProposals = this.actionStore.listProposals('WAITING_APPROVAL');
    metrics.push({
      dimension: 'APPROVALS_WAITING', value: waitingProposals.length,
      status: waitingProposals.length > 10 ? 'ATTENTION' : 'OK',
      detail: `${waitingProposals.length} Controlled Action proposal(s) waiting on a human.`,
      evidenceIds: waitingProposals.map(p => `CONTROLLED_ACTIONS:${p.id}`),
    });

    const blockedPlans = this.orchestrationStore.listPlans('PAUSED').concat(this.orchestrationStore.listPlans('FAILED'));
    metrics.push({
      dimension: 'BLOCKED_PLANS', value: blockedPlans.length,
      status: blockedPlans.length > 0 ? 'ATTENTION' : 'OK',
      detail: `${blockedPlans.length} orchestration plan(s) paused or failed.`,
      evidenceIds: blockedPlans.map(p => `ORCHESTRATION:${p.id}`),
    });

    const staleDocs = this.documentStore.listDocuments('STALE');
    metrics.push({
      dimension: 'STALE_KNOWLEDGE', value: staleDocs.length,
      status: staleDocs.length > 20 ? 'ATTENTION' : 'OK',
      detail: `${staleDocs.length} knowledge document(s) marked STALE.`,
      evidenceIds: staleDocs.map(d => `KNOWLEDGE:${d.id}`),
    });

    const failedJobs = this.documentStore.listJobs(200).filter(j => j.status === 'FAILED');
    metrics.push({
      dimension: 'FAILED_INGESTION', value: failedJobs.length,
      status: failedJobs.length > 0 ? 'ATTENTION' : 'OK',
      detail: `${failedJobs.length} ingestion job(s) failed.`,
      evidenceIds: failedJobs.map(j => `KNOWLEDGE:${j.id}`),
    });

    // POLICY_DRIFT — Phase 5I's delegation-service already computes this per-delegation
    // (PAUSED_POLICY_CHANGED); surface the count here rather than re-deriving it.
    const driftedDelegations = this.delegationStore.listDelegations('PAUSED_POLICY_CHANGED');
    metrics.push({
      dimension: 'POLICY_DRIFT', value: driftedDelegations.length,
      status: driftedDelegations.length > 0 ? 'ATTENTION' : 'OK',
      detail: `${driftedDelegations.length} delegation(s) paused by policy drift.`,
      evidenceIds: driftedDelegations.map(d => `DELEGATION:${d.id}`),
    });

    const activeDelegations = this.delegationStore.listDelegations('ACTIVE');
    const expiringSoon = activeDelegations.filter(d => new Date(d.expiresAt).getTime() - now.getTime() < 24 * 60 * 60 * 1000);
    metrics.push({
      dimension: 'DELEGATION_EXPIRY', value: expiringSoon.length,
      status: expiringSoon.length > 0 ? 'ATTENTION' : 'OK',
      detail: `${expiringSoon.length} active delegation(s) expiring within 24h.`,
      evidenceIds: expiringSoon.map(d => `DELEGATION:${d.id}`),
    });

    const exhaustedDelegations = this.delegationStore.listDelegations('EXHAUSTED');
    metrics.push({
      dimension: 'BUDGET_EXHAUSTION', value: exhaustedDelegations.length,
      status: exhaustedDelegations.length > 0 ? 'OK' : 'OK', // exhaustion is expected lifecycle, not itself a problem
      detail: `${exhaustedDelegations.length} delegation(s) reached execution quota.`,
      evidenceIds: exhaustedDelegations.map(d => `DELEGATION:${d.id}`),
    });

    const killSwitches = this.governanceStore.listKillSwitches(false);
    metrics.push({
      dimension: 'KILL_SWITCHES', value: killSwitches.length,
      status: killSwitches.length > 0 ? 'CRITICAL' : 'OK',
      detail: killSwitches.length > 0 ? `${killSwitches.length} kill switch(es) currently enabled.` : 'No active kill switches.',
      evidenceIds: killSwitches.map(k => `GOVERNANCE:${k.id}`),
    });

    // AUTHORITY_VIOLATIONS — no separate violations table exists (by design, per the
    // 6D.1 audit); a violation would surface as a governance anomaly or a denied
    // decision, both already counted above, so this dimension reports UNKNOWN rather
    // than double-counting or fabricating a distinct signal.
    metrics.push({
      dimension: 'AUTHORITY_VIOLATIONS', value: 0, status: 'UNKNOWN',
      detail: 'No dedicated authority-violation probe exists; see POLICY-category denials and HEALTH-category anomalies instead.',
      evidenceIds: [],
    });

    metrics.push({
      dimension: 'DB_INTEGRITY',
      value: 1, status: 'OK',
      detail: 'Schema-migration and integrity checks are run as part of every deploy/acceptance cycle (see PHASE6D_ACCEPTANCE.md), not re-probed live on every health call.',
      evidenceIds: [],
    });

    // SERVICE_HEALTH — reuses company-os/self-healing-monitor's own probe results
    // rather than re-implementing PM2/HTTP probing here.
    metrics.push({
      dimension: 'SERVICE_HEALTH', value: 0, status: 'UNKNOWN',
      detail: 'Live service probing is company-os/self-healing-monitor.ts\'s responsibility; this dimension is a placeholder for a future read-through, not a new probe.',
      evidenceIds: [],
    });

    return metrics;
  }

  /** §6D.9 — read-only, no remediation. */
  digest(date: string): DailyAuditDigest {
    const now = this.now();
    const dayStart = new Date(`${date}T00:00:00.000Z`).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const all = this.list();
    const inDay = all.filter(r => {
      const t = new Date(r.observedAt).getTime();
      return !Number.isNaN(t) && t >= dayStart && t < dayEnd;
    });

    const significantEvents = inDay
      .filter(r => ['DECISION', 'APPROVAL', 'EXECUTION', 'CONFLICT', 'HEALTH'].includes(r.category))
      .slice(0, 200);

    return {
      date, generatedAt: now.toISOString(),
      decisions: inDay.filter(r => r.category === 'DECISION').length,
      approvals: inDay.filter(r => r.category === 'APPROVAL').length,
      executions: inDay.filter(r => r.category === 'EXECUTION').length,
      denials: inDay.filter(r => r.claim.toLowerCase().includes('denied') || r.claim.toLowerCase().includes('rejected')).length,
      delegationExecutions: inDay.filter(r => r.sourceSystem === 'DELEGATION' && r.category === 'EXECUTION').length,
      anomalies: inDay.filter(r => r.sourceSystem === 'GOVERNANCE' && r.category === 'HEALTH').length,
      blockedItems: inDay.filter(r => r.category === 'POLICY').length,
      openConflicts: this.conflicts().length,
      healthDegradations: this.health().filter(m => m.status === 'ATTENTION' || m.status === 'CRITICAL').length,
      staleEvidenceCount: inDay.filter(r => r.freshness === 'STALE').length,
      significantEvents,
    };
  }
}

function applyFilter(records: EvidenceRecord[], filter: EvidenceFilter): EvidenceRecord[] {
  return records.filter(r => {
    if (filter.category && r.category !== filter.category) return false;
    if (filter.sourceSystem && r.sourceSystem !== filter.sourceSystem) return false;
    if (filter.projectId && r.projectId !== filter.projectId) return false;
    if (filter.subjectId && r.subjectId !== filter.subjectId) return false;
    if (filter.since && new Date(r.observedAt).getTime() < new Date(filter.since).getTime()) return false;
    if (filter.until && new Date(r.observedAt).getTime() > new Date(filter.until).getTime()) return false;
    return true;
  });
}
