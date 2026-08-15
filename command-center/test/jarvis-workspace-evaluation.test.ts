import { describe, it, expect } from 'vitest';
import {
  factTruthStatus,
  responseTruthStatus,
  planTruthStatus,
  proposalTruthStatus,
  simulationTruthStatus,
  deriveContextState,
  parseEvidenceRef,
  sessionKind,
} from '@/lib/jarvis-workspace';
import type {
  JarvisTruthStatement, JarvisResponseStatus, ActionPlanStatus, ActionProposalStatus,
  SimulationOutcome,
} from '@/lib/types';

/**
 * Phase 7E — deterministic evaluation (directive §25). Exhaustive
 * combinatorial sweeps over every pure classification function in
 * lib/jarvis-workspace.ts, matching the same "real coverage via genuine
 * combinatorics, not padded fixtures" approach as Phase 7B's 802-scenario
 * and Phase 7C's 530-fixture evaluations. Every `it` below is one counted
 * scenario; the file's own scenario count is asserted at the end so the
 * 700+ target is verified, not claimed.
 *
 * Hard target, checked throughout: a false EXECUTED claim (§6's critical
 * invariant) is impossible by construction for responseTruthStatus (the
 * type JarvisResponseStatus has no EXECUTED value at all) and requires
 * explicit real evidence for planTruthStatus/proposalTruthStatus.
 */

let scenarioCount = 0;
function scenario<T>(fn: () => T): T { scenarioCount++; return fn(); }

const ALL_RESPONSE_STATUSES: JarvisResponseStatus[] = [
  'ANSWERED', 'NEEDS_CLARIFICATION', 'NO_SUPPORTED_ANSWER', 'CONFLICT', 'DEGRADED',
  'SIMULATED', 'PROPOSAL_READY', 'WAITING_APPROVAL', 'BLOCKED', 'FAILED',
];
const ALL_PLAN_STATUSES: ActionPlanStatus[] = [
  'DRAFT', 'VALIDATED', 'WAITING_APPROVAL', 'READY', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED',
];
const ALL_PROPOSAL_STATUSES: ActionProposalStatus[] = [
  'DRAFT', 'WAITING_APPROVAL', 'APPROVED', 'EXECUTING', 'COMPLETED', 'FAILED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'RECOVERY_REQUIRED',
];
const ALL_SIMULATION_OUTCOMES: SimulationOutcome[] = [
  'SIMULATED', 'WOULD_EXECUTE', 'WOULD_REQUIRE_APPROVAL', 'WOULD_BLOCK', 'WOULD_FAIL', 'UNCERTAIN', 'INVALID',
];
const ALL_FACT_KINDS: JarvisTruthStatement['kind'][] = ['FACT', 'INFERENCE', 'ASSUMPTION'];

describe('Phase 7E evaluation — factTruthStatus (never conflates OBSERVED/INFERRED)', () => {
  it.each(ALL_FACT_KINDS)('kind=%s', kind => {
    scenario(() => {
      const status = factTruthStatus(kind);
      if (kind === 'FACT') expect(status).toBe('OBSERVED');
      else expect(status).toBe('INFERRED');
      // Structural invariant: never EXECUTED, never anything outside the 6-value vocabulary.
      expect(['OBSERVED', 'INFERRED']).toContain(status);
    });
  });
});

describe('Phase 7E evaluation — responseTruthStatus (EXECUTED structurally unreachable)', () => {
  const factsBuckets = [[], [{ kind: 'FACT' as const, statement: 'x' }]];
  const proposals = [undefined, { proposalId: 'p1', actionType: 'CALENDAR_EVENT_PROPOSAL', riskClass: 'R1' }];

  for (const status of ALL_RESPONSE_STATUSES) {
    for (const facts of factsBuckets) {
      for (const proposal of proposals) {
        it(`status=${status} facts=${facts.length} proposal=${Boolean(proposal)}`, () => {
          scenario(() => {
            const result = responseTruthStatus({ status, facts, proposal });
            // The hard invariant: this function can NEVER produce EXECUTED —
            // JarvisResponseStatus has no EXECUTED value, so there is no
            // input combination that could smuggle one through.
            expect(result).not.toBe('EXECUTED');

            if (status === 'WAITING_APPROVAL') expect(result).toBe('APPROVAL_REQUIRED');
            else if (status === 'BLOCKED') expect(result).toBe('BLOCKED');
            else if (status === 'SIMULATED' || status === 'PROPOSAL_READY' || proposal) expect(result).toBe('PROPOSED');
            else if (status === 'ANSWERED') expect(result).toBe(facts.length > 0 ? 'OBSERVED' : 'INFERRED');
            else expect(result).toBeNull();
          });
        });
      }
    }
  }
});

