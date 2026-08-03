import type { CodingEngineRegistryEntry } from './types';

export const CODING_ENGINE_REGISTRY: CodingEngineRegistryEntry[] = [
  {
    id: 'internal-patch-engine',
    label: 'Internal Patch Engine',
    purpose: 'Deterministic offline vertical-slice adapter for bounded repository edits.',
    status: 'ACTIVE',
    repositoryScale: true,
  },
  {
    id: 'openhands',
    label: 'OpenHands',
    purpose: 'Repo-scale coding engine candidate retained as a future wrapped adapter.',
    status: 'OPTIONAL',
    repositoryScale: true,
  },
  {
    id: 'aider',
    label: 'Aider',
    purpose: 'Small-edit/review engine candidate retained as a future wrapped adapter.',
    status: 'OPTIONAL',
    repositoryScale: false,
  },
];
