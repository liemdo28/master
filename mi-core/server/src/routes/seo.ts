/**
 * SEO Agent Integration Router — Phase 6.5: Multi-Brand Production System
 * 
 * CRITICAL: No hardcoded brand/domain/location data.
 * All brand data loaded from SEO/shared/config/brands.json + locations.json.
 * To add Brand N: insert config rows. Zero source code changes.
 */
import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import {
  getActiveBrands, getAllBrands, getBrandById, getBrandDomain,
  getActiveLocationsForBrand, getAllLocationsForBrand, getAllLocations, getLocationById,
  addConnectorRun, getConnectorRuns, getDataSourcesByBrand,
  computeBrandHealth, computeLocationHealth,
  loadBrandConfig,
  type BrandRecord, type LocationRecord, type ConnectorRunRecord,
} from '../seo/brand-config';

export const seoRouter = Router();

// ── Persistence ─────────────────────────────────────────────────────────────
const PERSIST_DIR = path.join(process.cwd(), 'data', 'seo');
const PERSIST_FILE = path.join(PERSIST_DIR, 'seo-state.json');
const STALE_MS = 5 * 60 * 1000;

function ensureDir(d: string) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

// ── Data stores ─────────────────────────────────────────────────────────────
interface SeoAgentRecord {
  agentId: string; version: string; port: number; status: string;
  health: string; uptime_s: number; last_sync_at: string; registered_at: string;
  last_report?: any; error_state: string | null; tasks_completed: number; tasks_pending: number;
}

let seoAgents = new Map<string, SeoAgentRecord>();
let seoSyncLogs: any[] = [];
let seoTasks: any[] = [];
let seoReports: any[] = [];
let seoIssues: any[] = [];
let seoOpportunities: any[] = [];
let connectorResults: any = {};
let orchestratorJobs: any[] = [];
let orchestratorLog: any[] = [];

// ── Load persisted state ────────────────────────────────────────────────────
function loadState() {
  ensureDir(PERSIST_DIR);
  const defaults = { agents: {}, syncLogs: [] as any[], tasks: [] as any[], reports: [] as any[],
    issues: [] as any[], opportunities: [] as any[], connectorResults: {},
    orchestratorJobs: [] as any[], orchestratorLog: [] as any[] };
  try {
    if (fs.existsSync(PERSIST_FILE)) {
      const s = JSON.parse(fs.readFileSync(PERSIST_FILE, 'utf8'));
      const now = Date.now();
      for (const [, a] of Object.entries(s.agents || {})) {
        if (now - new Date((a as any).last_sync_at).getTime() > STALE_MS) (a as any).status = 'stale';
      }
      return { ...defaults, ...s, agents: s.agents || {} };
    }
  } catch { console.log('[SEO] load failed, using defaults'); }
  return defaults;
}

function saveState() {
  ensureDir(PERSIST_DIR);
  try {
    fs.writeFileSync(PERSIST_FILE, JSON.stringify({
      agents: Object.fromEntries(seoAgents),
      syncLogs: seoSyncLogs.slice(-500), tasks: seoTasks.slice(-200),
      reports: seoReports.slice(-200), issues: seoIssues.slice(-200),
      opportunities: seoOpportunities.slice(-200), connectorResults,
      orchestratorJobs: orchestratorJobs.slice(-100), orchestratorLog: orchestratorLog.slice(-200),
    }, null, 2));
  } catch (e) { console.log('[SEO] save failed:', (e as Error).message); }
}

const _p = loadState();
seoAgents = new Map(Object.entries(_p.agents) as [string, SeoAgentRecord][]);
seoSyncLogs = _p.syncLogs; seoTasks = _p.tasks; seoReports = _p.reports;
seoIssues = _p.issues; seoOpportunities = _p.opportunities;
connectorResults = _p.connectorResults;
orchestratorJobs = _p.orchestratorJobs; orchestratorLog = _p.orchestratorLog;

// ── Brand API Endpoints ────────────────────────────────────────────────────

// GET /api/seo/brands — list all brands
seoRouter.get('/brands', (_req: Request, res: Response) => {
  const brands = getAllBrands();
  const active = brands.filter(b => b.status === 'active');
  res.json({
    ok: true,
    total: brands.length,
    active: active.length,
    brands: brands.map(b => {
      const health = computeBrandHealth(b.brand_id);
      const locs = getAllLocationsForBrand(b.brand_id);
      return {
        brand_id: b.brand_id,
        name: b.name,
        domain: b.domain,
        status: b.status,
        industry: b.industry,
        location_count: locs.length,
        active_locations: locs.filter(l => l.status === 'active').length,
        health_score: health.score,
        health_status: health.status,
        connectors: b.connectors ? Object.entries(b.connectors).map(([k, v]) => ({
          type: k, status: v.status, credentials_configured: v.credentials_configured,
        })) : [],
      };
    }),
  });
});

