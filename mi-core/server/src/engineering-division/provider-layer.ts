import type { CodingProvider, EngineeringTask, ProviderResult } from './types';

export type ProviderExecutor = (task: EngineeringTask) => ProviderResult;

const providers = new Map<CodingProvider, ProviderExecutor>();

export function registerProvider(provider: CodingProvider, executor: ProviderExecutor): void {
  providers.set(provider, executor);
}

export function getRegisteredProviders(): CodingProvider[] {
  return Array.from(providers.keys());
}

export function dispatchToProvider(task: EngineeringTask): ProviderResult {
  const executor = providers.get(task.model);
  if (!executor) {
    return {
      provider: task.model,
      status: 'human-required',
      summary: `No live executor registered for ${task.model}. Task is dispatched but cannot execute automatically.`,
      filesChanged: [],
      capturedAt: new Date().toISOString(),
    };
  }
  return executor(task);
}

registerProvider('human', (task) => ({
  provider: 'human',
  status: 'human-required',
  summary: `Human developer required for ${task.title}.`,
  filesChanged: [],
  capturedAt: new Date().toISOString(),
}));
