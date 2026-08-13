/**
 * Phase 6F fake provider boundary — §8/§9/§10/§33.
 *
 * This file must NEVER import `googleapis`, `../../visibility/connectors/google/*`, or
 * `../service` (`ControlledActionService`). That is not a comment-only promise: the
 * security test at `__tests__/automation-simulation-security.test.ts` reads this
 * file's own source text and fails the build if any of those strings ever appear in
 * it — a hard, automated boundary, not just documentation (§33: "do not rely solely
 * on env"). Every function here is pure and synchronous: no network, no OAuth, no
 * filesystem, no timers. All "SIMULATED" ids are prefixed so they can never be
 * confused with real provider evidence.
 */
import { createHash } from 'crypto';
import type { ActionType } from '../actions/types';
import type { FakeProviderResult, FakeProviderScenario, SimulationCapabilityToken } from './types';

/** Minted only here, by convention. TypeScript's structural typing does not make this
 *  the only place capable of constructing a matching object literal — it is an
 *  internal guard, not a compiler-enforced impossibility. The actual zero-real-dispatch
 *  guarantee comes from `fake-providers.ts` itself being proven (import-graph scan) to
 *  import nothing real, plus the security/parity/evaluation tests proving zero real
 *  side effects across many runs, regardless of how a caller obtained a token (§33). */
export function mintSimulationCapabilityToken(): SimulationCapabilityToken {
  return { __simulationOnly: true };
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

/**
 * Deterministic fake response for a candidate CONTROLLED_ACTION step. `scenario` is
 * explicit simulation input (§9) — never inferred, never randomized, so the same
 * input always produces the same result (§34).
 */
export function runFakeProvider(
  _token: SimulationCapabilityToken,
  actionType: ActionType,
  payloadHash: string,
  scenario: FakeProviderScenario,
): FakeProviderResult {
  const idSeed = shortHash(`${actionType}:${payloadHash}:${scenario}`);
  const prefix = actionType === 'GMAIL_CREATE_DRAFT' ? 'sim-gmail-draft' : actionType.startsWith('CALENDAR') ? 'sim-calendar-event' : 'sim-local-action';

  switch (scenario) {
    case 'SUCCESS':
      return {
        scenario,
        simulatedObjectId: `${prefix}-${idSeed}`,
        responseSummary: { status: `${actionType} WOULD be created under this scenario.`, simulated: true },
        reconciliationRequired: false,
      };
    case 'VALIDATION_ERROR':
      return {
        scenario,
        simulatedObjectId: null,
        responseSummary: { status: 'WOULD be rejected by the provider as a validation error.', simulated: true },
        reconciliationRequired: false,
      };
    case 'TIMEOUT':
      return {
        scenario,
        simulatedObjectId: null,
        responseSummary: { status: 'WOULD time out waiting for the provider.', simulated: true },
        reconciliationRequired: true,
      };
    case 'RATE_LIMIT':
      return {
        scenario,
        simulatedObjectId: null,
        responseSummary: { status: 'WOULD be rejected by the provider due to rate limiting.', simulated: true },
        reconciliationRequired: false,
      };
    case 'UNAVAILABLE':
      return {
        scenario,
        simulatedObjectId: null,
        responseSummary: { status: 'WOULD fail because the provider is unavailable.', simulated: true },
        reconciliationRequired: false,
      };
    case 'AMBIGUOUS_RESULT':
      // §21 — the request may have "succeeded" but the response was lost. Never
      // collapsed into a simple FAILED; the caller must reconcile.
      return {
        scenario,
        simulatedObjectId: `${prefix}-${idSeed}`,
        responseSummary: { status: 'The provider request WOULD have an ambiguous outcome — it may have succeeded but the response was lost.', simulated: true },
        reconciliationRequired: true,
      };
    case 'PARTIAL_FAILURE':
      return {
        scenario,
        simulatedObjectId: null,
        responseSummary: { status: 'WOULD partially fail (e.g. some recipients/attendees rejected).', simulated: true },
        reconciliationRequired: true,
      };
    default:
      return {
        scenario,
        simulatedObjectId: null,
        responseSummary: { status: 'Unrecognized simulation scenario.', simulated: true },
        reconciliationRequired: true,
      };
  }
}

/** Canonical reversibility metadata (§22) — never invented. Mirrors the exact same
 *  facts `actions/service.ts`'s `rollbackPlanFor()`/`compensationFor()` already
 *  establish for the real system, so a simulated step's reversibility label always
 *  matches what the real compensation record would say if this step actually ran. */
export function reversibilityFor(actionType: ActionType | null): 'REVERSIBLE' | 'IRREVERSIBLE' | 'UNKNOWN' {
  if (actionType === 'GMAIL_CREATE_DRAFT' || actionType === 'CALENDAR_CREATE_EVENT') return 'REVERSIBLE';
  if (actionType === 'GMAIL_SEND_DRAFT') return 'IRREVERSIBLE';
  if (actionType === 'CALENDAR_EVENT_PROPOSAL') return 'REVERSIBLE';
  if (actionType === null) return 'UNKNOWN';
  return 'UNKNOWN';
}
