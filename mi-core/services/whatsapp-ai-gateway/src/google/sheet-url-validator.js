const { extractSpreadsheetId } = require('./sheet-mapper');

const BAD_PATTERNS = [
  /docs\.google\.com\/test/i,
  /drive\.google\.com\/log/i,
  /localhost/i,
  /example\.com/i,
];

function normalizeGoogleSheetUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const id = extractSpreadsheetId(raw);
  if (!id || id === raw && !raw.includes('/spreadsheets/d/')) {
    throw new Error('Google Sheet URL must contain /spreadsheets/d/');
  }
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9_-]+\/edit(?:[?#].*)?$/i.test(raw)) {
    throw new Error('Google Sheet URL must be https://docs.google.com/spreadsheets/d/{ID}/edit');
  }
  if (BAD_PATTERNS.some(pattern => pattern.test(raw))) {
    throw new Error('Rejected placeholder or invalid Google Sheet URL.');
  }
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

function validateGoogleSheetUrl(value, label = 'Google Sheet URL') {
  try {
    return { ok: true, url: normalizeGoogleSheetUrl(value), error: null };
  } catch (err) {
    return { ok: false, url: '', error: `${label}: ${err.message}` };
  }
}

module.exports = { normalizeGoogleSheetUrl, validateGoogleSheetUrl, BAD_PATTERNS };
