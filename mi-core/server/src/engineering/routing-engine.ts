import type { TaskClassification } from './task-classifier';
import { MODEL_REGISTRY } from './model-registry';

export interface RoutingDecision {
  selected_model:    string;
  model_name:        string;
  confidence:        number;
  rationale:         string;
  fallback_model:    string;
  escalate_human:    boolean;
  escalation_reason?: string;
}

export function route(c: TaskClassification): RoutingDecision {
  // Human escalation rules
  if (c.is_p0 && c.is_production) {
    return {
      selected_model: 'human-dev', model_name: 'Human Developer',
      confidence: 100, rationale: 'P0 production issue — human required',
      fallback_model: 'claude', escalate_human: true,
      escalation_reason: 'P0 production incident requires human oversight',
    };
  }
  if (c.complexity === 'critical') {
    return {
      selected_model: 'human-dev', model_name: 'Human Developer',
      confidence: 95, rationale: 'Critical complexity — human review required',
      fallback_model: 'claude', escalate_human: true,
      escalation_reason: 'Critical complexity task requires human approval',
    };
  }

  // Score each available model
  const scores: Record<string, number> = {
    'qwen-coder': 50, 'deepseek': 50, 'kimi': 30, 'claude': 50, 'gpt': 50,
  };

  // Domain signals
  if (c.domain === 'security')    { scores['claude'] += 30; scores['gpt'] += 15; }
  if (c.domain === 'database')    { scores['deepseek'] += 20; scores['qwen-coder'] += 15; }
  if (c.domain === 'ui')          { scores['gpt'] += 20; scores['qwen-coder'] += 10; }
  if (c.domain === 'performance') { scores['deepseek'] += 25; scores['qwen-coder'] += 10; }
  if (c.domain === 'api')         { scores['qwen-coder'] += 20; scores['gpt'] += 15; }
  if (c.domain === 'testing')     { scores['claude'] += 20; scores['qwen-coder'] += 15; }
  if (c.domain === 'auth')        { scores['claude'] += 25; scores['gpt'] += 15; }
  if (c.domain === 'deployment')  { scores['claude'] += 20; scores['qwen-coder'] += 15; }

  // Task type signals
  if (c.task_type === 'review')   { scores['claude'] += 25; scores['gpt'] += 10; }
  if (c.task_type === 'bugfix')   { scores['qwen-coder'] += 20; scores['deepseek'] += 20; }
  if (c.task_type === 'feature')  { scores['qwen-coder'] += 15; scores['gpt'] += 15; }
  if (c.task_type === 'refactor') { scores['claude'] += 20; }

  // Complexity signals
  if (c.complexity === 'high')    { scores['claude'] += 20; scores['gpt'] += 10; }
  if (c.complexity === 'low')     { scores['qwen-coder'] += 20; scores['deepseek'] += 10; }

  // Language signals
  if (c.language === 'python')    { scores['qwen-coder'] += 15; scores['deepseek'] += 15; }
  if (c.language === 'sql')       { scores['deepseek'] += 20; scores['claude'] += 15; }

  // Pick winner
  const available = MODEL_REGISTRY.filter(m => m.available && m.id !== 'human-dev');
  const winner = available
    .map(m => ({ ...m, score: scores[m.id] || 50 }))
    .sort((a, b) => b.score - a.score)[0];

  const runnerUp = available
    .map(m => ({ ...m, score: scores[m.id] || 50 }))
    .sort((a, b) => b.score - a.score)[1];

  const maxScore = winner.score;
  const confidence = Math.min(99, Math.round(50 + (maxScore - 50) * 0.8));

  return {
    selected_model: winner.id,
    model_name:     winner.name,
    confidence,
    rationale: `Selected ${winner.name} for ${c.domain}/${c.task_type} task (score: ${maxScore})`,
    fallback_model: runnerUp?.id || 'claude',
    escalate_human: false,
  };
}
