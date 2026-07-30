// autonomous-qa/routeCrawler.js — crawls local dev server routes for QA coverage
// Phase 14: offline-only, only crawls localhost; discovers routes from source

import http from 'http';
import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Check if a single route is healthy.
 * @param {string} url  must be localhost
 * @returns {{ url: string, status: number|null, responseMs: number, ok: boolean }}
 */
export function checkRouteHealth(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    try {
      const req = http.get(url, (res) => {
        const responseMs = Date.now() - start;
        res.resume(); // drain body
        resolve({ url, status: res.statusCode, responseMs, ok: res.statusCode < 400 });
      });
      req.on('error', () => resolve({ url, status: null, responseMs: Date.now() - start, ok: false }));
      req.setTimeout(3000, () => { req.destroy(); resolve({ url, status: null, responseMs: 3000, ok: false }); });
    } catch {
      resolve({ url, status: null, responseMs: Date.now() - start, ok: false });
    }
  });
}

/**
 * Crawl a list of known localhost routes.
 * @param {string} baseUrl  e.g. 'http://localhost:3000'
 * @param {{ paths?: string[] }} options
 * @returns {Promise<object[]>}
 */
export async function crawlRoutes(baseUrl, options = {}) {
  if (!baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
    throw new Error('routeCrawler is offline-only: only localhost URLs allowed');
  }

  const paths   = options.paths ?? ['/'];
  const results = [];

  for (const path of paths) {
    const url    = `${baseUrl}${path}`;
    const result = await checkRouteHealth(url);
    results.push(result);
  }

  return results;
}

/**
 * Discover route definitions from source files.
 * Scans Express routes, Next.js pages, React Router, Astro pages.
 * @param {string} projectRoot
 * @returns {string[]} list of route paths
 */
export function discoverRoutes(projectRoot) {
  const routes = new Set(['/']);

  // Express routes
  const routeRe = /(?:app|router)\s*\.\s*(?:get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  // Next.js pages dir
  const pagesDir = join(projectRoot, 'pages');
  if (existsSync(pagesDir)) {
    walkDir(pagesDir, (filePath) => {
      const rel = filePath.replace(pagesDir, '').replace(/\\/g, '/').replace(/\.(jsx?|tsx?)$/, '');
      if (!rel.includes('_') && !rel.includes('[')) {
        routes.add(rel === '/index' ? '/' : rel);
      }
    });
  }

  // Astro pages dir
  const astroDir = join(projectRoot, 'src', 'pages');
  if (existsSync(astroDir)) {
    walkDir(astroDir, (filePath) => {
      const rel = filePath.replace(astroDir, '').replace(/\\/g, '/').replace(/\.\w+$/, '');
      if (!rel.includes('[')) routes.add(rel === '/index' ? '/' : rel);
    });
  }

  // Scan JS/TS files for Express-style routes
  walkDir(projectRoot, (filePath) => {
    if (!/\.(js|ts|mjs)$/.test(filePath)) return;
    try {
      const code = readFileSync(filePath, 'utf8');
      let m;
      while ((m = routeRe.exec(code)) !== null) {
        routes.add(m[1]);
      }
    } catch { /* skip */ }
  }, { maxDepth: 4, skipDirs: ['node_modules', '.git', 'dist', 'build'] });

  return [...routes];
}

/**
 * Generate a crawl coverage report.
 * @param {object[]} results  — from crawlRoutes
 * @returns {{ total: number, ok: number, failing: number, coverage: string }}
 */
export function getCrawlReport(results) {
  const total   = results.length;
  const ok      = results.filter(r => r.ok).length;
  const failing = total - ok;
  return {
    total,
    ok,
    failing,
    coverage:  total > 0 ? `${Math.round((ok / total) * 100)}%` : '0%',
    avgResponseMs: total > 0
      ? Math.round(results.reduce((s, r) => s + r.responseMs, 0) / total) : 0,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function walkDir(dir, fn, opts = {}, depth = 0) {
  const { maxDepth = 6, skipDirs = ['node_modules', '.git'] } = opts;
  if (depth > maxDepth) return;
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (skipDirs.includes(name)) continue;
    const full = join(dir, name);
    try {
      const st = statSync(full);
      if (st.isDirectory()) walkDir(full, fn, opts, depth + 1);
      else fn(full);
    } catch { /* skip */ }
  }
}
