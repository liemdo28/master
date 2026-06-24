/**
 * Phase 4 — Google Search Console Connector
 * Reads OAuth tokens from the shared google-tokens.json (same flow as Gmail/Calendar).
 * To authorize: GET /api/auth/google/start → approve all scopes → tokens saved automatically.
 */
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'E:/Project/Master/.local-agent-global';
const TOKEN_PATH = path.join(GLOBAL_DIR, 'visibility', 'google-tokens.json');

const CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI  || 'http://localhost:4001/api/auth/google/callback';

function getAuth() {
  const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  if (fs.existsSync(TOKEN_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    auth.setCredentials(tokens);
  }
  return auth;
}

function getClient() {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set');
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error('Google not authorized — visit http://localhost:4001/api/auth/google/start to connect');
  }
  return google.webmasters({ version: 'v3', auth: getAuth() });
}

export function isConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && fs.existsSync(TOKEN_PATH));
}

export async function listSites(): Promise<string[]> {
  const sc = getClient();
  const res = await sc.sites.list();
  return (res.data.siteEntry || []).map((s: any) => s.siteUrl || '');
}

export async function getSiteStatus(siteUrl: string): Promise<any> {
  const sc = getClient();
  const res = await sc.sites.get({ siteUrl });
  return res.data;
}

export async function getSearchAnalytics(
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[] = ['query']
): Promise<any[]> {
  const sc = getClient();
  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: { startDate, endDate, dimensions, rowLimit: 1000 },
  });
  return res.data.rows || [];
}

export async function getTopQueries(siteUrl: string, startDate: string, endDate: string): Promise<any[]> {
  const rows = await getSearchAnalytics(siteUrl, startDate, endDate, ['query']);
  return rows
    .sort((a: any, b: any) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, 20)
    .map((r: any) => ({
      query: r.keys?.[0] || '',
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: Math.round((r.ctr || 0) * 1000) / 10,
      position: Math.round((r.position || 0) * 10) / 10,
    }));
}

export async function getTopPages(siteUrl: string, startDate: string, endDate: string): Promise<any[]> {
  const rows = await getSearchAnalytics(siteUrl, startDate, endDate, ['page']);
  return rows
    .sort((a: any, b: any) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, 20)
    .map((r: any) => ({
      page: r.keys?.[0] || '',
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: Math.round((r.ctr || 0) * 1000) / 10,
      position: Math.round((r.position || 0) * 10) / 10,
    }));
}

export async function getIndexCoverage(siteUrl: string): Promise<any> {
  return { note: 'Index coverage available via GSC UI or URL Inspection API (v1)', siteUrl };
}

export async function getSitemaps(siteUrl: string): Promise<any[]> {
  const sc = getClient();
  const res = await sc.sitemaps.list({ siteUrl });
  return (res.data.sitemap || []).map((s: any) => ({
    path: s.path,
    lastSubmitted: s.lastSubmitted,
    isPending: s.isPending,
    isSitemapsIndex: s.isSitemapsIndex,
    lastDownloaded: s.lastDownloaded,
    warnings: s.warnings,
    errors: s.errors,
  }));
}

export async function getSummary(siteUrl: string, startDate: string, endDate: string): Promise<any> {
  const sc = getClient();
  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: { startDate, endDate, dimensions: [], rowLimit: 1 },
  });
  const agg = (res.data.rows?.[0] as any) || {};
  return {
    siteUrl,
    period: { startDate, endDate },
    clicks: agg.clicks || 0,
    impressions: agg.impressions || 0,
    ctr: Math.round((agg.ctr || 0) * 1000) / 10,
    average_position: Math.round((agg.position || 0) * 10) / 10,
  };
}