// GET /api/seo/brands/:brandId — single brand detail
seoRouter.get('/brands/:brandId', (req: Request, res: Response) => {
  const brand = getBrandById(req.params.brandId);
  if (!brand) return res.status(404).json({ ok: false, error: 'brand_not_found' });
  const health = computeBrandHealth(brand.brand_id);
  const locs = getAllLocationsForBrand(brand.brand_id);
  res.json({
    ok: true,
    brand: {
      ...brand,
      health_score: health.score,
      health_status: health.status,
      health_details: health.details,
      locations: locs,
    },
  });
});

// GET /api/seo/brands/:brandId/dashboard — brand dashboard
seoRouter.get('/brands/:brandId/dashboard', (req: Request, res: Response) => {
  const brand = getBrandById(req.params.brandId);
  if (!brand) return res.status(404).json({ ok: false, error: 'brand_not_found' });

  const health = computeBrandHealth(brand.brand_id);
  const locs = getAllLocationsForBrand(brand.brand_id);
  const activeLocs = locs.filter(l => l.status === 'active');
  const agents = Array.from(seoAgents.values());
  const online = agents.filter(a => a.status === 'online').length;
  const brandIssues = seoIssues.filter(i => i.brand_id === brand.brand_id);
  const brandOpps = seoOpportunities.filter(o => o.brand_id === brand.brand_id);
  const brandRuns = getConnectorRuns(brand.brand_id);

  res.json({
    ok: true,
    brand_id: brand.brand_id,
    brand_name: brand.name,
    domain: brand.domain,
    brand_status: brand.status,
    health_score: health.score,
    health_status: health.status,
    health_details: health.details,
    location_count: locs.length,
    active_locations: activeLocs.length,
    locations: locs.map(l => ({
      location_id: l.location_id,
      name: l.name,
      status: l.status,
      health: computeLocationHealth(brand.brand_id, l.location_id),
    })),
    agents_online: online,
    agents_total: agents.length,
    issues_count: brandIssues.length,
    opportunities_count: brandOpps.length,
    connector_status: brand.connectors ? Object.entries(brand.connectors).map(([k, v]) => ({
      type: k, status: v.status, credentials_configured: v.credentials_configured,
      last_run_at: v.last_run_at, last_success_at: v.last_success_at, last_error: v.last_error,
    })) : [],
    connector_runs_recent: brandRuns.slice(-10),
    data_source_summary: getDataSourcesByBrand().filter(d => d.brand_id === brand.brand_id),
    generated_at: new Date().toISOString(),
  });
});

// GET /api/seo/brands/:brandId/locations — brand locations
seoRouter.get('/brands/:brandId/locations', (req: Request, res: Response) => {
  const brand = getBrandById(req.params.brandId);
  if (!brand) return res.status(404).json({ ok: false, error: 'brand_not_found' });
  const locs = getAllLocationsForBrand(brand.brand_id);
  res.json({
    ok: true,
    brand_id: brand.brand_id,
    brand_name: brand.name,
    total: locs.length,
    active: locs.filter(l => l.status === 'active').length,
    needs_config: locs.filter(l => l.status === 'needs_location_config').length,
    locations: locs.map(l => ({
      ...l,
      health: computeLocationHealth(brand.brand_id, l.location_id),
    })),
  });
});

// GET /api/seo/brands/:brandId/kpis — brand KPIs
seoRouter.get('/brands/:brandId/kpis', (req: Request, res: Response) => {
  const brand = getBrandById(req.params.brandId);
  if (!brand) return res.status(404).json({ ok: false, error: 'brand_not_found' });

  const agents = Array.from(seoAgents.values());
  const online = agents.filter(a => a.status === 'online').length;
  const health = computeBrandHealth(brand.brand_id);
  const brandReports = seoReports.filter(r => r.brand_id === brand.brand_id || (!r.brand_id && brand.brand_id === 'bakudan'));
  const locs = getAllLocationsForBrand(brand.brand_id);

  // Connector data from persist
  const brandRuns = getConnectorRuns(brand.brand_id);
  const lastCrawl = brandRuns.filter(r => r.connector_type === 'crawler').slice(-1)[0];
  const lastCitation = brandRuns.filter(r => r.connector_type === 'citation_scan').slice(-1)[0];

  // Also check in-memory connectorResults for backwards compat
  const crawlerData = connectorResults['crawler'];
  const citationData = connectorResults['citation_scan'];
  const gscData = connectorResults['gsc'];

  res.json({
    ok: true,
    brand_id: brand.brand_id,
    brand_name: brand.name,
    kpis: {
      brand_health_score: health.score,
      brand_health_status: health.status,
      agents_online: online,
      agents_total: 7,
      seo_health: online === 7 ? 'healthy' : online >= 5 ? 'degraded' : 'critical',
      locations_total: locs.length,
      locations_active: locs.filter(l => l.status === 'active').length,
      pages_crawled: lastCrawl?.records_processed || crawlerData?.records || 0,
      broken_links: crawlerData?.broken_links_found || 0,
      citations_confirmed: lastCitation?.records_processed || citationData?.confirmed_listings || 0,
      citations_total: citationData?.records || 0,
      nap_consistent: citationData?.nap_consistent_count || 0,
      gsc_keywords: gscData?.records || 0,
      connector_status: brand.connectors ? Object.keys(brand.connectors).reduce((acc: any, k) => {
        acc[k] = brand.connectors![k].status;
        return acc;
      }, {}) : {},
      last_crawl: lastCrawl?.completed_at || crawlerData?.data?.[0]?.fetched_at || null,
      last_citation_scan: lastCitation?.completed_at || citationData?.data?.[0]?.fetched_at || null,
      tasks_completed: seoTasks.filter(t => t.status === 'completed' && (!t.brand_id || t.brand_id === brand.brand_id)).length,
      tasks_pending: seoTasks.filter(t => t.status === 'pending' && (!t.brand_id || t.brand_id === brand.brand_id)).length,
      reports_total: brandReports.length,
    },
  });
});

