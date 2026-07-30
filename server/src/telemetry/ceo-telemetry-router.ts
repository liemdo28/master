/**
 * CEO Telemetry Router — REST API for all telemetry ledgers
 *
 * Endpoints:
 *   POST   /api/telemetry/message          — Record inbound CEO message (P0-1)
 *   POST   /api/telemetry/message/batch    — Record multiple messages (P0-1)
 *   GET    /api/telemetry/messages          — List recent messages
 *   GET    /api/telemetry/message/:id       — Get message by ID
 *
 *   POST   /api/telemetry/decision          — Record decision (P0-2)
 *   GET    /api/telemetry/decision/:msg_id  — Get decision for message
 *
 *   POST   /api/telemetry/outcome           — Record outcome (P0-3)
 *   GET    /api/telemetry/outcome/:msg_id   — Get outcomes for message
 *
 *   POST   /api/telemetry/false-action      — Mark false action (P0-4)
 *   PATCH  /api/telemetry/false-action/:id  — Update false action review
 *   GET    /api/telemetry/false-actions     — List false actions
 *
 *   POST   /api/telemetry/dataset/build     — Build CEO_DATASET.json (P0-5)
 *   GET    /api/telemetry/dataset/status    — Dataset readiness check
 *
 *   GET    /api/telemetry/freeze            — Check freeze status (P0-6)
 *   POST   /api/telemetry/freeze/unfreeze   — Manual unfreeze (admin)
 *   POST   /api/telemetry/freeze/refreeze   — Re-enable freeze (admin)
 *   PUT    /api/telemetry/freeze/state      — Set freeze state value
 *   GET    /api/telemetry/freeze/check/:action — Check if action is allowed
 *
 *   GET    /api/telemetry/stats             — Aggregate telemetry stats
 *   GET    /api/telemetry/health            — Health check
 */

import { Router, Request, Response } from 'express';
import {
  recordMessage,
  recordMessageWithId,
  recordDecision,
  recordOutcome,
  markFalseAction,
  updateFalseAction,
  getRecentMessages,
  getMessageById,
  getDecisionByMessage,
  getOutcomesByMessage,
  getFalseActions,
  getTelemetryStats,
} from './ceo-telemetry-store';
import { buildDataset, isDatasetReady } from './ceo-dataset-builder';
import {
  checkFreeze,
  isActionAllowed,
  unfreezeModels,
  refreezeModels,
  setFreezeState,
} from './ceo-freeze-gate';
import { getMessageCount } from './ceo-telemetry-db';

export const ceoTelemetryRouter = Router();

// ── P0-1: Message endpoints ──────────────────────────────────────────────────

/**
 * Record a single inbound CEO message.
 */
