/**
 * SEO Monitoring Router - Free, no GSC API cost
 * Uses Playwright to crawl websites, detect SEO issues, generate alerts.
 */
import { Router, Request, Response } from 'express';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { getActiveBrands, getBrandDomain } from './brand-config';

export const seoMonitoringRouter = Router();

const DATA_DIR = path.join(process.cwd(), 'data', 'seo-monitoring');
const STATE_FILE = path.join(DATA_DIR, 'monitoring-state.json');
function ensureDir() { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }

export interface SeoIssue {
  id: string; brand_id: string;
  type: 'critical' | 'warning' | 'info';
  category: 'meta' | 'performance' | 'structure' | 'accessibility' | 'security';
  title: string; description: string; url: string;
  severity_score: number; found_at: string; resolved: boolean;
}

export interface ScanResult {
  brand_id: string; domain: string; scanned_at: string; duration_ms: number;
  pages_crawled: number; total_issues: number;
  critical_count: number; warning_count: number; info_count: number;
  health_score: number; https_ok: boolean; sitemap_found: boolean; robots_found: boolean;
  avg_load_ms: number; issues: SeoIssue[];
}

interface MonitorState { last_scan_at: string; scans: ScanResult[]; pending_alerts: SeoIssue[]; }
const state: MonitorState = { last_scan_at: '', scans: [], pending_alerts: [] };

function loadState() { ensureDir(); try { if (fs.existsSync(STATE_FILE)) Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))); } catch {} }
function persistState() { ensureDir(); fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }
loadState();

function ts() { return new Date().toISOString(); }
function slug(url: string) { return url.replace(/[^a-z0-9]/gi, '-').slice(0, 30); }

async function checkPage(page: any, url: string, brandId: string): Promise<SeoIssue[]> {
  const issues: SeoIssue[] = []; const t = ts();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const title = await page.title().catch(() => '');
    if (!title || title.length < 5) issues.push({ id: `no-title-${slug(url)}`, brand_id: brandId, type: 'critical', category: 'meta', title: 'Missing meta title', description: 'Empty <title> tag', url, severity_score: 9, found_at: t, resolved: false });
    else if (title.length > 70) issues.push({ id: `title-long-${slug(url)}`, brand_id: brandId, type: 'warning', category: 'meta', title: 'Meta title too long', description: title.length + ' chars (max 70)', url, severity_score: 4, found_at: t, resolved: false });
    const desc = await page.$eval('meta[name="description"]', (el: any) => el.content).catch(() => '');
    if (!desc) issues.push({ id: `no-desc-${slug(url)}`, brand_id: brandId, type: 'warning', category: 'meta', title: 'Missing meta description', description: 'No meta description tag', url, severity_score: 5, found_at: t, resolved: false });
    const h1s = await page.$$eval('h1', (h: any[]) => h.length).catch(() => 0);
    if (h1s === 0) issues.push({ id: `no-h1-${slug(url)}`, brand_id: brandId, type: 'critical', category: 'structure', title: 'No H1 heading', description: 'Page has no H1 tag', url, severity_score: 8, found_at: t, resolved: false });
    else if (h1s > 1) issues.push({ id: `multi-h1-${slug(url)}`, brand_id: brandId, type: 'warning', category: 'structure', title: 'Multiple H1 tags', description: h1s + ' H1s found - should be 1', url, severity_score: 5, found_at: t, resolved: false });
    const noAlt = await page.$$eval('img', (imgs: any[]) => imgs.filter((i: any) => !i.alt).length).catch(() => 0);
    if (noAlt > 0) issues.push({ id: `no-alt-${slug(url)}`, brand_id: brandId, type: 'warning', category: 'accessibility', title: 'Images missing alt text', description: noAlt + ' images without alt', url, severity_score: 5, found_at: t, resolved: false });
    const loadMs = await page.evaluate(() => { const p = (globalThis as any).performance; return p?.timing?.loadEventEnd - p?.timing?.navigationStart || 0; }).catch(() => 0);
    if (loadMs > 4000) issues.push({ id: `slow-${slug(url)}`, brand_id: brandId, type: 'warning', category: 'performance', title: 'Slow page load', description: (loadMs / 1000).toFixed(1) + 's (>4s)', url, severity_score: 6, found_at: t, resolved: false });
    if (url.startsWith('http://')) issues.push({ id: `no-https-${slug(url)}`, brand_id: brandId, type: 'critical', category: 'security', title: 'Not HTTPS', description: 'Served over HTTP', url, severity_score: 10, found_at: t, resolved: false });
  } catch (e) { issues.push({ id: `fail-${slug(url)}`, brand_id: brandId, type: 'critical', category: 'accessibility', title: 'Page load failed', description: (e as Error).message, url, severity_score: 9, found_at: t, resolved: false }); }
  return issues;
}