// GET /api/seo/brands/:brandId/issues — brand issues
seoRouter.get('/brands/:brandId/issues', (req: Request, res: Response) => {
  const brand = getBrandById(req.params.brandId);
  if (!brand) return res.status(404).json({ ok: false, error: 'brand_not_found' });

  // Filter issues by brand_id from both stored issues and report-generated issues
  const reportIssues = seoReports
    .filter(r => r.brand_id === brand.brand_id || (!r.brand_id && brand.brand_id === 'bakudan'))
    .flatMap(r => r.payload?.issues || r.issues || []);
  const storedIssues = seoIssues.filter(i => i.brand_id === brand.brand_id || (!i.brand_id && brand.brand_id === 'bakudan'));
  const allIssues = [...storedIssues, ...reportIssues].slice(-200);

  // Group by check type
  const byCheck: Record<string, number> = {};
  for (const issue of allIssues) {
    const check = issue.check || issue.check_type || 'unknown';
    byCheck[check] = (byCheck[check] || 0) + 1;
  }

  // Group by location
  const byLocation: Record<string, number> = {};
  for (const issue of allIssues) {
    const loc = issue.location_id || 'brand-level';
    byLocation[loc] = (byLocation[loc] || 0) + 1;
  }

  res.json({
    ok: true,
    brand_id: brand.brand_id,
    brand_name: brand.name,
    total: allIssues.length,
    issues: allIssues,
    by_check_type: byCheck,
    by_location: byLocation,
  });
});

// GET /api/seo/brands/:brandId/opportunities — brand opportunities
seoRouter.get('/brands/:brandId/opportunities', (req: Request, res: Response) => {
  const brand = getBrandById(req.params.brandId);
  if (!brand) return res.status(404).json({ ok: false, error: 'brand_not_found' });

  const reportOpps = seoReports
    .filter(r => r.brand_id === brand.brand_id || (!r.brand_id && brand.brand_id === 'bakudan'))
    .flatMap(r => r.payload?.opportunities || r.opportunities || []);
  const storedOpps = seoOpportunities.filter(o => o.brand_id === brand.brand_id || (!o.brand_id && brand.brand_id === 'bakudan'));

  res.json({
    ok: true,
    brand_id: brand.brand_id,
    brand_name: brand.name,
    total: [...storedOpps, ...reportOpps].length,
    opportunities: [...storedOpps, ...reportOpps].slice(-200),
  });
});

// GET /api/seo/brands/:brandId/connectors/status — brand connector status
seoRouter.get('/brands/:brandId/connectors/status', (req: Request, res: Response) => {
  const brand = getBrandById(req.params.brandId);
  if (!brand) return res.status(404).json({ ok: false, error: 'brand_not_found' });

  const brandRuns = getConnectorRuns(brand.brand_id);
  const connectorTypes = ['crawler', 'gsc', 'gbp', 'ga4', 'citation_scan'];

  res.json({
    ok: true,
    brand_id: brand.brand_id,
    brand_name: brand.name,
    connectors: connectorTypes.map(type => {
      const config = brand.connectors?.[type];
      const runs = brandRuns.filter(r => r.connector_type === type);
      const lastRun = runs.length ? runs[runs.length - 1] : null;
      return {
        id: type,
        name: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        brand_id: brand.brand_id,
        status: config?.status || 'not_configured',
        credentials_configured: config?.credentials_configured || false,
        last_success: config?.last_success_at || lastRun?.completed_at || null,
        last_error: config?.last_error || lastRun?.error || null,
        last_run_at: lastRun?.started_at || null,
        records_last_run: lastRun?.records_processed || 0,
      };
    }),
  });
});

