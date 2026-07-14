/**
 * SEO Keyword Research — cannibalization detector (spec §14).
 * Hard, synchronous gate the content pipeline must call before generating an
 * article for a target keyword. Compares the proposed keyword + intent +
 * location against existing seo_keywords.target_url rows and seo_site_pages
 * for the same brand, and returns a decision + reason. Always records
 * evidence of the scan.
 */

import { getSeoDb } from '../seo-db';
import { recordEvidence } from '../seo-evidence';
import { normalizeKeyword, coreTokenJaccard } from './keyword-normalizer';
import { classifySearchIntent, type SearchIntent } from './search-intent-classifier';
import type { KeywordRecord } from './keyword-store';

export type CannibalizationDecision =
  | 'CREATE_NEW'
  | 'UPDATE_EXISTING'
  | 'MERGE_CONTENT'
  | 'CHANGE_KEYWORD'
  | 'CHANGE_INTENT'
  | 'CHANGE_LOCATION'
  | 'REJECT';

export interface CannibalizationInput {
  brand_id: string;
  keyword: string;
  intent?: SearchIntent;
  location_id?: string | null;
  proposed_target_url?: string;
  exclude_keyword_id?: string;
}

export interface CannibalizationResult {
  decision: CannibalizationDecision;
  reason: string;
  conflicting_url?: string;
  conflicting_keyword_id?: string;
  similarity?: number;
  evidence_id: string;
}

const NEAR_DUPLICATE_THRESHOLD = 0.7;
const RELATED_THRESHOLD = 0.4;

interface SitePageRow {
  id: string;
  url: string;
  page_type: string;
  title: string | null;
}

function findRelatedSitePage(brandId: string, normalizedKeyword: string): SitePageRow | undefined {
  const db = getSeoDb();
  const pages = db.prepare(
    `SELECT id, url, page_type, title FROM seo_site_pages WHERE brand_id = ? AND deleted_at IS NULL AND title IS NOT NULL`,
  ).all(brandId) as SitePageRow[];

  for (const page of pages) {
    const titleNorm = normalizeKeyword(page.title || '');
    if (!titleNorm) continue;
    const sim = coreTokenJaccard(normalizedKeyword, titleNorm);
    if (sim >= NEAR_DUPLICATE_THRESHOLD) return page;
  }
  return undefined;
}

/**
 * Synchronous cannibalization gate. Call before creating/publishing content
 * for a target keyword. Returns a decision the caller MUST honor before
 * proceeding to article generation.
 */
export function detectCannibalization(input: CannibalizationInput): CannibalizationResult {
  const db = getSeoDb();
  const normalized = normalizeKeyword(input.keyword);
  const intent = input.intent ?? classifySearchIntent(input.keyword).intent;
  const locationId = input.location_id ?? null;

  const allExistingRows = db.prepare(
    `SELECT * FROM seo_keywords WHERE brand_id = ? AND deleted_at IS NULL
       AND status NOT IN ('REJECTED') ORDER BY created_at ASC`,
  ).all(input.brand_id) as KeywordRecord[];
  const existingRows = input.exclude_keyword_id
    ? allExistingRows.filter(r => r.id !== input.exclude_keyword_id)
    : allExistingRows;

  const exact = existingRows.filter(r => r.normalized_keyword === normalized);

  let decision: CannibalizationDecision = 'CREATE_NEW';
  let reason = 'no existing keyword or page targets this keyword for this brand';
  let conflictingUrl: string | undefined;
  let conflictingKeywordId: string | undefined;
  let similarity: number | undefined;

  const exactSameLocation = exact.find(r => (r.location_id ?? null) === locationId);
  const exactOtherLocation = exact.find(r => (r.location_id ?? null) !== locationId);

  if (exactSameLocation && exactSameLocation.target_url) {
    if (exactSameLocation.search_intent && exactSameLocation.search_intent !== intent) {
      decision = 'CHANGE_INTENT';
      reason = `identical keyword text already targets intent "${exactSameLocation.search_intent}" for this location; ` +
        `pick a different keyword variant or align the proposed intent ("${intent}") with the existing page`;
    } else {
      decision = 'UPDATE_EXISTING';
      reason = 'identical keyword already has a target page for this location — update that page instead of creating a duplicate';
    }
    conflictingUrl = exactSameLocation.target_url;
    conflictingKeywordId = exactSameLocation.id;
    similarity = 1;
  } else if (exactSameLocation && !exactSameLocation.target_url) {
    decision = 'REJECT';
    reason = 'identical keyword already exists in the pipeline for this location (no target page yet) — dedupe instead of creating a second row';
    conflictingKeywordId = exactSameLocation.id;
    similarity = 1;
  } else if (exactOtherLocation && exactOtherLocation.target_url && (intent === 'local' || locationId || exactOtherLocation.location_id)) {
    decision = 'CHANGE_LOCATION';
    reason = 'identical keyword already targets a different location — target the existing location page or change the proposed location assignment';
    conflictingUrl = exactOtherLocation.target_url;
    conflictingKeywordId = exactOtherLocation.id;
    similarity = 1;
  } else {
    // No exact match — look for near-duplicate / related keywords with an
    // assigned target page (same brand, any location) via core-token overlap.
    let best: { row: KeywordRecord; sim: number } | undefined;
    for (const row of existingRows) {
      if (!row.target_url) continue;
      const sim = coreTokenJaccard(normalized, row.normalized_keyword);
      if (!best || sim > best.sim) best = { row, sim };
    }

    if (best && best.sim >= NEAR_DUPLICATE_THRESHOLD) {
      decision = 'MERGE_CONTENT';
      reason = `near-duplicate keyword "${best.row.keyword}" (similarity ${best.sim.toFixed(2)}) already has a target page — ` +
        'merge this topic into that page rather than creating a competing one';
      conflictingUrl = best.row.target_url ?? undefined;
      conflictingKeywordId = best.row.id;
      similarity = best.sim;
    } else if (best && best.sim >= RELATED_THRESHOLD) {
      decision = 'CHANGE_KEYWORD';
      reason = `related keyword "${best.row.keyword}" (similarity ${best.sim.toFixed(2)}) already targets a page — ` +
        'pick a more differentiated keyword variant to avoid overlapping topical intent';
      conflictingUrl = best.row.target_url ?? undefined;
      conflictingKeywordId = best.row.id;
      similarity = best.sim;
    } else {
      // Fall back to checking seo_site_pages titles directly (covers pages
      // that predate keyword tracking / were never linked to a keyword row).
      const page = findRelatedSitePage(input.brand_id, normalized);
      if (page) {
        decision = 'UPDATE_EXISTING';
        reason = `an existing site page ("${page.title}") closely matches this keyword's topic — update that page instead of creating a new one`;
        conflictingUrl = page.url;
      }
    }
  }

  const evidence = recordEvidence({
    brand_id: input.brand_id,
    category: 'cannibalization_scan',
    summary: `${decision}: "${input.keyword}" (${intent}${locationId ? `, location=${locationId}` : ''})`,
    payload: { input: { ...input, intent, location_id: locationId }, decision, reason, conflicting_url: conflictingUrl, conflicting_keyword_id: conflictingKeywordId, similarity },
  });

  return {
    decision,
    reason,
    conflicting_url: conflictingUrl,
    conflicting_keyword_id: conflictingKeywordId,
    similarity,
    evidence_id: evidence.id,
  };
}
