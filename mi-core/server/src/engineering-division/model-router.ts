import type { ModelSelection, TaskClassification } from './types';

export function routeModel(classification: TaskClassification, title = ''): ModelSelection {
  const text = `${title} ${classification.domain} ${classification.language} ${classification.framework}`.toLowerCase();

  if (classification.framework === 'laravel' || classification.language === 'php') {
    return { selected_model: 'claude', confidence: 92, reason: 'Laravel/PHP work maps to Claude for architecture and large refactor safety.' };
  }
  if (classification.language === 'python' || classification.language === 'sql') {
    return { selected_model: 'deepseek', confidence: 90, reason: 'Python/SQL analytics work maps to DeepSeek.' };
  }
  if (/large repo|repo audit|audit|research/.test(text) || classification.complexity === 'high') {
    return { selected_model: 'kimi', confidence: 86, reason: 'Large repository analysis maps to Kimi.' };
  }
  if (classification.language === 'typescript' || classification.framework === 'nodejs') {
    return { selected_model: 'qwen', confidence: 92, reason: 'TypeScript/NodeJS/API work maps to Qwen Coder.' };
  }
  return { selected_model: 'gpt', confidence: 70, reason: 'Unknown work defaults to GPT general-purpose routing.' };
}
