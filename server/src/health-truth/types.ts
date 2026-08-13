/**
 * Phase 7B — canonical health/dependency truth model types.
 *
 * A dependency being unavailable must not collapse the whole system into a
 * vague "down". A dependency that is intentionally disabled must not be
 * reported as unhealthy merely because no probe succeeded. These states are
 * deliberately NOT a boolean.
 */

export type DependencyState =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNAVAILABLE'
  | 'DISCONNECTED'
  | 'BLOCKED'
  | 'INTENTIONALLY_DISABLED'
  | 'UNKNOWN';

/** How much a dependency's unhealthiness should affect the overall verdict. */
export type Criticality =
  | 'REQUIRED_FOR_CORE'
  | 'OPTIONAL_DEGRADED'
  | 'FEATURE_SCOPED'
  | 'INTENTIONALLY_DISABLED';

/** Structured reason codes — never rely on free text for a decision. */
export type ReasonCode =
  | 'OK'
  | 'PROCESS_NOT_RUNNING'
  | 'PORT_UNREACHABLE'
  | 'CONFIG_MISSING'
  | 'OAUTH_DISCONNECTED'
  | 'MODEL_UNAVAILABLE'
  | 'INTENTIONALLY_DISABLED'
  | 'RUNTIME_NOT_DEPLOYED'
  | 'AUTHORITY_UNKNOWN_MUTATION'
  | 'AUTHORITY_UNRESOLVED_LEGACY_MUTATION'
  | 'PROVENANCE_MISMATCH'
  | 'DB_UNAVAILABLE'
  | 'DB_INTEGRITY_FAILED'
  | 'INDEX_EMPTY'
  | 'INDEX_UNAVAILABLE'
  | 'REGISTRATION_BLOCKED'
  | 'UNKNOWN';

export type DependencyId =
  | 'CORE'
  | 'DATABASE'
  | 'AUTHORITY'
  | 'KNOWLEDGE'
  | 'PYTHON_AI'
  | 'LOCAL_MODEL'
  | 'GOOGLE_CONNECTORS'
  | 'NODE_AGENT'
  | 'ACCOUNTING'
  | 'QB_AGENT'
  | 'WHATSAPP'
  | 'N8N'
  | 'CEO_OBSERVER';

export interface DependencyHealth {
  id: DependencyId;
  state: DependencyState;
  criticality: Criticality;
  reasonCode: ReasonCode;
  /** Human-readable detail — never a source of truth, only for display. */
  detail: string;
  /** What Jarvis can/cannot still do because of this dependency's state. */
  capabilityImpact: string[];
  lastCheckedAt: string | null;
  lastHealthyAt: string | null;
  lastFailureAt: string | null;
}

export type OverallState = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'BLOCKED';

export interface SystemHealth {
  overall: OverallState;
  overallReason: ReasonCode;
  generatedAt: string;
  dependencies: DependencyHealth[];
  /** Backward-compatible fields — see routes/health.ts's original shape. */
  legacy: {
    server: 'ok';
    python_ai_service: 'ok' | 'down';
    ollama: 'ok' | 'down';
    timestamp: string;
  };
}

/**
 * Deterministic state → does this dependency block the overall verdict?
 * A dependency counts against "overall" only if its criticality says so.
 */
export function stateBlocksOverall(state: DependencyState, criticality: Criticality): boolean {
  if (state === 'HEALTHY' || state === 'INTENTIONALLY_DISABLED') return false;
  if (criticality === 'INTENTIONALLY_DISABLED') return false;
  if (criticality === 'REQUIRED_FOR_CORE') return true;
  // OPTIONAL_DEGRADED / FEATURE_SCOPED dependencies never force UNAVAILABLE,
  // only DEGRADED — see aggregate.ts for the exact overall computation.
  return false;
}
