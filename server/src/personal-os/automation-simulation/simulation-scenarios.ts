/**
 * Phase 6F §40 — deterministic scenario fixtures for the 500+ case evaluation.
 * Every scenario here is a plain data structure (no randomness, no Date.now()) so the
 * same call to buildSimulationScenarios() always produces byte-identical input.
 */
import type { ActionType } from '../actions/types';
import type { DelegationOverride, FakeProviderScenario, SimulationInput } from './types';

export interface ScenarioDef {
  id: string;
  category: string;
  input: SimulationInput;
}

const ACTION_TYPES: ActionType[] = ['GMAIL_CREATE_DRAFT', 'CALENDAR_EVENT_PROPOSAL', 'CALENDAR_CREATE_EVENT'];
const PROVIDER_SCENARIOS: FakeProviderScenario[] = ['SUCCESS', 'VALIDATION_ERROR', 'TIMEOUT', 'RATE_LIMIT', 'UNAVAILABLE', 'AMBIGUOUS_RESULT', 'PARTIAL_FAILURE'];
const DELEGATION_SCENARIOS: DelegationOverride['scenario'][] = [
  'NONE', 'VALID', 'EXPIRED', 'REVOKED', 'QUOTA_EXHAUSTED', 'WRONG_PROJECT', 'WRONG_ACTION', 'WRONG_TARGET', 'RISK_ABOVE_CEILING', 'POLICY_CHANGED',
];
const PROJECT_IDS = ['proj-eval-a', 'proj-eval-b'];

function payloadFor(actionType: ActionType): Record<string, unknown> {
  if (actionType === 'GMAIL_CREATE_DRAFT') return { to: ['user@mi.local'], subject: 's', body: 'b', reason: 'r' };
  return { title: 'x', start: '2026-08-13T10:00:00Z', end: '2026-08-13T10:30:00Z', timezone: 'UTC', attendees: [] };
}

function single(id: string, category: string, projectId: string, over: Partial<SimulationInput['steps'][number]>): ScenarioDef {
  const actionType = (over.actionType ?? 'CALENDAR_EVENT_PROPOSAL') as ActionType;
  return {
    id, category,
    input: {
      kind: over.delegationOverride ? 'DELEGATED_CANDIDATE' : 'POLICY_WHAT_IF', projectId,
      steps: [{
        key: 'a', type: 'CONTROLLED_ACTION', description: id, actionType,
        actionPayload: payloadFor(actionType), ...over,
      }],
    },
  };
}

