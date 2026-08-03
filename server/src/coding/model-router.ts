import { getModelsForRole } from '../models/model-registry';
import { selectModel } from '../model-router/ollama-router';
import type { CodingModelRoles } from './types';

export async function selectCodingModelRoles(): Promise<CodingModelRoles> {
  const registryCoding = getModelsForRole('coding').find(model => model.locality === 'local')?.name ?? null;
  const primary = await selectModel('coding') || registryCoding;
  const fast = await selectModel('fast_chat') || primary;
  const review = await selectModel('qa_review') || primary;
  return {
    coding_fast: fast,
    coding_primary: primary,
    coding_review: review,
    locality: 'local-first',
    offlineReady: Boolean(primary),
  };
}