describe('Phase 7E evaluation — planTruthStatus (EXECUTED only from real STEP_EXECUTED evidence)', () => {
  const blockedReasons = [null, 'policy denied'];
  const evidenceConfigs: { label: string; evidence: { eventType: string }[] }[] = [
    { label: 'none', evidence: [] },
    { label: 'STEP_EXECUTED', evidence: [{ eventType: 'STEP_EXECUTED' }] },
    { label: 'other-event-only', evidence: [{ eventType: 'POLICY_DENIED' }, { eventType: 'APPROVAL_BOUND' }] },
  ];

  for (const status of ALL_PLAN_STATUSES) {
    for (const blockedReason of blockedReasons) {
      for (const cfg of evidenceConfigs) {
        it(`status=${status} blockedReason=${blockedReason ?? 'null'} evidence=${cfg.label}`, () => {
          scenario(() => {
            const result = planTruthStatus({ status, blockedReason }, cfg.evidence);
            if (cfg.label === 'STEP_EXECUTED') {
              // Real execution evidence present — EXECUTED is correct,
              // regardless of what `status` or `blockedReason` claim.
              expect(result).toBe('EXECUTED');
            } else {
              // No real execution evidence — EXECUTED must be impossible,
              // even when status is COMPLETED (the critical invariant:
              // "plan COMPLETED alone is insufficient").
              expect(result).not.toBe('EXECUTED');
              if (blockedReason || status === 'FAILED' || status === 'CANCELLED') expect(result).toBe('BLOCKED');
              else if (status === 'WAITING_APPROVAL') expect(result).toBe('APPROVAL_REQUIRED');
              else expect(result).toBe('PROPOSED');
            }
          });
        });
      }
    }
  }

  it('a COMPLETED plan with zero evidence is never EXECUTED (explicit regression lock)', () => {
    scenario(() => {
      expect(planTruthStatus({ status: 'COMPLETED', blockedReason: null }, [])).not.toBe('EXECUTED');
      expect(planTruthStatus({ status: 'COMPLETED', blockedReason: null }, [])).toBe('PROPOSED');
    });
  });
});

describe('Phase 7E evaluation — proposalTruthStatus (EXECUTED only from executedAt + a real COMPLETED execution)', () => {
  const executedAts = [null, '2026-08-15T00:00:00Z'];
  const executionConfigs: { label: string; executions: { status: string }[] }[] = [
    { label: 'none', executions: [] },
    { label: 'COMPLETED', executions: [{ status: 'COMPLETED' }] },
    { label: 'FAILED-only', executions: [{ status: 'FAILED' }] },
  ];

  for (const status of ALL_PROPOSAL_STATUSES) {
    for (const executedAt of executedAts) {
      for (const cfg of executionConfigs) {
        it(`status=${status} executedAt=${executedAt ?? 'null'} executions=${cfg.label}`, () => {
          scenario(() => {
            const result = proposalTruthStatus({ status, executedAt }, cfg.executions);
            const hasRealExecutionEvidence = executedAt !== null && cfg.label === 'COMPLETED';
            if (hasRealExecutionEvidence) {
              expect(result).toBe('EXECUTED');
            } else {
              // Neither executedAt alone, nor a COMPLETED execution alone
              // without executedAt, nor status COMPLETED alone, can ever
              // produce EXECUTED — both real signals are required together.
              expect(result).not.toBe('EXECUTED');
              if (status === 'REJECTED' || status === 'EXPIRED' || status === 'FAILED' || status === 'CANCELLED') expect(result).toBe('BLOCKED');
              else if (status === 'WAITING_APPROVAL') expect(result).toBe('APPROVAL_REQUIRED');
              else expect(result).toBe('PROPOSED');
            }
          });
        });
      }
    }
  }

  it('status COMPLETED with executedAt but no COMPLETED execution record is never EXECUTED (explicit regression lock)', () => {
    scenario(() => {
      const result = proposalTruthStatus({ status: 'COMPLETED', executedAt: '2026-08-15T00:00:00Z' }, [{ status: 'FAILED' }]);
      expect(result).not.toBe('EXECUTED');
    });
  });
});

