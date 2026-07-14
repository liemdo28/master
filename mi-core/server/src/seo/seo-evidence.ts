/**
 * SEO Control Center — evidence helper.
 * Every mutating SEO action must record evidence before/alongside its result.
 * Table: seo_evidence (see seo-db.ts).
 */

import { createHash } from 'crypto';
import { getSeoDb, nowIso, seoId } from './seo-db';

export interface SeoEvidenceInput {
  action_id?: string;
  brand_id?: string;
  category: string;
  summary?: string;
  payload?: unknown;
}

export interface SeoEvidenceRecord {
  id: string;
  created_at: string;
  action_id?: string;
  brand_id?: string;
  category: string;
  summary?: string;
  payload?: string;
  sha256: string;
}

export function recordEvidence(input: SeoEvidenceInput): SeoEvidenceRecord {
  const payloadJson = input.payload !== undefined ? JSON.stringify(input.payload) : undefined;
  const sha256 = createHash('sha256').update(payloadJson ?? input.summary ?? input.category).digest('hex');

  const record: SeoEvidenceRecord = {
    id: seoId('ev'),
    created_at: nowIso(),
    action_id: input.action_id,
    brand_id: input.brand_id,
    category: input.category,
    summary: input.summary,
    payload: payloadJson,
    sha256,
  };

  getSeoDb().prepare(`
    INSERT INTO seo_evidence (id, created_at, action_id, brand_id, category, summary, payload, sha256)
    VALUES (@id, @created_at, @action_id, @brand_id, @category, @summary, @payload, @sha256)
  `).run(record);

  return record;
}

export function getEvidenceById(id: string): SeoEvidenceRecord | undefined {
  return getSeoDb().prepare('SELECT * FROM seo_evidence WHERE id = ?').get(id) as SeoEvidenceRecord | undefined;
}

export function getEvidenceForAction(actionId: string): SeoEvidenceRecord[] {
  return getSeoDb().prepare('SELECT * FROM seo_evidence WHERE action_id = ? ORDER BY created_at ASC').all(actionId) as SeoEvidenceRecord[];
}

export function getEvidenceForBrand(brandId: string, limit = 100): SeoEvidenceRecord[] {
  return getSeoDb().prepare('SELECT * FROM seo_evidence WHERE brand_id = ? ORDER BY created_at DESC LIMIT ?').all(brandId, limit) as SeoEvidenceRecord[];
}
