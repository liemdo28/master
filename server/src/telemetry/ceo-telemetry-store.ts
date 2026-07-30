/**
 * CEO Telemetry Store — CRUD operations for all 5 ledgers
 *
 * P0-1: recordMessage()       — 100% inbound message capture
 * P0-2: recordDecision()      — decision ledger entry
 * P0-3: recordOutcome()       — outcome ledger entry
 * P0-4: markFalseAction()     — false action / approval / finance / context failure
 * P0-5: Dataset builder       — see ceo-dataset-builder.ts
 * P0-6: Freeze gate           — see ceo-freeze-gate.ts
 *
 * Pattern: follows failure-evidence-store.ts conventions
 */

import { getTelemetryDb, nowIso } from './ceo-telemetry-db';

// ── Types ────────────────────────────────────────────────────────────────────

export type EvidenceState = 'no_data' | 'partial' | 'complete' | 'stale' | 'conflicting';
export type DecisionType  = 'execute' | 'defer' | 'escalate' | 'reject' | 'clarify' | 'auto_execute';
export type OutcomeResult  = 'success' | 'failure' | 'partial' | 'timeout' | 'cancelled' | 'pending';
export type ApprovalState = 'auto' | 'approved' | 'rejected' | 'pending' | 'expired' | 'not_required';
export type FreezeKey     = 'model_freeze' | 'message_threshold' | 'gemma_deploy_allowed' | 'qwen_replace_allowed';

export interface RawMessage {
  id: number;
  message_id: string;
  timestamp: string;
  sender: string;
  message: string;
  conversation_id: string | null;
  channel: string;
  raw_payload: string | null;
  created_at: string;
}

export interface Decision {
  id: number;
  message_id: string;
  intent: string;
  evidence_state: EvidenceState;
  decision: DecisionType;
  action: string | null;
  confidence: number | null;
  model_used: string | null;
  reasoning: string | null;
  created_at: string;
}

