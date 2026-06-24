const https = require('https');
const { getAccessToken, isConfigured } = require('./google-auth');
const { extractSpreadsheetId } = require('./sheet-mapper');

function getSpreadsheetId() {
  return process.env.FOOD_SAFETY_LOG_SPREADSHEET_ID ||
    process.env.FOOD_SAFETY_DAILY_LOG_SPREADSHEET_ID ||
    extractSpreadsheetId(process.env.FOOD_SAFETY_LOG_SHEET_URL || process.env.FOOD_SAFETY_DAILY_LOG_SHEET_URL);
}

async function appendValues({ spreadsheetId: overrideId, tab, values, columnEnd = 'Q', range: explicitRange = null }) {
  if (!isConfigured()) throw new Error('Google Sheets not configured');
  const spreadsheetId = overrideId || getSpreadsheetId();
  if (!spreadsheetId) throw new Error('FOOD_SAFETY_LOG_SPREADSHEET_ID or FOOD_SAFETY_LOG_SHEET_URL not set');

  const token = await getAccessToken();
  const range = `${quoteSheetName(tab)}!${explicitRange || `A:${columnEnd}`}`;
  const path = `/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  return requestJson({
    hostname: 'sheets.googleapis.com',
    path,
    method: 'POST',
    token,
    body: { values },
  });
}

async function updateValues({ spreadsheetId: overrideId, tab, range = 'A1:Z1', values }) {
  if (!isConfigured()) throw new Error('Google Sheets not configured');
  const spreadsheetId = overrideId || getSpreadsheetId();
  if (!spreadsheetId) throw new Error('FOOD_SAFETY_LOG_SPREADSHEET_ID or FOOD_SAFETY_LOG_SHEET_URL not set');

  const token = await getAccessToken();
  const fullRange = `${quoteSheetName(tab)}!${range}`;
  const path = `/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(fullRange)}?valueInputOption=USER_ENTERED`;
  return requestJson({
    hostname: 'sheets.googleapis.com',
    path,
    method: 'PUT',
    token,
    body: { values },
  });
}

async function getMetadata(spreadsheetIdOverride = null) {
  if (!isConfigured()) throw new Error('Google Sheets not configured');
  const spreadsheetId = spreadsheetIdOverride || getSpreadsheetId();
  if (!spreadsheetId) throw new Error('FOOD_SAFETY_LOG_SPREADSHEET_ID or FOOD_SAFETY_LOG_SHEET_URL not set');
  const token = await getAccessToken();
  const path = `/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,spreadsheetUrl,properties(title),sheets(properties(sheetId,title,index,gridProperties))`;
  return requestJson({ hostname: 'sheets.googleapis.com', path, method: 'GET', token, body: null });
}

async function batchUpdate(requests, spreadsheetIdOverride = null) {
  if (!isConfigured()) throw new Error('Google Sheets not configured');
  const spreadsheetId = spreadsheetIdOverride || getSpreadsheetId();
  if (!spreadsheetId) throw new Error('FOOD_SAFETY_LOG_SPREADSHEET_ID or FOOD_SAFETY_LOG_SHEET_URL not set');
  const token = await getAccessToken();
  const path = `/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`;
  return requestJson({ hostname: 'sheets.googleapis.com', path, method: 'POST', token, body: { requests } });
}

function quoteSheetName(tab) {
  const safe = String(tab || 'Test_Log').replace(/'/g, "''");
  return `'${safe}'`;
}

function requestJson({ hostname, path, method, token, body }) {
  const payload = body == null ? '' : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 30000,
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = {};
        try { parsed = data ? JSON.parse(data) : {}; } catch (_) { parsed = { raw: data }; }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Google Sheets append failed HTTP ${res.statusCode}: ${parsed.error?.message || data}`));
          return;
        }
        resolve(parsed);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Google Sheets append timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * Read values from a sheet range.
 * @param {{ spreadsheetId?: string, tab: string, range: string }} opts
 * Returns: 2-D array of cell values (strings), or throws on failure.
 */
async function getValues({ spreadsheetId: overrideId, tab, range }) {
  if (!isConfigured()) throw new Error('Google Sheets not configured');
  const spreadsheetId = overrideId || getSpreadsheetId();
  if (!spreadsheetId) throw new Error('No spreadsheet ID configured');

  const token = await getAccessToken();
  const fullRange = `${quoteSheetName(tab)}!${range}`;
  const path = `/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(fullRange)}`;
  const result = await requestJson({ hostname: 'sheets.googleapis.com', path, method: 'GET', token, body: null });
  return result.values || [];
}

async function getSheetsClient() {
  return isConfigured() ? module.exports : null;
}

module.exports = { appendValues, updateValues, getValues, getMetadata, batchUpdate, getSpreadsheetId, quoteSheetName, getSheetsClient };
