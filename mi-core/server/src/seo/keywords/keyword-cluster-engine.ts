/**
 * SEO Keyword Research — keyword clustering engine.
 * Default algorithm: deterministic token-overlap (Jaccard on core tokens)
 * greedy clustering — no embedding model required. If `useEmbeddings` is
 * requested, tries providerRouter.generateEmbedding() per keyword and
 * clusters by cosine similarity instead; any embedding failure (no provider
 * configured, network error, etc.) falls back to the token-overlap result so
 * this function always returns a real, usable clustering.
 */

import { coreTokens, coreTokenJaccard, normalizeKeyword } from './keyword-normalizer';
import { providerRouter } from '../../providers/provider-router';

export interface ClusterableKeyword {
  id: string;
  keyword: string;
}

export interface KeywordCluster {
  label: string;
  method: 'token_overlap' | 'embedding';
  keyword_ids: string[];
  keywords: string[];
}

const DEFAULT_JACCARD_THRESHOLD = 0.34;
const DEFAULT_COSINE_THRESHOLD = 0.82;

/** Pick a human-readable label for a cluster: the most frequent core token
 *  combination shared across its members, title-cased. */
function labelForGroup(keywords: string[]): string {
  const freq = new Map<string, number>();
  for (const kw of keywords) {
    for (const tok of coreTokens(normalizeKeyword(kw))) {
      freq.set(tok, (freq.get(tok) || 0) + 1);
    }
  }
  const ranked = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]);
  const topTokens = ranked.slice(0, 3).map(([tok]) => tok);
  if (topTokens.length === 0) return keywords[0] || 'uncategorized';
  return topTokens.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');
}

/**
 * Deterministic token-overlap clustering: greedily seeds a cluster from each
 * unclustered keyword, then absorbs every other unclustered keyword whose
 * core-token Jaccard similarity meets the threshold.
 */
export function clusterByTokenOverlap(
  items: ClusterableKeyword[],
  threshold: number = DEFAULT_JACCARD_THRESHOLD,
): KeywordCluster[] {
  const remaining = [...items];
  const clusters: KeywordCluster[] = [];

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const group: ClusterableKeyword[] = [seed];

    for (let i = remaining.length - 1; i >= 0; i--) {
      const candidate = remaining[i];
      const sim = coreTokenJaccard(normalizeKeyword(seed.keyword), normalizeKeyword(candidate.keyword));
      if (sim >= threshold) {
        group.push(candidate);
        remaining.splice(i, 1);
      }
    }

    clusters.push({
      label: labelForGroup(group.map(g => g.keyword)),
      method: 'token_overlap',
      keyword_ids: group.map(g => g.id),
      keywords: group.map(g => g.keyword),
    });
  }

  return clusters;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Embedding-enhanced clustering. Real cosine-similarity clustering when
 * embeddings are available; throws if any embedding call fails so the caller
 * (buildKeywordClusters) can fall back to the deterministic method.
 */
async function clusterByEmbedding(
  items: ClusterableKeyword[],
  threshold: number = DEFAULT_COSINE_THRESHOLD,
): Promise<KeywordCluster[]> {
  const vectors = new Map<string, number[]>();
  for (const item of items) {
    const result = await providerRouter.generateEmbedding(item.keyword);
    vectors.set(item.id, result.embedding);
  }

  const remaining = [...items];
  const clusters: KeywordCluster[] = [];

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const seedVec = vectors.get(seed.id) || [];
    const group: ClusterableKeyword[] = [seed];

    for (let i = remaining.length - 1; i >= 0; i--) {
      const candidate = remaining[i];
      const sim = cosineSimilarity(seedVec, vectors.get(candidate.id) || []);
      if (sim >= threshold) {
        group.push(candidate);
        remaining.splice(i, 1);
      }
    }

    clusters.push({
      label: labelForGroup(group.map(g => g.keyword)),
      method: 'embedding',
      keyword_ids: group.map(g => g.id),
      keywords: group.map(g => g.keyword),
    });
  }

  return clusters;
}

/**
 * Build clusters for a set of keywords. Uses embeddings when
 * `useEmbeddings: true` is passed and a provider is configured; otherwise
 * (or on any embedding failure) uses the deterministic token-overlap method.
 */
export async function buildKeywordClusters(
  items: ClusterableKeyword[],
  options: { useEmbeddings?: boolean; jaccardThreshold?: number; cosineThreshold?: number } = {},
): Promise<KeywordCluster[]> {
  if (items.length === 0) return [];

  if (options.useEmbeddings) {
    try {
      return await clusterByEmbedding(items, options.cosineThreshold);
    } catch {
      // Fall through to the deterministic method — never fail the caller
      // just because no embedding provider is configured.
    }
  }

  return clusterByTokenOverlap(items, options.jaccardThreshold);
}