export interface Outcome {
  id: number;
  message_id: string;
  decision_id: number | null;
  action: string;
  result: OutcomeResult;
  approval: ApprovalState;
  workflow_id: string | null;
  failure: string | null;
  failure_reason: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface FalseAction {
  id: number;
  outcome_id: number;
  message_id: string;
  false_action: number;
  false_approval: number;
  false_finance: number;
  false_image_claim: number;
  context_failure: number;
  reviewer: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

// ── P0-1: Record inbound CEO message ─────────────────────────────────────────

/**
 * Record every inbound CEO message. 100% coverage required.
 * Returns the recorded message with its generated ID.
 */
export function recordMessage(params: {
  sender: string;
  message: string;
  conversation_id?: string;
  channel?: string;
  raw_payload?: string;
  timestamp?: string;
}): RawMessage {
  const db = getTelemetryDb();
  const message_id = params.timestamp
    ? `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    : `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const now = nowIso();

  db.prepare(`
    INSERT INTO ceo_raw_messages
      (message_id, timestamp, sender, message, conversation_id, channel, raw_payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    message_id,
    params.timestamp || now,
    params.sender,
    params.message,
    params.conversation_id ?? null,
    params.channel || 'whatsapp',
    params.raw_payload ?? null,
    now,
  );

  return db.prepare('SELECT * FROM ceo_raw_messages WHERE message_id = ?').get(message_id) as RawMessage;
}

/**
 * Record a message with a pre-assigned message_id (for idempotency).
 */
export function recordMessageWithId(params: {
  message_id: string;
  sender: string;
  message: string;
  conversation_id?: string;
  channel?: string;
  raw_payload?: string;
  timestamp?: string;
}): RawMessage {
  const db = getTelemetryDb();
  const now = nowIso();

  // Idempotent: skip if already recorded
  const existing = db.prepare('SELECT * FROM ceo_raw_messages WHERE message_id = ?').get(params.message_id) as RawMessage | undefined;
  if (existing) return existing;

  db.prepare(`
    INSERT INTO ceo_raw_messages
      (message_id, timestamp, sender, message, conversation_id, channel, raw_payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.message_id,
    params.timestamp || now,
    params.sender,
    params.message,
    params.conversation_id ?? null,
    params.channel || 'whatsapp',
    params.raw_payload ?? null,
    now,
  );

  return db.prepare('SELECT * FROM ceo_raw_messages WHERE message_id = ?').get(params.message_id) as RawMessage;
}

// ── P0-2: Record decision for a message ──────────────────────────────────────

export function recordDecision(params: {
  message_id: string;
  intent: string;
  evidence_state: EvidenceState;
  decision: DecisionType;
  action?: string;
  confidence?: number;
  model_used?: string;
  reasoning?: string;
}): Decision {
  const db = getTelemetryDb();
  const now = nowIso();

  db.prepare(`
    INSERT INTO ceo_decisions
      (message_id, intent, evidence_state, decision, action, confidence, model_used, reasoning, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.message_id,
    params.intent,
    params.evidence_state,
    params.decision,
    params.action ?? null,
    params.confidence ?? null,
    params.model_used ?? null,
    params.reasoning ?? null,
    now,
  );

  return db.prepare('SELECT * FROM ceo_decisions WHERE message_id = ?').get(params.message_id) as Decision;
}

// ── P0-3: Record outcome for an action ───────────────────────────────────────

export function recordOutcome(params: {
  message_id: string;
  decision_id?: number;
  action: string;
  result: OutcomeResult;
  approval?: ApprovalState;
  workflow_id?: string;
  failure?: string;
  failure_reason?: string;
  duration_ms?: number;
}): Outcome {
  const db = getTelemetryDb();
  const now = nowIso();

  const r = db.prepare(`
    INSERT INTO ceo_outcomes
      (message_id, decision_id, action, result, approval, workflow_id, failure, failure_reason, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.message_id,
    params.decision_id ?? null,
    params.action,
    params.result,
    params.approval || 'not_required',
    params.workflow_id ?? null,
    params.failure ?? null,
    params.failure_reason ?? null,
    params.duration_ms ?? null,
    now,
  );

  return db.prepare('SELECT * FROM ceo_outcomes WHERE id = ?').get(r.lastInsertRowid) as Outcome;
}

// ── P0-4: Mark false actions after review ────────────────────────────────────

export function markFalseAction(params: {
  outcome_id: number;
  message_id: string;
  false_action?: boolean;
  false_approval?: boolean;
  false_finance?: boolean;
  false_image_claim?: boolean;
  context_failure?: boolean;
  reviewer?: string;
  review_note?: string;
}): FalseAction {
  const db = getTelemetryDb();
  const now = nowIso();

  const r = db.prepare(`
    INSERT INTO ceo_false_actions
      (outcome_id, message_id, false_action, false_approval, false_finance, false_image_claim, context_failure, reviewer, review_note, created_at, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.outcome_id,
    params.message_id,
    params.false_action ? 1 : 0,
    params.false_approval ? 1 : 0,
    params.false_finance ? 1 : 0,
    params.false_image_claim ? 1 : 0,
    params.context_failure ? 1 : 0,
    params.reviewer ?? null,
    params.review_note ?? null,
    now,
    now,
  );

  return db.prepare('SELECT * FROM ceo_false_actions WHERE id = ?').get(r.lastInsertRowid) as FalseAction;
}

/**
 * Update an existing false action review.
 */
export function updateFalseAction(
  id: number,
  params: {
    false_action?: boolean;
    false_approval?: boolean;
    false_finance?: boolean;
    context_failure?: boolean;
    reviewer?: string;
    review_note?: string;
  },
): FalseAction | null {
  const db = getTelemetryDb();
  const now = nowIso();

  const existing = db.prepare('SELECT * FROM ceo_false_actions WHERE id = ?').get(id) as FalseAction | undefined;
  if (!existing) return null;

  db.prepare(`
    UPDATE ceo_false_actions
    SET false_action = ?, false_approval = ?, false_finance = ?, context_failure = ?,
        reviewer = ?, review_note = ?, reviewed_at = ?
    WHERE id = ?
  `).run(
    params.false_action  !== undefined ? (params.false_action ? 1 : 0) : existing.false_action,
    params.false_approval !== undefined ? (params.false_approval ? 1 : 0) : existing.false_approval,
    params.false_finance !== undefined ? (params.false_finance ? 1 : 0) : existing.false_finance,
    params.context_failure !== undefined ? (params.context_failure ? 1 : 0) : existing.context_failure,
    params.reviewer  ?? existing.reviewer,
    params.review_note ?? existing.review_note,
    now,
    id,
  );

  return db.prepare('SELECT * FROM ceo_false_actions WHERE id = ?').get(id) as FalseAction;
}

// ── Query helpers ────────────────────────────────────────────────────────────

export function getMessageById(message_id: string): RawMessage | undefined {
  return getTelemetryDb().prepare('SELECT * FROM ceo_raw_messages WHERE message_id = ?').get(message_id) as RawMessage | undefined;
}

export function getDecisionByMessage(message_id: string): Decision | undefined {
  return getTelemetryDb().prepare('SELECT * FROM ceo_decisions WHERE message_id = ?').get(message_id) as Decision | undefined;
}

export function getOutcomesByMessage(message_id: string): Outcome[] {
  return getTelemetryDb().prepare('SELECT * FROM ceo_outcomes WHERE message_id = ? ORDER BY created_at').all(message_id) as Outcome[];
}

export function getFalseActions(params?: { reviewed?: boolean; limit?: number }): FalseAction[] {
  const db = getTelemetryDb();
  let sql = 'SELECT * FROM ceo_false_actions';
  const conditions: string[] = [];
  if (params?.reviewed === true) conditions.push('reviewed_at IS NOT NULL');
  if (params?.reviewed === false) conditions.push('reviewed_at IS NULL');
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  if (params?.limit) sql += ` LIMIT ${params.limit}`;
  return db.prepare(sql).all() as FalseAction[];
}

export function getRecentMessages(hours = 24, limit = 100): RawMessage[] {
  const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
  return getTelemetryDb().prepare(
    'SELECT * FROM ceo_raw_messages WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?'
  ).all(cutoff, limit) as RawMessage[];
}

// ── Aggregate stats (for P0-5 dataset builder) ──────────────────────────────

export interface TelemetryStats {
  total_messages: number;
  total_decisions: number;
  total_outcomes: number;
  total_false_actions: number;
  messages_last_24h: number;
  messages_last_7d: number;
  unique_senders: number;
  decision_breakdown: Record<string, number>;
  outcome_breakdown: Record<string, number>;
  false_action_rate: number;
  freeze_status: string;
}

export function getTelemetryStats(): TelemetryStats {
  const db = getTelemetryDb();
  const now = new Date();
  const h24 = new Date(now.getTime() - 86400_000).toISOString();
  const h7d = new Date(now.getTime() - 7 * 86400_000).toISOString();

  const total_messages = (db.prepare('SELECT COUNT(*) as n FROM ceo_raw_messages').get() as any).n;
  const total_decisions = (db.prepare('SELECT COUNT(*) as n FROM ceo_decisions').get() as any).n;
  const total_outcomes = (db.prepare('SELECT COUNT(*) as n FROM ceo_outcomes').get() as any).n;
  const total_false_actions = (db.prepare('SELECT COUNT(*) as n FROM ceo_false_actions').get() as any).n;
  const messages_last_24h = (db.prepare('SELECT COUNT(*) as n FROM ceo_raw_messages WHERE created_at >= ?').get(h24) as any).n;
  const messages_last_7d = (db.prepare('SELECT COUNT(*) as n FROM ceo_raw_messages WHERE created_at >= ?').get(h7d) as any).n;
  const unique_senders = (db.prepare('SELECT COUNT(DISTINCT sender) as n FROM ceo_raw_messages').get() as any).n;

  const decisionRows = db.prepare('SELECT decision, COUNT(*) as n FROM ceo_decisions GROUP BY decision').all() as any[];
  const decision_breakdown: Record<string, number> = {};
  for (const r of decisionRows) decision_breakdown[r.decision] = r.n;

  const outcomeRows = db.prepare('SELECT result, COUNT(*) as n FROM ceo_outcomes GROUP BY result').all() as any[];
  const outcome_breakdown: Record<string, number> = {};
  for (const r of outcomeRows) outcome_breakdown[r.result] = r.n;

  const false_action_rate = total_outcomes > 0 ? total_false_actions / total_outcomes : 0;

  const freezeRow = db.prepare("SELECT value FROM ceo_freeze_state WHERE key = 'model_freeze'").get() as any;
  const freeze_status = freezeRow?.value || 'unknown';

  return {
    total_messages,
    total_decisions,
    total_outcomes,
    total_false_actions,
    messages_last_24h,
    messages_last_7d,
    unique_senders,
    decision_breakdown,
    outcome_breakdown,
    false_action_rate,
    freeze_status,
  };
}
