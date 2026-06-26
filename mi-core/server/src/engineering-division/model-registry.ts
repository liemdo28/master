import type { CodingProvider, ModelProfile } from './types';

export const MODEL_REGISTRY: ModelProfile[] = [
  {
    provider: 'qwen',
    model: 'qwen-coder',
    strengths: ['TypeScript', 'NodeJS', 'APIs', 'Refactoring'],
    weaknesses: ['large architecture rewrites', 'ambiguous product strategy'],
    languages: ['typescript', 'javascript'],
    frameworks: ['express', 'nodejs', 'react'],
    cost: 'low',
    latency: 'low',
    qualityScore: 86,
    availability: 'available',
  },
  {
    provider: 'deepseek',
    model: 'deepseek-coder',
    strengths: ['Python', 'SQL', 'Analytics'],
    weaknesses: ['frontend polish', 'large repository planning'],
    languages: ['python', 'sql'],
    frameworks: ['fastapi', 'pandas', 'postgres'],
    cost: 'low',
    latency: 'medium',
    qualityScore: 82,
    availability: 'available',
  },
  {
    provider: 'claude',
    model: 'claude',
    strengths: ['Architecture', 'Large Refactors', 'Laravel', 'Code Review'],
    weaknesses: ['low-latency bulk edits'],
    languages: ['php', 'typescript', 'javascript'],
    frameworks: ['laravel', 'symfony', 'react'],
    cost: 'high',
    latency: 'medium',
    qualityScore: 92,
    availability: 'available',
  },
  {
    provider: 'gpt',
    model: 'gpt',
    strengths: ['Full Stack', 'General Purpose', 'Integration Work'],
    weaknesses: ['domain-specific benchmark dominance not guaranteed'],
    languages: ['typescript', 'javascript', 'python', 'php', 'sql'],
    frameworks: ['nodejs', 'express', 'react', 'laravel'],
    cost: 'medium',
    latency: 'medium',
    qualityScore: 88,
    availability: 'available',
  },
  {
    provider: 'kimi',
    model: 'kimi',
    strengths: ['Research', 'Repo Analysis', 'Long Context Review'],
    weaknesses: ['hands-on patch execution'],
    languages: ['typescript', 'javascript', 'python', 'php'],
    frameworks: ['repo-audit', 'documentation'],
    cost: 'medium',
    latency: 'high',
    qualityScore: 84,
    availability: 'available',
  },
  {
    provider: 'human',
    model: 'human-developer',
    strengths: ['Production judgment', 'credentials', 'manual releases', 'ambiguous incidents'],
    weaknesses: ['speed', 'availability'],
    languages: ['typescript', 'javascript', 'python', 'php', 'sql'],
    frameworks: ['any'],
    cost: 'human',
    latency: 'human',
    qualityScore: 95,
    availability: 'limited',
  },
];

export function getModelRegistry(): ModelProfile[] {
  return MODEL_REGISTRY;
}

export function getModelProfile(provider: CodingProvider): ModelProfile | null {
  return MODEL_REGISTRY.find((p) => p.provider === provider) || null;
}

export const MODEL_REGISTRY_STATUS = 'MODEL_REGISTRY_OPERATIONAL';
