/**
 * SEO Phase 6.5 — Multi-Brand Config Loader
 * 
 * Loads brand/location config from JSON files. Zero hardcoded brand data.
 * To add Brand N: insert into brands.json + locations.json. No source code change.
 */
import * as fs from 'fs';
import * as path from 'path';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BrandConnectorConfig {
  status: string;           // ready | needs_config | missing_credentials | blocked | error
  credentials_configured: boolean;
  gsc_site_url?: string;
  ga4_property_id?: string;
  gbp_account_id?: string;
  last_run_at?: string;
  last_success_at?: string;
  last_error?: string;
}

export interface BrandRecord {
  brand_id: string;
  name: string;
  domain: string;
  status: string;           // active | inactive | needs_config
  industry?: string;
  cuisine?: string;
  created_at?: string;
  connectors?: Record<string, BrandConnectorConfig>;
  platforms?: Record<string, string>;
}

export interface LocationRecord {
  location_id: string;
  brand_id: string;
  name: string;
  short_name?: string;
  status: string;           // active | inactive | needs_location_config
  address?: string;
  phone?: string;
  website_url?: string;
  menu_url?: string;
  order_url?: string;
  hours?: string;
  geo?: { lat: number; lng: number };
  gbp_place_id?: string;
  categories?: string[];
  apple_status?: string;
  bing_status?: string;
}

export interface ConnectorRunRecord {
  id: string;
  brand_id: string;
  connector_type: string;
  location_id?: string;
  status: string;
  started_at: string;
  completed_at?: string;
  records_processed: number;
  error?: string;
  result?: any;
  source: string;
  raw_payload_path?: string;
}

// ── Config paths ───────────────────────────────────────────────────────────
//
// IMPORTANT: There are TWO copies of brands.json/locations.json on disk:
//   canonical (this module reads):  ${MI_CORE_ROOT}/SEO/shared/config/
//   legacy mirror (do not read):    D:/Project/Master/SEO/shared/config/
// The legacy copy belongs to a separate, older standalone multi-agent SEO
// orchestrator (a different codebase at repo root, not this Express server)
// and is kept in sync FROM the canonical copy by
// SEO/shared/config/sync-from-canonical.js — never the other way around.
// See docs/seo-control-center/SEO_PATH_CONSOLIDATION.md for the full story.

const MI_CORE_ROOT_ENV = process.env.MI_CORE_ROOT;
const MI_CORE_ROOT = MI_CORE_ROOT_ENV || 'D:/Project/Master/mi-core';

// One-time diagnostic: production (ecosystem.config.js) always sets
// MI_CORE_ROOT explicitly. If it's unset here, some ad-hoc/test/dev entry
// point is running without it and silently falling back to the hardcoded
// default below. That default happens to match production today, but any
// future divergence (different machine, different drive letter, a second
// mi-core checkout) would make this module silently read the wrong
// brands.json/locations.json. Warn once so that failure mode is visible
// instead of silent.
if (!MI_CORE_ROOT_ENV) {
  // eslint-disable-next-line no-console
  console.warn(
    `[SEO-Config] WARNING: MI_CORE_ROOT env var is not set. Falling back to ` +
    `hardcoded default "${MI_CORE_ROOT}" for brand/location config. ` +
    `Production sets MI_CORE_ROOT explicitly in ecosystem.config.js — set it ` +
    `explicitly here too (ad-hoc scripts, tests, or a second checkout on a ` +
    `different path/drive would otherwise silently read the wrong config).`
  );
}

const SEO_SHARED = path.join(MI_CORE_ROOT, 'SEO', 'shared', 'config');
const BRANDS_FILE = path.join(SEO_SHARED, 'brands.json');
const LOCATIONS_FILE = path.join(SEO_SHARED, 'locations.json');
const PERSIST_DIR = path.join(MI_CORE_ROOT, 'data', 'seo');
const PERSIST_FILE = path.join(PERSIST_DIR, 'seo-state.json');

