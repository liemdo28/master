export interface ModelSpec {
  id:          string;
  name:        string;
  tier:        'coding' | 'ceo-brain' | 'vision' | 'human';
  languages:   string[];
  strengths:   string[];
  weaknesses:  string[];
  cost_per_1k: number;   // USD
  speed:       'fast' | 'medium' | 'slow';
  max_context: number;
  available:   boolean;
}

export const MODEL_REGISTRY: ModelSpec[] = [
  {
    id: 'qwen-coder', name: 'Qwen Coder 2.5', tier: 'coding',
    languages: ['python', 'javascript', 'typescript', 'go', 'rust', 'java'],
    strengths: ['code-generation', 'refactoring', 'debugging', 'low-cost'],
    weaknesses: ['complex-architecture', 'multi-file-reasoning'],
    cost_per_1k: 0.0002, speed: 'fast', max_context: 32768, available: true,
  },
  {
    id: 'deepseek', name: 'DeepSeek Coder V2', tier: 'coding',
    languages: ['python', 'javascript', 'typescript', 'c++', 'go'],
    strengths: ['algorithm', 'competitive-programming', 'math', 'reasoning'],
    weaknesses: ['context-length', 'web-frontend'],
    cost_per_1k: 0.0014, speed: 'medium', max_context: 131072, available: true,
  },
  {
    id: 'kimi', name: 'Kimi k1.5', tier: 'coding',
    languages: ['python', 'javascript', 'typescript'],
    strengths: ['long-context', 'documentation', 'translation', 'multimodal'],
    weaknesses: ['api-availability', 'speed'],
    cost_per_1k: 0.0015, speed: 'slow', max_context: 131072, available: false,
  },
  {
    id: 'claude', name: 'Claude Sonnet 4.6', tier: 'ceo-brain',
    languages: ['python', 'javascript', 'typescript', 'bash', 'sql'],
    strengths: ['architecture', 'code-review', 'security', 'documentation', 'reasoning'],
    weaknesses: ['cost', 'speed'],
    cost_per_1k: 0.003, speed: 'medium', max_context: 200000, available: true,
  },
  {
    id: 'gpt', name: 'GPT-4o', tier: 'ceo-brain',
    languages: ['python', 'javascript', 'typescript', 'sql', 'bash'],
    strengths: ['general-purpose', 'instructions-following', 'tooling'],
    weaknesses: ['cost', 'reasoning-depth'],
    cost_per_1k: 0.005, speed: 'medium', max_context: 128000, available: true,
  },
  {
    id: 'human-dev', name: 'Human Developer', tier: 'human',
    languages: ['all'],
    strengths: ['production-critical', 'architecture-decisions', 'compliance'],
    weaknesses: ['speed', 'availability', 'cost'],
    cost_per_1k: 99999, speed: 'slow', max_context: 999999, available: true,
  },
];

export function getModel(id: string): ModelSpec | undefined {
  return MODEL_REGISTRY.find(m => m.id === id);
}

export function getAvailableModels(): ModelSpec[] {
  return MODEL_REGISTRY.filter(m => m.available);
}
