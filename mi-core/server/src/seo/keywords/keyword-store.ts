/**
 * SEO Keyword Research — persistence layer over seo_keywords.
 * Exact columns as defined in seo-db.ts — no parallel schema.
 */

import { getSeoDb, nowIso, seoId } from '../seo-db';
import { normalizeKeyword } from './keyword-normalizer';
import type { SearchIntent } from './search-intent-classifier';

export type KeywordStatus =
  | 'DISCOVERED'
  | 'REVIEWED'
  | 'APPROVED'
  | 'ASSIGNED'
  | 'ACTIVE'
  | 'RANKING'
  | 'DECLINING'
  | 'CANNIBALIZED'
  | 'PAUSED'
  | 'REJECTED';

const VALID_STATUSES: Set<KeywordStatus> = new Set([
  'DISCOVERED', 'REVIEWED', 'APPROVED', 'ASSIGNED', 'ACTIVE',
  'RANKING', 'DECLINING', 'CANNIBALIZED', 'PAUSED', 'REJECTED',
]);

// Forward transitions this engine considers valid. Kept permissive on
// re-entry (e.g. RANKING -> DECLINING -> RANKING as rankings fluctuate) but
// blocks nonsense jumps like DISCOVERED -> RANKING without ever being
// assigned to a page.
const ALLOWED_TRANSITIONS: Record<KeywordStatus, KeywordStatus[]> = {
  DISCOVERED: ['REVIEWED', 'APPROVED', 'REJECTED'],
  REVIEWED: ['APPROVED', 'REJECTED', 'DISCOVERED'],
  APPROVED: ['ASSIGNED', 'REJECTED', 'PAUSED'],
  ASSIGNED: ['ACTIVE', 'PAUSED', 'REJECTED', 'CANNIBALIZED'],
  ACTIVE: ['RANKING', 'DECLINING', 'PAUSED', 'CANNIBALIZED'],
  RANKING: ['DECLINING', 'PAUSED', 'CANNIBALIZED'],
  DECLINING: ['RANKING', 'PAUSED', 'CANNIBALIZED'],
  CANNIBALIZED: ['REVIEWED', 'PAUSED', 'REJECTED'],
  PAUSED: ['ACTIVE', 'ASSIGNED', 'REVIEWED', 'REJECTED'],
  REJECTED: ['DISCOVERED'],
};

export interface KeywordRecord {
  id: string;
  created_at: string;
  updated_at: string;
  brand_id: string;
  location_id: string | null;
  keyword: string;
  normalized_keyword: string;
  language: string;
  search_intent: SearchIntent | null;
  funnel_stage: string | null;
  estimated_demand: number | null;
  difficulty_estimate: number | null;
  local_relevance: number | null;
  business_relevance: number | null;
  menu_relevance: number | null;
  conversion_potential: number | null;
  seasonal_relevance: string | null;
  target_url: string | null;
  current_ranking: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  avg_position: number | null;
  assigned_content_id: string | null;
  cannibalization_risk: string | null;
  status: KeywordStatus;
  source: string | null;
  evidence_id: string | null;
  last_reviewed_at: string | null;
  deleted_at: string | null;
}

export interface InsertKeywordInput {
  brand_id: string;
  keyword: string;
  location_id?: string | null;
  language?: string;
  search_intent?: SearchIntent | null;
  funnel_stage?: string | null;
  estimated_demand?: number | null;
  difficulty_estimate?: number | null;
  local_relevance?: number | null;
  business_relevance?: number | null;
  menu_relevance?: number | null;
  conversion_potential?: number | null;
  seasonal_relevance?: string | null;
  source?: string | null;
  evidence_id?: string | null;
}

