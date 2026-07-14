/**
 * SEO Keyword Research — location-keyword mapper.
 * Maps a keyword to a specific brand location when the keyword text mentions
 * that location's name/short-name/city, or flags it as "generic-but-local"
 * (assignable to every active location) when it carries local intent but no
 * location-specific token (e.g. "sushi delivery near me").
 */

import { getActiveLocationsForBrand, type LocationRecord } from '../brand-config';
import { normalizeKeyword } from './keyword-normalizer';
import { classifySearchIntent } from './search-intent-classifier';

export type LocationMatchType = 'explicit' | 'generic_local' | 'none';

export interface LocationMapping {
  match_type: LocationMatchType;
  /** Single best-match location_id, set only for 'explicit' matches. */
  location_id: string | null;
  /** All location_ids the keyword could reasonably be assigned to
   *  (one entry for 'explicit', all active locations for 'generic_local'). */
  applicable_location_ids: string[];
  reason: string;
}

/** Extract a plausible city/area token from a free-form address string. */
function cityFromAddress(address?: string): string | null {
  if (!address) return null;
  // Typical "123 Main St, Cityname, ST 12345" — take the second comma-segment.
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[1];
  return null;
}

function locationNameCandidates(loc: LocationRecord): string[] {
  const candidates = [loc.name, loc.short_name, cityFromAddress(loc.address)]
    .filter((v): v is string => !!v && v !== 'needs_config')
    .map(v => normalizeKeyword(v));
  return Array.from(new Set(candidates.filter(Boolean)));
}

/**
 * Map a keyword to a location for the given brand.
 *  - 'explicit': the keyword text contains a location's name/short-name/city.
 *  - 'generic_local': the keyword has local search intent ("near me", etc.)
 *    but no location-specific token — assignable to every active location.
 *  - 'none': no location signal at all (brand-wide / non-local keyword).
 */
export function mapKeywordToLocation(brandId: string, keyword: string): LocationMapping {
  const normalized = normalizeKeyword(keyword);
  const locations = getActiveLocationsForBrand(brandId);

  for (const loc of locations) {
    const candidates = locationNameCandidates(loc);
    const hit = candidates.find(c => c.length > 0 && normalized.includes(c));
    if (hit) {
      return {
        match_type: 'explicit',
        location_id: loc.location_id,
        applicable_location_ids: [loc.location_id],
        reason: `keyword mentions location token "${hit}" matching ${loc.name}`,
      };
    }
  }

  const intent = classifySearchIntent(keyword, {
    locationNames: locations.flatMap(locationNameCandidates),
  });

  if (intent.intent === 'local' && locations.length > 0) {
    return {
      match_type: 'generic_local',
      location_id: null,
      applicable_location_ids: locations.map(l => l.location_id),
      reason: 'keyword has local search intent but no specific location token — assignable to all active locations',
    };
  }

  return {
    match_type: 'none',
    location_id: null,
    applicable_location_ids: [],
    reason: 'no location signal found in keyword',
  };
}
