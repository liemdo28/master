/**
 * SEO Keyword Research — deterministic keyword discovery.
 * Generates candidate keywords from real business data (brand name, cuisine,
 * active locations) combined with common intent modifiers. No third-party
 * keyword-volume API involved — that's explicitly out of scope. Any
 * "demand"/"difficulty" figures produced here are documented heuristic
 * estimates (see heuristicDemand/heuristicDifficulty below), never presented
 * as real search-volume data.
 */

import { getBrandById, getActiveLocationsForBrand, type BrandRecord, type LocationRecord } from '../brand-config';
import { normalizeKeyword, tokenize } from './keyword-normalizer';
import { classifySearchIntent } from './search-intent-classifier';
import { mapKeywordToLocation } from './location-keyword-mapper';
import { insertKeyword, findByNormalized, type KeywordRecord } from './keyword-store';

const INTENT_MODIFIERS = [
  'menu', 'hours', 'delivery', 'order online', 'reservations', 'takeout',
  'catering', 'near me', 'best', 'reviews', 'happy hour', 'phone number',
];

function generateCandidates(brand: BrandRecord, locations: LocationRecord[], seedTerms: string[]): string[] {
  const cuisine = brand.cuisine || brand.industry || 'restaurant';
  const candidates = new Set<string>();

  candidates.add(brand.name);
  candidates.add(`${brand.name} menu`);
  candidates.add(`${brand.name} hours`);
  candidates.add(`${brand.name} near me`);
  candidates.add(`${brand.name} reservations`);
  candidates.add(`${cuisine} restaurant near me`);
  candidates.add(`best ${cuisine} restaurant`);
  candidates.add(`${cuisine} delivery`);
  candidates.add(`${cuisine} takeout`);
  candidates.add(`${cuisine} catering`);

  for (const loc of locations) {
    const locLabel = loc.short_name || loc.name;
    if (!locLabel) continue;
    candidates.add(`${brand.name} ${locLabel}`);
    candidates.add(`${cuisine} restaurant in ${locLabel}`);
    candidates.add(`${cuisine} delivery ${locLabel}`);
    candidates.add(`best ${cuisine} restaurant in ${locLabel}`);
    candidates.add(`${brand.name} ${locLabel} hours`);
  }

  for (const seedRaw of seedTerms) {
    const seed = seedRaw.trim();
    if (!seed) continue;
    candidates.add(seed);
    for (const mod of INTENT_MODIFIERS) candidates.add(`${seed} ${mod}`);
    for (const loc of locations) {
      const locLabel = loc.short_name || loc.name;
      if (locLabel) candidates.add(`${seed} ${locLabel}`);
    }
  }

  return Array.from(candidates).filter(Boolean);
}

/**
 * Heuristic demand estimate (1-100), NOT a real search-volume figure.
 * Signal used: shorter/more generic keywords score higher; branded and
 * hyper-local variants score lower (assumed narrower reach). This is a
 * documented placeholder for real keyword-volume data, which is out of
 * scope for this build.
 */
function heuristicDemand(normalized: string, intent: string): number {
  const tokenCount = tokenize(normalized).length;
  let score = Math.max(10, 100 - tokenCount * 12);
  if (intent === 'branded') score -= 20;
  if (intent === 'local') score -= 10;
  return Math.max(5, Math.min(100, Math.round(score)));
}

/**
 * Heuristic difficulty estimate (1-100), NOT derived from real SERP or
 * backlink competitiveness data. Signal used: generic superlative language
 * ("best", "top") assumed more competitive; branded/local terms assumed
 * easier to rank for.
 */
function heuristicDifficulty(normalized: string, intent: string): number {
  let score = 40;
  if (/\bbest\b|\btop\b/.test(normalized)) score += 25;
  if (intent === 'branded') score -= 25;
  if (intent === 'local') score -= 10;
  return Math.max(5, Math.min(95, Math.round(score)));
}

function menuRelevance(normalized: string): number {
  return /\bmenu\b|\bdish\b|\bsushi\b|\bramen\b|\bappetizer/i.test(normalized) ? 0.8 : 0.1;
}

export interface DiscoveredKeyword {
  keyword: KeywordRecord;
  location_match_type: string;
}

export interface DiscoveryResult {
  brand_id: string;
  candidates_generated: number;
  created: DiscoveredKeyword[];
  skipped_existing: number;
}

/**
 * Generate + persist candidate keywords for a brand. Skips any candidate
 * whose normalized form already exists for the brand (any status) so
 * repeated discovery runs don't create duplicate rows.
 */
export function discoverKeywords(brandId: string, seedTerms: string[] = []): DiscoveryResult {
  const brand = getBrandById(brandId);
  if (!brand) throw new Error(`brand not found: ${brandId}`);

  const locations = getActiveLocationsForBrand(brandId);
  const brandNames = [brand.name].filter(Boolean);
  const locationNames = locations.flatMap(l => [l.name, l.short_name].filter((v): v is string => !!v));

  const candidates = generateCandidates(brand, locations, seedTerms);
  const created: DiscoveredKeyword[] = [];
  let skipped = 0;

  for (const candidate of candidates) {
    const normalized = normalizeKeyword(candidate);
    if (!normalized) continue;
    if (findByNormalized(brandId, normalized).length > 0) { skipped++; continue; }

    const intentResult = classifySearchIntent(candidate, { brandNames, locationNames });
    const locationMapping = mapKeywordToLocation(brandId, candidate);
    const targetLocationIds = locationMapping.match_type === 'explicit'
      ? [locationMapping.location_id!]
      : locationMapping.match_type === 'generic_local'
        ? [null] // generic local terms are stored brand-wide (location_id null); caller can fan out per-location later
        : [null];

    for (const locationId of targetLocationIds) {
      const record = insertKeyword({
        brand_id: brandId,
        keyword: candidate,
        location_id: locationId,
        search_intent: intentResult.intent,
        funnel_stage: intentResult.intent === 'transactional' ? 'bottom' : intentResult.intent === 'informational' ? 'top' : 'middle',
        estimated_demand: heuristicDemand(normalized, intentResult.intent),
        difficulty_estimate: heuristicDifficulty(normalized, intentResult.intent),
        local_relevance: locationMapping.match_type === 'none' ? 0.1 : locationMapping.match_type === 'generic_local' ? 0.6 : 0.9,
        business_relevance: intentResult.intent === 'branded' ? 1 : 0.6,
        menu_relevance: menuRelevance(normalized),
        conversion_potential: intentResult.intent === 'transactional' ? 0.85 : intentResult.intent === 'commercial' ? 0.5 : 0.25,
        source: 'deterministic_expansion',
      });
      created.push({ keyword: record, location_match_type: locationMapping.match_type });
    }
  }

  return {
    brand_id: brandId,
    candidates_generated: candidates.length,
    created,
    skipped_existing: skipped,
  };
}
