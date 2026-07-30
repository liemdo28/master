// autonomous-qa/screenshotEngine.js — screenshot diffing for visual regression QA
// Phase 14: graceful fallback if capture unavailable; comparison logic is pure JS

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const BASELINES_DIR = '.local-agent/visual-baselines';

/**
 * Attempt to capture a screenshot of a localhost URL.
 * Falls back gracefully if no tool available.
 * @param {string} url  must be localhost
 * @param {{ outputPath?: string }} options
 * @returns {{ success: boolean, path?: string, method?: string, error?: string, metadata: object }}
 */
export async function captureScreenshot(url, options = {}) {
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    return { success: false, error: 'Only localhost URLs allowed (offline mode)', metadata: {} };
  }

  const metadata = { url, capturedAt: new Date().toISOString(), method: null };

  // Try puppeteer CLI if available
  try {
    execSync('which puppeteer 2>/dev/null || node -e "require(\'puppeteer\')"', { stdio: 'pipe', timeout: 3000 });
    // Puppeteer is available but we won't actually spawn it in this module
    // — delegate to external script pattern
    metadata.method = 'puppeteer_available';
    return { success: false, error: 'Screenshot capture requires external invocation', metadata };
  } catch { /* puppeteer not available */ }

  // Try screenshot-desktop if available
  try {
    execSync('which scrot || which gnome-screenshot || which screencapture', { stdio: 'pipe', timeout: 2000 });
    metadata.method = 'system_screenshot';
    return { success: false, error: 'System screenshot tools available but not auto-invoked', metadata };
  } catch { /* not available */ }

  metadata.method = 'none';
  return { success: false, error: 'No screenshot tool available — install puppeteer for capture', metadata };
}

/**
 * Compare two screenshots by pixel diff percentage (stub — compares file size as proxy).
 * @param {Buffer|string} baseline  raw image data or path
 * @param {Buffer|string} current
 * @returns {{ diffPercent: number, identical: boolean, pixelsCompared: number }}
 */
export function compareScreenshots(baseline, current) {
  try {
    const aSize = Buffer.isBuffer(baseline) ? baseline.length : existsSync(baseline) ? readFileSync(baseline).length : 0;
    const bSize = Buffer.isBuffer(current)  ? current.length  : existsSync(current)  ? readFileSync(current).length  : 0;

    if (aSize === 0 || bSize === 0) return { diffPercent: 100, identical: false, pixelsCompared: 0 };

    const sizeDiff    = Math.abs(aSize - bSize) / Math.max(aSize, bSize);
    const diffPercent = +(sizeDiff * 100).toFixed(2);
    return { diffPercent, identical: diffPercent < 0.5, pixelsCompared: Math.min(aSize, bSize) };
  } catch {
    return { diffPercent: 100, identical: false, pixelsCompared: 0 };
  }
}

/**
 * Save a baseline screenshot.
 * @param {string} name
 * @param {Buffer|string} data
 * @param {string} workspaceRoot
 */
export function saveBaseline(name, data, workspaceRoot = process.cwd()) {
  const dir  = join(workspaceRoot, BASELINES_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${sanitizeName(name)}.png`);
  writeFileSync(filePath, Buffer.isBuffer(data) ? data : Buffer.from(data));
  return filePath;
}

/**
 * Load a saved baseline.
 * @param {string} name
 * @param {string} workspaceRoot
 * @returns {Buffer|null}
 */
export function loadBaseline(name, workspaceRoot = process.cwd()) {
  const filePath = join(workspaceRoot, BASELINES_DIR, `${sanitizeName(name)}.png`);
  if (!existsSync(filePath)) return null;
  try { return readFileSync(filePath); } catch { return null; }
}

/**
 * Generate a visual regression report from a set of comparisons.
 * @param {Array<{ name: string, diffPercent: number, identical: boolean }>} comparisons
 * @returns {{ totalChecked: number, regressions: object[], passRate: string }}
 */
export function getVisualRegressionReport(comparisons) {
  const regressions = comparisons.filter(c => !c.identical);
  return {
    totalChecked: comparisons.length,
    regressions,
    passRate: comparisons.length > 0
      ? `${Math.round(((comparisons.length - regressions.length) / comparisons.length) * 100)}%`
      : '0%',
  };
}

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}
