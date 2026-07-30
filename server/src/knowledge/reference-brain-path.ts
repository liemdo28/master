/**
 * Canonical Path Resolver — US Compliance Reference Brain
 *
 * ALL modules must use this resolver. No hardcoded paths allowed.
 *
 * Resolution order:
 * 1. process.env.MI_REFERENCE_BRAIN_PATH
 * 2. <mi-core-root>/.local-agent-global/reference-brain/us-business-compliance/
 * 3. <workspace-root>/.local-agent-global/reference-brain/us-business-compliance/
 * 4. configured path from settings (GLOBAL_DIR)
 */

import fs from 'fs';
import path from 'path';

const COMPLIANCE_SUB = path.join('.local-agent-global', 'reference-brain', 'us-business-compliance');
const REFERENCE_BRAIN_SUB = path.join('.local-agent-global', 'reference-brain');

// ── Root resolution ──────────────────────────────────────────────────────

/** mi-core project root (3 levels up: knowledge → src → server → mi-core) */
export function getMiCoreRoot(): string {
  // From server/src/knowledge/ → 3 levels up = mi-core/
  // From server/dist/knowledge/ → 3 levels up = mi-core/
  return path.resolve(__dirname, '..', '..', '..');
}

/** Parent workspace root (E:/Project/Master) */
export function getWorkspaceRoot(): string {
  return process.env.MASTER_ROOT || path.resolve(getMiCoreRoot(), '..');
}

/** Reference brain root directory */
export function getReferenceBrainRoot(): string | null {
  const candidates = [
    path.join(getMiCoreRoot(), REFERENCE_BRAIN_SUB),
    path.join(getWorkspaceRoot(), REFERENCE_BRAIN_SUB),
  ];
  if (process.env.GLOBAL_DIR) {
    candidates.push(path.join(process.env.GLOBAL_DIR, 'reference-brain'));
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// ── US Compliance DB paths ───────────────────────────────────────────────

function getUSComplianceCandidates(): string[] {
  const candidates: string[] = [];

  // 1. Explicit env override
  if (process.env.MI_REFERENCE_BRAIN_PATH) {
    candidates.push(process.env.MI_REFERENCE_BRAIN_PATH);
  }

  // 2. mi-core root
  candidates.push(path.join(getMiCoreRoot(), COMPLIANCE_SUB));

  // 3. workspace root
  candidates.push(path.join(getWorkspaceRoot(), COMPLIANCE_SUB));

  // 4. GLOBAL_DIR
  if (process.env.GLOBAL_DIR) {
    candidates.push(path.join(process.env.GLOBAL_DIR, 'reference-brain', 'us-business-compliance'));
  }

  return candidates;
}

let _cachedPath: string | null = null;

/** Resolve US Compliance DB path. Returns null if not found. */
export function getUSComplianceDBPath(): string | null {
  if (_cachedPath && fs.existsSync(_cachedPath)) return _cachedPath;
  for (const p of getUSComplianceCandidates()) {
    if (fs.existsSync(p)) {
      _cachedPath = p;
      return p;
    }
  }
  return null;
}

/** Path to MI_INTEGRATION_MANIFEST.json */
export function getUSComplianceManifestPath(): string | null {
  const root = getUSComplianceDBPath();
  if (!root) return null;
  const p = path.join(root, 'source-catalog', 'MI_INTEGRATION_MANIFEST.json');
  return fs.existsSync(p) ? p : null;
}

/** Path to source_catalog.json */
export function getUSComplianceCatalogPath(): string | null {
  const root = getUSComplianceDBPath();
  if (!root) return null;
  const p = path.join(root, 'source-catalog', 'source_catalog.json');
  return fs.existsSync(p) ? p : null;
}

// ── Health check ─────────────────────────────────────────────────────────

export interface USComplianceDBHealth {
  exists: boolean;
  resolved_path: string;
  checked_paths: string[];
  raw_size_mb: number;
  document_count: number;
  chunk_count: number;
  source_count: number;
  jurisdictions: string[];
  domains: string[];
  catalog_exists: boolean;
  manifest_exists: boolean;
  last_indexed: string;
  searchable: boolean;
  errors: string[];
}

export function checkUSComplianceDBHealth(): USComplianceDBHealth {
  const checked = getUSComplianceCandidates().map(p => p.replace(/\\/g, '/'));
  const errors: string[] = [];

  const base: USComplianceDBHealth = {
    exists: false,
    resolved_path: '',
    checked_paths: checked,
    raw_size_mb: 0,
    document_count: 0,
    chunk_count: 0,
    source_count: 0,
    jurisdictions: [],
    domains: [],
    catalog_exists: false,
    manifest_exists: false,
    last_indexed: '',
    searchable: false,
    errors,
  };

  const resolved = getUSComplianceDBPath();
  if (!resolved) {
    errors.push(`DB not found. Checked: ${checked.join('; ')}`);
    return base;
  }

  const norm = resolved.replace(/\\/g, '/');

  try {
    // Read real stats from db_stats.json
    const statsPath = path.join(resolved, 'reports', 'db_stats.json');
    let rawSizeMb = 0;
    let docCount = 0;
    let chunkCount = 0;
    let sourceCount = 0;
    const jurisdictions: string[] = [];
    let lastBuild = '';

    if (fs.existsSync(statsPath)) {
      const stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
      rawSizeMb = stats.total_raw_size_mb || 0;
      docCount = stats.total_documents || 0;
      chunkCount = stats.total_chunks || 0;
      sourceCount = stats.total_source_records || 0;
      lastBuild = stats.last_build || '';
      if (stats.jurisdiction_counts) {
        for (const j of Object.keys(stats.jurisdiction_counts)) {
          jurisdictions.push(j.replace(/_/g, '-'));
        }
      }
    } else {
      errors.push('db_stats.json not found — falling back to filesystem scan');
      // Fallback: scan directories
      const knownJurisdictions = ['federal', 'california', 'texas', 'stockton', 'san-antonio'];
      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && knownJurisdictions.includes(e.name.toLowerCase())) {
          jurisdictions.push(e.name.toLowerCase());
        }
      }
    }

    // Detect domains from top-level directories
    const domainDirs = ['accounting', 'payroll', 'tax', 'labor-law', 'food-safety',
      'permits', 'restaurant-operations'];
    const domains: string[] = [];
    for (const d of domainDirs) {
      if (fs.existsSync(path.join(resolved, d))) domains.push(d);
    }

    const catalogPath = getUSComplianceCatalogPath();
    const manifestPath = getUSComplianceManifestPath();
    const catalogExists = catalogPath !== null;
    const manifestExists = manifestPath !== null;

    const searchable = (docCount > 0 || jurisdictions.length > 0) && manifestExists;

    return {
      exists: true,
      resolved_path: norm,
      checked_paths: checked,
      raw_size_mb: rawSizeMb,
      document_count: docCount,
      chunk_count: chunkCount,
      source_count: sourceCount,
      jurisdictions: jurisdictions.sort(),
      domains: domains.sort(),
      catalog_exists: catalogExists,
      manifest_exists: manifestExists,
      last_indexed: lastBuild,
      searchable,
      errors,
    };
  } catch (err) {
    errors.push(`Error scanning DB: ${err instanceof Error ? err.message : String(err)}`);
    return { ...base, resolved_path: norm, exists: true, errors };
  }
}

