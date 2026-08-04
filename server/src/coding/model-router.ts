import { getModelsForRole } from '../models/model-registry';
import { selectModel } from '../model-router/ollama-router';
import { listModels } from './llm/ollama-client';
import type { CodingModelRoles } from './types';

/**
 * Benchmark-derived coding role preferences.
 *
 * These orderings come from measured results on this host, not from model names
 * or vendor positioning — see .phase4/evidence/benchmark. Two findings drove the
 * choices and are worth stating because they are counter-intuitive:
 *
 *  - qwen3:8b, a general model, beat every dedicated coder model on the fixture
 *    suite (3/5 vs 1-2/5) with 100% plan and patch validity and no hallucinated
 *    paths. qwen2.5-coder:7b managed 1/5, despite being the model the registry
 *    already declared the "primary coding model".
 *  - On review, deepseek-coder-v2:lite approved a diff containing a hardcoded
 *    API key. A false PASS is the one error a reviewer must not make, so it is
 *    excluded from the review role regardless of its task score.
 *
 * Larger is not better here: qwen2.5-coder:14b exceeds 8 GB of VRAM, spills to
 * CPU at ~7 tok/s with a 103 s mean task time, and still scored 1/5.
 */
export const CODING_ROLE_PREFERENCES = {
  /** Highest task success with valid, well-formed patches. */
  coding_primary: ['qwen3:8b', 'deepseek-coder-v2:lite', 'qwen2.5-coder:7b', 'qwen2.5-coder:14b'],
  /** Cheap, high-throughput decisions such as the context-expansion pass. */
  coding_fast: ['qwen2.5-coder:7b', 'qwen3:8b', 'deepseek-coder-v2:lite'],
  /** Judged on review accuracy, weighted hard against false approvals. */
  coding_review: ['qwen3:8b', 'qwen2.5-coder:7b', 'qwen2.5-coder:14b'],
} as const;

type CodingRole = keyof typeof CODING_ROLE_PREFERENCES;

const ENV_OVERRIDES: Record<CodingRole, string> = {
  coding_primary: 'MI_CODING_MODEL_PRIMARY',
  coding_fast: 'MI_CODING_MODEL_FAST',
  coding_review: 'MI_CODING_MODEL_REVIEW',
};

function pick(role: CodingRole, installed: string[]): string | null {
  const override = process.env[ENV_OVERRIDES[role]];
  if (override && installed.includes(override)) return override;

  for (const candidate of CODING_ROLE_PREFERENCES[role]) {
    const exact = installed.find(name => name === candidate);
    if (exact) return exact;
    // Tolerate an explicit quantisation suffix, e.g. qwen3:8b-q4_K_M.
    const suffixed = installed.find(name => name.startsWith(`${candidate}-`));
    if (suffixed) return suffixed;
  }
  return null;
}

export async function selectCodingModelRoles(): Promise<CodingModelRoles> {
  let installed: string[] = [];
  try {
    installed = await listModels();
  } catch {
    installed = [];
  }

  const registryCoding = getModelsForRole('coding').find(model => model.locality === 'local')?.name ?? null;

  // Fall back to the generic router only when nothing preferred is installed,
  // so a host without the benchmarked models still gets a working selection.
  const primary = pick('coding_primary', installed) || (await selectModel('coding')) || registryCoding;
  const fast = pick('coding_fast', installed) || (await selectModel('fast_chat')) || primary;
  const review = pick('coding_review', installed) || (await selectModel('qa_review')) || primary;

  return {
    coding_fast: fast,
    coding_primary: primary,
    coding_review: review,
    locality: 'local-first',
    offlineReady: Boolean(primary),
  };
}
