const sheetsClient = require('./sheets-client');

const REQUIRED_SHEETS = {
  WhatsApp_AI_Daily_Log: [
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
  ],
  Photo_Audit_Log: [
    'Source Image',
    'Store',
    'Date / Day Range',
    'Readable?',
    'Notes',
  ],
  Needs_Review: [
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
  ],
  Sheet_Write_Queue: [
    'id',
    'check_id',
    'payload_json',
    'status',
    'attempt_count',
    'last_error',
    'created_at',
    'sent_at',
  ],
  AI_Rule_Source: [
    'Category',
    'Canonical Item',
    'Board/OCR Label',
    'Aliases',
    'Operator',
    'Target',
    'Unit',
    'Photo Required',
    'Warning Rule',
    'Corrective Action',
  ],
  Thresholds_SOP: [
    'Category',
    'Item',
    'Operator',
    'Target',
    'Unit',
    'Corrective Action',
    'Board Label / OCR Text',
    'AI Item Alias',
    'Photo Required?',
    'Daily Log Target',
  ],
  Broth_Count_Log: [
    'Timestamp',
    'Store',
    'Chat ID',
    'Sender',
    'Source',
    'Command',
    'Template Version',
    'Item',
    'Reading',
    'Target',
    'Status',
    'Warning',
    'Notes',
  ],
};

async function syncLogWorkbook() {
  const metadata = await sheetsClient.getMetadata();
  const existing = new Map((metadata.sheets || []).map(sheet => [sheet.properties.title, sheet.properties]));
  const requests = [];

  for (const [title, headers] of Object.entries(REQUIRED_SHEETS)) {
    if (!existing.has(title)) {
      requests.push({
        addSheet: {
          properties: {
            title,
            gridProperties: { rowCount: 1000, columnCount: Math.max(headers.length, 8) },
          },
        },
      });
    }
  }

  if (requests.length) {
    await sheetsClient.batchUpdate(requests);
  }

  for (const [title, headers] of Object.entries(REQUIRED_SHEETS)) {
    await sheetsClient.updateValues({
      tab: title,
      range: `A1:${columnName(headers.length)}1`,
      values: [headers],
    });
  }

  return {
    title: metadata.properties?.title || '',
    spreadsheetId: metadata.spreadsheetId,
    sheetsSynced: Object.keys(REQUIRED_SHEETS),
  };
}

function columnName(index) {
  let n = index;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

module.exports = { REQUIRED_SHEETS, syncLogWorkbook };