export function buildSimulationScenarios(): ScenarioDef[] {
  const scenarios: ScenarioDef[] = [];

  // --- category: action-type × provider-outcome × delegation-matrix × project ------
  // Covers: all existing action types, provider outcomes, delegation eligibility
  // matrix, policy outcomes (via the resulting policyDecision/approvalRequirement).
  for (const actionType of ACTION_TYPES) {
    for (const providerScenario of PROVIDER_SCENARIOS) {
      for (const delegationScenario of DELEGATION_SCENARIOS) {
        for (const projectId of PROJECT_IDS) {
          const id = `matrix-${actionType}-${providerScenario}-${delegationScenario}-${projectId}`;
          scenarios.push(single(id, 'ACTION_PROVIDER_DELEGATION_MATRIX', projectId, {
            actionType, providerScenario,
            delegationOverride: delegationScenario === 'NONE' ? undefined : { scenario: delegationScenario },
          }));
        }
      }
    }
  }

  // --- category: kill switches (GLOBAL / PROJECT / ACTION_TYPE) --------------------
  for (const actionType of ACTION_TYPES) {
    for (const scope of ['GLOBAL', 'PROJECT', 'ACTION_TYPE'] as const) {
      scenarios.push(single(`killswitch-${actionType}-${scope}`, 'KILL_SWITCH', 'proj-eval-a', {
        actionType,
        killSwitchOverrides: [{ scope, projectId: scope === 'PROJECT' ? 'proj-eval-a' : null, actionType: scope === 'ACTION_TYPE' ? actionType : null, reason: 'eval' }],
      }));
    }
  }

  // --- category: budgets (available / exhausted) + idempotency/quota via concurrency
  for (const actionType of ACTION_TYPES) {
    scenarios.push(single(`budget-available-${actionType}`, 'BUDGET', 'proj-eval-a', {
      actionType, budgetOverrides: [{ actionType, projectId: null, maxExecutions: 10, usedExecutions: 0, maxExternalTargets: 50, usedExternalTargets: 0 }],
    }));
    scenarios.push(single(`budget-exhausted-${actionType}`, 'BUDGET', 'proj-eval-a', {
      actionType, budgetOverrides: [{ actionType, projectId: null, maxExecutions: 1, usedExecutions: 1, maxExternalTargets: 50, usedExternalTargets: 0 }],
    }));
    for (const concurrentCandidateCount of [2, 3, 5]) {
      scenarios.push(single(`concurrency-${actionType}-${concurrentCandidateCount}`, 'CONCURRENCY', 'proj-eval-a', {
        actionType, concurrentCandidateCount,
        budgetOverrides: [{ actionType, projectId: null, maxExecutions: 1, usedExecutions: 0, maxExternalTargets: 50, usedExternalTargets: 0 }],
        delegationOverride: { scenario: 'VALID' },
      }));
    }
  }

  // --- category: forbidden capability what-if ---------------------------------------
  for (const actionType of [...ACTION_TYPES, 'GMAIL_SEND_DRAFT' as ActionType]) {
    scenarios.push(single(`forbidden-${actionType}`, 'FORBIDDEN_CAPABILITY', 'proj-eval-a', { actionType, forbiddenCandidate: true }));
  }

  // --- category: legacy quarantine what-if ------------------------------------------
  const quarantinedSurfaces = ['http:POST:/api/browser/write', 'http:POST:/api/n8n/trigger', 'http:POST:/api/legacy/gmail-send', 'http:POST:/api/legacy/shell', 'http:POST:/api/legacy/whatsapp-send'];
  for (const surfaceId of quarantinedSurfaces) {
    for (const actionType of ACTION_TYPES) {
      scenarios.push(single(`legacy-${actionType}-${surfaceId}`, 'LEGACY_QUARANTINE', 'proj-eval-a', { actionType, legacyQuarantinedSurfaceId: surfaceId }));
    }
  }

  // --- category: malformed / invalid input (DAG-level) ------------------------------
  scenarios.push({
    id: 'invalid-unknown-dependency', category: 'MALFORMED_INPUT',
    input: { kind: 'PROPOSED_PLAN', projectId: 'proj-eval-a', steps: [{ key: 'a', type: 'READ_ONLY', description: 'x', dependsOnKeys: ['ghost'] }] },
  });
  scenarios.push({
    id: 'invalid-cycle-2', category: 'MALFORMED_INPUT',
    input: {
      kind: 'PROPOSED_PLAN', projectId: 'proj-eval-a',
      steps: [{ key: 'a', type: 'READ_ONLY', description: 'x', dependsOnKeys: ['b'] }, { key: 'b', type: 'READ_ONLY', description: 'y', dependsOnKeys: ['a'] }],
    },
  });
  for (let i = 0; i < 8; i++) {
    scenarios.push({
      id: `invalid-cycle-chain-${i}`, category: 'MALFORMED_INPUT',
      input: {
        kind: 'PROPOSED_PLAN', projectId: 'proj-eval-a',
        steps: [
          { key: 'a', type: 'READ_ONLY', description: 'x', dependsOnKeys: ['c'] },
          { key: 'b', type: 'READ_ONLY', description: 'y', dependsOnKeys: ['a'] },
          { key: 'c', type: 'READ_ONLY', description: 'z', dependsOnKeys: [`missing-${i}`, 'b'] },
        ],
      },
    });
  }

  // --- category: multi-step plans (DAG progression, failure propagation, partial) --
  for (let i = 0; i < 30; i++) {
    const actionType = ACTION_TYPES[i % ACTION_TYPES.length];
    const scenario = PROVIDER_SCENARIOS[i % PROVIDER_SCENARIOS.length];
    scenarios.push({
      id: `plan-${i}`, category: 'MULTI_STEP_PLAN',
      input: {
        kind: 'PROPOSED_PLAN', projectId: PROJECT_IDS[i % 2],
        steps: [
          { key: 'read', type: 'READ_ONLY', description: 'gather context' },
          { key: 'compute', type: 'LOCAL_COMPUTE', description: 'local compute', dependsOnKeys: ['read'] },
          { key: 'act', type: 'CONTROLLED_ACTION', description: 'act after compute', dependsOnKeys: ['compute'], actionType, actionPayload: payloadFor(actionType), providerScenario: scenario, delegationOverride: { scenario: 'VALID' } },
        ],
      },
    });
  }

  // --- category: read-only / local-compute steps (no external side effect) --------
  for (let i = 0; i < 10; i++) {
    scenarios.push({
      id: `local-${i}`, category: 'LOCAL_STEP',
      input: { kind: 'SINGLE_PROPOSAL', projectId: PROJECT_IDS[i % 2], steps: [{ key: 'a', type: i % 2 === 0 ? 'READ_ONLY' : 'LOCAL_COMPUTE', description: `local step ${i}` }] },
    });
  }

  return scenarios;
}
