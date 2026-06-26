import { OperatorTaskInput, PolicyDecision } from './types';

const ALLOWED_MODES = new Set(['READ_ONLY', 'SAFE_WRITE_TEST_ONLY']);
const BLOCKED_MODES = new Set(['PRODUCTION_WRITE', 'FINANCIAL_ACTION', 'SECURITY_ACTION', 'CREDENTIAL_ACTION']);
const BLOCKED_TARGET_PATTERNS: Array<{ rule: string; pattern: RegExp }> = [
  { rule: 'doordash_production', pattern: /doordash/i },
  { rule: 'toast_production', pattern: /toast/i },
  { rule: 'quickbooks_production', pattern: /quickbooks|\.qbw|intuit/i },
  { rule: 'google_business_profile', pattern: /business\.google|google business profile|gbp/i },
  { rule: 'dreamhost', pattern: /dreamhost/i },
  { rule: 'cloudflare', pattern: /cloudflare/i },
  { rule: 'banking', pattern: /bank|banking|stripe|payment|credit union/i },
  { rule: 'payroll', pattern: /payroll|gusto|adp/i },
];
const SAFE_HOST_PATTERNS = [/^https:\/\/example\.com/i, /^https:\/\/www\.example\.com/i, /^http:\/\/127\.0\.0\.1(?::\d+)?/i, /^http:\/\/localhost(?::\d+)?/i];

export function evaluatePolicy(task: OperatorTaskInput): PolicyDecision {
  const matched_rules: string[] = [];
  const targetUrl = task.target?.url || '';
  const category = task.target?.category || '';
  const combined = `${targetUrl} ${category}`;

  if (BLOCKED_MODES.has(task.mode)) {
    matched_rules.push(`blocked_mode:${task.mode}`);
    return { ok: false, status: 'BLOCKED_BY_POLICY', reason: 'Production systems are not allowed in MVP', matched_rules };
  }

  if (!ALLOWED_MODES.has(task.mode)) {
    matched_rules.push(`unknown_mode:${task.mode}`);
    return { ok: false, status: 'BLOCKED_BY_POLICY', reason: 'Mode is not permitted for MVP', matched_rules };
  }

  for (const blocked of BLOCKED_TARGET_PATTERNS) {
    if (blocked.pattern.test(combined)) {
      matched_rules.push(`blocked_target:${blocked.rule}`);
      return { ok: false, status: 'BLOCKED_BY_POLICY', reason: 'Production systems are not allowed in MVP', matched_rules };
    }
  }

  const safeUrl = SAFE_HOST_PATTERNS.some((pattern) => pattern.test(targetUrl));
  if (!safeUrl) {
    matched_rules.push('safe_target_required');
    return {
      ok: false,
      status: 'BLOCKED_BY_POLICY',
      reason: 'Only public safe test targets are allowed in MVP',
      matched_rules,
    };
  }

  matched_rules.push('mode_allowed', 'target_allowed');
  return { ok: true, status: 'ALLOWED', reason: 'Allowed for safe MVP execution', matched_rules };
}
