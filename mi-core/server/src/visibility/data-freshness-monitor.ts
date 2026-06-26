/**
 * Data Freshness Monitor — single view for Dev3 burn-in support.
 * Reports real cache/registry timestamps only; missing data stays missing.
 */

import fs from 'fs';
import path from 'path';
import { connectorRegistry } from './connector-registry';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const MASTER_DIR = path.dirname(GLOBAL_DIR);
const CORE_LOCAL_DIR = path.join(MASTER_DIR, 'mi-core', '.local-agent-global');
const REPORT_PATH = path.join(GLOBAL_DIR, 'visibility', 'data-freshness.json');

export type FreshnessState = 'fresh' | 'degraded' | 'stale' | 'missing' | 'error';

export interface FreshnessSource {
  source: string;
  status: FreshnessState;
  connector_id?: string;
  connector_health?: string;
  auth_status?: string;
  last_sync: string | null;
  last_synced_at: string | null;
  age_minutes: number | null;
  threshold_minutes: number;
  freshness_score: number;
  stale: boolean;
  error: string | null;
  error_state: string | null;
  evidence_path?: string;
}

export interface FreshnessReport {
  generated_at: string;
  overall_status: FreshnessState;
  sources: FreshnessSource[];
  stale_count: number;
  missing_count: number;
  error_count: number;
  no_hallucination_guardrail: string;
}

const SOURCE_CONFIG: Array<{
  source: string;
  connector_id?: string;
  cache_path?: string;
  timestamp_fields?: string[];
  threshold_minutes: number;
}> = [
  { source: 'Gmail', connector_id: 'gmail', cache_path: 'visibility/gmail/data.json', timestamp_fields: ['synced_at'], threshold_minutes: 120 },
  { source: 'Calendar', connector_id: 'google-calendar', cache_path: 'visibility/google-calendar/data.json', timestamp_fields: ['synced_at'], threshold_minutes: 120 },
  { source: 'Drive', connector_id: 'google-drive', cache_path: 'visibility/google-drive/data.json', timestamp_fields: ['synced_at'], threshold_minutes: 240 },
  { source: 'Sheets', connector_id: 'google-sheets', cache_path: 'visibility/google-sheets/data.json', timestamp_fields: ['synced_at'], threshold_minutes: 240 },
  { source: 'Asana', connector_id: 'asana', cache_path: 'visibility/asana/data.json', timestamp_fields: ['synced_at'], threshold_minutes: 240 },
  { source: 'Health', connector_id: 'health-export', cache_path: 'visibility/health/data.json', timestamp_fields: ['imported_at', 'synced_at', 'generated_at'], threshold_minutes: 1440 },
  { source: 'Website bakudanramen.com', connector_id: 'website-bakudan', cache_path: 'visibility/websites/bakudan/data.json', timestamp_fields: ['synced_at'], threshold_minutes: 1440 },
  { source: 'Website rawsushibar.com', connector_id: 'website-raw', cache_path: 'visibility/websites/raw/data.json', timestamp_fields: ['synced_at'], threshold_minutes: 1440 },
  { source: 'QuickBooks', connector_id: 'quickbooks-runtime', cache_path: 'visibility/quickbooks/data.json', timestamp_fields: ['generated_at', 'last_sync_timestamp'], threshold_minutes: 1440 },
  { source: 'Work Orders', cache_path: 'work-orders', threshold_minutes: 2880 },
  { source: 'Graph', cache_path: 'graph', threshold_minutes: 1440 },
  { source: 'Memory', cache_path: 'operational-memory', threshold_minutes: 1440 },
];

