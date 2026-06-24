#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..', '..');
const brandsPath = path.join(root, 'SEO', 'shared', 'config', 'brands.json');
const locationsPath = path.join(root, 'SEO', 'shared', 'config', 'locations.json');

const allowedBrandStatus = new Set(['active', 'inactive', 'needs_config']);
const allowedLocationStatus = new Set(['active', 'inactive', 'needs_location_config']);
const requiredConnectors = ['gsc', 'ga4', 'gbp'];

function isMissing(v) { return v === undefined || v === null || String(v).trim() === '' || String(v).trim() === 'needs_config'; }
function isUrl(v) { try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; } }
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

const errors = [];
const warnings = [];
const brandsCfg = readJson(brandsPath);
const locsCfg = readJson(locationsPath);
const brands = brandsCfg.brands || [];
const locations = locsCfg.locations || [];

// --- Validate brands ---
const seenBrandIds = new Set();
const seenDomains = new Map();
for (const b of brands) {
  if (!b.brand_id) { errors.push({ type: 'missing_brand_id', brand: b.name || '<unknown>' }); continue; }
  if (seenBrandIds.has(b.brand_id)) errors.push({ type: 'duplicate_brand_id', brand_id: b.brand_id });
  seenBrandIds.add(b.brand_id);
  if (isMissing(b.domain)) errors.push({ type: 'missing_brand_domain', brand_id: b.brand_id });
  else if (!isUrl(b.domain)) errors.push({ type: 'invalid_brand_domain', brand_id: b.brand_id, domain: b.domain });
  else {
    const d = String(b.domain).toLowerCase().replace(/\/$/, '');
    if (seenDomains.has(d)) errors.push({ type: 'duplicate_domains', domain: b.domain, brand_ids: [seenDomains.get(d), b.brand_id] });
    seenDomains.set(d, b.brand_id);
  }
  if (!allowedBrandStatus.has(b.status)) errors.push({ type: 'invalid_status', scope: 'brand', brand_id: b.brand_id, status: b.status });
  for (const c of requiredConnectors) {
    const cfg = b.connectors && b.connectors[c];
    if (!cfg) errors.push({ type: 'missing_connector_config', brand_id: b.brand_id, connector: c });
    else if (!['ready', 'needs_config', 'missing_credentials', 'blocked', 'error', 'not_applicable'].includes(cfg.status)) {
      errors.push({ type: 'invalid_connector_status', brand_id: b.brand_id, connector: c, status: cfg.status });
    }
  }
}

// --- Validate locations ---
const locKeySeen = new Set();
const locIdSeen = new Map();
for (const l of locations) {
  const key = `${l.brand_id}|${l.location_id}`;
  if (locKeySeen.has(key)) errors.push({ type: 'duplicate_location', brand_id: l.brand_id, location_id: l.location_id });
  locKeySeen.add(key);
  if (!seenBrandIds.has(l.brand_id)) warnings.push({ type: 'location_orphaned', brand_id: l.brand_id, location_id: l.location_id });
  if (!allowedLocationStatus.has(l.status)) errors.push({ type: 'invalid_status', scope: 'location', brand_id: l.brand_id, location_id: l.location_id, status: l.status });
  if (l.status === 'active') {
    if (isMissing(l.address)) warnings.push({ type: 'missing_address', brand_id: l.brand_id, location_id: l.location_id });
    if (isMissing(l.phone)) warnings.push({ type: 'missing_phone', brand_id: l.brand_id, location_id: l.location_id });
  }
  // Check missing connector IDs for active locations
  if (l.status === 'active') {
    if (isMissing(l.gbp_place_id)) warnings.push({ type: 'missing_gbp_place_id', brand_id: l.brand_id, location_id: l.location_id });
  }
}

// --- Output ---
console.log('=== Brand Config Validation ===');
console.log(`Brands: ${brands.length} | Locations: ${locations.length}`);
console.log(`Errors: ${errors.length} | Warnings: ${warnings.length}`);
if (errors.length) {
  console.log('\nERRORS:');
  for (const e of errors) console.log(`  [ERROR] ${e.type}: ${JSON.stringify(e)}`);
}
if (warnings.length) {
  console.log('\nWARNINGS:');
  for (const w of warnings) console.log(`  [WARN] ${w.type}: ${JSON.stringify(w)}`);
}
if (!errors.length && !warnings.length) {
  console.log('\nAll checks passed.');
}
process.exit(errors.length > 0 ? 1 : 0);