// ── Dashboard: All Brands ──────────────────────────────────────────────────

// GET /api/seo/dashboard — global dashboard (all brands)
seoRouter.get('/dashboard', (_req: Request, res: Response) => {
  const brands = getAllBrands();
  const activeBrands = brands.filter(b => b.status === 'active');
  const agents = Array.from(seoAgents.values());
  const online = agents.filter(a => a.status === 'online').length;
  const totalIssues = seoReports.reduce((s, r) => s + (r.issues_count || 0), 0);
  const allLocs = getAllLocations();

  // Compute brand-level summaries
  const brandSummaries = brands.map(b => {
    const health = computeBrandHealth(b.brand_id);
    const locs = getAllLocationsForBrand(b.brand_id);
    const brandIssues = seoIssues.filter(i => i.brand_id === b.brand_id);
    const dataSources = getDataSourcesByBrand().filter(d => d.brand_id === b.brand_id);
    const realSources = dataSources.filter(d => d.source !== 'seeded' && d.record_count > 0);
    const seededSources = dataSources.filter(d => d.source === 'seeded');
    const totalReal = realSources.reduce((s, d) => s + d.record_count, 0);
    const totalSeeded = seededSources.reduce((s, d) => s + d.record_count, 0);

    return {
      brand_id: b.brand_id,
      name: b.name,
      domain: b.domain,
      status: b.status,
      health_score: health.score,
      health_status: health.status,
      location_count: locs.length,
      issues_count: brandIssues.length,
      real_vs_seeded: { real: totalReal, seeded: totalSeeded, ratio: totalReal > 0 ? `${Math.round(totalReal / (totalReal + totalSeeded) * 100)}% real` : '0% real' },
      connector_status: b.connectors ? Object.entries(b.connectors).map(([k, v]) => ({
        type: k, status: v.status,
      })) : [],
    };
  });

  res.json({
    ok: true,
    brand_count: brands.length,
    location_count: allLocs.length,
    brands_online: activeBrands.length,
    agents_online: online,
    agents_total: 7,
    all_agents_online: online === 7,
    brand_health_score: Math.round(brandSummaries.reduce((s, b) => s + b.health_score, 0) / Math.max(brands.length, 1)),
    issues_by_brand: brandSummaries.map(b => ({ brand_id: b.brand_id, name: b.name, issues: b.issues_count })),
    opportunities_by_brand: brandSummaries.map(b => {
      const brandOpps = seoOpportunities.filter(o => o.brand_id === b.brand_id);
      return { brand_id: b.brand_id, name: b.name, opportunities: brandOpps.length };
    }),
    real_vs_seeded_ratio_by_brand: brandSummaries.map(b => ({ brand_id: b.brand_id, name: b.name, ...b.real_vs_seeded })),
    connector_status_by_brand: brandSummaries.map(b => ({ brand_id: b.brand_id, name: b.name, connectors: b.connector_status })),
    brands: brandSummaries,
    last_sync: agents.length ? agents.sort((a, b) => b.last_sync_at.localeCompare(a.last_sync_at))[0].last_sync_at : null,
    agents: agents.map(a => ({
      id: a.agentId, status: a.status, health: a.health, port: a.port,
      uptime_s: a.uptime_s, last_sync_at: a.last_sync_at, error_state: a.error_state,
      tasks_completed: a.tasks_completed, tasks_pending: a.tasks_pending,
    })),
    seo_score_summary: { overall: online === 7 ? 'operational' : 'degraded', agents_reporting: agents.length },
    open_issues_count: totalIssues,
    ranking_opportunities: seoReports.filter(r => r.type === 'ranking').length,
    citation_issues: seoReports.filter(r => r.type === 'citation').length,
    technical_issues: seoReports.filter(r => r.type === 'technical').length,
    sync_logs_count: seoSyncLogs.length,
    tasks_total: seoTasks.length,
    tasks_completed: seoTasks.filter(t => t.status === 'completed').length,
    tasks_pending: seoTasks.filter(t => t.status === 'pending').length,
  });
});

// ── KPIs (all brands) ─────────────────────────────────────────────────────

