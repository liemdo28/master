/**
 * oss-execution-contract.ts — the shared contract every OSS runtime adapter honors.
 *
 * Honesty is built into the type system: an adapter must report one of the
 * AdapterStatus values, and `INTEGRATED_RUNNING` is only legal when a live
 * health probe actually succeeded. No adapter may claim production while the
 * underlying OSS is not installed/reachable.
 */

export type AdapterStatus =
  | 'INTEGRATED_RUNNING'        // OSS present + health probe passed (real runtime)
  | 'CONFIGURED_NOT_INSTALLED'  // adapter wired, governed; OSS binary/server absent
  | 'INSTALLED_UNHEALTHY'       // OSS present but health probe failed
  | 'DISABLED';                 // intentionally turned off

export type LicenseRisk = 'low' | 'medium' | 'high';

export interface OssWorkerSpec {
  /** stable id, e.g. "otel", "langgraph", "opa" */
  id: string;
  name: string;
  phase: number;
  businessRole: string;
  ownerDivision: string;
  license: string;
  licenseRisk: LicenseRisk;
  /** how the adapter detects presence: a module to require, or an env/host:port */
  probe:
    | { kind: 'module'; module: string }
    | { kind: 'env'; env: string }
    | { kind: 'tcp'; host: string; port: number }
    | { kind: 'none' };
  fallback: string;          // what we do if the OSS is unavailable
}

export interface HealthResult {
  status: AdapterStatus;
  checkedAt: string;
  detail: string;
  latencyMs: number | null;
}

export interface OssExecutionResult {
  ok: boolean;
  workerId: string;
  status: AdapterStatus;
  /** true only when work was actually performed by the real OSS */
  ranOnOss: boolean;
  output: unknown;
  fellBackTo: string | null;
  evidenceRef: string | null;
}

/** Every adapter implements this. */
export interface OssRuntimeAdapter {
  readonly spec: OssWorkerSpec;
  health(): HealthResult;
  /** Execute a unit of work; if OSS is unavailable, take the declared fallback. */
  execute(payload: Record<string, unknown>): OssExecutionResult;
}
