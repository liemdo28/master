/**
 * Model Policy — enforces 95% local / 5% cloud policy.
 * Cloud fallback requires explicit CEO allowance or system-configured exception.
 */

const CLOUD_ALLOWED = process.env.ALLOW_CLOUD_AI === '1';
const CLOUD_FALLBACK_ALLOWED = process.env.ALLOW_CLOUD_FALLBACK === '1';

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  cloud_allowed: boolean;
  fallback_allowed: boolean;
}

export function checkCloudPolicy(): PolicyDecision {
  return {
    allowed: CLOUD_ALLOWED || CLOUD_FALLBACK_ALLOWED,
    reason: CLOUD_ALLOWED ? 'explicit_allow' : CLOUD_FALLBACK_ALLOWED ? 'fallback_allowed' : 'local_first_policy',
    cloud_allowed: CLOUD_ALLOWED,
    fallback_allowed: CLOUD_FALLBACK_ALLOWED,
  };
}

export function getPolicySummary() {
  return {
    policy: '95% local / 5% cloud fallback',
    cloud_enabled: CLOUD_ALLOWED,
    fallback_enabled: CLOUD_FALLBACK_ALLOWED,
    env_vars: {
      ALLOW_CLOUD_AI: CLOUD_ALLOWED ? 'set' : 'not set (default: disabled)',
      ALLOW_CLOUD_FALLBACK: CLOUD_FALLBACK_ALLOWED ? 'set' : 'not set (default: disabled)',
    },
    compliance: !CLOUD_ALLOWED && !CLOUD_FALLBACK_ALLOWED
      ? '✅ 100% local — cloud disabled'
      : CLOUD_FALLBACK_ALLOWED
      ? '✅ Fallback only — cloud used only when local fails'
      : '⚠️ Cloud explicitly enabled',
  };
}
