/**
 * KnowledgeQuery validation.
 *
 * The one invariant this module exists to protect: there is no query shape that means
 * "search all private knowledge." `projectIds` is required, bounded, and validated
 * before anything reaches the retrieval layer — cross-project expansion is refused here,
 * not just filtered later.
 */

import { KNOWLEDGE_QUERY_LIMITS, type KnowledgeQuery } from './types';

export class KnowledgeQueryValidationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'KnowledgeQueryValidationError';
  }
}

const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const MAX_ID_CHARS = 120;

export function validateKnowledgeQuery(input: unknown): KnowledgeQuery {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new KnowledgeQueryValidationError('INVALID_QUERY', 'a query object is required');
  }
  const raw = input as Record<string, unknown>;

  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (text.length < KNOWLEDGE_QUERY_LIMITS.minTextChars) {
    throw new KnowledgeQueryValidationError(
      'TEXT_TOO_SHORT', `query text must be at least ${KNOWLEDGE_QUERY_LIMITS.minTextChars} characters`,
    );
  }
  if (text.length > KNOWLEDGE_QUERY_LIMITS.maxTextChars) {
    throw new KnowledgeQueryValidationError(
      'TEXT_TOO_LONG', `query text must be at most ${KNOWLEDGE_QUERY_LIMITS.maxTextChars} characters`,
    );
  }

  const projectIds = normaliseIdList(raw.projectIds, 'projectIds', KNOWLEDGE_QUERY_LIMITS.maxProjectIds);
  if (projectIds.length < KNOWLEDGE_QUERY_LIMITS.minProjectIds) {
    throw new KnowledgeQueryValidationError(
      'PROJECT_SCOPE_REQUIRED',
      'at least one projectId is required — there is no query mode that searches all private knowledge',
    );
  }
  for (const id of projectIds) {
    if (!PROJECT_ID_PATTERN.test(id)) {
      throw new KnowledgeQueryValidationError('INVALID_PROJECT_ID', `projectId is not a valid identifier`);
    }
  }

  const goalIds = normaliseIdList(raw.goalIds, 'goalIds', KNOWLEDGE_QUERY_LIMITS.maxGoalIds);
  const taskIds = normaliseIdList(raw.taskIds, 'taskIds', KNOWLEDGE_QUERY_LIMITS.maxTaskIds);

  let limit: number = KNOWLEDGE_QUERY_LIMITS.defaultLimit;
  if (raw.limit !== undefined) {
    const n = Number(raw.limit);
    if (!Number.isFinite(n)) throw new KnowledgeQueryValidationError('INVALID_LIMIT', 'limit must be a number');
    limit = Math.round(n);
    if (limit < KNOWLEDGE_QUERY_LIMITS.minLimit || limit > KNOWLEDGE_QUERY_LIMITS.maxLimit) {
      throw new KnowledgeQueryValidationError(
        'LIMIT_OUT_OF_RANGE',
        `limit must be between ${KNOWLEDGE_QUERY_LIMITS.minLimit} and ${KNOWLEDGE_QUERY_LIMITS.maxLimit}`,
      );
    }
  }

  const includeStale = raw.includeStale === true;

  return { text, projectIds, goalIds, taskIds, limit, includeStale };
}

function normaliseIdList(value: unknown, field: string, max: number): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new KnowledgeQueryValidationError('INVALID_FIELD', `${field} must be an array`);
  if (value.length > max) throw new KnowledgeQueryValidationError('TOO_MANY_IDS', `${field} may contain at most ${max} entries`);
  const out = [...new Set(value.map(v => String(v).trim().slice(0, MAX_ID_CHARS)).filter(Boolean))];
  return out;
}
