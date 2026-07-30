// autonomous-qa/seoAnalyzer.js — offline SEO analysis of built HTML files
// Phase 14: checks title, meta, h1, canonical, og tags, alt text, structured data

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Analyze SEO quality of a single HTML file.
 * @param {string} htmlFilePath
 * @returns {{ score: number, issues: string[], warnings: string[], passed: string[], file: string }}
 */
export function analyzeSEO(htmlFilePath) {
  const issues   = [];
  const warnings = [];
  const passed   = [];
  let html;

  try {
    html = readFileSync(htmlFilePath, 'utf8');
  } catch (err) {
    return { score: 0, issues: [`Cannot read file: ${err.message}`], warnings: [], passed: [], file: htmlFilePath };
  }

  // Title tag
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  if (!titleMatch || !titleMatch[1].trim()) {
    issues.push('Missing <title> tag');
  } else if (titleMatch[1].trim().length < 10) {
    warnings.push(`Title too short: "${titleMatch[1].trim()}"`);
    passed.push('Title tag present');
  } else if (titleMatch[1].trim().length > 70) {
    warnings.push('Title exceeds 70 characters');
    passed.push('Title tag present');
  } else {
    passed.push('Title tag: OK');
  }

  // Meta description
  const metaDesc = html.match(/<meta\s[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/<meta\s[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  if (!metaDesc) {
    issues.push('Missing meta description');
  } else {
    const len = metaDesc[1].length;
    if (len < 50 || len > 160) warnings.push(`Meta description length ${len} (ideal: 50–160)`);
    else passed.push('Meta description: OK');
  }

  // H1
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/is);
  if (!h1Match) issues.push('Missing <h1> tag');
  else passed.push('H1 tag present');

  // Canonical
  if (/<link[^>]*rel=["']canonical["']/i.test(html)) passed.push('Canonical link present');
  else warnings.push('No canonical link found');

  // OG tags
  if (/<meta[^>]*property=["']og:title["']/i.test(html)) passed.push('og:title present');
  else warnings.push('Missing og:title');

  if (/<meta[^>]*property=["']og:description["']/i.test(html)) passed.push('og:description present');
  else warnings.push('Missing og:description');

  // Alt text on images
  const imgTags    = [...html.matchAll(/<img[^>]+>/gi)];
  const missingAlt = imgTags.filter(m => !/alt=["'][^"']*["']/i.test(m[0]));
  if (missingAlt.length > 0) {
    issues.push(`${missingAlt.length} image(s) missing alt text`);
  } else if (imgTags.length > 0) {
    passed.push('All images have alt text');
  }

  // Structured data
  if (/<script[^>]*type=["']application\/ld\+json["']/i.test(html)) {
    passed.push('Structured data (JSON-LD) present');
  } else {
    warnings.push('No JSON-LD structured data found');
  }

  // Score: 100 minus 15 per issue, 5 per warning
  const score = Math.max(0, 100 - issues.length * 15 - warnings.length * 5);
  return { score, issues, warnings, passed, file: htmlFilePath };
}

/**
 * Analyze all HTML files in a build directory.
 * @param {string} buildDir
 * @returns {object[]}
 */
export function analyzeDirectory(buildDir) {
  const results = [];
  walkDir(buildDir, (filePath) => {
    if (!filePath.endsWith('.html')) return;
    results.push(analyzeSEO(filePath));
  });
  return results;
}

/**
 * Generate an SEO report summary from multiple file results.
 * @param {object[]} results
 * @returns {{ avgScore: number, totalIssues: number, totalWarnings: number, files: number }}
 */
export function getSEOReport(results) {
  const avgScore = results.length > 0
    ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;
  return {
    avgScore,
    totalIssues:   results.reduce((s, r) => s + r.issues.length, 0),
    totalWarnings: results.reduce((s, r) => s + r.warnings.length, 0),
    files:         results.length,
  };
}

function walkDir(dir, fn, depth = 0) {
  if (depth > 5) return;
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    const full = join(dir, name);
    try {
      const st = statSync(full);
      if (st.isDirectory()) walkDir(full, fn, depth + 1);
      else fn(full);
    } catch { /* skip */ }
  }
}
