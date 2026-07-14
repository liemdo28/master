/**
 * SEO Control Center — Internal Link Engine: link recommender (spec §15).
 * Recommends 2-5 internal link targets for a content item from its brand's
 * money/location/menu pages, weighted toward the item's location and toward
 * pages that currently have fewer inbound links (so link equity flows to
 * under-linked pages first — see orphan-detector.ts).
 *
 * BRAND ISOLATION — hard requirement (spec §15): a Raw Sushi article must
 * never recommend a Bakudan page, or vice versa. This is enforced in code at
 * two independent points, not just documented:
 *   1. Candidates are pulled exclusively via getPagesForBrand(brand_id, ...),
 *      a query that is itself scoped to brand_id in seo_site_pages.
 *   2. assertBrandIsolation() re-checks every candidate's brand_id against
 *      the requested brand_id and *throws* if anything leaked through —
 *      a runtime invariant, not a comment.
 */

import { getPagesForBrand, type SitePage, type PageType } from './link-registry';
import { getInboundLinkCount } from './orphan-detector';

export interface LinkRecommendationInput {
  brand_id: string;
  location_id?: string | null;
  topic?: string;
  exclude_urls?: string[];
  max_recommendations?: number;
}

export interface LinkRecommendation {
  url: string;
  page_type: PageType;
  title: string | null;
  location_id: string | null;
  inbound_link_count: number;
  score: number;
  reason: string;
}

const RECOMMENDABLE_TYPES: PageType[] = ['money', 'location', 'menu'];

/** Runtime brand-isolation invariant — throws if any candidate page belongs to a different brand. */
export function assertBrandIsolation(pages: SitePage[], brandId: string): void {
  const violation = pages.find(p => p.brand_id !== brandId);
  if (violation) {
    throw new Error(
      `BRAND_ISOLATION_VIOLATION: page ${violation.id} (brand_id=${violation.brand_id}) leaked into ` +
      `link recommendations requested for brand_id=${brandId}. This must never happen — refusing to recommend.`
    );
  }
}

export function recommendInternalLinks(input: LinkRecommendationInput): LinkRecommendation[] {
  const { brand_id, location_id, topic } = input;
  const maxRecs = Math.min(Math.max(input.max_recommendations ?? 5, 2), 5);
  const excludeSet = new Set((input.exclude_urls ?? []).map(u => u.toLowerCase()));

  let candidates: SitePage[] = [];
  for (const pageType of RECOMMENDABLE_TYPES) {
    candidates.push(...getPagesForBrand(brand_id, pageType));
  }

  // Defense-in-depth: re-verify brand isolation even though getPagesForBrand()
  // already scopes by brand_id. If this ever throws, it means the registry
  // query itself is broken — better to fail loudly than silently cross-link brands.
  assertBrandIsolation(candidates, brand_id);

  candidates = candidates.filter(p => !excludeSet.has(p.url.toLowerCase()));

  const scored: LinkRecommendation[] = candidates.map(p => {
    const inbound = getInboundLinkCount(brand_id, p.url);
    let score = 0;
    const reasons: string[] = [];

    if (location_id && p.location_id === location_id) {
      score += 10;
      reasons.push('location match');
    } else if (!p.location_id) {
      score += 3; // brand-wide page (e.g. primary money page) is always somewhat relevant
      reasons.push('brand-wide page');
    }

    if (topic) {
      const topicWords = topic.toLowerCase().split(/\W+/).filter(w => w.length > 2);
      const haystack = `${p.title ?? ''} ${p.url}`.toLowerCase();
      const hits = topicWords.filter(w => haystack.includes(w)).length;
      if (hits > 0) {
        score += hits * 2;
        reasons.push(`topic keyword overlap (${hits})`);
      }
    }

    if (p.page_type === 'money') { score += 4; reasons.push('money page'); }
    else if (p.page_type === 'menu') { score += 2; reasons.push('menu page'); }
    else if (p.page_type === 'location') { score += 2; reasons.push('location page'); }

    // Orphan / low-inbound weighting: pages with fewer existing inbound links
    // get boosted so link equity flows to under-linked pages first.
    const orphanBoost = inbound === 0 ? 6 : Math.max(0, 4 - inbound);
    score += orphanBoost;
    if (inbound === 0) reasons.push('currently orphaned');

    return {
      url: p.url,
      page_type: p.page_type,
      title: p.title ?? null,
      location_id: p.location_id ?? null,
      inbound_link_count: inbound,
      score,
      reason: reasons.join(', ') || 'baseline',
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxRecs);
}
