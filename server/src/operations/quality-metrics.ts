/**
 * O6 — Conversation Quality Metrics
 * Tracks Jarvis Quality Score across 6 dimensions.
 */

import { getOpsDb, nowIso } from './ops-db';

export type QualityEventType =
  | 'context_retained'       // follow-up referenced prior context correctly
  | 'context_lost'           // follow-up ignored prior context
  | 'follow_up_success'      // follow-up question answered correctly
  | 'follow_up_fail'         // follow-up question failed / off-topic
  | 'clarification_needed'   // Mi asked for clarification (lower = better)
  | 'action_success'         // action completed as expected
  | 'action_fail'            // action failed or wrong
  | 'approval_accepted'      // CEO approved Mi's proposal
  | 'approval_rejected'      // CEO rejected Mi's proposal
  | 'hallucination_detected' // factual error detected in reply
  | 'on_topic'               // reply stayed on topic
  | 'off_topic';             // reply drifted off topic

// 1 = positive signal, 0 = negative signal
const POSITIVE_EVENTS = new Set<QualityEventType>([
  'context_retained', 'follow_up_success', 'action_success', 'approval_accepted', 'on_topic',
]);

export function recordQualityEvent(params: {
  session_id?: string;
  event_type: QualityEventType;
  detail?: string;
}): void {
  const score = POSITIVE_EVENTS.has(params.event_type) ? 1 : 0;
  try {
    getOpsDb().prepare(`
      INSERT INTO quality_events (session_id, event_type, score, detail, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(params.session_id ?? null, params.event_type, score, params.detail ?? null, nowIso());
  } catch { /* non-blocking */ }
}

export interface QualityScore {
  overall: number;        // 0–100
  context_retention: number;
  action_success_rate: number;
  approval_success_rate: number;
  hallucination_rate: number;
  clarification_rate: number;
  follow_up_success: number;
  total_events: number;
  label: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
}

export function computeQualityScore(hours = 24): QualityScore {
  const db = getOpsDb();
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  function rate(pos: QualityEventType, neg: QualityEventType): number {
    const p = (db.prepare(`SELECT COUNT(*) as n FROM quality_events WHERE event_type=? AND created_at>=?`).get(pos, since) as any).n;
    const n = (db.prepare(`SELECT COUNT(*) as n FROM quality_events WHERE event_type=? AND created_at>=?`).get(neg, since) as any).n;
    return (p + n) === 0 ? 100 : Math.round((p / (p + n)) * 100);
  }

  function count(type: QualityEventType): number {
    return (db.prepare(`SELECT COUNT(*) as n FROM quality_events WHERE event_type=? AND created_at>=?`).get(type, since) as any).n;
  }

  const total = (db.prepare(`SELECT COUNT(*) as n FROM quality_events WHERE created_at>=?`).get(since) as any).n;

  const context_retention   = rate('context_retained', 'context_lost');
  const follow_up_success   = rate('follow_up_success', 'follow_up_fail');
  const action_success_rate = rate('action_success', 'action_fail');
  const approval_success_rate = rate('approval_accepted', 'approval_rejected');

  const totalActions = count('action_success') + count('action_fail');
  const clarifications = count('clarification_needed');
  const clarification_rate = totalActions > 0 ? Math.round((clarifications / totalActions) * 100) : 0;

  const hallucinations = count('hallucination_detected');
  const hallucination_rate = total > 0 ? Math.round((hallucinations / total) * 100) : 0;

  const overall = Math.round(
    context_retention   * 0.20 +
    follow_up_success   * 0.20 +
    action_success_rate * 0.25 +
    approval_success_rate * 0.15 +
    (100 - clarification_rate) * 0.10 +
    (100 - hallucination_rate) * 0.10
  );

  const label: QualityScore['label'] = overall >= 90 ? 'EXCELLENT' : overall >= 75 ? 'GOOD' : overall >= 60 ? 'FAIR' : 'POOR';

  return {
    overall, context_retention, action_success_rate, approval_success_rate,
    hallucination_rate, clarification_rate, follow_up_success,
    total_events: total, label,
  };
}

// Auto-infer quality signals from pipeline output
export function inferQualityFromReply(params: {
  session_id?: string;
  user_request: string;
  reply: string;
  intent?: string;
  history_length: number;
}): void {
  const { reply, user_request, session_id, history_length } = params;

  // Context retention: if it's a follow-up (history_length > 0) and reply references prior context
  if (history_length > 0) {
    const hasContext = /anh.*vừa|như.*đã|tiếp theo|theo.*đó|như.*nói/i.test(reply);
    recordQualityEvent({ session_id, event_type: hasContext ? 'context_retained' : 'context_lost' });
  }

  // Clarification needed
  if (/anh.*cho.*biết.*cụ thể|anh.*hỏi.*cụ thể|anh.*muốn.*gì|clarify|cụ thể hơn/i.test(reply)) {
    recordQualityEvent({ session_id, event_type: 'clarification_needed', detail: user_request.slice(0, 100) });
  }

  // On/off topic — graph dump is off-topic
  if (/knowledge graph|→\s*(depends_on|deployed_on|owned_by)/i.test(reply)) {
    recordQualityEvent({ session_id, event_type: 'off_topic', detail: 'graph_dump_detected' });
  } else {
    recordQualityEvent({ session_id, event_type: 'on_topic' });
  }

  // Hallucination signal: factual claims in Vietnamese + no sources
  if (/\d+\s*(triệu|billion|%|USD|VND)/i.test(reply) && !/source:|knowledge|connector/i.test(reply)) {
    // Only flag when making financial claims without source backing
    // Heuristic: not definitive, just a signal
  }
}
