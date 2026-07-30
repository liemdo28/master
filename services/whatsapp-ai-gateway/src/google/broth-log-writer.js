/**
 * Broth / Daily Entry Log Writer
 *
 * Writes confirmed daily entry sessions to Google Sheets.
 * Writes one row per template item so the sheet/log includes every item.
 *
 * Tab: WhatsApp_AI_Daily_Log  (configurable via BROTH_LOG_TAB)
 */

const sheetsClient = require('./sheets-client');
const storage      = require('../storage/food-safety-storage');
const storeRegistry = require('../stores/store-registry');
const templateCache = require('../templates/template-cache');

const BROTH_LOG_TAB = process.env.BROTH_LOG_TAB || 'WhatsApp_AI_Daily_Log';

const LOG_COLUMNS = [
  'timestamp',
  'store',
  'employee',
  'item',
  'category',
  'value',
  'target_min',
  'target_max',
  'status',
  'source',
  'notes',
];

const COLUMN_END = 'K';

function buildRows({ metadata, store, storeId, counts, validationResult, sheetWriteStatus = 'PENDING', notes = '' }) {
  const resolvedStoreId = storeId || storeRegistry.getStoreByName(store)?.store_id || '';
  if (!resolvedStoreId) throw new Error('store_id is required for Daily Entry log writes');
  const timestamp = formatTimestamp(metadata?.timestamp || new Date().toISOString());
  const itemMeta = Object.fromEntries(templateCache.getItems().map(item => [item.name, item]));
  const results = validationResult?.results?.length
    ? validationResult.results
    : Object.entries(counts || {}).map(([name, value]) => ({ name, value, status: 'PASS', min: null, max: null }));

  return results.map(result => {
    const meta = itemMeta[result.name] || {};
    return [
      timestamp,
      store || resolvedStoreId,
      metadata?.senderName || metadata?.sender || '',
      result.name,
      meta.section || '',
      result.value == null ? 'N/A' : result.value,
      result.min ?? meta.min ?? '',
      result.max ?? meta.max ?? '',
      result.status || 'PASS',
      sheetWriteStatus === 'SENT' ? 'WHATSAPP' : `WHATSAPP_${sheetWriteStatus}`,
      notes || result.reason || '',
    ];
  });
}

function buildRow(args) {
  return buildRows(args)[0] || [];
}

async function appendBrothLog(payload) {
  const rows = buildRows({
    metadata:          payload.metadata,
    store:             payload.store,
    storeId:           payload.storeId,
    counts:            payload.counts          || {},
    validationResult:  payload.validationResult || null,
    sheetWriteStatus:  'SENT',
    notes:             payload.notes           || '',
  });

  const queuePayload = { type: 'broth', tab: BROTH_LOG_TAB, rows, columnEnd: COLUMN_END, payload };
  const queueId = payload.entryId || payload.checkId || `BROTH_${Date.now()}`;

  if (process.env.GOOGLE_SHEETS_ENABLED !== 'true') {
    await storage.enqueueSheetWrite(queueId, queuePayload, 'Google Sheets disabled');
    return { status: 'QUEUED', tab: BROTH_LOG_TAB, rows: rows.length, reason: 'Google Sheets disabled' };
  }

  try {
    await sheetsClient.appendValues({ tab: BROTH_LOG_TAB, values: rows, columnEnd: COLUMN_END });
    return { status: 'SENT', tab: BROTH_LOG_TAB, rows: rows.length };
  } catch (err) {
    await storage.enqueueSheetWrite(queueId, queuePayload, err.message);
    return { status: 'QUEUED', tab: BROTH_LOG_TAB, reason: err.message };
  }
}

function formatTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value || '') : date.toISOString().slice(0, 16).replace('T', ' ');
}

module.exports = { BROTH_LOG_TAB, LOG_COLUMNS, COLUMN_END, buildRow, buildRows, appendBrothLog };
