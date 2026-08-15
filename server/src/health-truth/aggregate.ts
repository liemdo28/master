/**
 * Phase 7B — deterministic aggregation. No free-text heuristics: the overall
 * verdict is a pure function of (state, criticality) pairs.
 */
import path from 'path';
import type { DependencyHealth, OverallState, ReasonCode, SystemHealth } from './types';
import {
  probeCore, probeDatabase, probeAuthority, probeProvenance, probeKnowledge,
  probePythonAi, probeLocalModel, probeGoogleConnectors, probeNodeAgent,
  probeAccounting, probeQbAgent, probeIntentionallyDisabled,
  probeVoiceInput, probeVoiceOutput,
} from './probes';

/**
 * Deterministic overall computation:
 *  1. AUTHORITY unhealthy (unknown/unresolved mutation) → BLOCKED. This is
 *     checked first and separately — an invalid authority boundary is a
 *     stronger claim than "a dependency is down"; no other state may mask it.
 *  2. Any other REQUIRED_FOR_CORE dependency not HEALTHY → UNAVAILABLE.
 *  3. Any OPTIONAL_DEGRADED/FEATURE_SCOPED dependency not HEALTHY (and not
 *     INTENTIONALLY_DISABLED) → DEGRADED.
 *  4. Otherwise → HEALTHY.
 * INTENTIONALLY_DISABLED dependencies never contribute to any of the above —
 * being off on purpose is not unhealthiness.
 */
export function computeOverall(dependencies: DependencyHealth[]): { overall: OverallState; overallReason: ReasonCode } {
  const authority = dependencies.find(d => d.id === 'AUTHORITY');
  if (authority && authority.state !== 'HEALTHY' && authority.criticality !== 'INTENTIONALLY_DISABLED') {
    return { overall: 'BLOCKED', overallReason: authority.reasonCode };
  }

  const requiredDown = dependencies.find(d =>
    d.criticality === 'REQUIRED_FOR_CORE' && d.id !== 'AUTHORITY' && d.state !== 'HEALTHY' && d.state !== 'INTENTIONALLY_DISABLED');
  if (requiredDown) {
    return { overall: 'UNAVAILABLE', overallReason: requiredDown.reasonCode };
  }

  const degraded = dependencies.find(d =>
    d.criticality !== 'INTENTIONALLY_DISABLED' && d.state !== 'HEALTHY' && d.state !== 'INTENTIONALLY_DISABLED');
  if (degraded) {
    return { overall: 'DEGRADED', overallReason: degraded.reasonCode };
  }

  return { overall: 'HEALTHY', overallReason: 'OK' };
}

export interface SystemHealthOptions {
  runtimeRoot?: string;
}

export async function getSystemHealth(options: SystemHealthOptions = {}): Promise<SystemHealth> {
  const runtimeRoot = options.runtimeRoot ?? path.resolve(__dirname, '..', '..', '..');

  const [pythonAi, localModel, nodeAgent, voiceInput] = await Promise.all([
    probePythonAi(),
    probeLocalModel(),
    probeNodeAgent(),
    probeVoiceInput(),
  ]);

  const authority = probeAuthority();
  const provenance = probeProvenance();
  // Provenance mismatch is folded into AUTHORITY's own state per §18 ("Any
  // mismatch: PROVENANCE = BLOCKED/UNHEALTHY... do not silently degrade to
  // warning") — it must carry the same weight as an authority-manifest
  // failure, not a separate, softer dimension that could be missed.
  const authorityWithProvenance: DependencyHealth = provenance.ok || authority.state !== 'HEALTHY'
    ? authority
    : {
        ...authority,
        state: 'UNAVAILABLE',
        reasonCode: 'PROVENANCE_MISMATCH',
        detail: `${authority.detail} | ${provenance.detail}`,
        capabilityImpact: ['Governed action execution must not be trusted until deployed-source provenance is realigned.'],
      };

  const dependencies: DependencyHealth[] = [
    probeCore(),
    probeDatabase(),
    authorityWithProvenance,
    probeKnowledge(),
    pythonAi,
    localModel,
    probeGoogleConnectors(),
    nodeAgent,
    probeAccounting(),
    probeQbAgent(),
    probeIntentionallyDisabled('WHATSAPP', runtimeRoot),
    probeIntentionallyDisabled('N8N', runtimeRoot),
    probeIntentionallyDisabled('CEO_OBSERVER', runtimeRoot),
    voiceInput,
    probeVoiceOutput(),
  ];

  const { overall, overallReason } = computeOverall(dependencies);
  const now = new Date().toISOString();

  return {
    overall,
    overallReason,
    generatedAt: now,
    dependencies,
    legacy: {
      server: 'ok',
      python_ai_service: pythonAi.state === 'HEALTHY' ? 'ok' : 'down',
      ollama: localModel.state === 'HEALTHY' ? 'ok' : 'down',
      timestamp: now,
    },
  };
}