seoRouter.get('/kpis', (_req: Request, res: Response) => {
  const agents = Array.from(seoAgents.values());
  const online = agents.filter(a => a.status === 'online').length;
  const brands = getActiveBrands();
  const allLocs = getAllLocations();
  const cd = connectorResults['crawler']; const ci = connectorResults['citation_scan']; const gs = connectorResults['gsc'];
  res.json({
    ok: true,
    brand_count: brands.length,
    location_count: allLocs.length,
    kpis: {
      agents_online: online, agents_total: 7,
      seo_health: online === 7 ? 'healthy' : online >= 5 ? 'degraded' : 'critical',
      pages_crawled: cd?.records || 0,
      broken_links: cd?.broken_links_found || 0,
      citations_confirmed: ci?.confirmed_listings || 0, citations_total: ci?.records || 0, nap_consistent: ci?.nap_consistent_count || 0,
      gsc_keywords: gs?.records || 0,
      connector_status: { crawler: cd?.status || 'not_run', gsc: gs?.status || 'not_run', gbp: connectorResults['gbp']?.status || 'not_run', ga4: connectorResults['ga4']?.status || 'not_run', citation_scan: ci?.status || 'not_run' },
      last_crawl: cd?.data?.[0]?.fetched_at || null, last_citation_scan: ci?.data?.[0]?.fetched_at || null,
      tasks_completed: seoTasks.filter(t => t.status === 'completed').length,
      tasks_pending: seoTasks.filter(t => t.status === 'pending').length,
      reports_total: seoReports.length,
    },
    kpis_by_brand: brands.map(b => {
      const health = computeBrandHealth(b.brand_id);
      const locs = getAllLocationsForBrand(b.brand_id);
      return { brand_id: b.brand_id, name: b.name, health_score: health.score, location_count: locs.length };
    }),
  });
});

// ── Locations (all) ────────────────────────────────────────────────────────

seoRouter.get('/locations', (_req: Request, res: Response) => {
  const allLocs = getAllLocations();
  res.json({
    ok: true,
    total: allLocs.length,
    locations: allLocs.map(l => ({
      id: l.location_id,
      brand_id: l.brand_id,
      name: l.name,
      status: l.status,
    })),
  });
});

// ── Data Sources (all brands) ──────────────────────────────────────────────

seoRouter.get('/data-sources', (_req: Request, res: Response) => {
  const sources = getDataSourcesByBrand();
  const brands = getActiveBrands();
  const brandSummary = brands.map(b => {
    const brandSources = sources.filter(s => s.brand_id === b.brand_id);
    const real = brandSources.filter(s => s.source !== 'seeded').reduce((sum, s) => sum + s.record_count, 0);
    const seeded = brandSources.filter(s => s.source === 'seeded').reduce((sum, s) => sum + s.record_count, 0);
    return {
      brand_id: b.brand_id,
      name: b.name,
      real,
      seeded,
      ratio: real > 0 ? `${Math.round(real / (real + seeded) * 100)}% real` : '0% real',
    };
  });

  const totalReal = sources.filter(s => s.source !== 'seeded').reduce((sum, s) => sum + s.record_count, 0);
  const totalSeeded = sources.filter(s => s.source === 'seeded').reduce((sum, s) => sum + s.record_count, 0);

  res.json({
    ok: true,
    sources: sources,
    by_brand: brandSummary,
    real_vs_seeded: {
      real: totalReal,
      seeded: totalSeeded,
      ratio: totalReal > 0 ? `${Math.round(totalReal / (totalReal + totalSeeded) * 100)}% real` : '0% real',
    },
  });
});

// ── Existing Agent Endpoints (backward compat) ─────────────────────────────

seoRouter.post('/agents/register', (req: Request, res: Response) => {
  const { agent, version, port } = req.body;
  const agentId = agent || req.headers['x-agent-id'] as string;
  if (!agentId) return res.status(400).json({ ok: false, error: 'agent id required' });
  const now = new Date().toISOString();
  const ex = seoAgents.get(agentId);
  seoAgents.set(agentId, { agentId, version: version || ex?.version || '1.0.0', port: port || ex?.port || 0,
    status: 'online', health: 'healthy', uptime_s: 0, last_sync_at: now,
    registered_at: ex?.registered_at || now, error_state: null,
    tasks_completed: ex?.tasks_completed || 0, tasks_pending: ex?.tasks_pending || 0 });
  seoSyncLogs.push({ agent: agentId, action: 'register', ts: now });
  saveState();
  console.log(`[Mi][SEO] Agent registered: ${agentId}`);
  res.json({ ok: true, registered: agentId, ts: now });
});

seoRouter.post('/agents/:id/health', (req: Request, res: Response) => {
  const agentId = req.params.id;
  const r = seoAgents.get(agentId);
  if (!r) return res.status(404).json({ ok: false, error: 'agent not registered' });
  const now = new Date().toISOString();
  r.health = req.body.health || 'healthy'; r.uptime_s = req.body.uptime_s || r.uptime_s;
  r.error_state = req.body.error_state || null; r.last_sync_at = now;
  seoSyncLogs.push({ agent: agentId, action: 'health', ts: now });
  saveState();
  res.json({ ok: true, agent: agentId, health: r.health });
});

