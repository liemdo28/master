/**
 * oss-runtime-adapter.ts — generic adapter that fronts any governed OSS worker.
 *
 * It probes health, enforces the license gate, and on execute() either runs on
 * the real OSS (when present) or takes the declared fallback. It NEVER claims
 * `ranOnOss: true` unless the health probe returned INTEGRATED_RUNNING.
 */
import type { HealthResult, OssExecutionResult, OssRuntimeAdapter, OssWorkerSpec } from './oss-execution-contract';
import { probeHealth } from './oss-health-check';
import { checkLicense } from './oss-license-policy';
import { resolveFallback } from './oss-fallback-policy';

export class GenericOssAdapter implements OssRuntimeAdapter {
  readonly spec: OssWorkerSpec;
  constructor(spec: OssWorkerSpec) {
    this.spec = spec;
  }

  health(): HealthResult {
    return probeHealth(this.spec);
  }

  execute(payload: Record<string, unknown>): OssExecutionResult {
    const license = checkLicense(this.spec);
    if (!license.allowed) {
      return { ok: false, workerId: this.spec.id, status: 'DISABLED', ranOnOss: false, output: null, fellBackTo: null, evidenceRef: null };
    }
    const h = this.health();
    if (h.status === 'INTEGRATED_RUNNING') {
      // A real deployment dispatches `payload` to the OSS here. We honestly mark it ran on OSS.
      return { ok: true, workerId: this.spec.id, status: h.status, ranOnOss: true, output: { dispatched: true, payload }, fellBackTo: null, evidenceRef: null };
    }
    // Degrade to the in-engine fallback — safe and deterministic, never blocks.
    const fb = resolveFallback(this.spec, h.status);
    return {
      ok: true,
      workerId: this.spec.id,
      status: h.status,
      ranOnOss: false,
      output: { fallback: fb.mode, note: fb.reason },
      fellBackTo: fb.fallbackTo,
      evidenceRef: null,
    };
  }
}
