/**
 * SEO Business Fact Registry — claim guard (spec §11 mandatory blocking rule).
 * Scans article/draft text for superlative or unverifiable claim patterns and
 * checks whether a matching VERIFIED fact exists in seo_business_facts to
 * support each one. Anything without a verified backing fact is flagged
 * BLOCKED_UNVERIFIED. Designed to be called synchronously by another
 * engineer's content-QA pipeline before publish.
 */

import { listFacts, expireStaleFacts, type BusinessFactRecord } from './fact-registry';
import { getSeoDb, seoId } from '../seo-db';

export type ClaimStatus = 'BLOCKED_UNVERIFIED' | 'SUPPORTED_VERIFIED' | 'SUPPORTED_LOCATION_SPECIFIC';

export interface ClaimCheckResult {
  claim_text: string;
  claim_category: string;
  pattern_matched: string;
  status: ClaimStatus;
  supporting_fact_id?: string;
  reason: string;
}

interface ClaimPattern {
  category: string;
  pattern: RegExp;
  description: string;
}

// Each pattern maps to a fact `category` that must have a VERIFIED row in
// seo_business_facts before the claim is allowed to publish. Patterns are
// intentionally broad (case-insensitive substring/regex) since false
// positives here just mean "ask for a supporting fact", which is the safe
// direction to err.
const CLAIM_PATTERNS: ClaimPattern[] = [
  { category: 'superlative_ranking', pattern: /\bbest\s+\w*\s*restaurant\b/i, description: 'best restaurant claim' },
  { category: 'superlative_ranking', pattern: /\bnumber\s*one\b|\b#\s*1\b|\btop[- ]rated\b/i, description: 'number one / top-rated claim' },
  { category: 'superlative_ranking', pattern: /\bhighest[- ]rated\b/i, description: 'highest rated claim' },
  { category: 'authenticity', pattern: /\bauthentic\s+\w+/i, description: 'authentic <cuisine> claim' },
  { category: 'awards', pattern: /\baward[- ]winning\b/i, description: 'award-winning claim' },
  { category: 'awards', pattern: /\bvoted\s+best\b/i, description: 'voted best claim' },
  { category: 'freshness_practice', pattern: /\bfresh\s+daily\b/i, description: 'fresh daily claim' },
  { category: 'freshness_practice', pattern: /\b24[- ]hour\s+broth\b/i, description: '24-hour broth claim' },
  { category: 'sourcing', pattern: /\blocally\s+sourced\b/i, description: 'locally sourced claim' },
  { category: 'pricing_promo', pattern: /\bspecial\s+pricing\b/i, description: 'special pricing claim' },
  { category: 'pricing_promo', pattern: /\bhappy\s+hour\b/i, description: 'happy hour claim' },
  { category: 'hours_current', pattern: /\bopen\s+(now|until|24\/7|late)\b/i, description: 'current-hours claim' },
  { category: 'hours_current', pattern: /\bhours\s+(today|this\s+week)\b/i, description: 'current-hours claim' },
  { category: 'menu_current', pattern: /\bnew\s+menu\s+item\b|\blimited[- ]time\s+(menu|offer)\b/i, description: 'current-menu-item claim' },
  { category: 'menu_current', pattern: /\bseasonal\s+menu\b/i, description: 'current-menu-item claim' },

  // ── Categories added for hard claim-guard enforcement (spec §11 extension) ──
  // Covers: menu/price/hours/address/phone/promotion/ingredients/preparation/
  // awards/freshness/location/reservation/delivery/takeout.
  { category: 'menu_item', pattern: /\b(our|the)\s+menu\s+(includes|features|offers)\b/i, description: 'menu contents claim' },
  { category: 'menu_item', pattern: /\bsignature\s+dish(es)?\b/i, description: 'signature dish claim' },
  { category: 'pricing_promo', pattern: /\$\s?\d+(\.\d{2})?\b/, description: 'specific price claim' },
  { category: 'pricing_promo', pattern: /\bstarting\s+at\b/i, description: 'starting price claim' },
  { category: 'address', pattern: /\blocated\s+at\b|\baddress\s+is\b|\bfind\s+us\s+at\b/i, description: 'address claim' },
  { category: 'phone', pattern: /\bcall\s+us\s+at\b|\bphone\s+number\s+is\b|\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/i, description: 'phone number claim' },
  { category: 'ingredients', pattern: /\bmade\s+with\b|\bingredients\s+include\b|\b100%\s+\w+\b/i, description: 'ingredients claim' },
  { category: 'preparation', pattern: /\bprepared\s+(fresh|daily|in[- ]house|to\s+order)\b|\bcooked\s+(fresh|to\s+order)\b|\bhand[- ]made\b/i, description: 'preparation-method claim' },
  { category: 'location_claim', pattern: /\bonly\s+location\b|\bconveniently\s+located\b|\bin\s+the\s+heart\s+of\b/i, description: 'location-specific claim' },
  { category: 'reservation', pattern: /\breservations?\s+(are\s+)?(accepted|available|required|recommended)\b|\bwalk-?ins?\s+welcome\b/i, description: 'reservation-policy claim' },
  { category: 'delivery', pattern: /\bwe\s+deliver\b|\bdelivery\s+available\b|\bdelivery\s+radius\b/i, description: 'delivery-availability claim' },
  { category: 'takeout', pattern: /\btakeout\s+available\b|\bcarry-?out\b|\bto-?go\s+orders?\b/i, description: 'takeout-availability claim' },
];

/** Claim categories this guard currently enforces (used by content-brief.ts /
 *  article-pipeline.ts to build the prompt template's `forbidden_claims`
 *  section, and by tests to assert coverage). */
export function listClaimCategories(): string[] {
  return Array.from(new Set(CLAIM_PATTERNS.map(p => p.category)));
}

/** Human-readable "do not claim X unless backed by an approved fact" lines,
 *  one per distinct pattern description — suitable for direct inclusion in
 *  the `{{forbidden_claims}}` slot of the SEO prompt templates. */
export function listForbiddenClaimInstructions(): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const p of CLAIM_PATTERNS) {
    if (seen.has(p.description)) continue;
    seen.add(p.description);
    lines.push(`Do not state or imply a ${p.description} unless it is explicitly supported by an approved fact above.`);
  }
  return lines;
}

