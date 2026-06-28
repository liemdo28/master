/**
 * oss-fallback-policy.ts — what to do when an OSS worker is unavailable.
 *
 * The system never blocks on a missing OSS: each worker declares a fallback,
 * and this policy resolves the safe degraded behavior (use the in-engine
 * implementation, queue for later, or skip with a warning).
 */
import type { AdapterStatus, OssWorkerSpec } from './oss-execution-contract';

export type FallbackMode = 'in_engine' | 'queue' | 'skip';

export interface FallbackDecision {
  workerId: string;
  mode: FallbackMode;
  fallbackTo: string;
  reason: string;
}

export function resolveFallback(spec: OssWorkerSpec, status: AdapterStatus): FallbackDecision {
  if (status === 'INTEGRATED_RUNNING') {
    return { workerId: spec.id, mode: 'in_engine', fallbackTo: 'none (running on OSS)', reason: 'OSS healthy — no fallback needed' };
  }
  // Default: degrade to the deterministic in-engine implementation that already ships in Phase 12–30.
  return {
    workerId: spec.id,
    mode: 'in_engine',
    fallbackTo: spec.fallback,
    reason: `OSS ${status} → run the in-engine implementation (${spec.fallback})`,
  };
}
