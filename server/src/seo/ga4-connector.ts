/**
 * Phase 33 — GA4 Revenue Intelligence Connector
 * 
 * Live Google Analytics 4 Data API v1 connector.
 * Uses shared OAuth tokens (same flow as GSC/Gmail).
 * 
 * Metrics: users, sessions, pageviews, engagementRate, conversions
 * Dimensions: date, pagePath, sessionDefaultChannelGroup
 * 
 * Requires GA4 property ID in env: GA4_PROPERTY_ID
 * Requires Google OAuth credentials (same as GSC).
 */
import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

// ── Config ──────────────────────────────────────────────────────────────────
const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const TOKEN_PATH = path.join(GLOBAL_DIR, 'visibility', 'google-tokens.json');
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4001/api/auth/google/callback';
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '';
const GA4_BAKUDAN_PROPERTY_ID = process.env.GA4_BAKUDAN_PROPERTY_ID || '';
const GA4_RAWSUSHI_PROPERTY_ID = process.env.GA4_RAWSUSHI_PROPERTY_ID || '';

const GA4_PROPERTIES: Record<string, string> = {
  bakudan: GA4_BAKUDAN_PROPERTY_ID,
  rawsushi: GA4_RAWSUSHI_PROPERTY_ID,
  default: GA4_PROPERTY_ID || GA4_BAKUDAN_PROPERTY_ID,
};

// Per-brand property IDs (numeric format: properties/XXXXXXXXX)
const BRAND_PROPERTY_IDS: Record<string, string> = {
  bakudan:   process.env.GA4_PROPERTY_ID_BAKUDAN || '',
  raw_sushi: process.env.GA4_PROPERTY_ID_RAW     || '',
};

export function getPropertyIdForBrand(brandId: string): string {
  return BRAND_PROPERTY_IDS[brandId] || GA4_PROPERTY_ID;
}

// ── Snapshot DB ─────────────────────────────────────────────────────────────
const DATA_DIR = path.join(GLOBAL_DIR, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const SNAPSHOT_DB_PATH = path.join(DATA_DIR, 'ga4-snapshots.db');

let snapshotDb: Database.Database;
try {
  snapshotDb = new Database(SNAPSHOT_DB_PATH);
  snapshotDb.pragma('journal_mode = WAL');
  snapshotDb.exec(`
    CREATE TABLE IF NOT EXISTS ga4_daily_traffic (
      snapshot_date TEXT NOT NULL,
      users INTEGER DEFAULT 0,
      sessions INTEGER DEFAULT 0,
      pageviews INTEGER DEFAULT 0,
      engagement_rate REAL DEFAULT 0,
      conversions REAL DEFAULT 0,
      bounce_rate REAL DEFAULT 0,
      avg_session_duration REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (snapshot_date)
    );
    CREATE TABLE IF NOT EXISTS ga4_daily_pages (
      snapshot_date TEXT NOT NULL,
      page_path TEXT NOT NULL,
      pageviews INTEGER DEFAULT 0,
      users INTEGER DEFAULT 0,
      avg_time_on_page REAL DEFAULT 0,
      bounce_rate REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (snapshot_date, page_path)
    );
    CREATE TABLE IF NOT EXISTS ga4_daily_conversions (
      snapshot_date TEXT NOT NULL,
      event_name TEXT NOT NULL,
      conversions REAL DEFAULT 0,
      users INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (snapshot_date, event_name)
    );
    CREATE TABLE IF NOT EXISTS ga4_daily_channels (
      snapshot_date TEXT NOT NULL,
      channel TEXT NOT NULL,
      sessions INTEGER DEFAULT 0,
      users INTEGER DEFAULT 0,
      conversions REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (snapshot_date, channel)
    );
  `);
  console.log('[Mi][GA4] Snapshot DB initialized:', SNAPSHOT_DB_PATH);
} catch (e: any) {
  console.error('[Mi][GA4] Snapshot DB init error:', e.message);
  snapshotDb = null as any;
}

// ── OAuth Auth ──────────────────────────────────────────────────────────────
function getAuth() {
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    auth.setCredentials(tokens);
  }
  return auth;
}

