/**
 * Website Crawler Connector
 * Crawls bakudanramen.com pages, extracts SEO-relevant data.
 * Uses native https — zero external deps.
 * Phase 3: Full data extraction with robots, broken links, schema, store to DB.
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', 'reports', 'connectors');
const config = require('../config');

function fetch(url, timeout = 12000, maxRedirects = 5) {
  return new Promise((resolve) => {
    let redirects = 0;
    function doRequest(reqUrl) {
      const parsed = new URL(reqUrl);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.get(reqUrl, { timeout, headers: { 'User-Agent': 'BakudanSEOCrawler/2.0' } }, (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location && redirects < maxRedirects) {
          redirects++;
          const next = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, reqUrl).href;
          res.resume();
          return doRequest(next);
        }
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body, url: reqUrl, original_url: url, redirects }));
      });
      req.on('error', e => resolve({ status: 0, error: e.message, body: '', url: reqUrl, original_url: url }));
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout', body: '', url: reqUrl, original_url: url }); });
    }
    doRequest(url);
  });
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractMeta(html, name) {
  const re = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i');
  const m = html.match(re) || html.match(re2);
  return m ? m[1].trim() : null;
}

function extractH1(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : null;
}

function extractH2s(html) {
  const matches = [];
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let m;
  while ((m = re.exec(html)) !== null) matches.push(m[1].replace(/<[^>]+>/g, '').trim());
  return matches;
}

function extractCanonical(html) {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
  if (m) return m[1];
  const m2 = html.match(/<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["']/i);
  return m2 ? m2[1] : null;
}

function extractRobotsStatus(html, headers) {
  const metaRobots = extractMeta(html, 'robots') || 'index,follow';
  const xRobotsTag = headers['x-robots-tag'] || null;
  const noindex = metaRobots.toLowerCase().includes('noindex') || (xRobotsTag && xRobotsTag.toLowerCase().includes('noindex'));
  const nofollow = metaRobots.toLowerCase().includes('nofollow') || (xRobotsTag && xRobotsTag.toLowerCase().includes('nofollow'));
  return {
    meta_robots: metaRobots,
    x_robots_tag: xRobotsTag,
    indexable: !noindex,
    followable: !nofollow,
  };
}

function extractInternalLinks(html, baseHost) {
  const links = [];
  const re = /href=["'](https?:\/\/[^"'#]*|\/[^"'#]*)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const href = m[1].split('#')[0].split('?')[0];
      if (href.startsWith('/') || new URL(href).hostname === baseHost) {
        links.push(href.startsWith('/') ? `https://${baseHost}${href}` : href);
      }
    } catch {}
  }
  return [...new Set(links)];
}

function extractAllLinks(html, baseUrl) {
  const links = [];
  const re = /href=["'](https?:\/\/[^"'#\s]*|\/[^"'#\s]*)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const href = m[1];
      if (href.startsWith('/')) {
        links.push(new URL(href, baseUrl).href);
      } else {
        links.push(href);
      }
    } catch {}
  }
  return [...new Set(links)];
}

function countImgMissingAlt(html) {
  const imgs = html.match(/<img[^>]*>/gi) || [];
  return imgs.filter(i => !i.match(/alt=["'][^"']+["']/i)).length;
}

function extractImgDetails(html) {
  const imgs = html.match(/<img[^>]*>/gi) || [];
  const total = imgs.length;
  const missingAlt = imgs.filter(i => !i.match(/alt=["'][^"']+["']/i)).length;
  return { total, missing_alt: missingAlt };
}

function hasSchema(html) {
  return html.includes('application/ld+json');
}

function extractSchemaTypes(html) {
  const schemas = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      if (data['@type']) schemas.push(data['@type']);
      if (Array.isArray(data['@graph'])) {
        data['@graph'].forEach(item => { if (item['@type']) schemas.push(item['@type']); });
      }
    } catch {}
  }
  return schemas;
}

async function checkBrokenLinks(links, limit = 20) {
  const broken = [];
  const checked = links.slice(0, limit);
  for (const link of checked) {
    try {
      const res = await fetch(link, 6000, 3);
      if (res.status >= 400 || res.status === 0) {
        broken.push({ url: link, status: res.status, error: res.error || null });
      }
    } catch (e) {
      broken.push({ url: link, status: 0, error: e.message });
    }
  }
  return { broken, checked_count: checked.length };
}

async function crawl(opts = {}) {
  const pages = config.pages ? config.pages.pages : [];
  const baseUrl = config.locations ? config.locations.website : 'https://bakudanramen.com';
  const baseHost = new URL(baseUrl).hostname;
  const results = [];
  const checkBroken = opts.check_broken_links !== false;

  const urls = pages.map(p => p.url);
  if (!urls.includes(baseUrl) && !urls.includes(baseUrl + '/')) {
    urls.unshift(baseUrl);
  }

  for (const url of urls) {
    const res = await fetch(url);
    const html = res.body || '';
    const internalLinks = extractInternalLinks(html, baseHost);
    const allLinks = extractAllLinks(html, url);
    const images = extractImgDetails(html);
    const robots = extractRobotsStatus(html, res.headers || {});
    const schemaTypes = extractSchemaTypes(html);

    // Check for broken links on the homepage only (to avoid excessive requests)
    let brokenLinks = { broken: [], checked_count: 0 };
    if (checkBroken && url === baseUrl) {
      brokenLinks = await checkBrokenLinks(allLinks, 15);
    }

    const record = {
      url,
      source: 'crawler',
      fetched_at: new Date().toISOString(),
      confidence: res.status === 200 ? 'high' : 'low',
      status_code: res.status,
      error: res.error || null,
      title: extractTitle(html),
      meta_description: extractMeta(html, 'description'),
      h1: extractH1(html),
      h2s: extractH2s(html),
      canonical: extractCanonical(html),
      robots_status: robots,
      schema_present: hasSchema(html),
      schema_types: schemaTypes,
      internal_links: internalLinks,
      internal_links_count: internalLinks.length,
      images_total: images.total,
      images_missing_alt: images.missing_alt,
      broken_links: brokenLinks.broken,
      broken_links_count: brokenLinks.broken.length,
      content_length: html.length,
      raw_payload_path: null,
    };
    results.push(record);
  }

  // Save raw payload
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = path.join(REPORTS_DIR, `crawler-${Date.now()}.json`);
  const payload = { source: 'crawler', fetched_at: new Date().toISOString(), pages: results };
  fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2));

  // Store to DB if available
  if (opts.db) {
    for (const page of results) {
      opts.db.upsert('pages', {
        id: `crawl:${page.url}`,
        url: page.url,
        source: 'crawler',
        fetched_at: page.fetched_at,
        confidence: page.confidence,
        status_code: page.status_code,
        title: page.title,
        meta_description: page.meta_description,
        h1: page.h1,
        canonical: page.canonical,
        robots_status: page.robots_status,
        schema_present: page.schema_present,
        images_missing_alt: page.images_missing_alt,
        broken_links_count: page.broken_links_count,
        raw_payload_path: reportPath,
      });
    }
  }

  const successCount = results.filter(r => r.status_code === 200).length;
  return {
    status: successCount > 0 ? 'success' : 'error',
    records: results.length,
    successful_pages: successCount,
    failed_pages: results.length - successCount,
    broken_links_found: results.reduce((sum, r) => sum + r.broken_links_count, 0),
    credentials_configured: true,
    raw_payload_path: reportPath,
    data: results,
    error: successCount === 0 ? 'No pages returned HTTP 200' : null,
  };
}

module.exports = { crawl, fetch };
