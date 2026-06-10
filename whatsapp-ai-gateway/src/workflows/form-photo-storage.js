/**
 * Form Photo Storage — SQLite persistence for food safety form submissions
 * 
 * Tables:
 *   food_safety_submissions     — one row per form photo submission
 *   food_safety_submission_items — one row per extracted temperature item
 * 
 * Non-blocking: Google Sheet failure does NOT block local save.
 */

const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');

const log = makeLogger('form-photo-storage');

const SUBMISSION_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS food_safety_submissions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id       TEXT NOT NULL UNIQUE,
    chat_id             TEXT,
    sender              TEXT,
    sender_name         TEXT,
    store_id            TEXT,
    store               TEXT,
    form_date           TEXT,
    shift               TEXT,
    image_path          TEXT,
    raw_ocr_json        TEXT,
    parsed_json         TEXT,
    ocr_confidence      REAL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'OCR_PENDING',
    created_at          TEXT DEFAULT (datetime('now')),
    confirmed_at        TEXT,
    synced_to_sheet_at  TEXT,
    sync_error          TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_submissions_status ON food_safety_submissions(status);
  CREATE INDEX IF NOT EXISTS idx_submissions_store ON food_safety_submissions(store_id);
  CREATE INDEX IF NOT EXISTS idx_submissions_created ON food_safety_submissions(created_at);

  CREATE TABLE IF NOT EXISTS food_safety_submission_items (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id       TEXT NOT NULL,
    field_id            TEXT,
    label               TEXT,
    value               REAL,
    unit                TEXT DEFAULT 'F',
    confidence          REAL DEFAULT 0,
    status              TEXT DEFAULT 'PASS',
    created_at          TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_submission_items_sid ON food_safety_submission_items(submission_id);
`;

let initialized = false;

async function ensureTables() {
  if (initialized) return;
  try {
    const db = require('../storage/sqlite').getDb();
    db.exec(SUBMISSION_TABLES_SQL);
    initialized = true;
    log.info('Form photo storage tables ready');
  } catch (err) {
    log.error('Failed to create form photo storage tables', { error: err.message });
  }
}

function makeSubmissionId(chatId, sender) {
  const raw = `${chatId || ''}:${sender || ''}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i) | 0;
  }
  return `FP${Math.abs(hash).toString(36).toUpperCase().padStart(8, '0')}`;
}

async function initSession({ chatId, sender, storeId, store }) {
  await ensureTables();
  const submissionId = makeSubmissionId(chatId, sender);
  await run(
    `INSERT INTO food_safety_submissions (submission_id, chat_id, sender, store_id, store, status)
     VALUES (?, ?, ?, ?, ?, 'STORE_SELECTED')`,
    [submissionId, chatId || '', sender || '', storeId || '', store || 'Unknown']
  );
  return submissionId;
}

async function saveSubmission({ chatId, sender, senderName, storeId, store, imagePath, ocrResult, status }) {
  await ensureTables();
  const submissionId = makeSubmissionId(chatId, sender);
  const now = new Date().toISOString();
  
  await run(
    `INSERT INTO food_safety_submissions
     (submission_id, chat_id, sender, sender_name, store_id, store, form_date, shift, image_path, raw_ocr_json, ocr_confidence, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      submissionId,
      chatId || '',
      sender || '',
      senderName || '',
      storeId || '',
      store || 'Unknown',
      ocrResult?.form_date || now.slice(0, 10),
      ocrResult?.shift || '',
      imagePath || '',
      JSON.stringify(ocrResult || {}),
      ocrResult?.ocr_confidence || 0,
      status || 'OCR_PENDING',
      now,
    ]
  );

  // Save items
  const items = ocrResult?.items || [];
  for (const item of items) {
    await run(
      `INSERT INTO food_safety_submission_items (submission_id, field_id, label, value, unit, confidence, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        submissionId,
        item.field_id || item.name || '',
        item.label || item.name || '',
        item.value ?? null,
        item.unit || 'F',
        item.confidence ?? 0,
        item.status || 'PASS',
      ]
    );
  }

  log.info('Form photo submission saved', { submissionId, status, itemCount: items.length });
  return submissionId;
}

