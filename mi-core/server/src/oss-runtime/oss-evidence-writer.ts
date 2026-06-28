/**
 * oss-evidence-writer.ts — write per-phase OSS runtime evidence to disk.
 *
 * Produces mi-core/evidence/oss-runtime/phase-N.json capturing the selected
 * worker, license decision, live health status, and fallback — the auditable
 * proof that each phase has a governed, health-checked OSS worker.
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type { WorkerSelection } from './oss-worker-selector';

export function evidenceDir(): string {
  // server/dist/oss-runtime -> mi-core/evidence/oss-runtime
  return join(__dirname, '..', '..', '..', 'evidence', 'oss-runtime');
}

export interface PhaseEvidence {
  phase: number;
  worker: string;
  workerId: string;
  businessRole: string;
  ownerDivision: string;
  license: string;
  licenseRisk: string;
  licenseAllowed: boolean;
  licenseFlagged: boolean;
  health: string;
  fallbackTo: string;
  integration: 'INTEGRATED_RUNNING' | 'CONFIGURED_NOT_INSTALLED' | 'INSTALLED_UNHEALTHY' | 'DISABLED';
  capturedAt: string;
}

export function buildEvidence(sel: WorkerSelection): PhaseEvidence {
  return {
    phase: sel.phase,
    worker: sel.worker.name,
    workerId: sel.worker.id,
    businessRole: sel.worker.businessRole,
    ownerDivision: sel.worker.ownerDivision,
    license: sel.worker.license,
    licenseRisk: sel.worker.licenseRisk,
    licenseAllowed: sel.licenseAllowed,
    licenseFlagged: sel.licenseFlagged,
    health: sel.status,
    fallbackTo: sel.fallbackTo,
    integration: sel.status as PhaseEvidence['integration'],
    capturedAt: new Date().toISOString(),
  };
}

export function writeEvidence(ev: PhaseEvidence, dir = evidenceDir()): string {
  const path = join(dir, `phase-${ev.phase}.json`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(ev, null, 2));
  return path;
}
