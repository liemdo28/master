/**
 * policy.js — Risk Tier Model + Approval Policy Engine.
 *
 * Every proposed action is classified into a risk tier (0..3). The tier decides
 * whether it can auto-execute, needs human approval, or is blocked outright.
 *
 *   Tier 0 (trivial)   → auto-execute          (e.g. read-only metric pull)
 *   Tier 1 (low)       → auto-execute if no recent rejection for this kind
 *   Tier 2 (moderate)  → human approval REQUIRED
 *   Tier 3 (severe)    → human approval REQUIRED + rollback plan mandatory
 *
 * The policy is rule-driven and auditable — no opaque "AI decides".
 */
import { JsonStore } from '../../phase-12-self-improving-intelligence/src/store.js';

export const RISK_TIERS = {
  TRIVIAL: 0,
  LOW: 1,
  MODERATE: 2,
  SEVERE: 3,
};

// Pattern → tier. First match wins (declared most-severe-first).
const DEFAULT_RULES = [
  // SEVERE: anything that spends money, deletes, or mutates external accounts.
  { match: /(charge|payment|refund|payout|invoice|payroll)/i, tier: RISK_TIERS.SEVERE, why: 'financial mutation' },
  { match: /(delete|drop|wipe|purge|terminate|decommission)/i, tier: RISK_TIERS.SEVERE, why: 'destructive operation' },
  { match: /(publish|post|tweet|send email|broadcast|public)/i, tier: RISK_TIERS.SEVERE, why: 'public-facing publish' },

  // MODERATE: writes/updates that are reversible but visible.
  { match: /(update|create|insert|save|modify|configure)/i, tier: RISK_TIERS.MODERATE, why: 'reversible write' },
  { match: /(rotate|credential|token|secret|password)/i, tier: RISK_TIERS.MODERATE, why: 'credential lifecycle' },

  // LOW: idempotent / retry-safe ops.
  { match: /(retry|sync|refresh|re-pull|backfill)/i, tier: RISK_TIERS.LOW, why: 'idempotent retry' },
];

export class RiskTierModel {
  constructor(rules) {
    this.rules = rules && rules.length ? rules : DEFAULT_RULES;
  }

  classify(action) {
    const text = `${action.type || ''} ${action.summary || ''} ${JSON.stringify(action.meta || {})}`;
    for (const r of this.rules) {
      if (r.match.test(text)) {
        return { tier: r.tier, why: r.why, matched: r.match.source };
      }
    }
    // default: read-only → trivial
    return { tier: RISK_TIERS.TRIVIAL, why: 'no matching risky pattern (assumed read-only)', matched: null };
  }
}

export class ApprovalPolicy {
  constructor(opts) {
    this.risk = new RiskTierModel(opts && opts.rules);
    this.store = new JsonStore('approval-decision', opts); // policy decisions log
  }

  /**
   * Evaluate a proposed action and decide the gate outcome.
   * @returns {{ actionId, tier, why, gate: 'auto'|'approval'|'blocked', requiresRollbackPlan: boolean }}
   */
  evaluate(action, rejectionMemory) {
    const { tier, why } = this.risk.classify(action);

    let gate = 'auto';
    let requiresRollbackPlan = false;

    if (tier >= RISK_TIERS.MODERATE) {
      gate = 'approval';
      if (tier === RISK_TIERS.SEVERE) requiresRollbackPlan = true;
    }

    // Tier 1 (low) auto-execute UNLESS there is a recent rejection for this kind.
    if (tier === RISK_TIERS.LOW && rejectionMemory) {
      const recent = rejectionMemory.recentForActionType(action.type, 7 * 24 * 60 * 60 * 1000);
      if (recent.length) {
        gate = 'approval';
      }
    }

    return {
      actionId: action.id,
      tier,
      tierLabel: this._label(tier),
      why,
      gate,
      requiresRollbackPlan,
    };
  }

  _label(tier) {
    return ['TRIVIAL', 'LOW', 'MODERATE', 'SEVERE'][tier] || 'UNKNOWN';
  }
}
