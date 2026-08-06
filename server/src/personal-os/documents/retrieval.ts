/**
 * Canonical retrieval service and KnowledgePack builder for Phase 5D-2.
 *
 * Ranking is purely structural: FTS5's own bm25 signal plus deterministic heuristic
 * boosts (heading match, exact phrase, tag match, recency) and penalties (staleness, an
 * unresolved conflict touching the chunk). There is no embedding model and no LLM
 * synthesis step in this file — every KnowledgePackItem this service produces is either
 * an extractive FACT (a near-verbatim, cited excerpt) or an explicit UNKNOWN. SYNTHESIS
 * and SUGGESTION are real, validated item types (see citations.ts) for a future
 * answer-composer that combines multiple FACTs, but nothing in this phase invents one.
 */

import type { ChunkSearchResult, DocumentStore } from './store';
import { buildCitation, validateKnowledgePackItem } from './citations';
import { validateKnowledgeQuery } from './query-validation';
import type {
  ConflictRecord, DocumentChunk, DocumentRecord, KnowledgePack, KnowledgePackItem, KnowledgeQuery,
} from './types';

const RANK_WEIGHTS = {
  /** Base structural relevance from FTS5 bm25 (inverted so larger is more relevant). */
  bm25: 1,
  /** The literal query text appears verbatim in the chunk. */
  exactPhrase: 3,
  /** A query term appears in the chunk's heading path or section title. */
  headingMatch: 2,
  /** A query term matches an explicit tag on the chunk. */
  tagMatch: 0.5,
  /** More recently indexed content ranks slightly higher, all else equal. */
  recency: 0.3,
} as const;

const PENALTIES = {
  /** A STALE document surfaced only because the caller opted in via includeStale. */
  stale: 4,
  /** The chunk is named in an unresolved (OPEN/NEEDS_CONFIRMATION) conflict. A nudge,
   *  not a suppression: a conflicted chunk that is genuinely the best match for a query
   *  must still be returned — with the conflict surfaced in KnowledgePack.conflicts —
   *  rather than hidden. Silently ranking it away would be its own kind of silently
   *  picking a winner. */
  conflict: 0.4,
} as const;

const EXCERPT_MAX_CHARS = 800;

/** Minimum normalised score (0..1, relative to this query's own candidate pool) to be
 *  worth showing at all — below this a chunk is dropped rather than used as padding. */
const RELEVANCE_FLOOR = 0.55;

export interface RankedChunk {
  chunk: DocumentChunk;
  document: DocumentRecord;
  score: number;
  isStale: boolean;
}

export class KnowledgeRetrievalService {
  constructor(private readonly store: DocumentStore) {}