ceoTelemetryRouter.post('/message', (req: Request, res: Response) => {
  try {
    const { sender, message, conversation_id, channel, raw_payload, timestamp } = req.body;
    if (!sender || !message) {
      res.status(400).json({ error: 'sender and message are required' });
      return;
    }
    const msg = recordMessage({ sender, message, conversation_id, channel, raw_payload, timestamp });
    res.json({ ok: true, message: msg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Record multiple messages in a batch (idempotent via message_id).
 */
ceoTelemetryRouter.post('/message/batch', (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      res.status(400).json({ error: 'messages array is required' });
      return;
    }
    const recorded = messages.map((m: any) => {
      if (m.message_id) {
        return recordMessageWithId({
          message_id: m.message_id,
          sender: m.sender,
          message: m.message,
          conversation_id: m.conversation_id,
          channel: m.channel,
          raw_payload: m.raw_payload,
          timestamp: m.timestamp,
        });
      }
      return recordMessage({
        sender: m.sender,
        message: m.message,
        conversation_id: m.conversation_id,
        channel: m.channel,
        raw_payload: m.raw_payload,
        timestamp: m.timestamp,
      });
    });
    res.json({ ok: true, count: recorded.length, messages: recorded });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * List recent messages.
 * Query params: hours (default 24), limit (default 100)
 */
ceoTelemetryRouter.get('/messages', (req: Request, res: Response) => {
  try {
    const hours = parseInt(String(req.query.hours || '24'), 10);
    const limit = parseInt(String(req.query.limit || '100'), 10);
    const msgs = getRecentMessages(hours, limit);
    res.json({ ok: true, count: msgs.length, messages: msgs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get a specific message by ID.
 */
ceoTelemetryRouter.get('/message/:id', (req: Request, res: Response) => {
  try {
    const msg = getMessageById(req.params.id);
    if (!msg) {
      res.status(404).json({ error: 'message not found' });
      return;
    }
    res.json({ ok: true, message: msg });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── P0-2: Decision endpoints ─────────────────────────────────────────────────

/**
 * Record a decision for a message.
 */
ceoTelemetryRouter.post('/decision', (req: Request, res: Response) => {
  try {
    const { message_id, intent, evidence_state, decision, action, confidence, model_used, reasoning } = req.body;
    if (!message_id || !intent || !evidence_state || !decision) {
      res.status(400).json({ error: 'message_id, intent, evidence_state, and decision are required' });
      return;
    }
    const dec = recordDecision({ message_id, intent, evidence_state, decision, action, confidence, model_used, reasoning });
    res.json({ ok: true, decision: dec });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get decision for a specific message.
 */
ceoTelemetryRouter.get('/decision/:msg_id', (req: Request, res: Response) => {
  try {
    const dec = getDecisionByMessage(req.params.msg_id);
    if (!dec) {
      res.status(404).json({ error: 'decision not found for this message' });
      return;
    }
    res.json({ ok: true, decision: dec });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── P0-3: Outcome endpoints ──────────────────────────────────────────────────

/**
 * Record an outcome for an action.
 */
ceoTelemetryRouter.post('/outcome', (req: Request, res: Response) => {
  try {
    const { message_id, decision_id, action, result, approval, workflow_id, failure, failure_reason, duration_ms } = req.body;
    if (!message_id || !action || !result) {
      res.status(400).json({ error: 'message_id, action, and result are required' });
      return;
    }
    const out = recordOutcome({ message_id, decision_id, action, result, approval, workflow_id, failure, failure_reason, duration_ms });
    res.json({ ok: true, outcome: out });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get outcomes for a specific message.
 */
ceoTelemetryRouter.get('/outcome/:msg_id', (req: Request, res: Response) => {
  try {
    const outs = getOutcomesByMessage(req.params.msg_id);
    res.json({ ok: true, count: outs.length, outcomes: outs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── P0-4: False action endpoints ─────────────────────────────────────────────

/**
 * Mark a false action on an outcome.
 */
ceoTelemetryRouter.post('/false-action', (req: Request, res: Response) => {
  try {
    const { outcome_id, message_id, false_action, false_approval, false_finance, context_failure, reviewer, review_note } = req.body;
    if (!outcome_id || !message_id) {
      res.status(400).json({ error: 'outcome_id and message_id are required' });
      return;
    }
    const fa = markFalseAction({ outcome_id, message_id, false_action, false_approval, false_finance, context_failure, reviewer, review_note });
    res.json({ ok: true, false_action: fa });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Update an existing false action review.
 */
ceoTelemetryRouter.patch('/false-action/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { false_action, false_approval, false_finance, context_failure, reviewer, review_note } = req.body;
    const fa = updateFalseAction(id, { false_action, false_approval, false_finance, context_failure, reviewer, review_note });
    if (!fa) {
      res.status(404).json({ error: 'false action entry not found' });
      return;
    }
    res.json({ ok: true, false_action: fa });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * List false actions.
 * Query params: reviewed (true/false), limit
 */
ceoTelemetryRouter.get('/false-actions', (req: Request, res: Response) => {
  try {
    const reviewedParam = req.query.reviewed as string | undefined;
    const reviewed = reviewedParam !== undefined ? reviewedParam === 'true' : undefined;
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const fas = getFalseActions({ reviewed, limit });
    res.json({ ok: true, count: fas.length, false_actions: fas });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── P0-5: Dataset endpoints ──────────────────────────────────────────────────

/**
 * Build CEO_DATASET.json from current telemetry data.
 */
ceoTelemetryRouter.post('/dataset/build', (_req: Request, res: Response) => {
  try {
    const dataset = buildDataset();
    res.json({ ok: true, metadata: dataset.metadata });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Check dataset readiness / progress toward 500 messages.
 */
ceoTelemetryRouter.get('/dataset/status', (_req: Request, res: Response) => {
  try {
    const status = isDatasetReady();
    res.json({ ok: true, ...status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── P0-6: Freeze gate endpoints ──────────────────────────────────────────────

/**
 * Check current freeze status.
 */
ceoTelemetryRouter.get('/freeze', (_req: Request, res: Response) => {
  try {
    const status = checkFreeze();
    res.json({ ok: true, ...status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Check if a specific action (gemma_deploy, qwen_replace, model_promotion) is allowed.
 */
ceoTelemetryRouter.get('/freeze/check/:action', (req: Request, res: Response) => {
  try {
    const action = req.params.action as 'gemma_deploy' | 'qwen_replace' | 'model_promotion';
    if (!['gemma_deploy', 'qwen_replace', 'model_promotion'].includes(action)) {
      res.status(400).json({ error: 'action must be gemma_deploy, qwen_replace, or model_promotion' });
      return;
    }
    const result = isActionAllowed(action);
    res.json({ ok: true, action, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Manually unfreeze model evaluation (admin only).
 */
ceoTelemetryRouter.post('/freeze/unfreeze', (req: Request, res: Response) => {
  try {
    const { admin_override } = req.body;
    if (!admin_override) {
      res.status(400).json({ error: 'admin_override is required' });
      return;
    }
    const result = unfreezeModels(admin_override);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Re-enable model freeze.
 */
ceoTelemetryRouter.post('/freeze/refreeze', (_req: Request, res: Response) => {
  try {
    const result = refreezeModels();
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Set a freeze state value (generic admin setter).
 */
ceoTelemetryRouter.put('/freeze/state', (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      res.status(400).json({ error: 'key and value are required' });
      return;
    }
    const result = setFreezeState(key, String(value));
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Aggregate stats ──────────────────────────────────────────────────────────

/**
 * Get aggregate telemetry statistics.
 */
ceoTelemetryRouter.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = getTelemetryStats();
    res.json({ ok: true, ...stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Health check ─────────────────────────────────────────────────────────────

ceoTelemetryRouter.get('/health', (_req: Request, res: Response) => {
  try {
    const messageCount = getMessageCount();
    const freeze = checkFreeze();
    res.json({
      ok: true,
      module: 'ceo-telemetry',
      messages: messageCount,
      freeze_active: freeze.model_freeze,
      ready_for_evaluation: freeze.ready_for_evaluation,
      progress_pct: Math.min(100, Math.round((messageCount / freeze.message_threshold) * 100)),
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
