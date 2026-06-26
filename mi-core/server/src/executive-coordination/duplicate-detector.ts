 * Phase 0 â€” Duplicate Detection Engine
 *
 * Detects semantically similar tasks across all divisions.
 * Compares **title only** (not description) â€” descriptions have too much
 * domain noise to be a reliable signal. Uses token-based Jaccard similarity.
 *
 * Threshold â‰¥ 0.4 = duplicate.
 *
 * Example matches:
 *   "Run SEO Audit"      â†” "Check SEO performance"  (seo + semantic)
 *   "Run SEO Audit"      â†” "Run SEO Review"        (run, seo)
 *   "Modify dashboard schema" â†” "Deploy dashboard" (dashboard)
 */

import type { CoordinatedTask, DuplicateMatch } from './types';

const SIMILARITY_THRESHOLD = 0.4;

// â”€â”€ Normalization â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): Set<string> {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'at', 'is', 'by', 'with', 'from']);
  return new Set(
    normalize(text)
      .split(' ')
      .filter(w => w.length >= 2 && !stopWords.has(w))
  );
}

// â”€â”€ Jaccard Similarity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// â”€â”€ Semantic Boost â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Common synonym groups â€” boost similarity if both titles contain tokens
// from the same semantic cluster.

const SYNONYM_GROUPS: string[][] = [
  ['audit', 'check', 'review', 'inspect'],
  ['deploy', 'push', 'release', 'ship'],
  ['build', 'create', 'develop', 'implement'],
  ['fix', 'repair', 'resolve', 'patch'],
  ['seo', 'search', 'ranking', 'keywords'],
  ['dashboard', 'report', 'analytics', 'metrics'],
  ['campaign', 'ads', 'marketing', 'promotion'],
];

function semanticBoost(tokensA: Set<string>, tokensB: Set<string>): number {
  let boost = 0;
  for (const group of SYNONYM_GROUPS) {
    const aHit = tokensA.has(group[0]) || group.some(g => tokensA.has(g));
    const bHit = tokensB.has(group[0]) || group.some(g => tokensB.has(g));
    if (aHit && bHit) boost += 0.15;
  }
  return Math.min(boost, 0.4);
}

// â”€â”€ Detect Duplicates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function detectDuplicates(tasks: CoordinatedTask[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  const active = tasks.filter(t => !t.duplicateOf);
  const tokenCache = new Map<string, Set<string>>();
  for (const task of active) {
    tokenCache.set(task.id, tokenize(task.title));
  }

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      const tokensA = tokenCache.get(a.id)!;
      const tokensB = tokenCache.get(b.id)!;

      const jaccard = jaccardSimilarity(tokensA, tokensB);
      const boost = semanticBoost(tokensA, tokensB);
      const similarity = Math.min(jaccard + boost, 1);

      if (similarity >= SIMILARITY_THRESHOLD) {
        const shared = [...tokensA].filter(t => tokensB.has(t));
        matches.push({
          taskA: a.id,
          taskB: b.id,
          similarity: Math.round(similarity * 100) / 100,
          reason: shared.length > 0
            ? `Shared concepts: ${shared.join(', ')}`
            : 'Semantic overlap detected',

  return matches;
}

// â”€â”€ Mark Duplicate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function markDuplicate(
  canonicalId: string,
  duplicateId: string,
  updater: (id: string, patch: Partial<CoordinatedTask>) => CoordinatedTask | null
): { canonical: string; marked: string } | null {
  const updated = updater(duplicateId, { duplicateOf: canonicalId });
  if (!updated) return null;
  return { canonical: canonicalId, marked: duplicateId };
}

// â”€â”€ Summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function getDuplicateSummary(tasks: CoordinatedTask[]): {
  totalDuplicates: number;
  affectedDivisions: string[];
  canonicalTasks: string[];
} {
  const duplicates = tasks.filter(t => t.duplicateOf);
  const affectedDivisions = [...new Set(duplicates.map(t => t.division))];
  const canonicalTasks = [...new Set(duplicates.map(t => t.duplicateOf!))];
  return {
    totalDuplicates: duplicates.length,
    affectedDivisions,
    canonicalTasks,
  };
}