async function scanBrand(brandId: string, domain: string): Promise<ScanResult> {
  const start = Date.now(); const allIssues: SeoIssue[] = [];
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ userAgent: 'Mi-Core-SEO/1.0' }); const page = await ctx.newPage();
  const base = domain.startsWith('http') ? domain : 'https://' + domain;
  let sitemapFound = false, robotsFound = false, avgMs = 0, pages = 0;
  try {
    try { const r = await fetch(base + '/robots.txt', { signal: AbortSignal.timeout(5000) }); robotsFound = r.ok; } catch {}
    try { const s = await fetch(base + '/sitemap.xml', { signal: AbortSignal.timeout(5000) }); sitemapFound = s.ok; } catch {}
    allIssues.push(...await checkPage(page, base, brandId));
    const ms = await page.evaluate(() => { const p = (globalThis as any).performance; return p?.timing?.loadEventEnd - p?.timing?.navigationStart || 0; }).catch(() => 0);
    avgMs = ms; pages = 1;
    if (sitemapFound) {
      try {
        const sp = await ctx.newPage(); const sr = await sp.goto(base + '/sitemap.xml', { timeout: 8000 });
        if (sr?.ok()) {
          const urls = [...(await sp.content()).matchAll(/<loc>(.*?)<\/loc>/gi)].map((m: any) => m[1]).slice(0, 5);
          for (const u of urls.slice(1)) {
            if (u && !u.includes('#')) {
              const p2 = await ctx.newPage(); allIssues.push(...await checkPage(p2, u, brandId));
              const m = await p2.evaluate(() => { const p = (globalThis as any).performance; return p?.timing?.loadEventEnd - p?.timing?.navigationStart || 0; }).catch(() => 0);
              avgMs += m; pages++; await p2.close().catch(() => {});
            }
          }
        }
        await sp.close().catch(() => {});
      } catch {}
    }
  } finally { await browser.close().catch(() => {}); }
  const crit = allIssues.filter(i => i.type === 'critical').length;
  const warn = allIssues.filter(i => i.type === 'warning').length;
  const info = allIssues.filter(i => i.type === 'info').length;
  return { brand_id: brandId, domain: base, scanned_at: ts(), duration_ms: Date.now() - start, pages_crawled: pages, total_issues: allIssues.length, critical_count: crit, warning_count: warn, info_count: info, health_score: Math.round(Math.max(0, 100 - crit * 20 - warn * 5 - info)), https_ok: base.startsWith('https://'), sitemap_found: sitemapFound, robots_found: robotsFound, avg_load_ms: pages > 0 ? Math.round(avgMs / pages) : 0, issues: allIssues };
}