export function isConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && fs.existsSync(TOKEN_PATH) && (GA4_PROPERTY_ID || GA4_BAKUDAN_PROPERTY_ID));
}

export function getPropertyId(): string {
  return GA4_PROPERTY_ID;
}

export function getStatus() {
  const hasClientId = !!CLIENT_ID;
  const hasClientSecret = !!CLIENT_SECRET;
  const hasTokens = fs.existsSync(TOKEN_PATH);
  const hasPropertyId = !!(GA4_PROPERTY_ID || GA4_BAKUDAN_PROPERTY_ID);
  
  let configured = false;
  let status = 'NOT_CONFIGURED';
  let nextStep = '';
  
  if (!hasClientId || !hasClientSecret) {
    status = 'MISSING_GOOGLE_CREDENTIALS';
    nextStep = 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env';
  } else if (!hasTokens) {
    status = 'GOOGLE_NOT_AUTHORIZED';
    nextStep = 'Visit http://localhost:4001/api/auth/google/start to authorize';
  } else if (!hasPropertyId) {
    status = 'MISSING_GA4_PROPERTY_ID';
    nextStep = 'Set GA4_PROPERTY_ID in .env (e.g., properties/123456789)';
  } else {
    configured = true;
    status = 'GA4_CONNECTOR_READY';
  }
  
  return {
    configured,
    status,
    has_client_id: hasClientId,
    has_client_secret: hasClientSecret,
    has_tokens: hasTokens,
    has_property_id: hasPropertyId,
    property_id: GA4_PROPERTY_ID || GA4_BAKUDAN_PROPERTY_ID || null,
    properties: { bakudan: GA4_BAKUDAN_PROPERTY_ID, rawsushi: GA4_RAWSUSHI_PROPERTY_ID },
    snapshot_db: SNAPSHOT_DB_PATH,
    next_step: nextStep || null,
  };
}

// ── GA4 Data API v1 Calls ───────────────────────────────────────────────────

async function runReport(
  dateRanges: Array<{ startDate: string; endDate: string }>,
  dimensions: string[],
  metrics: string[],
  dimensionFilter?: any,
  limit: number = 1000,
  orderBys?: any[],
  propertyId?: string
): Promise<any> {
  const auth = getAuth();
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth });
  const property = propertyId || GA4_PROPERTY_ID;

  const requestBody: any = {
    dateRanges,
    dimensions: dimensions.map(d => ({ name: d })),
    metrics: metrics.map(m => ({ name: m })),
    limit,
  };

  if (dimensionFilter) {
    requestBody.dimensionFilter = dimensionFilter;
  }

  if (orderBys && orderBys.length > 0) {
    requestBody.orderBys = orderBys;
  }

  const response = await analyticsData.properties.runReport({
    property,
    requestBody,
  });

  return response.data;
}

function parseRows(rows: any[] | null | undefined): any[] {
  if (!rows) return [];
  return rows.map((row: any) => {
    const result: Record<string, any> = {};
    row.dimensionValues?.forEach((dv: any, i: number) => {
      result[`dim_${i}`] = dv.value || '';
    });
    row.metricValues?.forEach((mv: any, i: number) => {
      result[`metric_${i}`] = parseFloat(mv.value || '0') || 0;
    });
    return result;
  });
}

function dateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

// ── Public API Methods ──────────────────────────────────────────────────────

/**
 * Get traffic overview: users, sessions, pageviews, engagement rate
 */