function extractClaimText(text: string, matchIndex: number, matchLength: number): string {
  const contextRadius = 30;
  const start = Math.max(0, matchIndex - contextRadius);
  const end = Math.min(text.length, matchIndex + matchLength + contextRadius);
  return text.slice(start, end).trim();
}

function findSupportingFact(facts: BusinessFactRecord[], category: string, locationId?: string): BusinessFactRecord | undefined {
  const candidates = facts.filter(f => f.category === category);
  if (locationId) {
    const locationSpecific = candidates.find(f => f.location_id === locationId && (f.status === 'VERIFIED' || f.status === 'LOCATION_SPECIFIC'));
    if (locationSpecific) return locationSpecific;
  }
  return candidates.find(f => f.status === 'VERIFIED' && !f.location_id);
}

/**
 * Check a block of text for blocked/unverifiable claim patterns.
 * `locationId` is optional — when supplied, LOCATION_SPECIFIC facts scoped to
 * that location also count as support.
 */
export function checkClaims(brandId: string, text: string, locationId?: string): ClaimCheckResult[] {
  expireStaleFacts(brandId);
  const facts = listFacts(brandId, locationId ? { locationId } : {});
  const results: ClaimCheckResult[] = [];

  for (const { category, pattern, description } of CLAIM_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    let match: RegExpExecArray | null;
    while ((match = globalPattern.exec(text)) !== null) {
      const claimText = extractClaimText(text, match.index, match[0].length);
      const supportingFact = findSupportingFact(facts, category, locationId);

      if (supportingFact) {
        results.push({
          claim_text: claimText,
          claim_category: category,
          pattern_matched: description,
          status: supportingFact.status === 'LOCATION_SPECIFIC' ? 'SUPPORTED_LOCATION_SPECIFIC' : 'SUPPORTED_VERIFIED',
          supporting_fact_id: supportingFact.id,
          reason: `matched a VERIFIED business fact (${supportingFact.field_name} = "${supportingFact.value}")`,
        });
      } else {
        results.push({
          claim_text: claimText,
          claim_category: category,
          pattern_matched: description,
          status: 'BLOCKED_UNVERIFIED',
          reason: `no VERIFIED business fact of category "${category}" found for this brand${locationId ? '/location' : ''} — claim must not publish until verified`,
        });
      }

      // Avoid infinite loop on zero-length matches.
      if (match[0].length === 0) globalPattern.lastIndex++;
    }
  }

  return results;
}

