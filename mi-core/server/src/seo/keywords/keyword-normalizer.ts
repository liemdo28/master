/**
 * SEO Keyword Research — deterministic keyword normalizer.
 * Pure string logic, no AI: lowercase, collapse whitespace, strip punctuation
 * variance so "Best Sushi, Near Me!!" and "best   sushi near me" normalize to
 * the same key for dedupe/cannibalization comparisons.
 */

/** Words that carry little topical signal on their own — used by the cluster
 *  engine and intent classifier to find the "core" tokens of a keyword. */
export const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with', 'and',
  'or', 'is', 'are', 'near', 'me', 'my', 'best', 'top', 'good', 'great',
  'find', 'what', 'where', 'how', 'which', 'that', 'this', 'do', 'does',
]);

/**
 * Normalize a raw keyword string:
 *  - Unicode NFKC normalize (fold compatibility variants)
 *  - lowercase
 *  - normalize curly quotes to straight quotes
 *  - strip punctuation except apostrophes/hyphens (keeps "don't", "drive-thru")
 *  - collapse repeated whitespace
 *  - trim
 */
export function normalizeKeyword(raw: string): string {
  if (!raw) return '';
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Split a normalized keyword into tokens (whitespace + hyphen boundaries). */
export function tokenize(normalized: string): string[] {
  return normalized
    .split(/[\s-]+/)
    .map(t => t.trim())
    .filter(Boolean);
}

/** Tokens with stopwords removed — the "core" topical tokens of a keyword. */
export function coreTokens(normalized: string): string[] {
  return tokenize(normalized).filter(t => !STOPWORDS.has(t));
}

/**
 * Jaccard similarity between the core-token sets of two normalized keywords.
 * Deterministic token-overlap similarity — used by clustering and
 * near-duplicate detection. Returns 0..1.
 */
export function coreTokenJaccard(a: string, b: string): number {
  const setA = new Set(coreTokens(a));
  const setB = new Set(coreTokens(b));
  if (setA.size === 0 && setB.size === 0) return a === b ? 1 : 0;
  let intersection = 0;
  for (const t of setA) if (setB.has(t)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
