/**
 * CEO Model Freeze Gate (P0-6)
 *
 * Enforces the model evaluation freeze until 500 real messages exist.
 *
 * Rules:
 *   - No model promotions allowed while freeze is active
 *   - No Gemma deployment allowed
 *   - No Qwen replacement allowed
 *   - Freeze auto-lifts when message threshold (500) is reached
 *   - Manual override possible via API (requires explicit unfreeze)
 *
 * Consumed by: /api/telemetry/freeze/*
 * Enforced at: model registry routes, deployment endpoints
 */

import { getTelemetryDb, nowIso, getMessageCount } from './ceo-telemetry-db';

// ── Types ────────────────────────────────────────────────────────────────────

export interface FreezeStatus {
  model_freeze: boolean;
  message_count: number;
  message_threshold: number;
  gemma_deploy_allowed: boolean;
  qwen_replace_allowed: boolean;
  ready_for_evaluation: boolean;
  block_reason: string | null;
}

export interface FreezeOverride {
  success: boolean;
  key: string;
  old_value: string;
  new_value: string;
  message_count: number;
}

// ── Core gate ────────────────────────────────────────────────────────────────

/**
 * Check current freeze status. Auto-evaluates whether threshold is met.
 */
export function checkFreeze(): FreezeStatus {
  const db = getTelemetryDb();
  const messageCount = getMessageCount();

  const rows = db.prepare('SELECT key, value FROM ceo_freeze_state').all() as Array<{ key: string; value: string }>;
  const state: Record<string, string> = {};
  for (const r of rows) state[r.key] = r.value;

  const threshold = parseInt(state.message_threshold || '500', 10);
  const ready = messageCount >= threshold;
  const freezeActive = state.model_freeze === 'active' && !ready;

  const blockReason = freezeActive
    ? `Model freeze active: ${messageCount}/${threshold} messages collected. Need ${threshold - messageCount} more real messages before model evaluation is permitted.`
    : null;

  return {
    model_freeze: freezeActive,
    message_count: messageCount,
    message_threshold: threshold,
    gemma_deploy_allowed: state.gemma_deploy_allowed === 'true' || (!freezeActive && state.gemma_deploy_allowed !== 'false'),
    qwen_replace_allowed: state.qwen_replace_allowed === 'true' || (!freezeActive && state.qwen_replace_allowed !== 'false'),
    ready_for_evaluation: ready,
    block_reason: blockReason,
  };
}

/**
 * Enforce the freeze gate — throws if deployment is blocked.
 * Call this before ANY model promotion / deployment action.
 */
export function enforceFreeze(action: string): void {
  const status = checkFreeze();
  if (status.block_reason) {
    throw new Error(`[FreezeGate] BLOCKED: ${action} — ${status.block_reason}`);
  }
}

/**
 * Check if a specific action is allowed under current freeze state.
 */
export function isActionAllowed(action: 'gemma_deploy' | 'qwen_replace' | 'model_promotion'): { allowed: boolean; reason: string | null } {
  const status = checkFreeze();

  if (!status.ready_for_evaluation) {
    return {
      allowed: false,
      reason: `Freeze active: ${status.message_count}/${status.message_threshold} messages. ${action} requires ${status.message_threshold} real messages.`,
    };
  }

  const db = getTelemetryDb();
  const row = db.prepare("SELECT value FROM ceo_freeze_state WHERE key = ?").get(
    action === 'gemma_deploy' ? 'gemma_deploy_allowed' :
    action === 'qwen_replace' ? 'qwen_replace_allowed' : 'model_freeze'
  ) as { value: string } | undefined;

  if (row && row.value === 'false') {
    return { allowed: false, reason: `${action} is explicitly disabled in freeze state.` };
  }

  return { allowed: true, reason: null };
}

// ── Manual overrides (P0-6) ──────────────────────────────────────────────────

/**
 * Manually unfreeze model evaluation (admin action).
 */
export function unfreezeModels(adminOverride: string): FreezeOverride {
  const db = getTelemetryDb();
  const now = nowIso();
  const count = getMessageCount();

  const oldRow = db.prepare("SELECT value FROM ceo_freeze_state WHERE key = 'model_freeze'").get() as { value: string };

  db.prepare("UPDATE ceo_freeze_state SET value = ?, updated_at = ? WHERE key = 'model_freeze'").run('inactive', now);

  return {
    success: true,
    key: 'model_freeze',
    old_value: oldRow.value,
    new_value: 'inactive',
    message_count: count,
  };
}

/**
 * Re-enable freeze (admin action).
 */
export function refreezeModels(): FreezeOverride {
  const db = getTelemetryDb();
  const now = nowIso();
  const count = getMessageCount();

  const oldRow = db.prepare("SELECT value FROM ceo_freeze_state WHERE key = 'model_freeze'").get() as { value: string };

  db.prepare("UPDATE ceo_freeze_state SET value = ?, updated_at = ? WHERE key = 'model_freeze'").run('active', now);

  return {
    success: true,
    key: 'model_freeze',
    old_value: oldRow.value,
    new_value: 'active',
    message_count: count,
  };
}

/**
 * Update a freeze state value (generic admin setter).
 */
export function setFreezeState(key: string, value: string): FreezeOverride {
  const db = getTelemetryDb();
  const now = nowIso();

  const oldRow = db.prepare('SELECT value FROM ceo_freeze_state WHERE key = ?').get(key) as { value: string } | undefined;

  db.prepare('UPDATE ceo_freeze_state SET value = ?, updated_at = ? WHERE key = ?').run(value, now, key);

  return {
    success: true,
    key,
    old_value: oldRow?.value || '(not set)',
    new_value: value,
    message_count: getMessageCount(),
  };
}