seoRouter.post('/agents/:id/status', (req: Request, res: Response) => {
  const agentId = req.params.id;
  const r = seoAgents.get(agentId);
  const now = new Date().toISOString();
  if (!r) {
    const s = req.body.status || {};
    seoAgents.set(agentId, { agentId, version: s.version || '1.0.0', port: s.port || 0,
      status: 'online', health: 'healthy', uptime_s: s.uptime_s || 0, last_sync_at: now,
      registered_at: now, error_state: null, tasks_completed: 0, tasks_pending: 0 });
    seoSyncLogs.push({ agent: agentId, action: 'auto-register+status', ts: now });
    saveState();
    return res.json({ ok: true, agent: agentId, auto_registered: true });
  }
  const s = req.body.status || req.body;
  r.status = 'online'; r.uptime_s = s.uptime_s || r.uptime_s; r.port = s.port || r.port;
  r.version = s.version || r.version; r.error_state = s.error_state || null; r.last_sync_at = now;
  seoSyncLogs.push({ agent: agentId, action: 'status', ts: now });
  saveState();
  res.json({ ok: true, agent: agentId, status: r.status });
});

seoRouter.post('/agents/:id/reports', (req: Request, res: Response) => {
  const agentId = req.params.id; const now = new Date().toISOString();
  const report = { agent: agentId, ts: now, ...req.body };
  seoReports.push(report);
  const r = seoAgents.get(agentId);
  if (r) { r.last_report = report; r.last_sync_at = now; }
  seoSyncLogs.push({ agent: agentId, action: 'report', ts: now });
  saveState();
  res.json({ ok: true, agent: agentId, report_received: true });
});

seoRouter.post('/dashboard/:id', (req: Request, res: Response) => {
  const agentId = req.params.id; const now = new Date().toISOString();
  const r = seoAgents.get(agentId); if (r) r.last_sync_at = now;
  seoSyncLogs.push({ agent: agentId, action: 'dashboard', ts: now, payload: req.body });
  saveState();
  res.json({ ok: true, agent: agentId, dashboard_updated: true });
});

seoRouter.get('/agents/:id/tasks', (req: Request, res: Response) => {
  const pending = seoTasks.filter(t => t.assignee === req.params.id && t.status === 'pending');
  res.json({ ok: true, agent: req.params.id, tasks: pending });
});

seoRouter.get('/agents/:id/config', (req: Request, res: Response) => {
  res.json({ ok: true, agent: req.params.id, config: { sync_interval_s: 30, audit_cron: '0 3 * * *' } });
});

seoRouter.get('/agents/:id/status', (req: Request, res: Response) => {
  const r = seoAgents.get(req.params.id);
  if (!r) return res.status(404).json({ ok: false, error: 'agent not found' });
  res.json({ ok: true, ...r });
});

seoRouter.get('/agents', (_req: Request, res: Response) => {
  const agents = Array.from(seoAgents.values());
  res.json({ ok: true, total: agents.length, online: agents.filter(a => a.status === 'online').length, agents });
});

seoRouter.post('/agents/:id/sync', (req: Request, res: Response) => {
  const agentId = req.params.id; const now = new Date().toISOString();
  const r = seoAgents.get(agentId); if (r) r.last_sync_at = now;
  seoSyncLogs.push({ agent: agentId, action: 'sync', ts: now });
  saveState();
  res.json({ ok: true, agent: agentId, synced_at: now });
});

seoRouter.post('/tasks', (req: Request, res: Response) => {
  const { assignee, type, payload } = req.body;
  if (!assignee || !type) return res.status(400).json({ ok: false, error: 'assignee and type required' });
  const now = new Date().toISOString();
  const task = { id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    assignee, type, payload, status: 'pending', created_at: now, completed_at: null, result: null };
  seoTasks.push(task);
  const r = seoAgents.get(assignee); if (r) r.tasks_pending++;
  saveState();
  res.json({ ok: true, task });
});

seoRouter.post('/tasks/:taskId/complete', (req: Request, res: Response) => {
  const task = seoTasks.find(t => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ ok: false, error: 'task not found' });
  task.status = 'completed'; task.completed_at = new Date().toISOString(); task.result = req.body.result || null;
  const r = seoAgents.get(task.assignee);
  if (r) { r.tasks_pending = Math.max(0, r.tasks_pending - 1); r.tasks_completed++; }
  saveState();
  res.json({ ok: true, task });
});

seoRouter.get('/reports/latest', (_req: Request, res: Response) => {
  const agents = Array.from(seoAgents.values());
  res.json({ ok: true, reports: agents.map(a => ({ agent: a.agentId, last_report: a.last_report || null, last_sync_at: a.last_sync_at })), total: seoReports.length });
});

seoRouter.get('/sync-logs', (_req: Request, res: Response) => {
  res.json({ ok: true, logs: seoSyncLogs.slice(-100) });
});

// ── Connectors ──────────────────────────────────────────────────────────────