/** Convenience helper for the content-QA pipeline: true if any claim in the
 *  text is currently unsupported and must block publish. */
export function hasBlockingClaims(brandId: string, text: string, locationId?: string): boolean {
  return checkClaims(brandId, text, locationId).some(r => r.status === 'BLOCKED_UNVERIFIED');
}

export interface HardEnforcementResult {
  pass: boolean;
  results: ClaimCheckResult[];
  blocked: ClaimCheckResult[];
  supported: ClaimCheckResult[];
  persisted_fact_links: number;
}

/**
 * Hard enforcement entry point for the article pipeline's FACT_QA step
 * (spec: "every claim in generated article text relating to
 * menu/price/hours/address/phone/promotion/ingredients/preparation/awards/
 * freshness/location/reservation/delivery/takeout must resolve to one or
 * more VERIFIED fact IDs"). Runs checkClaims(), and — unlike checkClaims()
 * itself, which is read-only — persists every SUPPORTED_* claim's
 * claim->fact mapping into seo_article_facts so the article's evidence trail
 * is queryable after the fact. Returns `pass: false` if any claim in the
 * text is BLOCKED_UNVERIFIED; the caller (FACT_QA step) must not advance
 * the pipeline past this step when `pass` is false.
 */
export function checkClaimsHardEnforcement(
  brandId: string,
  contentId: string,
  text: string,
  locationId?: string,
): HardEnforcementResult {
  const results = checkClaims(brandId, text, locationId);
  const blocked = results.filter(r => r.status === 'BLOCKED_UNVERIFIED');
  const supported = results.filter(r => r.status !== 'BLOCKED_UNVERIFIED');

  const persisted = persistClaimFactMappings(contentId, supported);

  return {
    pass: blocked.length === 0,
    results,
    blocked,
    supported,
    persisted_fact_links: persisted,
  };
}

/**
 * Persists claim -> fact mappings into seo_article_facts for every result
 * that has a supporting_fact_id. Idempotent per (content_id, fact_id,
 * claim_text) — re-running FACT_QA on a retry does not duplicate rows.
 */
export function persistClaimFactMappings(contentId: string, results: ClaimCheckResult[]): number {
  const db = getSeoDb();
  let count = 0;
  for (const r of results) {
    if (!r.supporting_fact_id) continue;
    const existing = db.prepare(
      'SELECT id FROM seo_article_facts WHERE content_id = ? AND fact_id = ? AND claim_text = ?',
    ).get(contentId, r.supporting_fact_id, r.claim_text) as { id: string } | undefined;
    if (existing) continue;
    db.prepare(`
      INSERT INTO seo_article_facts (id, content_id, fact_id, claim_text)
      VALUES (?, ?, ?, ?)
    `).run(seoId('af'), contentId, r.supporting_fact_id, r.claim_text);
    count++;
  }
  return count;
}