export function insertKeyword(input: InsertKeywordInput): KeywordRecord {
  const db = getSeoDb();
  const now = nowIso();
  const record: KeywordRecord = {
    id: seoId('kw'),
    created_at: now,
    updated_at: now,
    brand_id: input.brand_id,
    location_id: input.location_id ?? null,
    keyword: input.keyword,
    normalized_keyword: normalizeKeyword(input.keyword),
    language: input.language ?? 'en-US',
    search_intent: input.search_intent ?? null,
    funnel_stage: input.funnel_stage ?? null,
    estimated_demand: input.estimated_demand ?? null,
    difficulty_estimate: input.difficulty_estimate ?? null,
    local_relevance: input.local_relevance ?? null,
    business_relevance: input.business_relevance ?? null,
    menu_relevance: input.menu_relevance ?? null,
    conversion_potential: input.conversion_potential ?? null,
    seasonal_relevance: input.seasonal_relevance ?? null,
    target_url: null,
    current_ranking: null,
    impressions: null,
    clicks: null,
    ctr: null,
    avg_position: null,
    assigned_content_id: null,
    cannibalization_risk: null,
    status: 'DISCOVERED',
    source: input.source ?? null,
    evidence_id: input.evidence_id ?? null,
    last_reviewed_at: null,
    deleted_at: null,
  };

  db.prepare(`
    INSERT INTO seo_keywords (
      id, created_at, updated_at, brand_id, location_id, keyword, normalized_keyword,
      language, search_intent, funnel_stage, estimated_demand, difficulty_estimate,
      local_relevance, business_relevance, menu_relevance, conversion_potential,
      seasonal_relevance, target_url, current_ranking, impressions, clicks, ctr,
      avg_position, assigned_content_id, cannibalization_risk, status, source,
      evidence_id, last_reviewed_at, deleted_at
    ) VALUES (
      @id, @created_at, @updated_at, @brand_id, @location_id, @keyword, @normalized_keyword,
      @language, @search_intent, @funnel_stage, @estimated_demand, @difficulty_estimate,
      @local_relevance, @business_relevance, @menu_relevance, @conversion_potential,
      @seasonal_relevance, @target_url, @current_ranking, @impressions, @clicks, @ctr,
      @avg_position, @assigned_content_id, @cannibalization_risk, @status, @source,
      @evidence_id, @last_reviewed_at, @deleted_at
    )
  `).run(record as unknown as Record<string, unknown>);

  return record;
}

export function getKeywordById(id: string): KeywordRecord | undefined {
  return getSeoDb().prepare('SELECT * FROM seo_keywords WHERE id = ? AND deleted_at IS NULL')
    .get(id) as KeywordRecord | undefined;
}

export function listKeywords(brandId: string, opts: { status?: string; locationId?: string } = {}): KeywordRecord[] {
  const db = getSeoDb();
  const clauses = ['brand_id = ?', 'deleted_at IS NULL'];
  const params: unknown[] = [brandId];
  if (opts.status) { clauses.push('status = ?'); params.push(opts.status); }
  if (opts.locationId) { clauses.push('location_id = ?'); params.push(opts.locationId); }
  return db.prepare(`SELECT * FROM seo_keywords WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`)
    .all(...params) as KeywordRecord[];
}

export function findByNormalized(brandId: string, normalized: string): KeywordRecord[] {
  return getSeoDb().prepare(
    'SELECT * FROM seo_keywords WHERE brand_id = ? AND normalized_keyword = ? AND deleted_at IS NULL',
  ).all(brandId, normalized) as KeywordRecord[];
}

export function isValidKeywordStatus(status: string): status is KeywordStatus {
  return VALID_STATUSES.has(status as KeywordStatus);
}

/**
 * Transition a keyword's status, validating both that the target status is
 * one of the ten defined values and that the transition is a reachable edge
 * in ALLOWED_TRANSITIONS. Throws on an invalid status or an illegal jump.
 */
export function setKeywordStatus(id: string, status: string, opts: { markReviewed?: boolean } = {}): KeywordRecord {
  if (!isValidKeywordStatus(status)) {
    throw new Error(`invalid keyword status: ${status}`);
  }
  const existing = getKeywordById(id);
  if (!existing) throw new Error(`keyword not found: ${id}`);

  const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
  if (existing.status !== status && !allowed.includes(status)) {
    throw new Error(`invalid keyword status transition: ${existing.status} -> ${status}`);
  }

  const now = nowIso();
  const db = getSeoDb();
  db.prepare(`
    UPDATE seo_keywords
    SET status = ?, updated_at = ?, last_reviewed_at = CASE WHEN ? THEN ? ELSE last_reviewed_at END
    WHERE id = ?
  `).run(status, now, opts.markReviewed ? 1 : 0, now, id);

  return getKeywordById(id)!;
}

export function assignKeywordTargetUrl(id: string, targetUrl: string, contentId?: string | null): KeywordRecord {
  const db = getSeoDb();
  db.prepare(`
    UPDATE seo_keywords SET target_url = ?, assigned_content_id = ?, updated_at = ? WHERE id = ?
  `).run(targetUrl, contentId ?? null, nowIso(), id);
  return getKeywordById(id)!;
}

export function setCannibalizationRisk(id: string, risk: string | null): void {
  getSeoDb().prepare('UPDATE seo_keywords SET cannibalization_risk = ?, updated_at = ? WHERE id = ?')
    .run(risk, nowIso(), id);
}
