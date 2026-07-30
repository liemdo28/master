/**
 * CEO Dataset Builder (P0-5)
 *
 * Auto-generates CEO_DATASET.json from real production usage.
 * Target: 500 real messages before any model evaluation is permitted.
 *
 * Produces a structured dataset file with:
 *   - metadata (build timestamp, counts, freeze status)
 *   - messages[] with linked decisions + outcomes
 *   - false_action annotations
 *   - quality scores
 *
 * Dataset is generated into: .local-agent-global/telemetry/CEO_DATASET.json
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getTelemetryDb } from './ceo-telemetry-db';
import { getTelemetryStats, type RawMessage, type Decision, type Outcome, type FalseAction } from './ceo-telemetry-store';

// ── Path setup ───────────────────────────────────────────────────────────────

const TELEMETRY_DIR = process.env.MI_DATA_DIR
  ? join(process.env.MI_DATA_DIR, 'telemetry')
  : join(process.cwd(), '..', '..', '.local-agent-global', 'telemetry');

if (!existsSync(TELEMETRY_DIR)) mkdirSync(TELEMETRY_DIR, { recursive: true });

const DATASET_PATH = join(TELEMETRY_DIR, 'CEO_DATASET.json');

// ── Dataset types ────────────────────────────────────────────────────────────

export interface DatasetEntry {
  message_id: string;
  timestamp: string;
  sender: string;
  message: string;
  conversation_id: string | null;
  channel: string;
  decision: {
    intent: string;
    evidence_state: string;
    decision: string;
    action: string | null;
    confidence: number | null;
  } | null;
  outcomes: Array<{
    action: string;
    result: string;
    approval: string;
    workflow_id: string | null;
    failure: string | null;
    duration_ms: number | null;
  }>;
  false_actions: Array<{
    false_action: boolean;
    false_approval: boolean;
    false_finance: boolean;
    context_failure: boolean;
    reviewer: string | null;
  }>;
}

export interface DatasetMetadata {
  version: string;
  built_at: string;
  total_messages: number;
  total_decisions: number;
  total_outcomes: number;
  total_false_actions: number;
  false_action_rate: number;
  freeze_status: string;
  ready_for_evaluation: boolean;
  target_messages: number;
  progress_pct: number;
}

export interface CEO_DATASET {
  metadata: DatasetMetadata;
  entries: DatasetEntry[];
}

// ── Builder ──────────────────────────────────────────────────────────────────

/**
 * Build CEO_DATASET.json from all recorded telemetry.
 * Returns the full dataset object and writes to disk.
 */
export function buildDataset(options?: { limit?: number }): CEO_DATASET {
  const db = getTelemetryDb();
  const stats = getTelemetryStats();
  const limit = options?.limit || 10000;

  // Pull all raw messages
  const messages = db.prepare(
    'SELECT * FROM ceo_raw_messages ORDER BY timestamp ASC LIMIT ?'
  ).all(limit) as RawMessage[];

  // Pull all decisions indexed by message_id
  const allDecisions = db.prepare('SELECT * FROM ceo_decisions').all() as Decision[];
  const decisionsByMsg = new Map<string, Decision>();
  for (const d of allDecisions) decisionsByMsg.set(d.message_id, d);

  // Pull all outcomes indexed by message_id
  const allOutcomes = db.prepare('SELECT * FROM ceo_outcomes ORDER BY created_at').all() as Outcome[];
  const outcomesByMsg = new Map<string, Outcome[]>();
  for (const o of allOutcomes) {
    const arr = outcomesByMsg.get(o.message_id) || [];
    arr.push(o);
    outcomesByMsg.set(o.message_id, arr);
  }

  // Pull all false actions indexed by message_id
  const allFalse = db.prepare('SELECT * FROM ceo_false_actions').all() as FalseAction[];
  const falseByMsg = new Map<string, FalseAction[]>();
  for (const f of allFalse) {
    const arr = falseByMsg.get(f.message_id) || [];
    arr.push(f);
    falseByMsg.set(f.message_id, arr);
  }

  // Assemble entries
  const entries: DatasetEntry[] = messages.map(msg => {
    const dec = decisionsByMsg.get(msg.message_id) || null;
    const outs = outcomesByMsg.get(msg.message_id) || [];
    const falses = falseByMsg.get(msg.message_id) || [];

    return {
      message_id: msg.message_id,
      timestamp: msg.timestamp,
      sender: msg.sender,
      message: msg.message,
      conversation_id: msg.conversation_id,
      channel: msg.channel,
      decision: dec ? {
        intent: dec.intent,
        evidence_state: dec.evidence_state,
        decision: dec.decision,
        action: dec.action,
        confidence: dec.confidence,
      } : null,
      outcomes: outs.map(o => ({
        action: o.action,
        result: o.result,
        approval: o.approval,
        workflow_id: o.workflow_id,
        failure: o.failure,
        duration_ms: o.duration_ms,
      })),
      false_actions: falses.map(f => ({
        false_action: f.false_action === 1,
        false_approval: f.false_approval === 1,
        false_finance: f.false_finance === 1,
        context_failure: f.context_failure === 1,
        reviewer: f.reviewer,
      })),
    };
  });

  const targetMessages = 500;
  const readyForEvaluation = stats.total_messages >= targetMessages;

  const dataset: CEO_DATASET = {
    metadata: {
      version: '1.0.0',
      built_at: new Date().toISOString(),
      total_messages: stats.total_messages,
      total_decisions: stats.total_decisions,
      total_outcomes: stats.total_outcomes,
      total_false_actions: stats.total_false_actions,
      false_action_rate: stats.false_action_rate,
      freeze_status: stats.freeze_status,
      ready_for_evaluation: readyForEvaluation,
      target_messages: targetMessages,
      progress_pct: Math.min(100, Math.round((stats.total_messages / targetMessages) * 100)),
    },
    entries,
  };

  // Write to disk
  writeFileSync(DATASET_PATH, JSON.stringify(dataset, null, 2), 'utf-8');
  console.log(`[CeoDataset] Built CEO_DATASET.json — ${stats.total_messages} messages, ${entries.length} entries, progress: ${dataset.metadata.progress_pct}%`);

  return dataset;
}

/**
 * Quick status check — is dataset ready for model evaluation?
 */
export function isDatasetReady(): { ready: boolean; current: number; target: number; progress_pct: number } {
  const count = getTelemetryDb().prepare('SELECT COUNT(*) as n FROM ceo_raw_messages').get() as { n: number };
  const target = 500;
  return {
    ready: count.n >= target,
    current: count.n,
    target,
    progress_pct: Math.min(100, Math.round((count.n / target) * 100)),
  };
}
