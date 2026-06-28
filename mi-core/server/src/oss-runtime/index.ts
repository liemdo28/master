/**
 * oss-runtime/index.ts — public surface for the OSS runtime integration layer.
 *
 * Closes PR #25 blocker #1 ("OSS governed/mapped but not runtime-integrated") by
 * giving every phase a real adapter with a license gate, a live health probe,
 * and a declared fallback. Honest by design: workers report
 * CONFIGURED_NOT_INSTALLED until the OSS is actually present — we never fake
 * production.
 */
export * from './oss-execution-contract';
export * from './oss-worker-registry';
export * from './oss-runtime-adapter';
export * from './oss-worker-selector';
export * from './oss-health-check';
export * from './oss-license-policy';
export * from './oss-fallback-policy';
export * from './oss-evidence-writer';

import { OSS_WORKERS } from './oss-worker-registry';
import { selectWorkerForPhase } from './oss-worker-selector';
import { buildEvidence, writeEvidence, type PhaseEvidence } from './oss-evidence-writer';

/** Materialize evidence for every phase that has a governed worker. */
export function captureAllPhaseEvidence(phases?: number[]): PhaseEvidence[] {
  const targetPhases = phases || [...new Set(OSS_WORKERS.map((w) => w.phase))].sort((a, b) => a - b);
  const out: PhaseEvidence[] = [];
  for (const phase of targetPhases) {
    const sel = selectWorkerForPhase(phase);
    if (!sel) continue;
    const ev = buildEvidence(sel);
    writeEvidence(ev);
    out.push(ev);
  }
  return out;
}

/** A compact runtime summary for the CEO command center / health endpoints. */
export function ossRuntimeSummary(): {
  workers: number;
  phasesCovered: number[];
  running: number;
  configuredNotInstalled: number;
  flaggedLicenses: number;
} {
  const phases = [...new Set(OSS_WORKERS.map((w) => w.phase))].sort((a, b) => a - b);
  let running = 0;
  let notInstalled = 0;
  let flagged = 0;
  for (const phase of phases) {
    const sel = selectWorkerForPhase(phase);
    if (!sel) continue;
    if (sel.status === 'INTEGRATED_RUNNING') running++;
    else notInstalled++;
    if (sel.licenseFlagged) flagged++;
  }
  return { workers: OSS_WORKERS.length, phasesCovered: phases, running, configuredNotInstalled: notInstalled, flaggedLicenses: flagged };
}
