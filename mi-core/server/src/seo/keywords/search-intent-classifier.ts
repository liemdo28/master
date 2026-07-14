/**
 * SEO Keyword Research — deterministic search-intent classifier.
 * Rule-based pattern matching (no LLM call) against a fixed precedence order:
 *   branded > local > transactional > navigational > commercial > informational
 * Branded is checked first because a brand-name match is the strongest signal
 * regardless of what other words surround it. Local ("near me", a known
 * location name) is checked next because it usually dominates intent even
 * when combined with transactional words ("order sushi near me").
 */

import { normalizeKeyword } from './keyword-normalizer';

export type SearchIntent =
  | 'informational'
  | 'commercial'
  | 'transactional'
  | 'navigational'
  | 'local'
  | 'branded';

export interface IntentClassification {
  intent: SearchIntent;
  confidence: number;        // 0..1 heuristic confidence based on pattern strength
  matched_patterns: string[];
}

const LOCAL_PATTERNS: RegExp[] = [
  /\bnear me\b/,
  /\bnearby\b/,
  /\bclose to me\b/,
  /\bin my area\b/,
  /\bopen now\b/,
  /\bwalking distance\b/,
];

const TRANSACTIONAL_PATTERNS: RegExp[] = [
  /\border( online)?\b/,
  /\bbuy\b/,
  /\bdelivery\b/,
  /\bpickup\b/,
  /\bcarry ?out\b/,
  /\breservation[s]?\b/,
  /\bbook a table\b/,
  /\btable booking\b/,
  /\bcoupon[s]?\b/,
  /\bdiscount code\b/,
  /\bpromo code\b/,
  /\bdeal[s]?\b/,
  /\bcatering (order|quote)\b/,
];

const NAVIGATIONAL_PATTERNS: RegExp[] = [
  /\bhours\b/,
  /\bphone number\b/,
  /\bdirections\b/,
  /\baddress\b/,
  /\blocation[s]?\b/,
  /\bwebsite\b/,
  /\blogin\b/,
  /\bmenu\b/,
  /\bcontact\b/,
];

const COMMERCIAL_PATTERNS: RegExp[] = [
  /\bbest\b/,
  /\btop\b/,
  /\bvs\.?\b/,
  /\breview[s]?\b/,
  /\bcompare\b/,
  /\bcheap(est)?\b/,
  /\baffordable\b/,
  /\brated\b/,
  /\brecommend(ed)?\b/,
];

const INFORMATIONAL_PATTERNS: RegExp[] = [
  /\bhow to\b/,
  /\bwhat is\b/,
  /\brecipe\b/,
  /\bhistory of\b/,
  /\bguide\b/,
  /\bmeaning\b/,
  /\bcalories\b/,
  /\bingredients\b/,
];

function testAll(normalized: string, patterns: RegExp[]): string[] {
  const hits: string[] = [];
  for (const p of patterns) {
    if (p.test(normalized)) hits.push(p.source);
  }
  return hits;
}

/**
 * Classify a keyword's search intent using deterministic rule matching.
 * `brandNames` / `locationNames` come from brand-config so branded/local
 * detection is data-driven per brand rather than hardcoded.
 */
export function classifySearchIntent(
  keyword: string,
  opts: { brandNames?: string[]; locationNames?: string[] } = {},
): IntentClassification {
  const normalized = normalizeKeyword(keyword);
  const brandNames = (opts.brandNames || []).map(n => normalizeKeyword(n)).filter(Boolean);
  const locationNames = (opts.locationNames || []).map(n => normalizeKeyword(n)).filter(Boolean);

  // Branded — the normalized keyword contains a known brand name/alias.
  const brandHits = brandNames.filter(b => b.length > 0 && normalized.includes(b));
  if (brandHits.length > 0) {
    return { intent: 'branded', confidence: 0.95, matched_patterns: brandHits.map(b => `brand:${b}`) };
  }

  // Local — "near me" style patterns, or a known location name present.
  const localPatternHits = testAll(normalized, LOCAL_PATTERNS);
  const locationHits = locationNames.filter(l => l.length > 0 && normalized.includes(l));
  if (localPatternHits.length > 0 || locationHits.length > 0) {
    return {
      intent: 'local',
      confidence: localPatternHits.length > 0 ? 0.9 : 0.75,
      matched_patterns: [...localPatternHits, ...locationHits.map(l => `location:${l}`)],
    };
  }

  // Transactional — explicit commerce/action words.
  const transactionalHits = testAll(normalized, TRANSACTIONAL_PATTERNS);
  if (transactionalHits.length > 0) {
    return { intent: 'transactional', confidence: 0.85, matched_patterns: transactionalHits };
  }

  // Navigational — looking for a specific business detail/page.
  const navigationalHits = testAll(normalized, NAVIGATIONAL_PATTERNS);
  if (navigationalHits.length > 0) {
    return { intent: 'navigational', confidence: 0.7, matched_patterns: navigationalHits };
  }

  // Commercial — comparison/evaluation shopping language.
  const commercialHits = testAll(normalized, COMMERCIAL_PATTERNS);
  if (commercialHits.length > 0) {
    return { intent: 'commercial', confidence: 0.7, matched_patterns: commercialHits };
  }

  // Informational — explicit question/how-to patterns, else default fallback.
  const informationalHits = testAll(normalized, INFORMATIONAL_PATTERNS);
  if (informationalHits.length > 0) {
    return { intent: 'informational', confidence: 0.65, matched_patterns: informationalHits };
  }

  return { intent: 'informational', confidence: 0.4, matched_patterns: ['default_fallback'] };
}