// Documented legacy fallback ONLY — the primary path above (${MI_CORE_ROOT}/
// SEO/shared/config/) is never overridden by this. It exists purely so that
// if the canonical file is ever missing (e.g. a fresh checkout that hasn't
// been fully set up yet), this module doesn't hard-fail — it degrades to the
// mirror instead of returning zero brands/locations. In steady state the
// mirror is kept identical to canonical by sync-from-canonical.js, so this
// fallback should rarely, if ever, actually trigger.
const LEGACY_ROOT_SEO_SHARED = 'D:/Project/Master/SEO/shared/config';
const LEGACY_BRANDS_FILE = path.join(LEGACY_ROOT_SEO_SHARED, 'brands.json');
const LEGACY_LOCATIONS_FILE = path.join(LEGACY_ROOT_SEO_SHARED, 'locations.json');

function resolveConfigFile(primary: string, legacy: string): string {
  if (fs.existsSync(primary)) return primary;
  if (fs.existsSync(legacy)) {
    console.warn(
      `[SEO-Config] WARNING: canonical file missing (${primary}). ` +
      `Falling back to legacy mirror (${legacy}). This should self-correct ` +
      `once the canonical file exists — see docs/seo-control-center/SEO_PATH_CONSOLIDATION.md.`
    );
    return legacy;
  }
  return primary; // neither exists — return primary so the existsSync check below reports it missing as usual
}

// ── In-memory stores (file-backed) ─────────────────────────────────────────

let brandsMap = new Map<string, BrandRecord>();
let locationsMap = new Map<string, LocationRecord[]>();  // keyed by brand_id
let allLocations: LocationRecord[] = [];
let connectorRuns: ConnectorRunRecord[] = [];

// ── Load from files ────────────────────────────────────────────────────────

export function loadBrandConfig(): void {
  const brandsFile = resolveConfigFile(BRANDS_FILE, LEGACY_BRANDS_FILE);
  const locationsFile = resolveConfigFile(LOCATIONS_FILE, LEGACY_LOCATIONS_FILE);

  try {
    if (fs.existsSync(brandsFile)) {
      const data = JSON.parse(fs.readFileSync(brandsFile, 'utf8'));
      brandsMap.clear();
      for (const b of (data.brands || []) as BrandRecord[]) {
        brandsMap.set(b.brand_id, b);
      }
    }
  } catch (e) {
    console.log('[SEO-Config] Failed to load brands.json:', (e as Error).message);
  }

  try {
    if (fs.existsSync(locationsFile)) {
      const data = JSON.parse(fs.readFileSync(locationsFile, 'utf8'));
      locationsMap.clear();
      allLocations = [];
      for (const loc of (data.locations || []) as LocationRecord[]) {
        allLocations.push(loc);
        const list = locationsMap.get(loc.brand_id) || [];
        list.push(loc);
        locationsMap.set(loc.brand_id, list);
      }
    }
  } catch (e) {
    console.log('[SEO-Config] Failed to load locations.json:', (e as Error).message);
  }

  // Load connector run history from seo-state.json
  try {
    if (fs.existsSync(PERSIST_FILE)) {
      const state = JSON.parse(fs.readFileSync(PERSIST_FILE, 'utf8'));
      connectorRuns = state.connectorRuns || [];
    }
  } catch { /* ignore */ }

  console.log(`[SEO-Config] Loaded ${brandsMap.size} brands, ${allLocations.length} locations`);
}

// ── Brand queries ──────────────────────────────────────────────────────────

export function getActiveBrands(): BrandRecord[] {
  return Array.from(brandsMap.values()).filter(b => b.status === 'active');
}

export function getAllBrands(): BrandRecord[] {
  return Array.from(brandsMap.values());
}

export function getBrandById(brandId: string): BrandRecord | undefined {
  return brandsMap.get(brandId);
}

export function getBrandDomain(brandId: string): string | null {
  const brand = brandsMap.get(brandId);
  return brand?.domain || null;
}

// ── Location queries ───────────────────────────────────────────────────────

export function getActiveLocationsForBrand(brandId: string): LocationRecord[] {
  return (locationsMap.get(brandId) || []).filter(l => l.status === 'active');
}

export function getAllLocationsForBrand(brandId: string): LocationRecord[] {
  return locationsMap.get(brandId) || [];
}

export function getAllLocations(): LocationRecord[] {
  return allLocations;
}

