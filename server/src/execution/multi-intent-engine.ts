/**
 * DEV5 — Phase M1: Multi-Intent Engine
 * 
 * Splits CEO messages containing multiple tasks into individual intents.
 * Creates parent workflow + child workflows per detected intent.
 * 
 * Example: "Kiểm tra Dashboard, coi QB, tạo SEO Raw Sushi, rồi gửi Maria"
 *   → 4 intents: DASHBOARD_AUDIT, QB_CHECK, SEO_CONTENT, EMAIL_DRAFT
 */

import { classifyActionIntent, resolveEntities, ActionIntent, MessageClass } from './action-intent-engine';
import { createWorkflow } from './workflow-creation-layer';

// ── Types ──────────────────────────────────────────────────────────────────

export interface IntentClause {
  text: string;
  intent: ActionIntent;
  entities: { entity?: string; website?: string };
  index: number;
}

export interface MultiIntentResult {
  parent_workflow_id: string;
  original_message: string;
  clause_count: number;
  clauses: IntentClause[];
  child_workflows: Array<{
    workflow_id: string;
    clause_index: number;
    intent: ActionIntent;
    entities: { entity?: string; website?: string };
    workflow_type: string;
  }>;
  created_at: string;
}

// ── Clause Splitting ───────────────────────────────────────────────────────

/**
 * Vietnamese + English conjunction patterns that split task clauses.
 * Order matters: longer patterns first.
 */
const SPLIT_PATTERNS = [
  /\s+r[ồo]i\s+/gi,         // "rồi"/"roi" (then) — highest priority
  /,\s*r[ồo]i\s+/gi,        // "roi" after comma
  /\s+v[àa]\s+/gi,          // "và"/"va" (and)
  /;\s+/gi,                 // semicolon
  /,\s+/gi,                 // comma separator (Vietnamese list style)
  /\.\s+/gi,                // period
];

/**
 * Additional keyword-based split hints:
 * If a clause starts with these, it's likely a separate task.
 */
const TASK_STARTERS = [
  /(?:tạ|ta|ao)\s+(?:bài|post|seo|bài viết)/gi,
  /(?:kiểm|kiem)\s+tra/gi,
  /(?:coi|check|review)/gi,
  /(?:gửi|gui|send|email|mail)/gi,
  /(?:đăng|dang|post|publish)/gi,
  /(?:sửa|sua|fix|update|chỉnh)/gi,
  /(?:tạo|tao|create|make|làm|lam)/gi,
  /(?:xóa|xoa|delete|remove)/gi,
  /(?:deploy|triển khai)/gi,
  /(?:upload|tải|tai)/gi,
];

export function splitClauses(message: string): string[] {
  if (!message || message.trim().length === 0) return [];

  const normalized = message
    .trim()
    .replace(/\s+r[ồo]i\s+/gi, ', ')
    .replace(/\s+v[àa]\s+/gi, ', ')
    .replace(/;\s+/g, ', ')
    .replace(/\.\s+/g, ', ');

  const commaParts = normalized.split(/,\s*/).map(s => s.trim()).filter(Boolean);
  if (commaParts.length > 1) return commaParts;

  // Handle terse CEO chains without separators, e.g. "Dashboard QB Raw SEO báo Maria".
  const starter = /\b(qb|quickbooks|raw\s+seo|seo\s+raw|(?:báo|bao|gửi|gui|send)\s+maria|(?:kiểm|kiem)\s+tra\s+dashboard|dashboard)\b/gi;
  const matches = [...normalized.matchAll(starter)];
  if (matches.length > 1) {
    const clauses: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index || 0;
      const end = i + 1 < matches.length ? matches[i + 1].index || normalized.length : normalized.length;
      const clause = normalized.slice(start, end).trim();
      if (clause) clauses.push(clause);
    }
    if (clauses.length > 1) return clauses;
  }

  return [normalized];
}

// ── Multi-Intent Detection ────────────────────────────────────────────────

export function detectMultiIntent(message: string): IntentClause[] {
  const clauses = splitClauses(message);
  const results: IntentClause[] = [];

  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i];
    const intent = classifyActionIntent(clause);
    const entities = resolveEntities(clause);

    // Only include action-like intents (not informational questions alone)
    if (intent.message_class === 'action_request' || intent.message_class === 'dangerous_action' || 
        (intent.message_class === 'informational_question' && intent.confidence >= 80)) {
      results.push({
        text: clause,
        intent,
        entities,
        index: i,
      });
    }
  }

  // If no action intents found but we have clauses, include all
  if (results.length === 0 && clauses.length > 0) {
    for (let i = 0; i < clauses.length; i++) {
      const clause = clauses[i];
      const intent = classifyActionIntent(clause);
      const entities = resolveEntities(clause);
      results.push({ text: clause, intent, entities, index: i });
    }
  }

  return results;
}

// ── Parent Workflow Creation ───────────────────────────────────────────────

function genParentWorkflowId(): string {
  const d = new Date();
  const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).substring(2, 5);
  return `CEO-MULTI-${ds}-${rand}`;
}

export function processMultiIntent(
  message: string,
  sender: string
): MultiIntentResult {
  const clauses = detectMultiIntent(message);
  const parentId = genParentWorkflowId();

  // Create parent workflow
  const parentWf = createWorkflow({
    intent: {
      message_class: 'action_request' as MessageClass,
      domain: 'general',
      workflow_types: clauses.map(c => (c.intent.workflow_types[0] || 'GENERAL_TASK')),
      target_entity: undefined,
      approval_required: true,
      confidence: Math.max(...clauses.map(c => c.intent.confidence)),
      action_verbs: clauses.flatMap(c => c.intent.action_verbs),
      entity_mentions: clauses.flatMap(c => c.intent.entity_mentions),
      raw_keywords: [],
    },
    source_message_id: `CEO-MULTI-${Date.now()}`,
    sender,
    raw_message: message,
  });

  // Create child workflows for each clause
  const childWorkflows: MultiIntentResult['child_workflows'] = [];

  for (const clause of clauses) {
    const childWf = createWorkflow({
      intent: clause.intent,
      source_message_id: `CEO-CHILD-${Date.now()}-${clause.index}`,
      sender,
      raw_message: clause.text,
    });

    childWorkflows.push({
      workflow_id: childWf.workflow_id,
      clause_index: clause.index,
      intent: clause.intent,
      entities: clause.entities,
      workflow_type: clause.intent.workflow_types[0] || 'GENERAL_TASK',
    });
  }

  return {
    parent_workflow_id: parentWf.workflow_id,
    original_message: message,
    clause_count: clauses.length,
    clauses,
    child_workflows: childWorkflows,
    created_at: new Date().toISOString(),
  };
}

export function isMultiIntent(message: string): boolean {
  const clauses = splitClauses(message);
  return clauses.length > 1;
}

export function getClauseCount(message: string): number {
  return splitClauses(message).length;
}