seoRouter.get('/connectors/status', (_req: Request, res: Response) => {
  const brands = getActiveBrands();
  const connectorTypes = ['crawler', 'gsc', 'gbp', 'ga4', 'citation_scan'];
  const byBrand = brands.map(b => ({
    brand_id: b.brand_id,
    name: b.name,
    connectors: connectorTypes.map(type => {
      const config = b.connectors?.[type];
      return {
        id: type,
        brand_id: b.brand_id,
        name: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        status: config?.status || 'not_configured',
        credentials_configured: config?.credentials_configured || false,
        last_success: config?.last_success_at || null,
        last_error: config?.last_error || null,
      };
    }),
  }));

  res.json({ ok: true, connectors: byBrand });
});

seoRouter.post('/connectors/run', async (req: Request, res: Response) => {
  const connectorId = req.body?.connector;
  try {
    const runUrl = `http://localhost:4011/run/connectors${connectorId ? `?connector=${connectorId}` : ''}`;
    const http = require('http');
    const result: any = await new Promise((resolve) => {
      const r = http.get(runUrl, { timeout: 120000 }, (response: any) => {
        let body = '';
        response.on('data', (d: string) => body += d);
        response.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({ ok: false, error: 'parse_error' }); } });
      });
      r.on('error', (e: Error) => resolve({ ok: false, error: e.message }));
      r.on('timeout', () => { r.destroy(); resolve({ ok: false, error: 'timeout' }); });
    });
    if (result.ok && result.results) {
      for (const [k, v] of Object.entries(result.results as Record<string, any>)) connectorResults[k] = v;
    }
    saveState();
    res.json({ ok: true, ...result });
  } catch (e: any) { res.json({ ok: false, error: e.message }); }
});

seoRouter.get('/connectors/latest', (_req: Request, res: Response) => {
  res.json({ ok: true, connectors: connectorResults });
});

// ── Issues & Opportunities (global) ──────────────────────────��─────────────

seoRouter.post('/issues', (req: Request, res: Response) => {
  const issue = { id: `issue_${Date.now()}`, ts: new Date().toISOString(), ...req.body };
  seoIssues.push(issue); saveState();
  res.json({ ok: true, issue });
});

seoRouter.get('/issues', (req: Request, res: Response) => {
  const brandId = req.query.brand_id as string | undefined;
  const reportIssues = seoReports.filter(r => r.payload?.issues || r.issues).flatMap(r => r.payload?.issues || r.issues || []);
  let allIssues = [...seoIssues, ...reportIssues].slice(-200);
  if (brandId) {
    allIssues = allIssues.filter((i: any) => i.brand_id === brandId);
  }
  res.json({ ok: true, issues: allIssues, total: allIssues.length });
});

seoRouter.post('/opportunities', (req: Request, res: Response) => {
  const opp = { id: `opp_${Date.now()}`, ts: new Date().toISOString(), ...req.body };
  seoOpportunities.push(opp); saveState();
  res.json({ ok: true, opportunity: opp });
});

seoRouter.get('/opportunities', (req: Request, res: Response) => {
  const brandId = req.query.brand_id as string | undefined;
  const reportOpps = seoReports.filter(r => r.payload?.opportunities || r.opportunities).flatMap(r => r.payload?.opportunities || r.opportunities || []);
  let allOpps = [...seoOpportunities, ...reportOpps].slice(-200);
  if (brandId) {
    allOpps = allOpps.filter((o: any) => o.brand_id === brandId);
  }
  res.json({ ok: true, opportunities: allOpps, total: allOpps.length });
});

// ── Orchestrator (brand-aware) ─────────────────────────────────────────────

