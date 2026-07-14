/**
 * SEO Business Fact Registry (spec §11) — CRUD over seo_business_facts.
 * Every new fact starts UNVERIFIED regardless of what the caller supplies;
 * only verifyFact() (called through the approval-gated route) can promote it.
 */

import { getSeoDb, nowIso, seoId } from '../seo-db';

export type FactStatus =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'CONFLICT'
  | 'EXPIRED'
  | 'LOCATION_SPECIFIC'
  | 'SEASONAL'
  | 'DO_NOT_USE';

const VALID_STATUSES: Set<FactStatus> = new Set([
  'VERIFIED', 'UNVERIFIED', 'CONFLICT', 'EXPIRED', 'LOCATION_SPECIFIC', 'SEASONAL', 'DO_NOT_USE',
]);

export interface BusinessFactRecord {
  id: string;
  created_at: string;
  updated_at: string;
  brand_id: string;
  location_id: string | null;
  category: string;
  field_name: string;
  value: string;
  source: string;
  source_ref: string | null;
  verification_date: string | null;
  expiration_date: string | null;
  verified_by: string | null;
  confidence: number | null;
  usage_restrictions: string | null;
  status: FactStatus;
}

export interface CreateFactInput {
  brand_id: string;
  location_id?: string | null;
  category: string;
  field_name: string;
  value: string;
  source: string;
  source_ref?: string | null;
  expiration_date?: string | null;
  confidence?: number | null;
  usage_restrictions?: string | null;
}

export function createFact(input: CreateFactInput): BusinessFactRecord {
  const db = getSeoDb();
  const now = nowIso();
  const record: BusinessFactRecord = {
    id: seoId('fact'),
    created_at: now,
    updated_at: now,
    brand_id: input.brand_id,
    location_id: input.location_id ?? null,
    category: input.category,
    field_name: input.field_name,
    value: input.value,
    source: input.source,
    source_ref: input.source_ref ?? null,
    verification_date: null,
    expiration_date: input.expiration_date ?? null,
    verified_by: null,
    confidence: input.confidence ?? null,
    usage_restrictions: input.usage_restrictions ?? null,
    // Forced regardless of any status field the caller might try to pass —
    // nothing enters the registry pre-verified.
    status: 'UNVERIFIED',
  };

  db.prepare(`
    INSERT INTO seo_business_facts (
      id, created_at, updated_at, brand_id, location_id, category, field_name, value,
      source, source_ref, verification_date, expiration_date, verified_by, confidence,
      usage_restrictions, status
    ) VALUES (
      @id, @created_at, @updated_at, @brand_id, @location_id, @category, @field_name, @value,
      @source, @source_ref, @verification_date, @expiration_date, @verified_by, @confidence,
      @usage_restrictions, @status
    )
  `).run(record as unknown as Record<string, unknown>);

  return record;
}

export function getFactById(id: string): BusinessFactRecord | undefined {
  return getSeoDb().prepare('SELECT * FROM seo_business_facts WHERE id = ?').get(id) as BusinessFactRecord | undefined;
}

export function listFacts(brandId: string, opts: { status?: string; category?: string; locationId?: string } = {}): BusinessFactRecord[] {
  const db = getSeoDb();
  const clauses = ['brand_id = ?'];
  const params: unknown[] = [brandId];
  if (opts.status) { clauses.push('status = ?'); params.push(opts.status); }
  if (opts.category) { clauses.push('category = ?'); params.push(opts.category); }
  if (opts.locationId) { clauses.push('(location_id = ? OR location_id IS NULL)'); params.push(opts.locationId); }
  return db.prepare(`SELECT * FROM seo_business_facts WHERE ${clauses.join(' AND ')} ORDER BY updated_at DESC`)
    .all(...params) as BusinessFactRecord[];
}

export function isValidFactStatus(status: string): status is FactStatus {
  return VALID_STATUSES.has(status as FactStatus);
}

/** Directly set a fact's status. Used internally once policy-gating has cleared. */
export function setFactStatus(id: string, status: string, opts: { verifiedBy?: string } = {}): BusinessFactRecord {
  if (!isValidFactStatus(status)) throw new Error(`invalid fact status: ${status}`);
  const db = getSeoDb();
  const now = nowIso();
  if (status === 'VERIFIED') {
    db.prepare(`
      UPDATE seo_business_facts
      SET status = ?, updated_at = ?, verification_date = ?, verified_by = ?
      WHERE id = ?
    `).run(status, now, now, opts.verifiedBy ?? 'unknown', id);
  } else {
    db.prepare('UPDATE seo_business_facts SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
  }
  const updated = getFactById(id);
  if (!updated) throw new Error(`fact not found: ${id}`);
  return updated;
}

/** Facts whose expiration_date has passed but are still marked VERIFIED — call
 *  periodically (or lazily before claim checks) to keep the registry honest. */
export function expireStaleFacts(brandId?: string): number {
  const db = getSeoDb();
  const now = nowIso();
  const rows = (brandId
    ? db.prepare(`SELECT id FROM seo_business_facts WHERE brand_id = ? AND status = 'VERIFIED' AND expiration_date IS NOT NULL AND expiration_date < ?`).all(brandId, now)
    : db.prepare(`SELECT id FROM seo_business_facts WHERE status = 'VERIFIED' AND expiration_date IS NOT NULL AND expiration_date < ?`).all(now)
  ) as { id: string }[];
  for (const row of rows) {
    db.prepare(`UPDATE seo_business_facts SET status = 'EXPIRED', updated_at = ? WHERE id = ?`).run(now, row.id);
  }
  return rows.length;
}
