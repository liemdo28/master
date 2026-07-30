// autonomous-qa/accessibilityAnalyzer.js — offline accessibility analysis of HTML
// Phase 14: checks alt attrs, ARIA, heading hierarchy, form labels, lang, focus

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Analyze a single HTML file for accessibility.
 * @param {string} htmlFilePath
 * @returns {{ score: number, violations: string[], warnings: string[], level: string, file: string }}
 */
export function analyzeAccessibility(htmlFilePath) {
  const violations = [];
  const warnings   = [];
  let html;

  try {
    html = readFileSync(htmlFilePath, 'utf8');
  } catch (err) {
    return { score: 0, violations: [`Cannot read file: ${err.message}`], warnings: [], level: 'A', file: htmlFilePath };
  }

  // ── lang attribute ────────────────────────────────────────────────────────
  if (/<html[^>]+lang=["'][^"']+["']/i.test(html)) {
    // pass
  } else {
    violations.push('Missing lang attribute on <html> element (WCAG 3.1.1 - Level A)');
  }

  // ── Alt text on images ────────────────────────────────────────────────────
  const imgs       = [...html.matchAll(/<img[^>]+>/gi)];
  const noAlt      = imgs.filter(m => !/alt=["'][^"']*["']/i.test(m[0]));
  if (noAlt.length > 0) {
    violations.push(`${noAlt.length} image(s) missing alt attribute (WCAG 1.1.1 - Level A)`);
  }

  // ── Form labels ───────────────────────────────────────────────────────────
  const inputs     = [...html.matchAll(/<input[^>]+>/gi)];
  const labeledIds = [...html.matchAll(/for=["']([^"']+)["']/gi)].map(m => m[1]);
  const ariaLabeled = (str) => /aria-label=|aria-labelledby=|id=["'][^"']+["']/i.test(str);
  const unlabeled  = inputs.filter(m => {
    const input = m[0];
    if (/type=["'](?:hidden|submit|button|reset|image)["']/i.test(input)) return false;
    const idMatch = input.match(/id=["']([^"']+)["']/i);
    if (idMatch && labeledIds.includes(idMatch[1])) return false;
    return !ariaLabeled(input);
  });
  if (unlabeled.length > 0) {
    violations.push(`${unlabeled.length} form input(s) without associated label (WCAG 1.3.1 - Level A)`);
  }

  // ── Heading hierarchy ─────────────────────────────────────────────────────
  const headings = [...html.matchAll(/<h([1-6])[^>]*>/gi)].map(m => parseInt(m[1], 10));
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] > headings[i - 1] + 1) {
      warnings.push(`Heading hierarchy skip: h${headings[i - 1]} → h${headings[i]} (WCAG 1.3.1)`);
      break;
    }
  }

  // ── ARIA roles ────────────────────────────────────────────────────────────
  const invalidRoles = [...html.matchAll(/role=["']([^"']+)["']/gi)]
    .map(m => m[1])
    .filter(r => !VALID_ARIA_ROLES.has(r));
  if (invalidRoles.length > 0) {
    warnings.push(`Non-standard ARIA roles: ${[...new Set(invalidRoles)].join(', ')}`);
  }

  // ── Keyboard focus indicators ─────────────────────────────────────────────
  if (/outline\s*:\s*0|outline\s*:\s*none/.test(html)) {
    warnings.push('CSS may suppress focus outlines — verify keyboard navigation (WCAG 2.4.7)');
  }

  // ── Color contrast (hint only — no pixel analysis) ─────────────────────────
  if (/color\s*:\s*#[a-f0-9]{6}/i.test(html)) {
    warnings.push('Color values found — verify contrast ratios meet WCAG 1.4.3 (4.5:1 for normal text)');
  }

  const score = Math.max(0, 100 - violations.length * 20 - warnings.length * 5);
  const level = violations.length === 0 && warnings.length === 0 ? 'AAA'
    : violations.length === 0 ? 'AA' : 'A';

  return { score, violations, warnings, level, file: htmlFilePath };
}

/**
 * Analyze all HTML files in a directory.
 * @param {string} buildDir
 * @returns {object[]}
 */
export function analyzeDirectory(buildDir) {
  const results = [];
  walkDir(buildDir, (filePath) => {
    if (!filePath.endsWith('.html')) return;
    results.push(analyzeAccessibility(filePath));
  });
  return results;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_ARIA_ROLES = new Set([
  'alert','alertdialog','application','article','banner','button','cell','checkbox',
  'columnheader','combobox','complementary','contentinfo','definition','dialog',
  'directory','document','feed','figure','form','grid','gridcell','group',
  'heading','img','link','list','listbox','listitem','log','main','marquee',
  'math','menu','menubar','menuitem','menuitemcheckbox','menuitemradio','navigation',
  'none','note','option','presentation','progressbar','radio','radiogroup',
  'region','row','rowgroup','rowheader','scrollbar','search','searchbox',
  'separator','slider','spinbutton','status','switch','tab','table','tablist',
  'tabpanel','term','textbox','timer','toolbar','tooltip','tree','treegrid','treeitem',
]);

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
