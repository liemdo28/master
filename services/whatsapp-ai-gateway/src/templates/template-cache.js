/**
 * Template Cache
 *
 * Runtime cache for Daily_Entry_Template data:
 *   1. In-process runtime snapshot (fastest — zero I/O)
 *   2. SQLite template_cache table (last real Google Sheet sync)
 *
 * All public functions are synchronous-readable (getItems(), getThresholds())
 * because they hit the runtime snapshot. Writes go to SQLite via upsert.
 * There is intentionally no hardcoded operational fallback.
 */

const { run, all, get } = require('../storage/sqlite');
const crypto = require('crypto');
const { makeLogger } = require('../logger');

const log = makeLogger('whatsapp');

const DEFAULT_ITEMS = [];

// ── In-process snapshot ───────────────────────────────────────────────────────
let _snapshot = null;
/*
  _snapshot shape:
  {
    items: [{ name, min, max, sortOrder, section }],
    version: 'sha1hex',
    syncedAt: 'ISO string',
    rowCount: N,
    source: 'sheet' | 'sqlite' | 'unavailable' | 'test'
  }
*/

// ── Version helper ────────────────────────────────────────────────────────────
function computeVersion(items) {
  const sig = items.map(i => `${i.name}|${i.min}|${i.max}|${i.section || ''}`).join('\n');
  return crypto.createHash('sha1').update(sig).digest('hex').slice(0, 12);
}

// ── Public reads (always use snapshot → never await) ─────────────────────────

/** Returns array of item names in sort order. */
function getItemNames() {
  return getSnapshot().items.map(i => i.name);
}

/** Returns full item objects [{ name, min, max, sortOrder, section }]. */
function getItems() {
  return getSnapshot().items;
}

/** Returns { itemName: { min, max } } — for threshold validation. */
function getThresholds() {
  const out = {};
  for (const item of getSnapshot().items) {
    if (item.min != null || item.max != null) {
      out[item.name] = { min: item.min, max: item.max };
    }
  }
  return out;
}

/** Returns snapshot metadata (version, syncedAt, rowCount, source). */
function getStatus() {
  const s = getSnapshot();
  return { version: s.version, syncedAt: s.syncedAt, rowCount: s.rowCount, source: s.source };
}

function getSnapshot() {
  if (!_snapshot) {
    _snapshot = {
      items: [],
      version: null,
      syncedAt: null,
      rowCount: 0,
      source: 'unavailable',
    };
  }
  return _snapshot;
}

// ── Warm from DB (call on startup, after DB ready) ────────────────────────────
async function warmFromDb() {
  try {
    const cacheRow = await get(`
      SELECT * FROM template_cache
      WHERE template_name = ?
      ORDER BY id DESC
      LIMIT 1
    `, ['Daily_Entry_Template']);
    if (!cacheRow) {
      log.info('Template cache: no synced template_cache payload available');
      return;
    }
    const payload = JSON.parse(cacheRow.payload_json || '{}');
    const sourceItems = Array.isArray(payload.items) ? payload.items : [];
    const items = sourceItems
      .filter(i => i.active !== false)
      .map((i, idx) => ({
        name: i.item_name || i.name,
        min: i.target_min ?? i.min ?? null,
        max: i.target_max ?? i.max ?? null,
        sortOrder: i.sort_order || idx + 1,
        section: i.category || i.section || null,
        unit: i.unit || 'F',
        rowNumber: i.row_number || null,
      }))
      .filter(i => i.name);
    _snapshot = {
      items,
      version: cacheRow.template_version || computeVersion(items),
      syncedAt: cacheRow.last_sync_at || null,
      rowCount: items.length,
      source: 'sqlite',
    };
    log.info('Template cache warmed from SQLite', { count: items.length, version: _snapshot.version });
  } catch (err) {
    log.warn('Template cache warm failed', { error: err.message });
  }
}

// ── Write from sync service ───────────────────────────────────────────────────
/**
 * Persist a fresh item list to SQLite and update the runtime snapshot.
 * @param {Array<{ name, min, max, sortOrder, section }>} items
 * @param {string} syncedAt
 */
async function persist(items, syncedAt, forcedVersion = null) {
  const version = forcedVersion || computeVersion(items);
  const now = syncedAt || new Date().toISOString();

  await run(`DELETE FROM template_items`);

  for (const item of items) {
    await run(`
      INSERT INTO template_items (item_name, target_min, target_max, sort_order, section, template_version, last_sync_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_name) DO UPDATE SET
        target_min       = excluded.target_min,
        target_max       = excluded.target_max,
        sort_order       = excluded.sort_order,
        section          = excluded.section,
        template_version = excluded.template_version,
        last_sync_at     = excluded.last_sync_at
    `, [item.name, item.min ?? null, item.max ?? null, item.sortOrder, item.section ?? null, version, now]);
  }

  _snapshot = { items: items.map(i => ({ ...i })), version, syncedAt: now, rowCount: items.length, source: 'sheet' };
  log.info('Template cache persisted', { count: items.length, version });
  return version;
}

/** Force-clear snapshot (for tests). */
function clearSnapshot() { _snapshot = null; }

/** Inject a test snapshot directly (for tests). */
function injectSnapshot(items, source = 'test') {
  _snapshot = {
    items: items.map((item, idx) => typeof item === 'string'
      ? { name: item, min: null, max: null, sortOrder: idx + 1, section: null }
      : { sortOrder: idx + 1, section: null, ...item }),
    version: computeVersion(items),
    syncedAt: new Date().toISOString(),
    rowCount: items.length,
    source,
  };
}

module.exports = {
  DEFAULT_ITEMS,
  getItemNames,
  getItems,
  getThresholds,
  getStatus,
  getSnapshot,
  warmFromDb,
  persist,
  computeVersion,
  clearSnapshot,
  injectSnapshot,
};