seoMonitoringRouter.get('/monitoring/health', (_req: Request, res: Response) => {
  const brands = getActiveBrands();
  const summary = brands.map(b => {
    const latest = state.scans.filter(s => s.brand_id === b.brand_id).at(-1);
    return { brand_id: b.brand_id, name: b.name, domain: b.domain, status: b.status, latest_scan: latest ? { scanned_at: latest.scanned_at, health_score: latest.health_score, total_issues: latest.total_issues, critical: latest.critical_count } : null };
  });
  res.json({ ok: true, brands: summary, last_scan_at: state.last_scan_at || null });
});

seoMonitoringRouter.get('/monitoring/alerts', (req: Request, res: Response) => {
  const { brand_id, type, category } = req.query as { brand_id?: string; type?: string; category?: string };
  let alerts = [...state.pending_alerts];
  if (brand_id) alerts = alerts.filter(a => a.brand_id === brand_id);
  if (type) alerts = alerts.filter(a => a.type === type);
  if (category) alerts = alerts.filter(a => a.category === category);
  res.json({ ok: true, count: alerts.length, alerts: alerts.slice(0, 100) });
});

seoMonitoringRouter.get('/monitoring/scans', (req: Request, res: Response) => {
  const { brand_id, limit } = req.query as { brand_id?: string; limit?: string };
  let scans = [...state.scans].reverse();
  if (brand_id) scans = scans.filter(s => s.brand_id === brand_id);
  res.json({ ok: true, count: scans.length, scans: scans.slice(0, parseInt(limit || '20', 10)) });
});

seoMonitoringRouter.get('/monitoring/scan/:brandId', (req: Request, res: Response) => {
  const scan = state.scans.filter(s => s.brand_id === req.params.brandId).at(-1);
  if (!scan) return res.status(404).json({ ok: false, error: 'No scan found' });
  res.json({ ok: true, scan });
});

seoMonitoringRouter.post('/monitoring/scan', async (req: Request, res: Response) => {
  const { brand_id } = req.body as { brand_id?: string };
  const brands = brand_id ? getActiveBrands().filter(b => b.brand_id === brand_id) : getActiveBrands();
  if (!brands.length) return res.json({ ok: false, error: 'No active brands found' });
  const results: ScanResult[] = [];
  for (const brand of brands) {
    const domain = getBrandDomain(brand.brand_id) || brand.domain;
    console.log('[SEO Monitor] Scanning ' + brand.name + ' (' + domain + ')...');
    try {
      const result = await scanBrand(brand.brand_id, domain);
      results.push(result);
      state.scans.push(result);
      if (state.scans.length > 50) state.scans.splice(0, state.scans.length - 50);
      for (const issue of result.issues.filter(i => i.type !== 'info')) {
        if (!state.pending_alerts.find(a => a.id === issue.id)) state.pending_alerts.push(issue);
      }
    } catch (e) { console.error('[SEO Monitor] ' + brand.brand_id + ': ' + (e as Error).message); }
  }
  state.last_scan_at = ts();
  state.pending_alerts = state.pending_alerts.slice(-200);
  persistState();
  res.json({ ok: true, scanned: brands.map(b => b.brand_id), results_count: results.length, results });
});

// Schedule daily scan via cron (called from main server scheduler)
export async function runScheduledScan(): Promise<{ brands: number; issues: number }> {
  const brands = getActiveBrands();
  let totalIssues = 0;
  for (const brand of brands) {
    const domain = getBrandDomain(brand.brand_id) || brand.domain;
    try {
      const result = await scanBrand(brand.brand_id, domain);
      state.scans.push(result);
      if (state.scans.length > 50) state.scans.splice(0, state.scans.length - 50);
      totalIssues += result.total_issues;
      for (const issue of result.issues.filter(i => i.type === 'critical')) {
        state.pending_alerts.push(issue);
      }
    } catch (e) { console.error('[SEO Monitor scheduled] ' + brand.brand_id + ': ' + (e as Error).message); }
  }
  state.last_scan_at = ts();
  state.pending_alerts = state.pending_alerts.slice(-200);
  persistState();
  return { brands: brands.length, issues: totalIssues };
}
