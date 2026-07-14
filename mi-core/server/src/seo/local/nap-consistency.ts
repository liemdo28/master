/**
 * SEO Control Center — Local SEO Engine: NAP (Name/Address/Phone) consistency (spec §17).
 *
 * Compares the structured LocationRecord fields in brand-config.ts (the
 * "website" source of truth) against the most recent seo_gbp_snapshots row
 * for that location (the "GBP" source of truth, written by
 * ../local/gbp-posts.ts::syncGbpSnapshot).
 *
 * Never fabricates a comparison: if no GBP snapshot has ever been captured
 * for this brand+location, this returns `{consistent: null, reason: 'no_gbp_snapshot_yet'}`
 * rather than pretending everything matches.
 */

import { getSeoDb } from '../seo-db';
import { getLocationById, type LocationRecord } from '../brand-config';

export interface NapConflict {
  field: string;
  website_value: unknown;
  gbp_value: unknown;
}

export interface NapConsistencyMatch {
  consistent: true;
  conflicts: [];
  brand_id: string;
  location_id: string;
  gbp_snapshot_id: string;
  gbp_snapshot_captured_at: string;
  fields_compared: string[];
  checked_at: string;
}

export interface NapConsistencyMismatch {
  consistent: false;
  conflicts: NapConflict[];
  brand_id: string;
  location_id: string;
  gbp_snapshot_id: string;
  gbp_snapshot_captured_at: string;
  fields_compared: string[];
  checked_at: string;
}

export interface NapConsistencyUnknown {
  consistent: null;
  reason: 'no_gbp_snapshot_yet' | 'location_not_found';
  brand_id: string;
  location_id: string;
  checked_at: string;
}

export type NapConsistencyResult = NapConsistencyMatch | NapConsistencyMismatch | NapConsistencyUnknown;

interface GbpSnapshotRow {
  id: string;
  captured_at: string;
  brand_id: string;
  location_id: string;
  raw_payload: string | null;
  nap_conflicts: string | null;
}

/** GBP raw_payload shape written by syncGbpSnapshot() in ./gbp-posts.ts */
interface GbpRawPayload {
  address?: string;
  phone?: string;
  website_uri?: string;
  hours?: string;
  [key: string]: unknown;
}

function normalizePhone(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[^\d]/g, '');
}

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/**
 * Field comparators. Each entry maps a human-readable field name to how it
 * reads from the LocationRecord (website side) and the GBP raw_payload
 * (GBP side), plus how to normalize both before comparing. A field is only
 * compared when BOTH sides have a non-empty value — we never claim a
 * conflict against a field GBP never captured.
 */
const FIELD_COMPARATORS: Array<{
  field: string;
  website: (loc: LocationRecord) => unknown;
  gbp: (payload: GbpRawPayload) => unknown;
  normalize: (value: unknown) => string;
}> = [
  { field: 'address', website: (l) => l.address, gbp: (p) => p.address, normalize: normalizeText },
  { field: 'phone', website: (l) => l.phone, gbp: (p) => p.phone, normalize: normalizePhone },
  { field: 'website_url', website: (l) => l.website_url, gbp: (p) => p.website_uri, normalize: normalizeUrl },
  { field: 'hours', website: (l) => l.hours, gbp: (p) => p.hours, normalize: normalizeText },
];

function isUsable(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0 && value !== 'needs_config';
}

export function checkNapConsistency(brandId: string, locationId: string): NapConsistencyResult {
  const checkedAt = new Date().toISOString();
  const location = getLocationById(brandId, locationId);
  if (!location) {
    return { consistent: null, reason: 'location_not_found', brand_id: brandId, location_id: locationId, checked_at: checkedAt };
  }

  const db = getSeoDb();
  const snapshot = db.prepare(`
    SELECT * FROM seo_gbp_snapshots WHERE brand_id = ? AND location_id = ? ORDER BY captured_at DESC LIMIT 1
  `).get(brandId, locationId) as GbpSnapshotRow | undefined;

  if (!snapshot) {
    return { consistent: null, reason: 'no_gbp_snapshot_yet', brand_id: brandId, location_id: locationId, checked_at: checkedAt };
  }

  let payload: GbpRawPayload = {};
  try {
    payload = snapshot.raw_payload ? (JSON.parse(snapshot.raw_payload) as GbpRawPayload) : {};
  } catch {
    payload = {};
  }

  const conflicts: NapConflict[] = [];
  const fieldsCompared: string[] = [];

  for (const c of FIELD_COMPARATORS) {
    const websiteValue = c.website(location);
    const gbpValue = c.gbp(payload);
    if (!isUsable(websiteValue) || !isUsable(gbpValue)) continue; // don't fabricate a comparison for missing data
    fieldsCompared.push(c.field);
    if (c.normalize(websiteValue) !== c.normalize(gbpValue)) {
      conflicts.push({ field: c.field, website_value: websiteValue, gbp_value: gbpValue });
    }
  }

  if (conflicts.length > 0) {
    return {
      consistent: false,
      conflicts,
      brand_id: brandId,
      location_id: locationId,
      gbp_snapshot_id: snapshot.id,
      gbp_snapshot_captured_at: snapshot.captured_at,
      fields_compared: fieldsCompared,
      checked_at: checkedAt,
    };
  }

  return {
    consistent: true,
    conflicts: [],
    brand_id: brandId,
    location_id: locationId,
    gbp_snapshot_id: snapshot.id,
    gbp_snapshot_captured_at: snapshot.captured_at,
    fields_compared: fieldsCompared,
    checked_at: checkedAt,
  };
}