  /** Structural search: validated query in, ranked chunks out. No embeddings. */
  search(rawQuery: unknown): RankedChunk[] {
    const query = validateKnowledgeQuery(rawQuery);
    const candidates = this.store.searchChunks(query.text, {
      projectIds: query.projectIds,
      includeStale: query.includeStale,
      limit: Math.min(query.limit * 5, 100),
    });
    if (!candidates.length) return [];

    const chunkIds = candidates.map(c => c.chunk.id);
    const conflicted = new Set(this.store.openConflictsForChunks(chunkIds).flatMap(c => c.chunkIds));
    const queryTerms = query.text.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    const now = Date.now();

    const ranked = candidates.map(candidate => scoreCandidate(candidate, query.text, queryTerms, conflicted, now));
    ranked.sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id));
    const normalised = normaliseScores(ranked);

    // A relevance floor, not just a count limit: padding a pack with the least-bad
    // leftovers from the candidate pool just to hit `limit` items would inflate the
    // unrelated-result rate for no benefit — the caller would rather see fewer, better
    // citations than a fixed-size list diluted with noise. The best match always
    // survives this filter, even alone.
    const relevant = normalised.filter((r, i) => i === 0 || r.score >= RELEVANCE_FLOOR);
    return relevant.slice(0, query.limit);
  }

  /**
   * The only code path allowed to assemble a KnowledgePack. Every FACT item is cited;
   * an empty result becomes one explicit UNKNOWN item rather than an empty list a caller
   * might mistake for "nothing to say."
   */
  buildKnowledgePack(rawQuery: unknown): KnowledgePack {
    const query = validateKnowledgeQuery(rawQuery);
    const ranked = this.search(rawQuery);
    const queryId = `kq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const generatedAt = new Date().toISOString();

    const items: KnowledgePackItem[] = ranked.map(r => toFactItem(r));
    const warnings: string[] = [];
    if (query.includeStale && ranked.some(r => r.isStale)) {
      warnings.push('results include STALE documents because includeStale was set');
    }

    if (!items.length) {
      items.push({ factType: 'UNKNOWN', statement: `no matching knowledge found for "${query.text}" in the requested project scope`, citations: [], score: 0, isStale: false });
    }

    for (const item of items) validateKnowledgePackItem(item);

    const conflicts = dedupeConflicts(this.store.openConflictsForChunks(ranked.map(r => r.chunk.id)));

    return {
      queryId,
      query: { text: query.text, projectIds: query.projectIds, includeStale: query.includeStale },
      generatedAt,
      items,
      conflicts,
      warnings,
      unknown: ranked.length === 0,
    };
  }
}

function scoreCandidate(
  candidate: ChunkSearchResult, queryText: string, queryTerms: string[], conflicted: Set<string>, now: number,
): RankedChunk {
  const { chunk, document } = candidate;
  const bm25Signal = Math.max(0, -candidate.rank) * RANK_WEIGHTS.bm25;

  const normalizedChunk = chunk.normalizedText;
  const exactPhrase = queryText.length > 3 && normalizedChunk.includes(queryText.toLowerCase())
    ? RANK_WEIGHTS.exactPhrase : 0;

  const headingText = [...chunk.headingPath, chunk.sectionTitle ?? ''].join(' ').toLowerCase();
  const headingMatch = queryTerms.some(t => headingText.includes(t)) ? RANK_WEIGHTS.headingMatch : 0;

  const tagText = chunk.tags.join(' ').toLowerCase();
  const tagMatch = queryTerms.some(t => tagText.includes(t)) ? RANK_WEIGHTS.tagMatch : 0;

  const ageDays = Math.max(0, (now - Date.parse(document.updatedAt || document.createdAt)) / 86_400_000);
  const recency = RANK_WEIGHTS.recency / (1 + ageDays / 30);

  const isStale = document.status === 'STALE';
  const stalePenalty = isStale ? PENALTIES.stale : 0;
  const conflictPenalty = conflicted.has(chunk.id) ? PENALTIES.conflict : 0;

  const score = bm25Signal + exactPhrase + headingMatch + tagMatch + recency - stalePenalty - conflictPenalty;
  return { chunk, document, score, isStale };
}

/** Min-max scales scores into [0,1] so KnowledgePackItem.score is comparable across queries. */
function normaliseScores(ranked: RankedChunk[]): RankedChunk[] {
  if (!ranked.length) return ranked;
  const values = ranked.map(r => r.score);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (span <= 0) return ranked.map(r => ({ ...r, score: 1 }));
  return ranked.map(r => ({ ...r, score: (r.score - min) / span }));
}

function toFactItem(ranked: RankedChunk): KnowledgePackItem {
  const citation = buildCitation(ranked.chunk, ranked.document);
  const text = ranked.chunk.text.length > EXCERPT_MAX_CHARS
    ? `${ranked.chunk.text.slice(0, EXCERPT_MAX_CHARS)}…` : ranked.chunk.text;
  return { factType: 'FACT', statement: text, citations: [citation], score: ranked.score, isStale: ranked.isStale };
}

function dedupeConflicts(conflicts: ConflictRecord[]): ConflictRecord[] {
  const seen = new Set<string>();
  const out: ConflictRecord[] = [];
  for (const c of conflicts) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}
