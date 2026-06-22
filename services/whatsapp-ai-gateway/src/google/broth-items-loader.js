/**
 * Broth Items Loader
 *
 * Legacy loader retained for tests/manual utilities.
 * Production /broth uses templates/daily-entry-template-service.js.
 *
 * Config env vars:
 *   BROTH_ITEM_SOURCE_SHEET      = Daily_Entry_Template  (tab name)
 *   BROTH_ITEM_SOURCE_COLUMN     = B
 *   BROTH_ITEM_SOURCE_START_ROW  = 11
 *   BROTH_ITEM_SPREADSHEET_ID    = (uses FOOD_SAFETY_LOG_SPREADSHEET_ID if unset)
 */

const fs   = require('fs');
const path = require('path');
const sheetsClient = require('./sheets-client');
const { makeLogger } = require('../logger');

const log = makeLogger('whatsapp');

const CACHE_PATH = path.resolve('./data/broth-items-cache.json');

const DEFAULT_ITEMS = [];

// In-process cache
let _cachedItems = null;
let _cacheSource = 'default';

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns the current item list (in-process cache → disk cache → empty).
 * Does NOT trigger a network request. Use refreshFromSheet() for that.
 */
function getItems() {
  if (_cachedItems) return _cachedItems;

  // Try disk cache
  if (fs.existsSync(CACHE_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
      if (Array.isArray(raw.items) && raw.items.length > 0) {
        _cachedItems = raw.items;
        _cacheSource = 'disk_cache';
        log.info('Broth items loaded from disk cache', { count: _cachedItems.length });
        return _cachedItems;
      }
    } catch (_) {}
  }

  _cachedItems = DEFAULT_ITEMS;
  _cacheSource = 'default';
  return _cachedItems;
}

/**
 * Reads item list from Google Sheets and updates in-process + disk cache.
 * Resolves to: { items, source: 'sheet' | 'disk_cache' | 'default', count }.
 */
async function refreshFromSheet() {
  const tab        = process.env.BROTH_ITEM_SOURCE_SHEET      || 'Daily_Entry_Template';
  const col        = (process.env.BROTH_ITEM_SOURCE_COLUMN    || 'B').toUpperCase();
  const startRow   = parseInt(process.env.BROTH_ITEM_SOURCE_START_ROW || '11', 10);
  const overrideId = process.env.BROTH_ITEM_SPREADSHEET_ID    || undefined;

  try {
    // Read a generous range — stop at first empty cell
    const endRow = startRow + 50;
    const range = `${col}${startRow}:${col}${endRow}`;

    log.info('Loading broth items from sheet', { tab, range });
    const rows = await sheetsClient.getValues({ spreadsheetId: overrideId, tab, range });

    const items = rows
      .map(r => String(r[0] || '').trim())
      .filter(Boolean);

    if (items.length < 3) {
      throw new Error(`Too few items returned from sheet (${items.length}) — ignoring`);
    }

    _cachedItems = items;
    _cacheSource = 'sheet';

    // Persist to disk
    try {
      const dir = path.dirname(CACHE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CACHE_PATH, JSON.stringify({ items, loadedAt: new Date().toISOString(), tab, range }, null, 2));
    } catch (writeErr) {
      log.warn('Could not write broth items cache', { error: writeErr.message });
    }

    log.info('Broth items loaded from sheet', { count: items.length, tab });
    return { items, source: 'sheet', count: items.length };

  } catch (err) {
    log.warn('Could not load broth items from sheet — using legacy cache only', { error: err.message });
    const fallback = getItems(); // returns disk cache or default
    return { items: fallback, source: _cacheSource, count: fallback.length, error: err.message };
  }
}

/** Returns the source of the current in-process cache. */
function getCacheSource() { return _cacheSource; }

/** Force-clear in-process cache (for tests). */
function clearCache() { _cachedItems = null; _cacheSource = 'default'; }

/** Write a specific list to disk cache (for tests / manual override). */
function writeCache(items) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify({ items, loadedAt: new Date().toISOString() }, null, 2));
  _cachedItems = items;
  _cacheSource = 'disk_cache';
}

module.exports = { getItems, refreshFromSheet, getCacheSource, clearCache, writeCache, DEFAULT_ITEMS, CACHE_PATH };
