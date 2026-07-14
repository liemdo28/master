/**
 * SEO Control Center — approval bridge.
 * Wires the SEO policy engine (seo-policy-engine.ts) into the existing,
 * canonical approval gate (approval/gate.ts). Per mi-core/CLAUDE.md rule 2
 * ("DO NOT modify ... Approval Engine"), this module only calls gate.ts's
 * public API with new `seo_*` categories — it never forks or edits gate.ts.
 */

import { enqueue, type ApprovalAction, type RiskLevel } from '../approval/gate';
import { evaluatePolicy, type PolicyTier } from './seo-policy-engine';
import { recordEvidence } from './seo-evidence';
import { getSeoDb, nowIso, seoId } from './seo-db';
import { queueToCeo } from '../services/whatsapp-sender';
import { bindSeoApproval, hashPayload } from './seo-approval-binding';

export interface SeoActionRequest {
  category: string;          // must match a category in config/seo-policy.yaml
  brand_id?: string;
  description: string;
  target: string;
  before_state?: string;
  after_state?: string;
  rollback_plan?: string;
  idempotency_key: string;
  payload?: unknown;         // stored as evidence
  location_id?: string | null;
  actor_id?: string | null;
  action_key?: string;
  payload_hash?: string | null;
}

export type SeoActionOutcome =
  | { outcome: 'blocked'; tier: PolicyTier; reason: string }
  | { outcome: 'auto_executed'; tier: PolicyTier; evidence_id: string }
  | { outcome: 'auto_executed_with_notification'; tier: PolicyTier; evidence_id: string }
  | { outcome: 'pending_approval'; tier: PolicyTier; approval: ApprovalAction; evidence_id: string }
  | { outcome: 'duplicate'; existing_action_id: string };

// Categories that must go through the L3 (double-confirm) risk level even though
// they're policy-tier REQUIRES_APPROVAL — matches spec's highest-risk action set.
const L3_CATEGORIES = new Set([
  'production_deploy', 'rollback', 'delete_production_data',
  'modify_gbp_core_info', 'modify_gbp_ownership', 'change_credentials',
]);

function riskLevelFor(tier: PolicyTier, category: string): RiskLevel {
  if (tier === 'BLOCKED') return 3; // never reached — blocked short-circuits before enqueue
  if (L3_CATEGORIES.has(category)) return 3;
  return 2;
}

/**
 * Submit an SEO action through policy evaluation, then either:
 *  - reject immediately (BLOCKED)
 *  - record evidence and return auto-executed (SAFE_AUTO)
 *  - record evidence, notify CEO via WhatsApp, and return auto-executed (AUTO_WITH_NOTIFICATION)
 *  - enqueue into the existing approval gate and return pending (REQUIRES_APPROVAL)
 * Idempotent: a repeated idempotency_key returns the prior action instead of re-running.
 */
export function submitSeoAction(req: SeoActionRequest): SeoActionOutcome {
  const db = getSeoDb();

  const existing = db.prepare('SELECT id FROM seo_actions WHERE idempotency_key = ?').get(req.idempotency_key) as { id: string } | undefined;
  if (existing) {
    return { outcome: 'duplicate', existing_action_id: existing.id };
  }

  const evaluation = evaluatePolicy(req.category);
  const actionId = seoId('act');

  if (evaluation.tier === 'BLOCKED') {
    const evidence = recordEvidence({
      brand_id: req.brand_id,
      category: req.category,
      summary: `BLOCKED: ${req.description}`,
      payload: { request: req, evaluation },
    });
    db.prepare(`
      INSERT INTO seo_actions (id, created_at, brand_id, category, policy_tier, description, status, idempotency_key, evidence_id, result, target)
      VALUES (@id, @created_at, @brand_id, @category, @policy_tier, @description, 'blocked', @idempotency_key, @evidence_id, @result, @target)
    `).run({
      id: actionId, created_at: nowIso(), brand_id: req.brand_id ?? null, category: req.category,
      policy_tier: evaluation.tier, description: req.description, idempotency_key: req.idempotency_key,
      evidence_id: evidence.id, result: evaluation.reason, target: req.target,
    });
    return { outcome: 'blocked', tier: evaluation.tier, reason: evaluation.reason };
  }

  const evidence = recordEvidence({
    action_id: actionId,
    brand_id: req.brand_id,
    category: req.category,
    summary: req.description,
    payload: { request: req, evaluation },
  });

  if (evaluation.tier === 'SAFE_AUTO' || evaluation.tier === 'AUTO_WITH_NOTIFICATION') {
    db.prepare(`
      INSERT INTO seo_actions (id, created_at, brand_id, category, policy_tier, description, status, idempotency_key, evidence_id, target)
      VALUES (@id, @created_at, @brand_id, @category, @policy_tier, @description, 'ran', @idempotency_key, @evidence_id, @target)
    `).run({
      id: actionId, created_at: nowIso(), brand_id: req.brand_id ?? null, category: req.category,
      policy_tier: evaluation.tier, description: req.description, idempotency_key: req.idempotency_key,
      evidence_id: evidence.id, target: req.target,
    });

    if (evaluation.tier === 'AUTO_WITH_NOTIFICATION') {
      queueToCeo(`[SEO] Auto action (notify-only): ${req.description} — ${req.target}`);
      return { outcome: 'auto_executed_with_notification', tier: evaluation.tier, evidence_id: evidence.id };
    }
    return { outcome: 'auto_executed', tier: evaluation.tier, evidence_id: evidence.id };
  }

  // REQUIRES_APPROVAL
  const approval = enqueue({
    risk_level: riskLevelFor(evaluation.tier, req.category),
    category: `seo_${req.category}`,
    description: req.description,
    target: req.target,
    before_state: req.before_state ?? null as unknown as string,
    after_state: req.after_state ?? null as unknown as string,
    rollback_plan: req.rollback_plan ?? null as unknown as string,
  });

  bindSeoApproval(approval.id, {
    category: req.category,
    action: req.action_key || req.category,
    target: req.target,
    brand_id: req.brand_id || 'global',
    location_id: req.location_id ?? null,
    actor_id: req.actor_id ?? null,
    payload_hash: req.payload_hash ?? hashPayload(req.payload),
  });

  db.prepare(`
    INSERT INTO seo_actions (id, created_at, brand_id, category, policy_tier, description, status, approval_id, idempotency_key, evidence_id, target)
    VALUES (@id, @created_at, @brand_id, @category, @policy_tier, @description, 'pending', @approval_id, @idempotency_key, @evidence_id, @target)
  `).run({
    id: actionId, created_at: nowIso(), brand_id: req.brand_id ?? null, category: req.category,
    policy_tier: evaluation.tier, description: req.description, approval_id: approval.id,
    idempotency_key: req.idempotency_key, evidence_id: evidence.id, target: req.target,
  });

  return { outcome: 'pending_approval', tier: evaluation.tier, approval, evidence_id: evidence.id };
}

export function markSeoActionResult(actionId: string, result: string): void {
  getSeoDb().prepare(`UPDATE seo_actions SET status = 'ran', result = ? WHERE id = ?`).run(result, actionId);
}

export function getSeoAction(actionId: string) {
  return getSeoDb().prepare('SELECT * FROM seo_actions WHERE id = ?').get(actionId);
}
