/**
 * Phase 34B — Google Business Profile (GBP) Connector
 *
 * Connects to Business Profile Performance API and Business Profile Management API
 * to pull local intent signals: Calls, Directions, Website Clicks, Map Views, etc.
 *
 * Requires OAuth scope: https://www.googleapis.com/auth/business.manage
 * NOTE: This scope was added to SCOPES in google-auth.ts. Existing tokens do NOT
 * include this scope — CEO must re-authorize via http://localhost:4001/api/auth/google/start
 *
 * APIs used:
 *   - https://mybusinessbusinessinformation.googleapis.com/v1/accounts
 *   - https://mybusinessbusinessinformation.googleapis.com/v1/{account}/locations
 *   - https://businessprofileperformance.googleapis.com/v1/locations/{locationId}:getDailyMetrics
 *
 * Snapshots stored to: D:/Project/Master/.local-agent-global/seo/gbp-snapshots.db
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { getAuthedClient, loadTokens } from '../visibility/connectors/google/google-auth';

// ── Config ───────────────────────────────────────────────────────────────────
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const GBP_SCOPE = 'https://www.googleapis.com/auth/business.manage';
const PERFORMANCE_API = 'https://businessprofileperformance.googleapis.com/v1';

// Hardcoded location IDs from business.google.com (store codes)
// Bypasses mybusinessaccountmanagement.googleapis.com (quota=0, needs apply)
const HARDCODED_LOCATIONS = [
  {
    location_id: 'locations/13607740634521426033',
    account_id:  '',
    location_name: 'Bakudan Ramen',
    address: '17619 La Cantera Pkwy 208, San Antonio, TX 78257',
    website_uri: 'https://bakudanramen.com',
    phone: '',
  },
  {
    location_id: 'locations/2490512',
    account_id:  '',
    location_name: 'Raw Sushi Bistro',
    address: '10742 Trinity Pkwy Suite D, Stockton, CA 95219',
    website_uri: 'https://www.rawsushibar.com',
    phone: '',
  },
];

const GBP_METRICS = [
  'CALL_CLICKS',
  'WEBSITE_CLICKS',
  'BUSINESS_DIRECTION_REQUESTS',
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
];

// ── Snapshot DB ──────────────────────────────────────────────────────────────
const SEO_DIR = path.join(GLOBAL_DIR, 'seo');
if (!fs.existsSync(SEO_DIR)) fs.mkdirSync(SEO_DIR, { recursive: true });
const SNAPSHOT_DB_PATH = path.join(SEO_DIR, 'gbp-snapshots.db');

let snapshotDb: Database.Database | null = null;
try {
  snapshotDb = new Database(SNAPSHOT_DB_PATH);
  snapshotDb.pragma('journal_mode = WAL');
  snapshotDb.exec(`
    CREATE TABLE IF NOT EXISTS gbp_daily_metrics (
      location_id   TEXT NOT NULL,
      location_name TEXT,
      metric        TEXT NOT NULL,
      snapshot_date TEXT NOT NULL,
      value         INTEGER DEFAULT 0,
      created_at    TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (location_id, metric, snapshot_date)
    );
    CREATE TABLE IF NOT EXISTS gbp_locations (
      location_id   TEXT PRIMARY KEY,
      account_id    TEXT,
      location_name TEXT,
      address       TEXT,
      website_uri   TEXT,
      phone         TEXT,
      last_synced   TEXT DEFAULT (datetime('now'))
    );
  `);
  console.log('[Mi][GBP] Snapshot DB initialized:', SNAPSHOT_DB_PATH);
} catch (e: any) {
  console.error('[Mi][GBP] Snapshot DB init error:', e.message);
  snapshotDb = null;
}

// ── Scope Check ──────────────────────────────────────────────────────────────

export function hasBizManageScope(): boolean {
  const tokens = loadTokens();
  if (!tokens) return false;
  const scope: string = tokens.scope || '';
  return scope.includes('business.manage');
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getStatus(): Record<string, any> {
  const tokens = loadTokens();
  const hasTokens = !!tokens;
  const hasScope = hasBizManageScope();

  if (!hasTokens) {
    return {
      configured: false,
      status: 'GOOGLE_NOT_AUTHORIZED',
      has_scope: false,
      re_auth_needed: true,
      next_step: 'Visit http://localhost:4001/api/auth/google/start to authorize Google',
      scope_required: GBP_SCOPE,
    };
  }

  if (!hasScope) {
    return {
      configured: false,
      status: 'MISSING_GBP_SCOPE',
      has_scope: false,
      re_auth_needed: true,
      next_step: 'business.manage scope was added to SCOPES. CEO must re-authorize: http://localhost:4001/api/auth/google/start',
      scope_required: GBP_SCOPE,
      current_scopes: tokens.scope || 'unknown',
    };
  }

  return {
    configured: true,
    status: 'GBP_CONNECTOR_READY',
    has_scope: true,
    re_auth_needed: false,
    snapshot_db: SNAPSHOT_DB_PATH,
    next_step: null,
  };
}

// ── HTTP helper using authed client ──────────────────────────────────────────

async function gbpGet(url: string): Promise<any> {
  const client = await getAuthedClient();
  const token = (client.credentials as any).access_token as string;
  if (!token) throw new Error('No access_token in authed client');

  const https = require('https') as typeof import('https');
  const urlObj = new URL(url);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`GBP API ${res.statusCode}: ${JSON.stringify(parsed?.error || parsed)}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`GBP API parse error: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── List Locations ────────────────────────────────────────────────────────────

export async function listLocations(): Promise<any> {
  if (!hasBizManageScope()) {
    return {
      error: 'MISSING_GBP_SCOPE',
      re_auth_needed: true,
      next_step: 'Visit http://localhost:4001/api/auth/google/start',
    };
  }

  // Use hardcoded locations — mybusinessaccountmanagement API has quota=0
  const allLocations = [...HARDCODED_LOCATIONS];

  if (snapshotDb && allLocations.length) {
    const upsert = snapshotDb.prepare(`
      INSERT OR REPLACE INTO gbp_locations (location_id, account_id, location_name, address, website_uri, phone, last_synced)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    const tx = snapshotDb.transaction(() => {
      for (const loc of allLocations) {
        upsert.run(loc.location_id, loc.account_id, loc.location_name, loc.address, loc.website_uri, loc.phone);
      }
    });
    tx();
  }

  return {
    locations: allLocations,
    count: allLocations.length,
    source: 'hardcoded',
  };
}

// ── Daily Metrics ─────────────────────────────────────────────────────────────

export async function getDailyMetrics(
  locationId: string,
  startDate: string,
  endDate: string
): Promise<any> {
  if (!hasBizManageScope()) {
    return {
      error: 'MISSING_GBP_SCOPE',
      re_auth_needed: true,
      next_step: 'Visit http://localhost:4001/api/auth/google/start',
    };
  }

  // locationId format: "locations/XXXXX" → strip prefix for the path
  // The API path uses the full resource name
  const cleanId = locationId.replace(/^locations\//, '');
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

  const metricResults: Record<string, any[]> = {};

  for (const metric of GBP_METRICS) {
    const url = `${PERFORMANCE_API}/locations/${cleanId}:getDailyMetrics` +
      `?dailyMetric=${metric}` +
      `&dailyRange.start_date.year=${startYear}` +
      `&dailyRange.start_date.month=${startMonth}` +
      `&dailyRange.start_date.day=${startDay}` +
      `&dailyRange.end_date.year=${endYear}` +
      `&dailyRange.end_date.month=${endMonth}` +
      `&dailyRange.end_date.day=${endDay}`;
    try {
      const resp = await gbpGet(url);
      metricResults[metric] = resp.timeSeries?.datedValues || [];
    } catch (e: any) {
      metricResults[metric] = [];
      console.warn(`[Mi][GBP] Metric ${metric} for ${locationId}:`, e.message);
    }
  }

  return {
    location_id: locationId,
    start_date: startDate,
    end_date: endDate,
    metrics: metricResults,
  };
}

// ── Store Daily Snapshot ──────────────────────────────────────────────────────

export async function storeDailySnapshot(): Promise<any> {
  if (!snapshotDb) throw new Error('Snapshot DB not initialized');

  if (!hasBizManageScope()) {
    return {
      status: 'SKIPPED',
      reason: 'MISSING_GBP_SCOPE',
      next_step: 'Visit http://localhost:4001/api/auth/google/start',
    };
  }

  const locations = [...HARDCODED_LOCATIONS];
  if (!locations.length) {
    return { status: 'NO_LOCATIONS', detail: 'No GBP locations configured' };
  }

  const today = new Date();
  const endDate = today.toISOString().slice(0, 10);
  const startDay = new Date(today);
  startDay.setDate(today.getDate() - 30);
  const startDate = startDay.toISOString().slice(0, 10);

  const insert = snapshotDb.prepare(`
    INSERT OR REPLACE INTO gbp_daily_metrics (location_id, location_name, metric, snapshot_date, value)
    VALUES (?, ?, ?, ?, ?)
  `);

  let totalRows = 0;

  for (const loc of locations) {
    const metricsData = await getDailyMetrics(loc.location_id, startDate, endDate);
    if (metricsData.error) continue;

    const tx = snapshotDb.transaction(() => {
      for (const [metric, values] of Object.entries(metricsData.metrics as Record<string, any[]>)) {
        for (const dv of values) {
          const d = dv.date;
          const dateStr = d ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}` : endDate;
          const val = parseInt(dv.value || '0', 10) || 0;
          insert.run(loc.location_id, loc.location_name, metric, dateStr, val);
          totalRows++;
        }
      }
    });
    tx();
  }

  return {
    status: 'SNAPSHOTS_STORED',
    locations_synced: locations.length,
    rows_inserted: totalRows,
    snapshot_date: endDate,
  };
}

// ── Snapshot Queries ──────────────────────────────────────────────────────────

export function getStoredMetrics(locationId?: string, days: number = 30): any {
  if (!snapshotDb) return { error: 'Snapshot DB not initialized' };

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const rows = locationId
    ? snapshotDb.prepare(
        'SELECT * FROM gbp_daily_metrics WHERE location_id = ? AND snapshot_date >= ? ORDER BY snapshot_date DESC, metric'
      ).all(locationId, cutoffStr)
    : snapshotDb.prepare(
        'SELECT * FROM gbp_daily_metrics WHERE snapshot_date >= ? ORDER BY location_id, snapshot_date DESC, metric'
      ).all(cutoffStr);

  return { rows, count: rows.length };
}

export function getStoredLocations(): any {
  if (!snapshotDb) return { error: 'Snapshot DB not initialized' };
  const rows = snapshotDb.prepare('SELECT * FROM gbp_locations ORDER BY location_name').all();
  return { rows, count: rows.length };
}
