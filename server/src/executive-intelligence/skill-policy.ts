/**
 * Skill Policy Engine — Phase 21 (Week 4)
 *
 * Enforces per-skill access policies:
 * - mode: read-only or controlled-write
 * - allowed_connectors whitelist
 * - denied_actions blocklist
 * - approval_required_for_write flag
 *
 * All skill executions pass through this engine before being allowed.
 */

import { SkillManifest, SkillPolicy } from './types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PolicyCheckResult {
  allowed: boolean;
  reason: string;
  violations: string[];
}

// ── Public API ────────────────────────────────────────────────────────────────

export const skillPolicy = {
  /**
   * Check if a skill action is allowed by its policy.
   */
  checkAction(
    manifest: SkillManifest,
    action: string,
    connector: string,
    isWrite: boolean,
    hasCEOApproval: boolean,
  ): PolicyCheckResult {
    const policy = manifest.policy;
    const violations: string[] = [];

    if (!policy) {
      return {
        allowed: false,
        reason: 'No policy defined for this skill',
        violations: ['Missing policy definition'],
      };
    }

    // 1. Check mode
    if (isWrite && policy.mode === 'read-only') {
      violations.push(`Skill "${manifest.name}" is read-only, action "${action}" requires write`);
    }

    // 2. Check write approval
    if (isWrite && policy.approvalRequiredForWrite && !hasCEOApproval) {
      violations.push(`Write action "${action}" requires CEO approval`);
    }

    // 3. Check connector whitelist
    if (connector && policy.allowedConnectors.length > 0) {
      if (!policy.allowedConnectors.includes(connector)) {
        violations.push(`Connector "${connector}" not in allowed list: ${policy.allowedConnectors.join(', ')}`);
      }
    }

    // 4. Check denied actions
    if (policy.deniedActions && policy.deniedActions.length > 0) {
      for (const denied of policy.deniedActions) {
        if (action.toLowerCase().includes(denied.toLowerCase())) {
          violations.push(`Action "${action}" matches denied pattern "${denied}"`);
        }
      }
    }

    return {
      allowed: violations.length === 0,
      reason: violations.length === 0
        ? 'Policy check passed'
        : `Policy violations: ${violations.join('; ')}`,
      violations,
    };
  },

  /**
   * Check if a skill execution request is allowed.
   * Simplified version for common use cases.
   */
  canExecute(
    manifest: SkillManifest,
    options: {
      isWrite?: boolean;
      hasCEOApproval?: boolean;
      connector?: string;
      action?: string;
    } = {},
  ): PolicyCheckResult {
    return this.checkAction(
      manifest,
      options.action || 'execute',
      options.connector || '',
      options.isWrite || false,
      options.hasCEOApproval || false,
    );
  },
};
