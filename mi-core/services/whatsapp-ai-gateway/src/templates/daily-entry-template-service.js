/**
 * Daily Entry Template Service
 *
 * Daily_Entry_Template is the source of truth for category, item, target range,
 * row order, and active state. Runtime fallback is limited to the last real
 * SQLite template_cache payload written by a successful sheet sync.
 */

const crypto = require('crypto');
const sheetsClient = require('../google/sheets-client');
const templateCache = require('./template-cache');
const { run, get } = require('../storage/sqlite');
const { extractSpreadsheetId } = require('../google/sheet-mapper');
const { makeLogger } = require('../logger');

const log = makeLogger('whatsapp');

const TEMPLATE_NAME = 'Daily_Entry_Template';
const NOT_AVAILABLE_MESSAGE = 'Template is not available. Please contact manager or try again later.';

let _current = null;

function normalizeHeader(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseNumber(value) {
  const raw = String(value ?? '').trim();
  if (!raw || /^n\/?a$/i.test(raw) || /^na$/i.test(raw)) return null;
  const cleaned = raw.replace(/[^\d.+-]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function parseActive(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return true;
  return !['0', 'false', 'no', 'inactive', 'off'].includes(raw);
}

function computeVersion(items) {
  const payload = items.map(i => ({
    category: i.category,
    item_name: i.item_name,
    target_min: i.target_min,
    target_max: i.target_max,
    active: i.active,
    sort_order: i.sort_order,
  }));
  return crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex').slice(0, 12);
}

function buildTemplate({ items, headerRow, source, spreadsheetId, tab, syncedAt, warnings = [] }) {
  const version = computeVersion(items);
  const validation = validateTemplate({ items, headerRow, warnings });
  return {
    template_name: TEMPLATE_NAME,
    template_version: version,
    source,
    spreadsheet_id: spreadsheetId || null,
    tab: tab || TEMPLATE_NAME,
    header_row: headerRow || null,
    item_count: items.filter(i => i.active !== false).length,
    items,
    validation,
    available: items.filter(i => i.active !== false).length > 0 && validation.ok,
    last_sync_at: syncedAt || new Date().toISOString(),
  };
}

function parseTemplateRows(rows, options = {}) {
  const expected = {
    category: ['category'],
    item: ['item', 'itemname', 'name'],
    targetMin: ['targetmin', 'min', 'targetminimum'],
    targetMax: ['targetmax', 'max', 'targetmaximum'],
    active: ['active', 'enabled'],
  };
  let headerIndex = -1;
  let columns = {};
  const warnings = [];

  for (let r = 0; r < rows.length; r += 1) {
    const normalized = (rows[r] || []).map(normalizeHeader);
    const found = {};
    for (const [key, aliases] of Object.entries(expected)) {
      const idx = normalized.findIndex(cell => aliases.includes(cell));
      if (idx >= 0) found[key] = idx;
    }
    if (found.category != null && found.item != null && found.targetMin != null && found.targetMax != null) {
      headerIndex = r;
      columns = found;
      break;
    }
  }

  if (headerIndex < 0) {
    return buildTemplate({
      items: [],
      headerRow: null,
      source: options.source || 'sheet',
      spreadsheetId: options.spreadsheetId,
      tab: options.tab,
      syncedAt: options.syncedAt,
      warnings: ['Header not found: expected Category | Item | Target Min | Target Max'],
    });
  }

  const items = [];
  const dataRows = rows.slice(headerIndex + 1);
  for (const [offset, row] of dataRows.entries()) {
    const rowNumber = headerIndex + offset + 2;
    const itemName = String(row[columns.item] || '').trim();
    if (!itemName) {
      const hasAnyValue = (row || []).some(v => String(v || '').trim());
      if (hasAnyValue) warnings.push(`Row ${rowNumber}: blank item name ignored`);
      continue;
    }

    const targetMin = parseNumber(row[columns.targetMin]);
    const targetMax = parseNumber(row[columns.targetMax]);
    const active = columns.active == null ? true : parseActive(row[columns.active]);

    items.push({
      category: String(row[columns.category] || '').trim() || null,
      item_name: itemName,
      target_min: targetMin,
      target_max: targetMax,
      unit: 'F',
      row_number: rowNumber,
      active,
      sort_order: items.length + 1,
    });
  }

  return buildTemplate({
    items,
    headerRow: headerIndex + 1,
    source: options.source || 'sheet',
    spreadsheetId: options.spreadsheetId,
    tab: options.tab,
    syncedAt: options.syncedAt,
    warnings,
  });
}

function parseTemplateRangeRows(rows, options = {}) {
  const startRow = options.startRow || 11;
  const items = [];
  const warnings = [];
  for (const [offset, row] of (rows || []).entries()) {
    const rowNumber = startRow + offset;
    const itemName = String(row?.[0] || '').trim();
    if (!itemName) continue;
    items.push({
      category: null,
      item_name: itemName,
      target_min: parseNumber(row?.[1]),
      target_max: parseNumber(row?.[2]),
      unit: 'F',
      row_number: rowNumber,
      active: true,
      sort_order: items.length + 1,
    });
  }
  return buildTemplate({
    items,
    headerRow: startRow,
    source: options.source || 'sheet',
    spreadsheetId: options.spreadsheetId,
    tab: options.tab,
    syncedAt: options.syncedAt,
    warnings,
  });
}

function validateTemplate(template = _current) {
  const items = Array.isArray(template?.items) ? template.items : [];
  const errors = [];
  const warnings = [...(template?.warnings || [])];
  const activeItems = items.filter(i => i.active !== false);
  const seen = new Map();

  if (!template?.headerRow && !template?.header_row) {
    errors.push('Header row not detected.');
  }
  if (activeItems.length < 1) {
    errors.push('No active template items found.');
  }

  for (const item of activeItems) {
    const key = String(item.item_name || '').trim().toLowerCase();
    if (!key) {
      errors.push(`Row ${item.row_number || '?'}: item name is blank.`);
      continue;
    }
    if (seen.has(key)) {
      errors.push(`Duplicate item name: ${item.item_name}`);
    }
    seen.set(key, true);
    if (!item.category) warnings.push(`Row ${item.row_number || '?'}: category is blank for ${item.item_name}`);
    if (item.target_min != null && item.target_max != null && item.target_min > item.target_max) {
      errors.push(`${item.item_name}: Target Min is greater than Target Max.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    item_count: activeItems.length,
    header_found: !!(template?.headerRow || template?.header_row),
    duplicate_item_names: errors.filter(e => e.startsWith('Duplicate item name:')),
  };
}

function toLegacyItems(template) {
  return (template.items || [])
    .filter(i => i.active !== false)
    .map((item, idx) => ({
      name: item.item_name,
      min: item.target_min,
      max: item.target_max,
      sortOrder: item.sort_order || idx + 1,
      section: item.category || null,
      unit: item.unit || 'F',
      rowNumber: item.row_number || null,
    }));
}

async function saveTemplate(template) {
  const payload = JSON.stringify(template);
  const syncedAt = template.last_sync_at || new Date().toISOString();
  await run(`
    INSERT INTO template_cache (template_name, template_version, source, item_count, payload_json, last_sync_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [TEMPLATE_NAME, template.template_version, template.source || 'sheet', template.item_count, payload, syncedAt, syncedAt]);

  await templateCache.persist(toLegacyItems(template), syncedAt, template.template_version);
  _current = template;
  return template;
}

async function loadCachedTemplate() {
  const row = await get(`
    SELECT * FROM template_cache
    WHERE template_name = ?
    ORDER BY id DESC
    LIMIT 1
  `, [TEMPLATE_NAME]);
  if (!row) return null;
  const template = JSON.parse(row.payload_json || '{}');
  template.source = 'sqlite';
  template.available = (template.item_count || 0) > 0 && validateTemplate(template).ok;
  template.validation = validateTemplate(template);
  _current = template;
  return template;
}

async function getSpreadsheetId() {
  const envId = process.env.TEMPLATE_SPREADSHEET_ID
    || extractSpreadsheetId(process.env.TEMPLATE_SHEET_URL || '');
  if (envId) return envId;

  try {
    const storeRegistry = require('../stores/store-registry');
    const links = await storeRegistry.getGoogleSheetLinks();
    const configured = extractSpreadsheetId(links?.template_sheet_url || '');
    if (configured) return configured;
  } catch (_) {}

  return process.env.FOOD_SAFETY_LOG_SPREADSHEET_ID
    || extractSpreadsheetId(process.env.FOOD_SAFETY_LOG_SHEET_URL || '')
    || undefined;
}

async function syncFromGoogleSheet() {
  const tab = process.env.TEMPLATE_SHEET || TEMPLATE_NAME;
  const spreadsheetId = await getSpreadsheetId();
  const range = process.env.TEMPLATE_SCAN_RANGE || 'B11:D35';
  const syncedAt = new Date().toISOString();
  log.info('Daily entry template sync: fetching', { tab, range, spreadsheetId: spreadsheetId ? 'configured' : 'default' });
  const rows = await sheetsClient.getValues({ spreadsheetId, tab, range });
  const template = parseTemplateRangeRows(rows, { source: 'sheet', spreadsheetId, tab, syncedAt, startRow: 11 });
  if (!template.available) {
    const errors = template.validation?.errors?.join('; ') || 'Template validation failed';
    throw new Error(errors);
  }
  return saveTemplate(template);
}

function unavailableTemplate() {
  return {
    template_name: TEMPLATE_NAME,
    template_version: null,
    source: 'unavailable',
    item_count: 0,
    items: [],
    validation: { ok: false, errors: [NOT_AVAILABLE_MESSAGE], warnings: [], item_count: 0, header_found: false, duplicate_item_names: [] },
    available: false,
    last_sync_at: null,
  };
}

function getCurrentTemplate() {
  if (_current) return _current;
  const snapshot = templateCache.getSnapshot();
  if (snapshot.items.length > 0) {
    const items = snapshot.items.map((item, idx) => ({
      category: item.section || null,
      item_name: item.name,
      target_min: item.min ?? null,
      target_max: item.max ?? null,
      unit: item.unit || 'F',
      row_number: item.rowNumber || null,
      active: true,
      sort_order: item.sortOrder || idx + 1,
    }));
    _current = buildTemplate({
      items,
      headerRow: 1,
      source: snapshot.source,
      syncedAt: snapshot.syncedAt,
    });
    _current.template_version = snapshot.version;
    return _current;
  }
  return unavailableTemplate();
}

function getTemplateItems() {
  return getCurrentTemplate().items.filter(i => i.active !== false);
}

function getItems() {
  return getTemplateItems();
}

function getItemCount() {
  return getTemplateItems().length;
}

function getTemplateVersion() {
  return getCurrentTemplate().template_version;
}

function getItemByIndex(index) {
  const idx = Number(index) - 1;
  return getTemplateItems()[idx] || null;
}

function getItemByName(name) {
  const needle = String(name || '').trim().toLowerCase();
  return getTemplateItems().find(i => String(i.item_name).toLowerCase() === needle) || null;
}

function formatRange(item) {
  if (!item) return 'No target';
  const min = item.target_min ?? item.min ?? null;
  const max = item.target_max ?? item.max ?? null;
  const unit = item.unit || 'F';
  const suffix = unit === 'F' ? '°F' : unit;
  if (min != null && max != null) return `${min}${suffix} - ${max}${suffix}`;
  if (min != null) return `>= ${min}${suffix}`;
  if (max != null) return `<= ${max}${suffix}`;
  return 'No target range';
}

function getRangeDisplay(item) {
  return formatRange(item);
}

async function saveCache(template) {
  return saveTemplate(template);
}

async function loadCache() {
  return loadCachedTemplate();
}

function injectTemplate(template) {
  _current = template;
  templateCache.injectSnapshot(toLegacyItems(template), template.source || 'test');
}

function clearTemplate() {
  _current = null;
}

module.exports = {
  TEMPLATE_NAME,
  NOT_AVAILABLE_MESSAGE,
  syncFromGoogleSheet,
  getCurrentTemplate,
  getItems,
  getTemplateItems,
  getTemplateVersion,
  validateTemplate,
  getItemCount,
  getItemByIndex,
  getItemByName,
  getRangeDisplay,
  formatRange,
  parseTemplateRows,
  parseTemplateRangeRows,
  loadCachedTemplate,
  loadCache,
  saveTemplate,
  saveCache,
  injectTemplate,
  clearTemplate,
};