export async function getTrafficOverview(days: number = 30): Promise<any> {
  const range = dateRange(days);
  
  const response = await runReport(
    [{ startDate: range.startDate, endDate: range.endDate }],
    ['date'],
    [
      'activeUsers',
      'sessions',
      'screenPageViews',
      'engagementRate',
      'bounceRate',
      'averageSessionDuration',
      'conversions',
    ],
    undefined,
    1000,
    [{ dimension: { dimensionName: 'date' }, desc: true }]
  );
  
  const rows = parseRows(response.rows || []);
  
  return {
    period: { startDate: range.startDate, endDate: range.endDate },
    total: {
      users: rows.reduce((sum: number, r: any) => sum + r.metric_0, 0),
      sessions: rows.reduce((sum: number, r: any) => sum + r.metric_1, 0),
      pageviews: rows.reduce((sum: number, r: any) => sum + r.metric_2, 0),
      avg_engagement_rate: rows.length > 0 
        ? Math.round((rows.reduce((sum: number, r: any) => sum + r.metric_3, 0) / rows.length) * 1000) / 10
        : 0,
      avg_bounce_rate: rows.length > 0
        ? Math.round((rows.reduce((sum: number, r: any) => sum + r.metric_4, 0) / rows.length) * 1000) / 10
        : 0,
      avg_session_duration: rows.length > 0
        ? Math.round(rows.reduce((sum: number, r: any) => sum + r.metric_5, 0) / rows.length * 10) / 10
        : 0,
      conversions: Math.round(rows.reduce((sum: number, r: any) => sum + r.metric_6, 0) * 100) / 100,
    },
    daily: rows.map((r: any) => ({
      date: r.dim_0,
      users: r.metric_0,
      sessions: r.metric_1,
      pageviews: r.metric_2,
      engagement_rate: Math.round(r.metric_3 * 1000) / 10,
      bounce_rate: Math.round(r.metric_4 * 1000) / 10,
      avg_session_duration: Math.round(r.metric_5 * 10) / 10,
      conversions: Math.round(r.metric_6 * 100) / 100,
    })),
  };
}

/**
 * Get traffic by channel (source/medium)
 */
export async function getTrafficByChannel(days: number = 30): Promise<any> {
  const range = dateRange(days);
  
  const response = await runReport(
    [{ startDate: range.startDate, endDate: range.endDate }],
    ['sessionDefaultChannelGroup'],
    ['sessions', 'activeUsers', 'conversions'],
    undefined,
    20,
    [{ metric: { metricName: 'sessions' }, desc: true }]
  );
  
  const rows = parseRows(response.rows || []);
  
  return {
    period: { startDate: range.startDate, endDate: range.endDate },
    channels: rows.map((r: any) => ({
      channel: r.dim_0,
      sessions: r.metric_0,
      users: r.metric_1,
      conversions: Math.round(r.metric_2 * 100) / 100,
    })),
  };
}

/**
 * Get top pages by pageviews
 */
export async function getTopPages(days: number = 30): Promise<any> {
  const range = dateRange(days);
  
  const response = await runReport(
    [{ startDate: range.startDate, endDate: range.endDate }],
    ['pagePath'],
    ['screenPageViews', 'activeUsers', 'averageSessionDuration', 'bounceRate'],
    undefined,
    50,
    [{ metric: { metricName: 'screenPageViews' }, desc: true }]
  );
  
  const rows = parseRows(response.rows || []);
  
  return {
    period: { startDate: range.startDate, endDate: range.endDate },
    pages: rows.map((r: any) => ({
      page: r.dim_0,
      pageviews: r.metric_0,
      users: r.metric_1,
      avg_time_on_page: Math.round(r.metric_2 * 10) / 10,
      bounce_rate: Math.round(r.metric_3 * 1000) / 10,
    })),
  };
}

/**
 * Get conversions (events that are marked as conversion events)
 */
