/**
 * oss-license-policy.ts — license gate for OSS runtime adapters.
 *
 * Copyleft/commercial licenses are allowed but flagged; an explicit deny-list
 * blocks anything we will not run. A worker that fails the policy cannot be
 * selected for execution.
 */
import type { OssWorkerSpec } from './oss-execution-contract';

const DENY = new Set<string>([]); // none denied today — all governed OSS are permissive or flagged
const FLAG_RISK = new Set(['medium', 'high']);

export interface LicenseDecision {
  workerId: string;
  license: string;
  risk: string;
  allowed: boolean;
  flagged: boolean;
  reason: string;
}

export function checkLicense(spec: OssWorkerSpec): LicenseDecision {
  if (DENY.has(spec.license)) {
    return { workerId: spec.id, license: spec.license, risk: spec.licenseRisk, allowed: false, flagged: true, reason: `License ${spec.license} is deny-listed` };
  }
  const flagged = FLAG_RISK.has(spec.licenseRisk);
  return {
    workerId: spec.id,
    license: spec.license,
    risk: spec.licenseRisk,
    allowed: true,
    flagged,
    reason: flagged ? `Allowed but ${spec.licenseRisk}-risk (${spec.license}) — fallback required` : `Permissive license (${spec.license})`,
  };
}
