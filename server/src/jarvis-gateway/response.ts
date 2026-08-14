import type { JarvisResponse, RequestType } from './types';

/** Builds the base envelope every handler starts from — keeps every field
 *  present (per §25's "not every field is required" but callers should
 *  never need an `?.` chain to read a top-level key) and the generatedAt
 *  timestamp consistent. */
export function baseResponse(requestId: string, intent: RequestType, projectId: string | null): JarvisResponse {
  return {
    requestId,
    intent,
    projectId,
    sessionId: null,
    status: 'ANSWERED',
    answer: '',
    facts: [],
    inferences: [],
    unknowns: [],
    conflicts: [],
    citations: [],
    suggestedNextSteps: [],
    evidenceRefs: [],
    degradedCapabilities: [],
    generatedAt: new Date().toISOString(),
  };
}