describe('Phase 7E evaluation — simulationTruthStatus (a simulation is never EXECUTED, by construction)', () => {
  it.each(ALL_SIMULATION_OUTCOMES)('overallOutcome=%s', outcome => {
    scenario(() => {
      const result = simulationTruthStatus({ overallOutcome: outcome });
      expect(result).toBe('PROPOSED');
      expect(result).not.toBe('EXECUTED');
      // Even the most execution-sounding outcome label (WOULD_EXECUTE) must
      // never be upgraded to EXECUTED — it is still only ever a simulated
      // what-if result.
      if (outcome === 'WOULD_EXECUTE') expect(result).toBe('PROPOSED');
    });
  });
});

describe('Phase 7E evaluation — deriveContextState (explicit always outranks session-derived)', () => {
  const sessionIds = [null, 'device:dev-1', 'explicit:sess-1'];
  const requestedProjectIds = [null, 'proj-a', 'proj-b'];
  const responseProjectIds = [null, 'proj-a', 'proj-b'];
  const statuses: JarvisResponseStatus[] = ALL_RESPONSE_STATUSES;

  for (const sid of sessionIds) {
    for (const reqPid of requestedProjectIds) {
      for (const respPid of responseProjectIds) {
        for (const status of statuses) {
          it(`sessionId=${sid ?? 'null'} requested=${reqPid ?? 'null'} responseProjectId=${respPid ?? 'null'} status=${status}`, () => {
            scenario(() => {
              const state = deriveContextState({ sessionId: sid, projectId: respPid, status }, reqPid);
              expect(state.sessionKind).toBe(sessionKind(sid));
              expect(state.explicitThisTurn).toBe(Boolean(reqPid));
              expect(state.clarificationRequired).toBe(status === 'NEEDS_CLARIFICATION');
              // contextReused can only ever be true when NOTHING was
              // explicit this turn — explicit context must always outrank it.
              if (state.contextReused) expect(state.explicitThisTurn).toBe(false);
              if (reqPid) expect(state.contextReused).toBe(false);
            });
          });
        }
      }
    }
  }
});

describe('Phase 7E evaluation — sessionKind', () => {
  const cases: [string | null, 'device' | 'explicit' | 'none'][] = [
    [null, 'none'],
    ['device:abc', 'device'],
    ['device:', 'device'],
    ['explicit:xyz', 'explicit'],
    ['explicit:device:abc', 'explicit'], // forged-looking but must resolve to explicit — see session-resolver.ts
    ['', 'none'],
  ];
  it.each(cases)('sessionId=%s', (sid, expected) => {
    scenario(() => expect(sessionKind(sid)).toBe(expected));
  });
});

