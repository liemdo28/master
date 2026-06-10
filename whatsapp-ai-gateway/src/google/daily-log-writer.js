const sheetsClient = require('./sheets-client');
const mapper = require('./sheet-mapper');
const storage = require('../storage/food-safety-storage');
const { makeLogger } = require('../logger');

const log = makeLogger('food-safety');

const COLUMNS = [
  'Timestamp',
  'Store',
  'Chat ID',
  'Sender',
  'Message ID',
  'Source Type',
  'Image Path',
  'Item',
  'Reading',
  'Unit',
  'Target',
  'Status',
  'Confidence',
  'Corrective Action',
  'Warning Sent',
  'Sheet Write Status',
  'Notes',
];

function isEnabled() {
  return process.env.GOOGLE_SHEETS_ENABLED === 'true';
}

function buildRows({ checkId, metadata, imagePath, analyzed, readings, result, warning }) {
  const mapped = mapper.getWriteTab(analyzed?.store);
  const sourceReadings = readings && readings.length ? readings : [{
    item: (analyzed?.needs_review || [])[0] || 'Unclear image',
    value: null,
    unit: 'F',
    status: 'NEEDS_REVIEW',
    confidence: null,
  }];
  const rows = sourceReadings.map(reading => toRow({
    checkId,
    metadata,
    imagePath,
    analyzed,
    reading,
    result,
    warning,
    store: mapped.known ? mapped.store : 'Unknown',
    storeKnown: mapped.known,
  }));
  const tab = result === 'NEEDS_REVIEW' || !mapped.known ? mapper.getReviewTab() : mapper.getTestTab();
  return { tab, rows, mapped };
}

function toRow({ metadata, imagePath, analyzed, reading, result, warning, store, storeKnown, sheetWriteStatus = 'PENDING' }) {
  const timestamp = metadata?.timestamp || new Date().toISOString();
  const status = reading.status || result || 'NEEDS_REVIEW';
  return [
    formatTimestamp(timestamp),
    store || 'Unknown',
    metadata?.chatId || '',
    metadata?.senderName || metadata?.sender || '',
    metadata?.messageId || '',
    metadata?.sourceType || (imagePath ? 'image' : 'text'),
    imagePath || '',
    reading.item || 'Unclear image',
    reading.value ?? '',
    reading.unit || 'F',
    formatTarget(reading),
    status,
    reading.confidence ?? '',
    reading.corrective || reading.correctiveAction || '',
    warning ? 'YES' : 'NO',
    sheetWriteStatus,
    storeKnown ? 'Auto-recorded from WhatsApp image' : 'Store unclear - please confirm store.',
  ];
}

function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function formatTarget(reading) {
  if (!reading || reading.operator == null || reading.target == null) return '';
  return `${reading.operator} ${reading.target}${reading.unit ? `°${reading.unit}` : ''}`;
}

async function appendDailyLog(payload) {
  const built = buildRows(payload);
  const queuePayload = { ...payload, tab: built.tab, rows: built.rows, mapped: built.mapped };
  if (!isEnabled()) {
    await storage.enqueueSheetWrite(payload.checkId, queuePayload, 'Google Sheets disabled');
    return { status: 'QUEUED', tab: built.tab, reason: 'Google Sheets disabled' };
  }

  try {
    const sentRows = built.rows.map(row => {
      const next = [...row];
      next[15] = 'SENT';
      return next;
    });
    await sheetsClient.appendValues({ tab: built.tab, values: sentRows });
    await storage.markSheetWriteSent(payload.checkId);
    return { status: 'SENT', tab: built.tab, rows: built.rows.length };
  } catch (err) {
    log.warn('Daily log append failed; queued for retry', { checkId: payload.checkId, error: err.message });
    await storage.enqueueSheetWrite(payload.checkId, queuePayload, err.message);
    return { status: 'QUEUED', tab: built.tab, reason: err.message };
  }
}

async function retryPending(limit = 10) {
  const pending = await storage.getPendingSheetWrites(limit);
  const results = [];
  for (const item of pending) {
    try {
      const payload = JSON.parse(item.payload_json);
      const sentRows = (payload.rows || []).map(row => {
        const next = [...row];
        next[15] = 'SENT';
        return next;
      });
      await sheetsClient.appendValues({ tab: payload.tab, values: sentRows, columnEnd: payload.columnEnd || 'Q' });
      await storage.markQueueItemSent(item.id);
      results.push({ id: item.id, status: 'SENT' });
    } catch (err) {
      await storage.markQueueItemFailed(item.id, err.message);
      results.push({ id: item.id, status: 'FAILED', error: err.message });
    }
  }
  return results;
}

module.exports = {
  COLUMNS,
  appendDailyLog,
  buildRows,
  retryPending,
  isEnabled,
};
