require('dotenv').config();

const fs = require('fs');
const { syncLogWorkbook } = require('../src/google/log-sheet-sync');
const { getSpreadsheetId } = require('../src/google/sheets-client');

async function main() {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error('FOOD_SAFETY_LOG_SPREADSHEET_ID or FOOD_SAFETY_LOG_SHEET_URL is required');
  }
  const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
    throw new Error(`Google service account file not found: ${serviceAccountPath || '(unset)'}`);
  }

  const result = await syncLogWorkbook();
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
