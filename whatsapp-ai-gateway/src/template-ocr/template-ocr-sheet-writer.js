const sheetsClient = require('../google/sheets-client');
const sheetQueue = require('../workflows/sheet-write-queue');
const storage = require('./template-ocr-storage');
const { targetText } = require('./template-ocr-validator');

const TAB = process.env.TEMPLATE_OCR_LOG_SHEET || 'WhatsApp_AI_Daily_Log';

async function writeConfirmedOcr(payload) {
  const rows = buildRows(payload);
  try {
    if (process.env.GOOGLE_SHEETS_ENABLED !== 'true') {
      throw new Error('Google Sheets disabled');
    }
    await sheetsClient.appendValues({ tab: TAB, values: rows, columnEnd: 'Q' });
    await storage.updateRunStatus(payload.ocrId, { sheetWriteStatus: 'SENT', status: payload.validation.status, confirmed: true, payload });
    return { status: 'SENT', rows: rows.length };
  } catch (err) {
    await sheetQueue.enqueue({
      workflowType: 'template_ocr',
      storeId: payload.storeId || '',
      targetSheet: TAB,
      payload: { ...payload, rows },
      lastError: err.message,
    });
    await storage.updateRunStatus(payload.ocrId, { sheetWriteStatus: 'QUEUED', status: payload.validation.status, confirmed: true, payload });
    return { status: 'QUEUED', error: err.message, rows: rows.length };
  }
}

function buildRows(payload) {
  const timestamp = payload.timestamp || new Date().toISOString();
  const warningSent = payload.validation.failCount > 0 ? 'YES' : 'NO';
  return (payload.validation.items || []).map(item => [
    timestamp,
    payload.store || 'Unknown',
    payload.chatId || '',
    payload.senderName || payload.sender || '',
    payload.messageId || payload.ocrId || '',
    'TEMPLATE_OCR',
    payload.imagePath || '',
    item.item,
    item.value ?? '',
    'F',
    targetText(item),
    item.status,
    item.confidence != null ? Number(item.confidence).toFixed(2) : '',
    '',
    warningSent,
    'CONFIRMED',
    JSON.stringify({
      template_id: payload.templateId,
      template_version: payload.templateVersion,
      aligned_image_path: payload.alignedImagePath,
      crop_path: item.crop_path,
      raw_text: item.raw_text,
    }),
  ]);
}

module.exports = { TAB, writeConfirmedOcr, buildRows };
