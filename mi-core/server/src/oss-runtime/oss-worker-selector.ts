/**
 * oss-worker-selector.ts — pick the OSS worker for a phase or business role.
 *
 * Selection enforces the license gate and attaches the live health status +
 * resolved fallback, so a caller always gets a runnable decision (real OSS or
 * safe in-engine degrade).
 */
import type { OssWorkerSpec } from './oss-execution-contract';
import { OSS_WORKERS, workersForPhase } from './oss-worker-registry';
import { GenericOssAdapter } from './oss-runtime-adapter';
import { checkLicense } from './oss-license-policy';
import { resolveFallback } from './oss-fallback-policy';

export interface WorkerSelection {
  phase: number;
  worker: OssWorkerSpec;
  adapter: GenericOssAdapter;
  status: string;
  licenseAllowed: boolean;
  licenseFlagged: boolean;
  fallbackTo: string;
}

export function selectWorkerForPhase(phase: number): WorkerSelection | null {
  const [spec] = workersForPhase(phase);
  if (!spec) return null;
  return buildSelection(spec);
}

export function selectWorkerByRole(roleKeyword: string): WorkerSelection | null {
  const k = roleKeyword.toLowerCase();
  const spec = OSS_WORKERS.find((w) => w.businessRole.toLowerCase().includes(k));
  return spec ? buildSelection(spec) : null;
}

function buildSelection(spec: OssWorkerSpec): WorkerSelection {
  const adapter = new GenericOssAdapter(spec);
  const health = adapter.health();
  const license = checkLicense(spec);
  const fb = resolveFallback(spec, health.status);
  return {
    phase: spec.phase,
    worker: spec,
    adapter,
    status: health.status,
    licenseAllowed: license.allowed,
    licenseFlagged: license.flagged,
    fallbackTo: fb.fallbackTo,
  };
}