function readJson(filePath: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function resolveEvidencePath(relativePath?: string): string | undefined {
  if (!relativePath) return undefined;
  const candidates = [path.join(GLOBAL_DIR, relativePath), path.join(CORE_LOCAL_DIR, relativePath)];
  const existing = candidates.filter(p => fs.existsSync(p));
  if (!existing.length) return candidates[0];
  return existing
    .map(p => ({ path: p, ts: Date.parse(newestMtime(p) || '') || 0 }))
    .sort((a, b) => b.ts - a.ts)[0].path;
}

function newestMtime(targetPath: string): string | null {
  try {
    const stat = fs.statSync(targetPath);
    if (stat.isFile()) return stat.mtime.toISOString();
    const files = fs.readdirSync(targetPath).map(name => path.join(targetPath, name));
    let newest = stat.mtimeMs;
    for (const file of files) {
      try {
        newest = Math.max(newest, fs.statSync(file).mtimeMs);
      } catch {
        // Ignore unreadable child files and keep scanning.
      }
    }
    return new Date(newest).toISOString();
  } catch {
    return null;
  }
}

function pickTimestamp(data: any, fields: string[] = []): string | null {
  for (const field of fields) {
    const value = data?.[field];
    if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value;
  }
  return null;
}

function classify(lastSyncedAt: string | null, thresholdMinutes: number, error: string | null): Pick<FreshnessSource, 'status' | 'age_minutes'> {
  if (error === 'Connector is offline') return { status: 'error', age_minutes: null };
  if (!lastSyncedAt) return { status: 'missing', age_minutes: null };
  const age = Math.max(0, Math.round((Date.now() - new Date(lastSyncedAt).getTime()) / 60_000));
  if (error) return { status: 'degraded', age_minutes: age };
  return { status: age <= thresholdMinutes ? 'fresh' : 'stale', age_minutes: age };
}

function freshnessScore(ageMinutes: number | null, thresholdMinutes: number, hasError: boolean): number {
  if (hasError && ageMinutes === null) return 0;
  if (ageMinutes === null) return 0;
  if (ageMinutes <= 0) return 100;
  const base = Math.max(0, Math.min(100, Math.round(100 - (ageMinutes / thresholdMinutes) * 100)));
  return hasError ? Math.min(base, 75) : base;
}

export function generateDataFreshnessReport(): FreshnessReport {
  const registry = connectorRegistry.getAll();
  const sources = SOURCE_CONFIG.map(config => {
    const connector = config.connector_id
      ? registry.find(c => c.connector_id === config.connector_id)
      : undefined;
    const evidencePath = resolveEvidencePath(config.cache_path);
    const data = evidencePath && fs.existsSync(evidencePath) && fs.statSync(evidencePath).isFile()
      ? readJson(evidencePath)
      : null;
    const cacheTimestamp = data ? pickTimestamp(data, config.timestamp_fields) : null;
    const fileTimestamp = evidencePath ? newestMtime(evidencePath) : null;
    const lastSyncedAt = connector?.last_sync || cacheTimestamp || fileTimestamp;
    const error = connector?.health_status === 'offline'
      ? 'Connector is offline'
      : connector?.health_status === 'degraded'
        ? 'Connector health is degraded'
        : null;
    const state = classify(lastSyncedAt, config.threshold_minutes, error);
    const score = freshnessScore(state.age_minutes, config.threshold_minutes, !!error);
    return {
      source: config.source,
      status: state.status,
      connector_id: config.connector_id,
      connector_health: connector?.health_status,
      auth_status: connector?.auth_status,
      last_sync: lastSyncedAt,
      last_synced_at: lastSyncedAt,
      age_minutes: state.age_minutes,
      threshold_minutes: config.threshold_minutes,
      freshness_score: score,
      stale: state.status === 'stale' || state.status === 'missing' || state.status === 'error',
      error,
      error_state: error,
      evidence_path: evidencePath,
    };
  });

  const staleCount = sources.filter(s => s.status === 'stale').length;
  const missingCount = sources.filter(s => s.status === 'missing').length;
  const errorCount = sources.filter(s => s.status === 'error').length;
  const overall: FreshnessState = errorCount > 0 ? 'error' : missingCount > 0 ? 'missing' : staleCount > 0 ? 'stale' : 'fresh';
  const report: FreshnessReport = {
    generated_at: new Date().toISOString(),
    overall_status: overall,
    sources,
    stale_count: staleCount,
    missing_count: missingCount,
    error_count: errorCount,
    no_hallucination_guardrail: 'Em chưa có đủ dữ liệu thật để kết luận.',
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  return report;
}
