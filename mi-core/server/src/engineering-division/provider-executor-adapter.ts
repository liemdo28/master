import { execFileSync } from 'child_process';
import type { CodingProvider, EngineeringTask, ProviderResult } from './types';

export interface LocalProviderAvailability {
  provider: CodingProvider;
  model: string | null;
  available: boolean;
  reason: string;
}

const localModels: Partial<Record<CodingProvider, string>> = {
  qwen: 'qwen2.5-coder:7b',
  deepseek: 'deepseek-coder:6.7b',
};

function ollamaList(): string {
  try {
    return execFileSync('ollama', ['list'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err: any) {
    return String(err?.stderr || err?.message || '');
  }
}

export function checkLocalProviderAvailability(): LocalProviderAvailability[] {
  const list = ollamaList();
  const providers: CodingProvider[] = ['qwen', 'deepseek', 'kimi'];
  return providers.map((provider) => {
    const model = localModels[provider] || null;
    if (!model) {
      return { provider, model: null, available: false, reason: 'No approved local Ollama model mapping configured.' };
    }
    const available = list.includes(model);
    return {
      provider,
      model,
      available,
      reason: available ? 'Model is present in local Ollama registry.' : 'Model is not present in local Ollama registry.',
    };
  });
}

export function buildPatchPrompt(task: EngineeringTask): string {
  return [
    'You are a coding provider inside Mi Engineering Division.',
    'Return a unified diff only. Do not invent test results, commits, branches, or PRs.',
    `Task: ${task.title}`,
    `Description: ${task.description}`,
    `Repo: ${task.repo}`,
    `Language: ${task.classification.language}`,
    `Framework: ${task.classification.framework}`,
  ].join('\n');
}

export function runLocalProviderPatchRequest(task: EngineeringTask): ProviderResult {
  const availability = checkLocalProviderAvailability().find((p) => p.provider === task.model);
  if (!availability?.available || !availability.model) {
    return {
      provider: task.model,
      status: 'human-required',
      summary: availability?.reason || `No local adapter is available for ${task.model}.`,
      filesChanged: [],
      capturedAt: new Date().toISOString(),
    };
  }

  if (process.env.ENGINEERING_ALLOW_LIVE_MODEL_EXECUTION !== '1') {
    return {
      provider: task.model,
      status: 'human-required',
      summary: `Local model ${availability.model} is available, but live patch generation is disabled. Set ENGINEERING_ALLOW_LIVE_MODEL_EXECUTION=1 for an approved run.`,
      filesChanged: [],
      capturedAt: new Date().toISOString(),
    };
  }

  try {
    const output = execFileSync('ollama', ['run', availability.model, buildPatchPrompt(task)], {
      cwd: task.repo,
      encoding: 'utf-8',
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return {
      provider: task.model,
      status: output.trim().length > 0 ? 'executed' : 'failed',
      summary: output.trim(),
      filesChanged: [],
      capturedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      provider: task.model,
      status: 'failed',
      summary: String(err?.stdout || err?.stderr || err?.message || err),
      filesChanged: [],
      capturedAt: new Date().toISOString(),
    };
  }
}
