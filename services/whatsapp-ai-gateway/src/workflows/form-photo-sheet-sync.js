/**
 * Form Photo Sheet Sync — writes confirmed submissions to Google Sheet
 * 
 * Non-blocking: Google Sheet failure does NOT block local save.
 * Submissions are saved locally first, then synced asynchronously.
 */

const { makeLogger } = require('../logger');
const formPhotoStorage = require('./form-photo-storage');

const log = makeLogger('form-photo-sheet-sync');

const SHEET_TAB = 'Food_Safety_Form_Submissions';
const MAX_RETRIES = 3;

/**
 * Sync a confirmed submission to Google Sheet.
 * Called non-blocking after local save succeeds.
 */
async function syncSubmission(submissionId) {
  log.info('Sheet sync started', { submissionId });

  const submission = await formPhotoStorage.getSubmission(submissionId);
  if (!submission) {
    log.warn('Submission not found for sheet sync', { submissionId });
    return { ok: false, error: 'Submission not found' };
  }

  // Check if Google Sheets is configured
  if (!isSheetsConfigured()) {
    log.warn('Google Sheets not configured — queuing sync', { submissionId });
    await formPhotoStorage.markSynced(submissionId, 'PENDING_CREDENTIALS');
    return { ok: false, error: 'Google Sheets not configured' };
  }

  // Build row data
  const row = buildSheetRow(submission);

  // Write to Google Sheet
  try {
    const sheetsClient = require('../google/sheets-client');
    const spreadsheetId = process.env.FOOD_SAFETY_LOG_SPREADSHEET_ID || extractSpreadsheetId(process.env.LOG_SHEET_URL);

    await sheetsClient.appendValues({
      spreadsheetId,
      tab: SHEET_TAB,
      values: [row],
    });

    await formPhotoStorage.markSynced(submissionId);
    log.info('Sheet sync successful', { submissionId });
    return { ok: true, status: 'SYNCED' };
  } catch (err) {
    log.error('Sheet sync failed', { error: err.message, submissionId });
    await formPhotoStorage.markSynced(submissionId, err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Process all pending sheet syncs (called by retry scheduler).
 */
async function processPendingSyncs() {
  const pending = await formPhotoStorage.getPendingSheetSync(20);
  log.info('Processing pending sheet syncs', { count: pending.length });

  for (const submission of pending) {
    try {
      await syncSubmission(submission.submission_id);
    } catch (err) {
      log.warn('Pending sync failed', { error: err.message, submissionId: submission.submission_id });
    }
  }
}

function buildSheetRow(submission) {
  const items = submission.items || [];
  const parsed = submission.parsed_json ? JSON.parse(submission.parsed_json) : {};
  const warnings = parsed.warnings || [];

  return [
    submission.submission_id || '',
    submission.created_at || '',
    submission.store || '',
    submission.form_date || '',
    submission.shift || '',
    submission.sender_name || '',
    submission.sender || '',
    items.length > 0 ? items.map(i => `${i.label}: ${i.value}°F`).join('; ') : '',
    items.filter(i => i.status === 'FAIL').length.toString(),
    submission.ocr_confidence?.toString() || '0',
    submission.status || '',
    submission.synced_to_sheet_at || '',
    submission.sync_error || '',
    submission.image_path || '',
    warnings.length > 0 ? warnings.join('; ') : '',
  ];
}

function isSheetsConfigured() {
  return !!(
    process.env.GOOGLE_SHEETS_ENABLED === 'true' &&
    (process.env.LOG_SHEET_URL || process.env.FOOD_SAFETY_LOG_SPREADSHEET_ID)
  );
}

function extractSpreadsheetId(url) {
  if (!url) return null;
  const m = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// Retry scheduler — processes failed syncs every 15 minutes
let retryInterval = null;

function startRetryScheduler() {
  if (retryInterval) return;
  retryInterval = setInterval(async () => {
    try {
      await processPendingSyncs();
    } catch (err) {
      log.warn('Retry scheduler error', { error: err.message });
    }
  }, 15 * 60 * 1000); // 15 minutes
  log.info('Sheet sync retry scheduler started');
}

function stopRetryScheduler() {
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
  }
}

module.exports = {
  syncSubmission,
  processPendingSyncs,
  startRetryScheduler,
  stopRetryScheduler,
};