// ── Backward compatibility ───────────────────────────────────────────────
// These aliases allow existing consumers to migrate gradually.

/** @deprecated Use getUSComplianceDBPath() */
export const resolveCompliancePath = getUSComplianceDBPath;

/**
 * Compute READY/PARTIAL/MISSING/ERROR status per CEO directive.
 *
 * Criteria:
 *   READY    : exists=true AND searchable=true AND source_count>0 AND chunk_count>0
 *   PARTIAL  : exists=true but search not wired OR missing catalog
 *   MISSING  : exists=false
 *   ERROR    : exception while checking
 *
 * Returns the full health payload plus { status, resolved_from, raw_size_bytes }.
 */
export function getComplianceDBStatus() {
  let health: USComplianceDBHealth;
  try {
    health = checkUSComplianceDBHealth();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      exists: false,
      resolved_path: '',
      checked_paths: [],
      raw_size_mb: 0,
      document_count: 0,
      chunk_count: 0,
      source_count: 0,
      jurisdictions: [],
      domains: [],
      catalog_exists: false,
      manifest_exists: false,
      last_indexed: '',
      searchable: false,
      errors: [`Exception while checking US Compliance DB: ${msg}`],
      status: 'ERROR' as const,
      resolved_from: 'none',
      raw_size_bytes: 0,
    };
  }

  let status: 'READY' | 'PARTIAL' | 'MISSING' | 'ERROR';
  if (!health.exists) {
    status = 'MISSING';
  } else if (health.errors.some(e => e.toLowerCase().startsWith('error'))) {
    status = 'ERROR';
  } else if (
    health.searchable &&
    health.source_count > 0 &&
    health.chunk_count > 0
  ) {
    status = 'READY';
  } else {
    // exists=true but search not wired OR missing catalog/manifest/counts
    status = 'PARTIAL';
  }

  return {
    ...health,
    status,
    resolved_from: health.resolved_path ? 'resolver' : 'none',
    raw_size_bytes: Math.round(health.raw_size_mb * 1024 * 1024),
  };
}