/**
 * Confirm a form photo submission.
 * 
 * @param {object} params
 * @param {string} [params.submissionId] - If provided, UPDATE existing row (prevents duplicate).
 *                                          If not provided, INSERT new row (legacy behavior).
 */
async function confirmSubmission({ chatId, sender, senderName, storeId, store, imagePath, ocrResult, ocrConfidence, items, warnings, submissionId: existingSubmissionId }) {
  await ensureTables();
  const now = new Date().toISOString();

  // If we have an existing submissionId from saveSubmission(), UPDATE that row.
  // This prevents duplicate records when user confirms after OCR review.
  if (existingSubmissionId) {
    await run(
      `UPDATE food_safety_submissions
       SET sender_name = ?, form_date = ?, shift = ?, image_path = ?,
           raw_ocr_json = ?, parsed_json = ?, ocr_confidence = ?,
           status = 'CONFIRMED', confirmed_at = ?
       WHERE submission_id = ?`,
      [
        senderName || '',
        ocrResult?.form_date || now.slice(0, 10),
        ocrResult?.shift || '',
        imagePath || '',
        JSON.stringify(ocrResult || {}),
        JSON.stringify({ items, warnings }),
        ocrConfidence || 0,
        now,
        existingSubmissionId,
      ]
    );

    // Delete old items and re-insert (in case OCR improved after retake)
    await run(`DELETE FROM food_safety_submission_items WHERE submission_id = ?`, [existingSubmissionId]);
    for (const item of items) {
      await run(
        `INSERT INTO food_safety_submission_items (submission_id, field_id, label, value, unit, confidence, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          existingSubmissionId,
          item.field_id || item.name || '',
          item.label || item.name || '',
          item.value ?? null,
          item.unit || 'F',
          item.confidence ?? 0,
          item.status || 'PASS',
        ]
      );
    }

    log.info('Form photo submission confirmed (updated)', { submissionId: existingSubmissionId, itemCount: items.length });
    return { submissionId: existingSubmissionId, status: 'CONFIRMED' };
  }

  // Legacy: no existing ID — INSERT new row
  const newId = makeSubmissionId(chatId, sender);
  await run(
    `INSERT INTO food_safety_submissions
     (submission_id, chat_id, sender, sender_name, store_id, store, form_date, shift, image_path, raw_ocr_json, parsed_json, ocr_confidence, status, created_at, confirmed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      chatId || '',
      sender || '',
      senderName || '',
      storeId || '',
      store || 'Unknown',
      ocrResult?.form_date || now.slice(0, 10),
      ocrResult?.shift || '',
      imagePath || '',
      JSON.stringify(ocrResult || {}),
      JSON.stringify({ items, warnings }),
      ocrConfidence || 0,
      'CONFIRMED',
      now,
      now,
    ]
  );

  for (const item of items) {
    await run(
      `INSERT INTO food_safety_submission_items (submission_id, field_id, label, value, unit, confidence, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newId,
        item.field_id || item.name || '',
        item.label || item.name || '',
        item.value ?? null,
        item.unit || 'F',
        item.confidence ?? 0,
        item.status || 'PASS',
      ]
    );
  }

  log.info('Form photo submission confirmed (insert)', { submissionId: newId, itemCount: items.length });
  return { submissionId: newId, status: 'CONFIRMED' };
}

async function markRetakeRequested(chatId, sender) {
  await ensureTables();
  await run(
    `UPDATE food_safety_submissions SET status = 'RETAKE_REQUESTED' WHERE chat_id = ? AND sender = ? AND status NOT IN ('CONFIRMED', 'SAVED', 'CANCELLED')`,
    [chatId || '', sender || '']
  );
}

async function markCancelled(chatId, sender) {
  await ensureTables();
  await run(
    `UPDATE food_safety_submissions SET status = 'CANCELLED' WHERE chat_id = ? AND sender = ? AND status NOT IN ('CONFIRMED', 'SAVED')`,
    [chatId || '', sender || '']
  );
}

async function markManagerReview(submissionId) {
  await ensureTables();
  await run(
    `UPDATE food_safety_submissions SET status = 'MANAGER_REVIEW' WHERE submission_id = ?`,
    [submissionId || '']
  );
}

async function markSynced(submissionId, syncError = '') {
  await ensureTables();
  if (syncError) {
    await run(
      `UPDATE food_safety_submissions SET status = 'SYNC_FAILED', sync_error = ?, synced_to_sheet_at = datetime('now') WHERE submission_id = ?`,
      [String(syncError).slice(0, 500), submissionId]
    );
  } else {
    await run(
      `UPDATE food_safety_submissions SET status = 'SAVED', synced_to_sheet_at = datetime('now'), sync_error = '' WHERE submission_id = ?`,
      [submissionId]
    );
  }
}

async function getSubmission(submissionId) {
  await ensureTables();
  const row = await get(`SELECT * FROM food_safety_submissions WHERE submission_id = ?`, [submissionId]);
  if (!row) return null;
  row.items = await all(`SELECT * FROM food_safety_submission_items WHERE submission_id = ?`, [submissionId]);
  return row;
}

async function getRecentSubmissions(limit = 20) {
  await ensureTables();
  const rows = await all(
    `SELECT * FROM food_safety_submissions ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
  // Attach items
  for (const row of rows) {
    row.items = await all(`SELECT * FROM food_safety_submission_items WHERE submission_id = ?`, [row.submission_id]);
  }
  return rows;
}

async function getSubmissionsByStatus(status, limit = 50) {
  await ensureTables();
  const rows = await all(
    `SELECT * FROM food_safety_submissions WHERE status = ? ORDER BY created_at DESC LIMIT ?`,
    [status, limit]
  );
  for (const row of rows) {
    row.items = await all(`SELECT * FROM food_safety_submission_items WHERE submission_id = ?`, [row.submission_id]);
  }
  return rows;
}

async function getSubmissionStats() {
  await ensureTables();
  return get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('OCR_PENDING', 'OCR_PROCESSING') THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'OCR_REVIEW_READY' THEN 1 ELSE 0 END) as review_ready,
      SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status IN ('SAVED', 'SYNCED') THEN 1 ELSE 0 END) as saved,
      SUM(CASE WHEN status = 'SYNC_FAILED' THEN 1 ELSE 0 END) as sync_failed,
      SUM(CASE WHEN status = 'NEEDS_REVIEW' THEN 1 ELSE 0 END) as needs_review,
      SUM(CASE WHEN status = 'RETAKE_REQUESTED' THEN 1 ELSE 0 END) as retake_requested,
      SUM(CASE WHEN status = 'MANAGER_REVIEW' THEN 1 ELSE 0 END) as manager_review,
      MAX(created_at) as last_submission_at
    FROM food_safety_submissions
  `);
}

async function getPendingSheetSync(limit = 20) {
  await ensureTables();
  return all(
    `SELECT * FROM food_safety_submissions
     WHERE status IN ('CONFIRMED', 'SAVED', 'SYNC_FAILED', 'PENDING_CREDENTIALS')
     ORDER BY created_at ASC LIMIT ?`,
    [limit]
  );
}

module.exports = {
  ensureTables,
  initSession,
  saveSubmission,
  confirmSubmission,
  markRetakeRequested,
  markCancelled,
  markManagerReview,
  markSynced,
  getSubmission,
  getRecentSubmissions,
  getSubmissionsByStatus,
  getSubmissionStats,
  getPendingSheetSync,
  makeSubmissionId,
};
