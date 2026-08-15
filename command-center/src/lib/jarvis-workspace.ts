/**
 * Phase 7E — Operator Workspace pure logic. No side effects, no fetches —
 * every function here is a deterministic mapping from already-fetched data
 * to a UI-facing classification, kept separate from components so it can be
 * unit-tested directly.
 */
import type { JarvisResponse, JarvisTruthStatement, ActionPlan, ActionPlanEvidence, ActionProposal, SimulationRun } from './types';

/**
 * The strict operator-visible status vocabulary (directive §6). These six
 * meanings must never be conflated:
 *  - OBSERVED: directly supported by canonical runtime/evidence state.
 *  - INFERRED: derived interpretation, not a direct fact.
 *  - PROPOSED: a plan/action exists only as a proposal.
 *  - APPROVAL_REQUIRED: canonical governance requires a decision.
 *  - BLOCKED: canonical policy/governance/runtime prevented progression.
 *  - EXECUTED: only when canonical execution evidence proves it happened.
 *
 * CRITICAL INVARIANT: nothing in this module may ever return EXECUTED from
 * a Jarvis Gateway response alone — `JarvisResponse['status']` structurally
 * has no EXECUTED value (see JarvisResponseStatus in types.ts), so
 * `responseTruthStatus` below can never produce it. EXECUTED can only come
 * from `planTruthStatus`/`proposalTruthStatus`, and only when real
 * execution-evidence fields (ActionPlanEvidence.eventType === 'STEP_EXECUTED',
 * or ActionProposal.executedAt with a COMPLETED execution) are present.
 */
export type TruthStatus = 'OBSERVED' | 'INFERRED' | 'PROPOSED' | 'APPROVAL_REQUIRED' | 'BLOCKED' | 'EXECUTED';

export function factTruthStatus(kind: JarvisTruthStatement['kind']): TruthStatus {
  return kind === 'FACT' ? 'OBSERVED' : 'INFERRED';
}

/** Best-effort classification of a whole Jarvis response. Returns null for
 *  statuses that already have their own precise meaning via StatusBadge
 *  (NEEDS_CLARIFICATION, NO_SUPPORTED_ANSWER, CONFLICT, DEGRADED, FAILED) —
 *  forcing those into one of the six would blur a distinction that already
 *  exists, not sharpen it. */
export function responseTruthStatus(r: Pick<JarvisResponse, 'status' | 'facts' | 'proposal'>): TruthStatus | null {
  if (r.status === 'WAITING_APPROVAL') return 'APPROVAL_REQUIRED';
  if (r.status === 'BLOCKED') return 'BLOCKED';
  if (r.status === 'SIMULATED' || r.status === 'PROPOSAL_READY' || r.proposal) return 'PROPOSED';
  if (r.status === 'ANSWERED') return r.facts.length > 0 ? 'OBSERVED' : 'INFERRED';
  return null;
}

/** Real execution evidence for a plan — never inferred from `status` text
 *  alone (directive §6's critical invariant). `STEP_EXECUTED` is the actual
 *  event type real executions record (see orchestration/types.ts's
 *  PlanEvidenceEventType); a plan whose `status` merely says COMPLETED with
 *  no such event is reported PROPOSED/BLOCKED, never EXECUTED. */
export function planTruthStatus(plan: Pick<ActionPlan, 'status' | 'blockedReason'>, evidence: Pick<ActionPlanEvidence, 'eventType'>[]): TruthStatus {
  const hasExecutionEvidence = evidence.some(e => e.eventType === 'STEP_EXECUTED');
  if (hasExecutionEvidence) return 'EXECUTED';
  // ActionPlanStatus has no BLOCKED value of its own — blocked-ness is
  // represented by a non-null blockedReason (and treated the same way as a
  // genuine FAILED status: progression was prevented, not merely pending).
  if (plan.blockedReason || plan.status === 'FAILED' || plan.status === 'CANCELLED') return 'BLOCKED';
  if (plan.status === 'WAITING_APPROVAL') return 'APPROVAL_REQUIRED';
  return 'PROPOSED';
}

/** Real execution evidence for a Controlled Action proposal — requires both
 *  a non-null `executedAt` timestamp AND at least one COMPLETED execution
 *  record, never `executedAt` alone (a proposal can carry a stale/failed
 *  execution attempt). */
export function proposalTruthStatus(
  proposal: Pick<ActionProposal, 'status' | 'executedAt'>,
  executions: Array<{ status: string }>,
): TruthStatus {
  const hasCompletedExecution = proposal.executedAt !== null && executions.some(e => e.status === 'COMPLETED');
  if (hasCompletedExecution) return 'EXECUTED';
  if (proposal.status === 'REJECTED' || proposal.status === 'EXPIRED' || proposal.status === 'FAILED' || proposal.status === 'CANCELLED') return 'BLOCKED';
  if (proposal.status === 'WAITING_APPROVAL') return 'APPROVAL_REQUIRED';
  return 'PROPOSED';
}

/** A simulation is, by definition (Phase 6F boundary), never anything but a
 *  what-if — WOULD_EXECUTE is a simulated outcome label, not a real
 *  execution. `simulationTruthStatus` always returns PROPOSED for that
 *  reason; the caller is responsible for rendering the mandatory
 *  "SIMULATION — NO LIVE EXECUTION" banner (directive §10) alongside it. */
export function simulationTruthStatus(_run: Pick<SimulationRun, 'overallOutcome'>): TruthStatus {
  return 'PROPOSED';
}

export interface ParsedEvidenceRef {
  raw: string;
  /** Jarvis Gateway's own short prefixes (`task:`, `goal:`, `plan:`,
   *  `project:`) point at a canonical Command Center detail page directly —
   *  these are not real EvidenceRecord ids. Anything else is treated as a
   *  real `EvidenceRecord.id` (`${sourceSystem}:${sourceId}`, e.g.
   *  `CONTROLLED_ACTIONS:action-...`) fetchable via `GET /evidence/:id`. */
  kind: 'task' | 'goal' | 'plan' | 'project' | 'evidence-record';
  id: string;
  /** Only set for kind !== 'evidence-record'. */
  linkTo?: string;
}

const CANONICAL_PAGE_PREFIXES: Record<string, ParsedEvidenceRef['kind']> = {
  task: 'task',
  goal: 'goal',
  plan: 'plan',
  project: 'project',
};

export function parseEvidenceRef(raw: string): ParsedEvidenceRef {
  const sep = raw.indexOf(':');
  if (sep === -1) return { raw, kind: 'evidence-record', id: raw };
  const prefix = raw.slice(0, sep);
  const id = raw.slice(sep + 1);
  const pageKind = CANONICAL_PAGE_PREFIXES[prefix];
  if (pageKind) {
    const linkTo = pageKind === 'task' ? `/tasks/${id}`
      : pageKind === 'goal' ? `/goals/${id}`
      : pageKind === 'plan' ? `/plans/${id}`
      : `/projects/${id}`;
    return { raw, kind: pageKind, id, linkTo };
  }
  return { raw, kind: 'evidence-record', id: raw };
}