export async function getConversions(days: number = 30): Promise<any> {
  const range = dateRange(days);
  
  const response = await runReport(
    [{ startDate: range.startDate, endDate: range.endDate }],
    ['eventName'],
    ['conversions', 'activeUsers', 'eventCount'],
    undefined,
    50,
    [{ metric: { metricName: 'conversions' }, desc: true }]
  );
  
  const rows = parseRows(response.rows || []);
  
  return {
    period: { startDate: range.startDate, endDate: range.endDate },
    conversions: rows.map((r: any) => ({
      event_name: r.dim_0,
      conversions: Math.round(r.metric_0 * 100) / 100,
      users: r.metric_1,
      event_count: r.metric_2,
    })),
  };
}

/**
 * Get daily traffic breakdown for snapshots
 */
export async function getDailyTraffic(days: number = 30): Promise<any> {
  const range = dateRange(days);
  
  const response = await runReport(
    [{ startDate: range.startDate, endDate: range.endDate }],
    ['date'],
    ['activeUsers', 'sessions', 'screenPageViews', 'engagementRate', 'bounceRate', 'averageSessionDuration', 'conversions'],
    undefined,
    1000,
    [{ dimension: { dimensionName: 'date' }, desc: true }]
  );
  
  const rows = parseRows(response.rows || []);
  
  return rows.map((r: any) => ({
    date: r.dim_0,
    users: r.metric_0,
    sessions: r.metric_1,
    pageviews: r.metric_2,
    engagement_rate: r.metric_3,
    bounce_rate: r.metric_4,
    avg_session_duration: r.metric_5,
    conversions: r.metric_6,
  }));
}

/**
 * Get daily pages for snapshots
 */
export async function getDailyPages(days: number = 30): Promise<any> {
  const range = dateRange(days);
  
  const response = await runReport(
    [{ startDate: range.startDate, endDate: range.endDate }],
    ['date', 'pagePath'],
    ['screenPageViews', 'activeUsers', 'averageSessionDuration', 'bounceRate'],
    undefined,
    1000,
    [{ metric: { metricName: 'screenPageViews' }, desc: true }]
  );
  
  const rows = parseRows(response.rows || []);
  
  return rows.map((r: any) => ({
    date: r.dim_0,
    page_path: r.dim_1,
    pageviews: r.metric_0,
    users: r.metric_1,
    avg_time_on_page: r.metric_2,
    bounce_rate: r.metric_3,
  }));
}

/**
 * Get daily conversions for snapshots
 */
export async function getDailyConversions(days: number = 30): Promise<any> {
  const range = dateRange(days);
  
  const response = await runReport(
    [{ startDate: range.startDate, endDate: range.endDate }],
    ['date', 'eventName'],
    ['conversions', 'activeUsers'],
    undefined,
    1000,
    [{ metric: { metricName: 'conversions' }, desc: true }]
  );
  
  const rows = parseRows(response.rows || []);
  
  return rows.map((r: any) => ({
    date: r.dim_0,
    event_name: r.dim_1,
    conversions: r.metric_0,
    users: r.metric_1,
  }));
}

// ── Snapshot Storage ────────────────────────────────────────────────────────

