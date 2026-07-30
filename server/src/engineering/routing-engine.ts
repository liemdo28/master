/**
 * Phase 34C — Routing Engine
 * Selects the best model for a classified task using a scoring matrix.
 */

import { ModelId, MODEL_REGISTRY, ModelDefinition } from './model-registry';
import { TaskClassification } from './task-classifier';

export interface RoutingDecision {
  selected_model:   ModelId;
  model_name:       string;
  confidence:       number;   // 0-100
  rationale:        string;
  fallback_model?:  ModelId;
  escalate_human:   boolean;
  escalation_reason?: string;
}

// ── Routing Rules ─────────────────────────────────────────────────────────────
// Each rule assigns score adjustments to models based on classification signals.

interface RoutingRule {
  condition: (c: TaskClassification) => boolean;
  scores:    Partial<Record<ModelId, number>>;
  reason:    string;
}

const ROUTING_RULES: RoutingRule[] = [
  // Language-based routing
  { condition: c => ['typescript','javascript','node'].includes(c.language),
    scores: { 'qwen-coder': +30, 'claude': +10, 'gpt': +10 },
    reason: 'Node/TS work' },

  { condition: c => ['python','sql'].includes(c.language),
    scores: { 'deepseek': +35, 'claude': +5 },
    reason: 'Python/SQL work' },

  { condition: c => c.language === 'php' || c.framework === 'laravel',
    scores: { 'claude': +30, 'gpt': +20 },
    reason: 'PHP/Laravel work' },

  // Framework-based routing
  { condition: c => ['react','nextjs','vue'].includes(c.framework),
    scores: { 'gpt': +25, 'claude': +15, 'qwen-coder': +10 },
    reason: 'Frontend framework' },

  // Task type routing
  { condition: c => c.task_type === 'bugfix' && c.complexity !== 'critical',
    scores: { 'qwen-coder': +25, 'deepseek': +10 },
    reason: 'Standard bugfix' },

  { condition: c => c.task_type === 'review' || c.domain === 'refactor',
    scores: { 'kimi': +30, 'claude': +20 },
    reason: 'Code review/audit' },

  { condition: c => c.domain === 'analytics' || c.domain === 'database',
    scores: { 'deepseek': +30, 'claude': +10 },
    reason: 'Analytics/DB work' },

  { condition: c => c.domain === 'auth' || c.domain === 'deployment',
    scores: { 'claude': +35 },
    reason: 'Security/infra — Claude preferred' },

  // Complexity routing
  { condition: c => c.complexity === 'high',
    scores: { 'claude': +20, 'gpt': +10, 'qwen-coder': -10 },
    reason: 'High complexity — prefer senior models' },

  { condition: c => c.complexity === 'low',
    scores: { 'qwen-coder': +15, 'deepseek': +10 },
    reason: 'Low complexity — prefer fast/cheap models' },

  // Large repo analysis → Kimi
  { condition: c => c.task_type === 'review' && c.complexity === 'high',
    scores: { 'kimi': +25 },
    reason: 'Large repo analysis' },
];

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreModels(classification: TaskClassification): Record<ModelId, number> {
  const scores: Record<ModelId, number> = {
    'qwen-coder': 20,
    'deepseek':   20,
    'kimi':       15,
    'claude':     25,
    'gpt':        20,
    'human-dev':  0,
  };

  for (const rule of ROUTING_RULES) {
    if (rule.condition(classification)) {
      for (const [model, delta] of Object.entries(rule.scores) as [ModelId, number][]) {
        scores[model] = (scores[model] || 0) + delta;
      }
    }
  }

  // Human dev override for P0/production
  if (classification.is_p0) {
    scores['human-dev'] = 100;
  }

  return scores;
}

// ── Router ────────────────────────────────────────────────────────────────────

export function route(classification: TaskClassification): RoutingDecision {
  // P0 / critical always escalates
  if (classification.is_p0) {
    return {
      selected_model:  'human-dev',
      model_name:      'Human Developer',
      confidence:      100,
      rationale:       'P0/critical task — requires human oversight',
      escalate_human:  true,
      escalation_reason: 'P0 or production-critical change',
    };
  }

  const scores = scoreModels(classification);

  // Sort by score descending (exclude human-dev from auto routing)
  const ranked = (Object.entries(scores) as [ModelId, number][])
    .filter(([id]) => id !== 'human-dev')
    .sort(([, a], [, b]) => b - a);

  const [topModel, topScore] = ranked[0];
  const [fallbackModel] = ranked[1] || [];

  // Confidence = normalized score (cap at 99)
  const maxPossibleScore = 25 + 35 + 35 + 25 + 25; // theoretical max
  const confidence = Math.min(99, Math.round((topScore / maxPossibleScore) * 100) + 40);

  // Build rationale from matching rules
  const matchedReasons = ROUTING_RULES
    .filter(r => r.condition(classification) && (r.scores[topModel] || 0) > 0)
    .map(r => r.reason);
  const rationale = matchedReasons.length
    ? matchedReasons.join('; ')
    : `Best match for ${classification.domain}/${classification.language}`;

  const escalate_human = confidence < 60 || classification.is_production;
  const escalation_reason = confidence < 60
    ? `Low confidence (${confidence}) — human review recommended`
    : classification.is_production
    ? 'Production change — human approval required'
    : undefined;

  return {
    selected_model:  topModel,
    model_name:      MODEL_REGISTRY[topModel].name,
    confidence,
    rationale,
    fallback_model:  fallbackModel,
    escalate_human,
    ...(escalation_reason ? { escalation_reason } : {}),
  };
}
