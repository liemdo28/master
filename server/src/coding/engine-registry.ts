import type { CodingEngineRegistryEntry } from './types';

export const CODING_ENGINE_REGISTRY: CodingEngineRegistryEntry[] = [
  {
    id: 'local-llm-engine',
    label: 'Local LLM Engine',
    purpose: 'General-purpose offline coding engine driving a local Ollama model through plan, patch and bounded repair.',
    status: 'ACTIVE',
    repositoryScale: true,
  },
  {
    id: 'internal-patch-engine',
    label: 'Internal Patch Engine',
    purpose: 'Deterministic offline adapter retained as a fallback for tasks that must not involve a model.',
    status: 'ACTIVE',
    repositoryScale: true,
  },
  {
    id: 'openhands',
    label: 'OpenHands',
    purpose: 'Repo-scale coding engine candidate. Not installed on this host; retained as a future wrapped adapter.',
    status: 'WRAP_LATER',
    repositoryScale: true,
  },
  {
    id: 'aider',
    label: 'Aider',
    purpose: 'Small-edit/review engine candidate. Not installed on this host; retained as a future wrapped adapter.',
    status: 'WRAP_LATER',
    repositoryScale: false,
  },
];