describe('Phase 7E evaluation — parseEvidenceRef', () => {
  const canonicalPagePrefixes = ['task', 'goal', 'plan', 'project'];
  const evidenceRecordPrefixes = ['CONTROLLED_ACTIONS', 'GOVERNANCE', 'ORCHESTRATION', 'DELEGATION', 'KNOWLEDGE', 'TASK_RUNTIME'];
  const idVariants = [
    'abc123', 'uuid-1234-5678-90ab-cdef', 'a', '0', 'with-many-dashes-in-it',
    'UPPERCASE-ID', 'id_with_underscore', '12345', 'x'.repeat(40), 'id.with.dots',
    '00000000-0000-0000-0000-000000000000', 'task-2026-08-15-001', 'ẞunicode-id',
    'id with spaces', 'id/with/slashes', 'id?with=query', 'a'.repeat(200),
    '-leading-dash', 'trailing-dash-', '--double--dash--', 'MiXeD-CaSe-Id-123',
  ];

  for (const prefix of canonicalPagePrefixes) {
    for (const id of idVariants) {
      it(`canonical-page ref: ${prefix}:${id}`, () => {
        scenario(() => {
          const parsed = parseEvidenceRef(`${prefix}:${id}`);
          expect(parsed.kind).toBe(prefix);
          expect(parsed.id).toBe(id);
          expect(parsed.linkTo).toBe(
            prefix === 'task' ? `/tasks/${id}`
              : prefix === 'goal' ? `/goals/${id}`
              : prefix === 'plan' ? `/plans/${id}`
              : `/projects/${id}`,
          );
        });
      });
    }
  }

  for (const prefix of evidenceRecordPrefixes) {
    for (const id of idVariants) {
      it(`evidence-record ref: ${prefix}:${id}`, () => {
        scenario(() => {
          const raw = `${prefix}:${id}`;
          const parsed = parseEvidenceRef(raw);
          expect(parsed.kind).toBe('evidence-record');
          expect(parsed.id).toBe(raw);
          expect(parsed.linkTo).toBeUndefined();
        });
      });
    }
  }

  const edgeCases = ['no-colon-at-all', '', ':leading-colon', 'trailing-colon:', 'multiple:colons:here'];
  it.each(edgeCases)('edge case: %s', raw => {
    scenario(() => {
      const parsed = parseEvidenceRef(raw);
      // Must never throw, must always classify as SOME kind.
      expect(['task', 'goal', 'plan', 'project', 'evidence-record']).toContain(parsed.kind);
    });
  });
});

describe('Phase 7E evaluation — joint consistency of responseTruthStatus + deriveContextState', () => {
  // Exercises both functions against the SAME synthetic response the way the
  // real workspace does (ResponseDetail calls responseTruthStatus; the
  // Context tab calls deriveContextState) — proving neither can silently
  // contradict the other for any reachable combination of status/facts/
  // session/explicit-project.
  const factsBuckets = [[], [{ kind: 'FACT' as const, statement: 'x' }]];
  const sessionIds = [null, 'device:dev-1', 'explicit:sess-1'];
  const requestedProjectIds = [null, 'proj-a'];

  for (const status of ALL_RESPONSE_STATUSES) {
    for (const facts of factsBuckets) {
      for (const sid of sessionIds) {
        for (const reqPid of requestedProjectIds) {
          it(`status=${status} facts=${facts.length} sessionId=${sid ?? 'null'} requested=${reqPid ?? 'null'}`, () => {
            scenario(() => {
              const response = { sessionId: sid, projectId: reqPid ?? (status === 'ANSWERED' ? 'proj-a' : null), status, facts, proposal: undefined };
              const truth = responseTruthStatus(response);
              const context = deriveContextState(response, reqPid);

              // A clarification-required response must never simultaneously
              // claim a truth status that implies a resolved answer.
              if (context.clarificationRequired) {
                expect(truth).not.toBe('OBSERVED');
                expect(truth).not.toBe('EXECUTED');
              }
              // Never EXECUTED, under any joint combination — restated here
              // as the cross-function regression lock.
              expect(truth).not.toBe('EXECUTED');
            });
          });
        }
      }
    }
  }
});

describe('Phase 7E evaluation — scenario count meets the 700+ target', () => {
  it('total scenario count is at least 700', () => {
    // Counted live via the shared scenario() wrapper every `it` above calls
    // through — not a hardcoded/predicted number. Vitest runs describe
    // blocks in file order within a single file, so by the time this test
    // runs, every prior scenario has already incremented the counter.
    expect(scenarioCount).toBeGreaterThanOrEqual(700);
  });
});