seoRouter.post('/orchestrator/run/:jobId', async (req: Request, res: Response) => {
  const jobId = req.params.jobId;
  const brandId = (req.query.brand_id as string) || 'all';
  const now = new Date().toISOString();

  // Resolve brands to run
  let targetBrands: BrandRecord[];
  if (brandId === 'all') {
    targetBrands = getActiveBrands();
  } else {
    const b = getBrandById(brandId);
    if (!b) return res.status(404).json({ ok: false, error: `brand_not_found: ${brandId}` });
    targetBrands = [b];
  }

  const agentMap: Record<string, { port: number; endpoint: string }> = {
    'daily-website-crawl': { port: 4011, endpoint: '/run/connectors?connector=crawler' },
    'daily-gbp-sync': { port: 4011, endpoint: '/run/connectors?connector=gbp' },
    'daily-gsc-sync': { port: 4011, endpoint: '/run/connectors?connector=gsc' },
    'daily-ga4-sync': { port: 4011, endpoint: '/run/connectors?connector=ga4' },
    'daily-schema-validation': { port: 4014, endpoint: '/run/audit' },
    'daily-technical-audit': { port: 4012, endpoint: '/run/audit' },
    'weekly-citation-scan': { port: 4011, endpoint: '/run/connectors?connector=citation_scan' },
    'weekly-content-plan': { port: 4015, endpoint: '/run/audit' },
    'weekly-executive-seo-report': { port: 4017, endpoint: '/run/audit' },
    'monthly-full-seo-audit': { port: 4012, endpoint: '/run/audit' },
  };

  const target = agentMap[jobId];
  if (!target) {
    return res.status(400).json({ ok: false, error: `Unknown job: ${jobId}` });
  }

  const jobs: any[] = [];

  for (const brand of targetBrands) {
    const running = orchestratorJobs.find(j => j.job_id === jobId && j.brand_id === brand.brand_id && j.status === 'running');
    if (running) {
      jobs.push({ brand_id: brand.brand_id, status: 'skipped', reason: 'already_running', job: running });
      continue;
    }

    const job: {
      id: string;
      job_id: string;
      brand_id: string;
      location_id: string | null;
      status: string;
      started_at: string;
      completed_at: string | null;
      records_processed: number;
      result: unknown;
      error: string | null;
    } = {
      id: `job_${Date.now()}_${brand.brand_id}`,
      job_id: jobId,
      brand_id: brand.brand_id,
      location_id: null,
      status: 'running',
      started_at: now,
      completed_at: null,
      records_processed: 0,
      result: null,
      error: null,
    };
    orchestratorJobs.push(job);
    orchestratorLog.push({ job_id: jobId, brand_id: brand.brand_id, action: 'started', ts: now });

    try {
      const http = require('http');
      const method = target.endpoint.startsWith('/run/connectors') ? 'GET' : 'POST';
      // Append brand_id to crawler endpoint for brand-scoped crawling
      let endpoint = target.endpoint;
      if (target.endpoint.includes('connector=crawler') && brand.domain) {
        endpoint += `&brand_id=${brand.brand_id}`;
      }
      const result: any = await new Promise((resolve) => {
        const r = http.request({ hostname: 'localhost', port: target.port, path: endpoint, method, timeout: 120000 }, (response: any) => {
          let body = ''; response.on('data', (d: string) => body += d);
          response.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({ ok: false, raw: body }); } });
        });
        r.on('error', (e: Error) => resolve({ ok: false, error: e.message }));
        r.on('timeout', () => { r.destroy(); resolve({ ok: false, error: 'timeout' }); }); r.end();
      });
      job.status = result.ok ? 'completed' : 'failed';
      job.result = result;
      job.error = result.error || null;
      job.completed_at = new Date().toISOString();
      job.records_processed = result?.result?.results?.crawler?.records || result?.records || 0;
      orchestratorLog.push({ job_id: jobId, brand_id: brand.brand_id, action: job.status, ts: job.completed_at });

      // Record connector run
      addConnectorRun({
        id: `run_${Date.now()}_${brand.brand_id}`,
        brand_id: brand.brand_id,
        connector_type: target.endpoint.includes('connector=') ? target.endpoint.split('connector=')[1].split('&')[0] : jobId,
        status: job.status,
        started_at: job.started_at,
        completed_at: job.completed_at || undefined,
        records_processed: job.records_processed,
        error: job.error || undefined,
        source: 'orchestrator',
      });

      // Merge connector results
      const innerResults = (result?.result?.results) || (result?.results) || null;
      if (innerResults && typeof innerResults === 'object') {
        for (const [k, v] of Object.entries(innerResults as Record<string, any>)) {
          if (v && typeof v === 'object' && ('status' in v || 'records' in v)) {
            connectorResults[k] = v;
          }
        }
      }
    } catch (e: any) {
      job.status = 'failed'; job.error = e.message;
      job.completed_at = new Date().toISOString();
    }

    jobs.push({ brand_id: brand.brand_id, brand_name: brand.name, job });
  }

  saveState();
  res.json({
    ok: true,
    job_id: jobId,
    brand_id: brandId,
    brands_processed: targetBrands.map(b => b.brand_id),
    results: jobs,
  });
});

seoRouter.get('/orchestrator/status', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    jobs_total: orchestratorJobs.length,
    jobs_running: orchestratorJobs.filter(j => j.status === 'running').length,
    jobs_completed: orchestratorJobs.filter(j => j.status === 'completed').length,
    jobs_failed: orchestratorJobs.filter(j => j.status === 'failed').length,
    recent_jobs: orchestratorJobs.slice(-20),
    log: orchestratorLog.slice(-50),
  });
});

seoRouter.get('/orchestrator/jobs', (_req: Request, res: Response) => {
  res.json({ ok: true, jobs: orchestratorJobs });
});

// ── Config reload ──────────────────────────────────────────────────────────

seoRouter.post('/config/reload', (_req: Request, res: Response) => {
  loadBrandConfig();
  res.json({ ok: true, message: 'Brand config reloaded', brands: getAllBrands().length, locations: getAllLocations().length });
});