export async function storeDailySnapshots(): Promise<any> {
  if (!snapshotDb) {
    throw new Error('Snapshot DB not initialized');
  }
  
  const today = new Date().toISOString().slice(0, 10);
  
  // Fetch all data
  const traffic = await getDailyTraffic(30);
  const pages = await getDailyPages(30);
  const conversionsData = await getDailyConversions(30);
  const channels = await getTrafficByChannel(30);
  
  const insertTraffic = snapshotDb.prepare(`
    INSERT OR REPLACE INTO ga4_daily_traffic 
    (snapshot_date, users, sessions, pageviews, engagement_rate, conversions, bounce_rate, avg_session_duration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertPage = snapshotDb.prepare(`
    INSERT OR REPLACE INTO ga4_daily_pages 
    (snapshot_date, page_path, pageviews, users, avg_time_on_page, bounce_rate)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const insertConversion = snapshotDb.prepare(`
    INSERT OR REPLACE INTO ga4_daily_conversions 
    (snapshot_date, event_name, conversions, users)
    VALUES (?, ?, ?, ?)
  `);
  
  const insertChannel = snapshotDb.prepare(`
    INSERT OR REPLACE INTO ga4_daily_channels 
    (snapshot_date, channel, sessions, users, conversions)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  let trafficRows = 0;
  let pageRows = 0;
  let conversionRows = 0;
  let channelRows = 0;
  
  const transaction = snapshotDb.transaction(() => {
    // Store traffic
    for (const row of traffic) {
      insertTraffic.run(row.date, row.users, row.sessions, row.pageviews, row.engagement_rate, row.conversions, row.bounce_rate, row.avg_session_duration);
      trafficRows++;
    }
    
    // Store pages
    for (const row of pages) {
      insertPage.run(row.date, row.page_path, row.pageviews, row.users, row.avg_time_on_page, row.bounce_rate);
      pageRows++;
    }
    
    // Store conversions
    for (const row of conversionsData) {
      insertConversion.run(row.date, row.event_name, row.conversions, row.users);
      conversionRows++;
    }
    
    // Store channels (per-day aggregate)
    for (const ch of channels.channels) {
      insertChannel.run(today, ch.channel, ch.sessions, ch.users, ch.conversions);
      channelRows++;
    }
  });
  
  transaction();
  
  return {
    snapshot_date: today,
    traffic_rows: trafficRows,
    page_rows: pageRows,
    conversion_rows: conversionRows,
    channel_rows: channelRows,
    status: 'SNAPSHOTS_STORED',
  };
}

// ── Snapshot Queries ────────────────────────────────────────────────────────

export function getLatestTraffic(): any {
  if (!snapshotDb) return { error: 'Snapshot DB not initialized' };
  
  const rows = snapshotDb.prepare(
    'SELECT * FROM ga4_daily_traffic ORDER BY snapshot_date DESC LIMIT 30'
  ).all();
  
  return { rows, count: rows.length };
}

export function getLatestPages(limit: number = 20): any {
  if (!snapshotDb) return { error: 'Snapshot DB not initialized' };
  
  const rows = snapshotDb.prepare(
    'SELECT * FROM ga4_daily_pages WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM ga4_daily_pages) ORDER BY pageviews DESC LIMIT ?'
  ).all(limit);
  
  return { rows, count: rows.length };
}

export function getLatestConversions(): any {
  if (!snapshotDb) return { error: 'Snapshot DB not initialized' };
  
  const rows = snapshotDb.prepare(
    'SELECT * FROM ga4_daily_conversions WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM ga4_daily_conversions) ORDER BY conversions DESC'
  ).all();
  
  return { rows, count: rows.length };
}

export function getLatestChannels(): any {
  if (!snapshotDb) return { error: 'Snapshot DB not initialized' };
  
  const rows = snapshotDb.prepare(
    'SELECT * FROM ga4_daily_channels WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM ga4_daily_channels) ORDER BY sessions DESC'
  ).all();
  
  return { rows, count: rows.length };
}

export function getSnapshotDates(): any {
  if (!snapshotDb) return { error: 'Snapshot DB not initialized' };
  
  const rows = snapshotDb.prepare(
    'SELECT DISTINCT snapshot_date FROM ga4_daily_traffic ORDER BY snapshot_date DESC LIMIT 30'
  ).all();
  
  return { dates: rows.map((r: any) => r.snapshot_date), count: rows.length };
}

export function getHistoricalTraffic(days: number = 90): any {
  if (!snapshotDb) return { error: 'Snapshot DB not initialized' };
  
  const rows = snapshotDb.prepare(
    'SELECT * FROM ga4_daily_traffic ORDER BY snapshot_date DESC LIMIT ?'
  ).all(days);
  
  return { rows, count: rows.length };
}