export function getLocationById(brandId: string, locationId: string): LocationRecord | undefined {
  return allLocations.find(l => l.brand_id === brandId && l.location_id === locationId);
}

// ── Connector runs ─────────────────────────────────────────────────────────

export function addConnectorRun(run: ConnectorRunRecord): void {
  connectorRuns.push(run);
  // Persist to seo-state.json
  try {
    if (fs.existsSync(PERSIST_FILE)) {
      const state = JSON.parse(fs.readFileSync(PERSIST_FILE, 'utf8'));
      state.connectorRuns = (state.connectorRuns || []).slice(-500);
      state.connectorRuns.push(run);
      fs.writeFileSync(PERSIST_FILE, JSON.stringify(state, null, 2));
    }
  } catch { /* best effort */ }
}

export function getConnectorRuns(brandId?: string): ConnectorRunRecord[] {
  if (brandId) {
    return connectorRuns.filter(r => r.brand_id === brandId);
  }
  return connectorRuns;
}

// ── Data source analysis ───────────────────────────────────────────────────

export interface DataSourceSummary {
  brand_id: string;
  source: string;
  record_count: number;
  status: string;
}

export function getDataSourcesByBrand(): DataSourceSummary[] {
  const result: DataSourceSummary[] = [];
  const brands = getActiveBrands();

  for (const brand of brands) {
    const brandRuns = getConnectorRuns(brand.brand_id);
    const sources = ['crawler', 'gsc', 'ga4', 'gbp', 'citation_scan', 'seeded'];
    for (const src of sources) {
      if (src === 'seeded') {
        // All brands have seeded data by default
        const seededCount = allLocations.filter(l => l.brand_id === brand.brand_id).length * 13; // estimate
        result.push({ brand_id: brand.brand_id, source: 'seeded', record_count: seededCount, status: 'available' });
      } else {
        const runs = brandRuns.filter(r => r.connector_type === src);
        const lastRun = runs.length ? runs[runs.length - 1] : null;
        result.push({
          brand_id: brand.brand_id,
          source: src,
          record_count: lastRun?.records_processed || 0,
          status: lastRun?.status || (brand.connectors?.[src]?.status || 'not_run'),
        });
      }
    }
  }
  return result;
}

// ── Health score ───────────────────────────────────────────────────────────

export function computeBrandHealth(brandId: string): { score: number; status: string; details: any } {
  const brand = brandsMap.get(brandId);
  if (!brand) return { score: 0, status: 'not_found', details: {} };

  const locs = getAllLocationsForBrand(brandId);
  const activeLocs = locs.filter(l => l.status === 'active');
  const connectors = brand.connectors || {};
  const readyConnectors = Object.values(connectors).filter(c => c.status === 'ready');
  const totalConnectors = Object.keys(connectors).length || 5;

  const locationScore = locs.length > 0 ? (activeLocs.length / locs.length) * 30 : 0;
  const connectorScore = (readyConnectors.length / totalConnectors) * 40;
  const domainScore = brand.domain && brand.domain !== 'needs_config' ? 30 : 0;
  const score = Math.round(locationScore + connectorScore + domainScore);

  return {
    score,
    status: score >= 80 ? 'healthy' : score >= 50 ? 'degraded' : 'critical',
    details: {
      total_locations: locs.length,
      active_locations: activeLocs.length,
      connectors_ready: readyConnectors.length,
      connectors_total: totalConnectors,
      domain_configured: domainScore > 0,
    },
  };
}

export function computeLocationHealth(brandId: string, locationId: string): { score: number; status: string } {
  const loc = getLocationById(brandId, locationId);
  if (!loc) return { score: 0, status: 'not_found' };

  let score = 0;
  if (loc.address && loc.address !== 'needs_config') score += 25;
  if (loc.phone && loc.phone !== 'needs_config') score += 15;
  if (loc.website_url && loc.website_url !== 'needs_config') score += 20;
  if (loc.gbp_place_id && loc.gbp_place_id !== 'needs_config') score += 20;
  if (loc.hours && loc.hours !== 'needs_config') score += 10;
  if (loc.status === 'active') score += 10;

  return {
    score,
    status: score >= 80 ? 'healthy' : score >= 50 ? 'degraded' : 'critical',
  };
}

// Load on import
loadBrandConfig();
