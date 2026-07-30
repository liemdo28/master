/**
 * Phase 34A — Model Registry
 * Central registry of all AI models in the Engineering Division.
 * Mi (CTO) uses this to know what each model can do.
 */

export type ModelId = 'qwen-coder' | 'deepseek' | 'kimi' | 'claude' | 'gpt' | 'human-dev';

export interface ModelDefinition {
  id:          ModelId;
  name:        string;
  languages:   string[];
  strengths:   string[];
  weaknesses:  string[];
  cost:        'low' | 'medium' | 'high';
  speed:       'fast' | 'medium' | 'slow';
  max_context: number;   // tokens
  available:   boolean;
  endpoint?:   string;   // API endpoint if callable
  notes?:      string;
}

export const MODEL_REGISTRY: Record<ModelId, ModelDefinition> = {
  'qwen-coder': {
    id:          'qwen-coder',
    name:        'Qwen Coder',
    languages:   ['typescript', 'javascript', 'node', 'react', 'vue'],
    strengths:   ['bugfix', 'api', 'refactor', 'unit-test', 'small-feature'],
    weaknesses:  ['architecture', 'large-repo', 'security-audit'],
    cost:        'low',
    speed:       'fast',
    max_context: 32000,
    available:   true,
    notes:       'Best for Node/TS bugfixes and API work. Fast iteration.',
  },
  'deepseek': {
    id:          'deepseek',
    name:        'DeepSeek Coder',
    languages:   ['python', 'sql', 'r', 'typescript'],
    strengths:   ['analytics', 'etl', 'data-pipeline', 'sql-optimization', 'ml'],
    weaknesses:  ['frontend', 'real-time', 'ui'],
    cost:        'low',
    speed:       'fast',
    max_context: 64000,
    available:   true,
    notes:       'Best for data engineering, analytics, SQL queries.',
  },
  'kimi': {
    id:          'kimi',
    name:        'Kimi',
    languages:   ['*'],
    strengths:   ['research', 'repo-analysis', 'documentation', 'large-codebase-audit', 'architecture-review'],
    weaknesses:  ['real-time-coding', 'iteration-speed'],
    cost:        'medium',
    speed:       'slow',
    max_context: 128000,
    available:   true,
    notes:       'Best for reading large repos, architecture analysis, research tasks.',
  },
  'claude': {
    id:          'claude',
    name:        'Claude (Sonnet)',
    languages:   ['*'],
    strengths:   ['architecture', 'fullstack', 'security', 'complex-refactor', 'system-design', 'review'],
    weaknesses:  ['cost-sensitive-bulk-tasks'],
    cost:        'high',
    speed:       'medium',
    max_context: 200000,
    available:   true,
    notes:       'Best for architecture decisions, security review, complex multi-file changes.',
  },
  'gpt': {
    id:          'gpt',
    name:        'GPT-4o',
    languages:   ['*'],
    strengths:   ['fullstack', 'product-features', 'ui', 'content'],
    weaknesses:  ['deep-architecture', 'cost-at-scale'],
    cost:        'high',
    speed:       'medium',
    max_context: 128000,
    available:   true,
    notes:       'Strong generalist. Good for product features and UI work.',
  },
  'human-dev': {
    id:          'human-dev',
    name:        'Human Developer',
    languages:   ['*'],
    strengths:   ['p0-production', 'stakeholder-communication', 'legal-compliance', 'ambiguous-requirements'],
    weaknesses:  ['speed', 'availability', 'cost'],
    cost:        'high',
    speed:       'slow',
    max_context: 999999,
    available:   true,
    notes:       'Required for P0 incidents, production deploys, compliance decisions.',
  },
};

export function getModel(id: ModelId): ModelDefinition {
  return MODEL_REGISTRY[id];
}

export function listAvailableModels(): ModelDefinition[] {
  return Object.values(MODEL_REGISTRY).filter(m => m.available);
}

export function getModelsByStrength(strength: string): ModelDefinition[] {
  return Object.values(MODEL_REGISTRY).filter(m =>
    m.strengths.some(s => s.toLowerCase().includes(strength.toLowerCase()))
  );
}

export function getModelsByLanguage(lang: string): ModelDefinition[] {
  return Object.values(MODEL_REGISTRY).filter(m =>
    m.languages.includes('*') || m.languages.includes(lang.toLowerCase())
  );
}
