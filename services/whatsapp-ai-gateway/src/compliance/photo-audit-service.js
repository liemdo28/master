/**
 * Photo Audit Service
 * 
 * Orchestrates the photo audit verification flow:
 *   1. After CONFIRM → select items for photo audit
 *   2. Ask staff to send photo of specific item
 *   3. Vision AI extracts reading from photo
 *   4. Compare entered vs observed → PASS/MISMATCH/NEEDS_REVIEW
 *   5. Handle resolution options
 * 
 * Tables:
 *   photo_audits  — one row per audit request
 *   photo_audit_sessions — active in-memory sessions per chatId
 */

const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');
const visionProvider = require('../vision/vision-provider');
const { saveVisionImage } = require('../vision/image-storage');
const complianceScore = require('./compliance-score-service');
const photoAuditSelector = require('./photo-audit-selector');

const log = makeLogger('compliance');

// ── Config ────────────────────────────────────────────────────────────────────
function getToleranceF() {
  return parseFloat(process.env.TEMP_TOLERANCE_F || '2');
}

// ── In-memory sessions ────────────────────────────────────────────────────────
const PENDING_AUDITS = new Map(); // `${chatId}:${senderId}` → session

let initialized = false;

async function ensureTables() {
  if (initialized) return;

  await run(`
    CREATE TABLE IF NOT EXISTS photo_audits (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id            TEXT NOT NULL UNIQUE,
      workflow_audit_log_id TEXT,
      store_id            TEXT,
      store_name          TEXT,
      employee_id         TEXT,
      employee_name       TEXT,
      item_name           TEXT NOT NULL,
      entered_value       REAL,
      target_min          REAL,
      target_max          REAL,
      photo_required_at   TEXT DEFAULT (datetime('now')),
      photo_received_at   TEXT,
      image_path          TEXT,
      observed_value      REAL,
      difference          REAL,
      status              TEXT DEFAULT 'PENDING',
      created_at          TEXT DEFAULT (datetime('now')),
      resolved_at         TEXT,
      resolution          TEXT
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_photo_audit_status ON photo_audits(status)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_photo_audit_employee ON photo_audits(employee_id)`);

  initialized = true;
}

// ── Start audit after CONFIRM ──────────────────────────────────────────────────
/**
 * Trigger photo audit after a daily entry is confirmed.
 * 
 * @param {object} payload  - { storeId, storeName, employeeId, employeeName, counts, thresholds }
 * @param {object} metadata - { chatId, sender, senderName, timestamp }
 * @param {number} workflowAuditLogId - audit log ID from workflow_audit_logs
 * @returns {Promise<object>} - { started: true, selectedItems, reply }
 */
async function startPhotoAudit(payload, metadata, workflowAuditLogId = null) {
  await ensureTables();

  const { chatId, sender: employeeId, senderName: employeeName } = metadata;
  const { storeId, storeName, counts, thresholds } = payload || {};

  const sessionKey = `${chatId}:${employeeId}`;

  // Select items for audit
  const { items, auditId, triggeredBy } = await photoAuditSelector.selectItemsForAudit({
    storeId,
    storeName,
    employeeId,
    employeeName,
    counts,
    thresholds,
  });

  if (!items || items.length === 0) {
    return { started: false, reason: triggeredBy === 'none' ? 'No audit triggered' : 'No items selected' };
  }

  const timeoutMs = photoAuditSelector.getTimeoutMinutes() * 60 * 1000;

  // Save each item as a pending audit record
  const dbIds = [];
  for (const item of items) {
    const result = await run(
      `INSERT INTO photo_audits
       (audit_id, workflow_audit_log_id, store_id, store_name, employee_id, employee_name,
        item_name, entered_value, target_min, target_max, photo_required_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'PENDING')`,
      [
        auditId,
        workflowAuditLogId || null,
        storeId || '',
        storeName || '',
        employeeId || '',
        employeeName || '',
        item.item,
        item.enteredValue,
        item.targetMin,
        item.targetMax,
      ]
    );
    dbIds.push({ dbId: result.lastID, item: item.item });
  }

  // Create session
  PENDING_AUDITS.set(sessionKey, {
    auditId,
    items,
    dbIds,
    currentIndex: 0,
    metadata,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + timeoutMs).toISOString(),
  });

  // Build reply asking for first photo
  const firstItem = items[0];
  const lang = metadata?.language || 'en';
  const reply = lang === 'vi'
    ? `📷 Yêu cầu Xác minh Ảnh\n\nVui lòng gửi ảnh của:\n${firstItem.item}\n\nBạn có ${photoAuditSelector.getTimeoutMinutes()} phút.`
    : `📷 Photo Verification Required\n\nPlease send a photo of:\n${firstItem.item}\n\nYou have ${photoAuditSelector.getTimeoutMinutes()} minutes.`;

  log.info('Photo audit started', { auditId, items: items.map(i => i.item).join(', '), employeeId, storeId });

  return { started: true, auditId, selectedItems: items, reply, sessionKey };
}

// ── Handle photo received ──────────────────────────────────────────────────────
/**
 * Process a photo received in response to a photo audit request.
 * 
 * @param {string} imagePath  - path to saved photo
 * @param {object} metadata   - { chatId, sender, senderName, timestamp }
 * @returns {Promise<object>} - { handled, result, reply }
 */
async function handlePhotoReceived(imagePath, metadata = {}) {
  const { chatId, sender: senderId, senderName: senderName } = metadata;
  const sessionKey = `${chatId}:${senderId}`;
  const session = PENDING_AUDITS.get(sessionKey);

  if (!session) {
    return { handled: false, result: null };
  }

  // Check timeout
  if (new Date(session.expiresAt) < new Date()) {
    await expireSession(sessionKey);
    return {
      handled: true,
      result: 'EXPIRED',
      reply: '⏰ Photo audit session expired.',
    };
  }

  const currentItem = session.items[session.currentIndex];
  const tolerance = getToleranceF();

  // Save photo
  let savedPath = imagePath;
  try {
    const fs = require('fs');
    savedPath = saveVisionImage(fs.readFileSync(imagePath), { ...metadata, type: 'photo-audit', item: currentItem.item });
  } catch (err) {
    log.warn('Failed to save audit photo', { error: err.message });
  }

  // Extract temperature reading
  const visionResult = await visionProvider.extractTemperatureReading(savedPath, currentItem.item, {
    storeName: session.metadata?.storeName,
  });

  let observedValue = null;
  let needsReview = true;
  let imageQuality = 'UNKNOWN';

  if (visionResult.ok && visionResult.content) {
    const parsed = visionProvider.parseJsonResponse(visionResult.content);
    if (parsed && parsed.observed_value != null && !parsed.needs_review) {
      observedValue = parsed.observed_value;
      needsReview = parsed.needs_review || false;
      imageQuality = parsed.image_quality || 'GOOD';
    }
  }

  // Update DB record
  const dbRecord = session.dbIds[session.currentIndex];
  await run(
    `UPDATE photo_audits
     SET photo_received_at = datetime('now'),
         image_path = ?,
         observed_value = ?,
         difference = ?
     WHERE id = ?`,
    [savedPath, observedValue, observedValue != null ? Math.abs(observedValue - currentItem.enteredValue) : null, dbRecord.dbId]
  );

  // Compare
  let status;
  let difference;
  let reply;

  if (needsReview || observedValue == null) {
    status = 'NEEDS_REVIEW';
    difference = null;
    reply = buildNeedsReviewReply(currentItem.item, imageQuality, session.metadata?.language);
    complianceScore.onNeedsReview(senderId, senderName, session.metadata?.storeId, 'Photo unreadable').catch(() => {});
  } else {
    difference = Math.abs(observedValue - currentItem.enteredValue);
    const passed = difference <= tolerance;
    status = passed ? 'PASSED' : 'MISMATCH';

    if (passed) {
      reply = buildPassReply(currentItem.item, currentItem.enteredValue, observedValue, session.metadata?.language);
      complianceScore.onPhotoAuditPassed(senderId, senderName, session.metadata?.storeId, session.auditId).catch(() => {});
    } else {
      reply = buildMismatchReply(currentItem.item, currentItem.enteredValue, observedValue, difference, tolerance, session.metadata?.language, session.metadata?.storeName);
      complianceScore.onMismatchConfirmed(senderId, senderName, session.metadata?.storeId, session.auditId, true).catch(() => {});
    }
  }

  // Update status in DB
  await run(`UPDATE photo_audits SET status = ? WHERE id = ?`, [status, dbRecord.dbId]);

  // Move to next item or complete
  session.currentIndex++;
  if (session.currentIndex >= session.items.length) {
    PENDING_AUDITS.delete(sessionKey);
    await run(`UPDATE photo_audits SET resolved_at = datetime('now') WHERE audit_id = ?`, [session.auditId]);
    reply += session.metadata?.language === 'vi'
      ? '\n\n✅ Hoàn tất xác minh ảnh.'
      : '\n\n✅ Photo verification complete.';
    log.info('Photo audit complete', { auditId: session.auditId, status });
  }

  return {
    handled: true,
    result: { status, difference, observedValue, enteredValue: currentItem.enteredValue, item: currentItem.item },
    reply,
    session,
  };
}

// ── Handle resolution reply (1/2/3 for mismatch) ───────────────────────────────
async function handleMismatchResolution(chatId, senderId, senderName, choice) {
  const sessionKey = `${chatId}:${senderId}`;
  const session = PENDING_AUDITS.get(sessionKey);
  if (!session) return { handled: false };

  const choiceNum = parseInt(choice, 10);
  let resolutionNote = '';
  if (choiceNum === 1) resolutionNote = 'Staff chose entered value';
  else if (choiceNum === 2) resolutionNote = 'Staff chose photo reading';
  else if (choiceNum === 3) resolutionNote = 'Staff chose to re-enter manually';
  else return { handled: false };

  await run(
    `UPDATE photo_audits SET status = 'RESOLVED', resolved_at = datetime('now'), resolution = ? WHERE audit_id = ? AND status IN ('MISMATCH','NEEDS_REVIEW')`,
    [resolutionNote, session.auditId]
  );

  PENDING_AUDITS.delete(sessionKey);
  log.info('Mismatch resolved', { choice: choiceNum, resolution: resolutionNote, senderId, auditId: session.auditId });

  return { handled: true, reply: `✅ Resolution noted. ${resolutionNote}.` };
}

// ── Expire session ───────────────────────────────────────────────────────────
async function expireSession(sessionKey) {
  const session = PENDING_AUDITS.get(sessionKey);
  if (!session) return;

  // Mark all pending as expired
  await run(
    `UPDATE photo_audits SET status = 'EXPIRED' WHERE audit_id = ? AND status = 'PENDING'`,
    [session.auditId]
  );

  complianceScore.onAuditIgnored(
    session.metadata?.sender || session.metadata?.employeeId || '',
    session.metadata?.senderName || '',
    session.metadata?.storeId || '',
    session.auditId
  ).catch(() => {});

  PENDING_AUDITS.delete(sessionKey);
  log.info('Photo audit session expired', { auditId: session.auditId });
}

// ── Reply builders ────────────────────────────────────────────────────────────
function buildPassReply(item, entered, observed, lang = 'en') {
  if (lang === 'vi') {
    return `✅ Xác minh ảnh đạt.\n${item}: Nhập: ${entered}°F | Ảnh: ${observed}°F`;
  }
  return `✅ Photo verification passed.\n${item} — Entered: ${entered}°F | Photo reading: ${observed}°F`;
}

function buildMismatchReply(item, entered, observed, difference, tolerance, lang = 'en', storeName = '') {
  if (lang === 'vi') {
    const lines = [`⚠️ SỰ KHÔNG KHỚP XÁC MINH`];
    if (storeName) lines.push(`Cửa hàng: ${storeName}`);
    lines.push(
      `Mục: ${item}`,
      `Đã nhập: ${entered}°F`,
      `Đọc ảnh: ${observed}°F`,
      `Chênh lệch: ${difference}°F`,
      '',
      'Vui lòng xác nhận giá trị đúng.',
      '',
      'Chọn:',
      '1 — Dùng giá trị đã nhập',
      '2 — Dùng đọc từ ảnh',
      '3 — Nhập lại thủ công',
    );
    return lines.join('\n');
  }
  const lines = [`⚠️ VERIFICATION MISMATCH`];
  if (storeName) lines.push(`Store: ${storeName}`);
  lines.push(
    `Item: ${item}`,
    `Entered: ${entered}°F`,
    `Photo Reading: ${observed}°F`,
    `Difference: ${difference}°F`,
    '',
    'Please confirm the correct value.',
    '',
    'Reply:',
    '1 — Use entered value',
    '2 — Use photo reading',
    '3 — Re-enter manually',
  );
  return lines.join('\n');
}

function buildNeedsReviewReply(item, quality, lang = 'en') {
  if (lang === 'vi') {
    return `⚠️ Ảnh không thể xác minh (${quality || 'chất lượng kém'}). Vui lòng chụp lại hoặc quản lý xem xét.`;
  }
  return `⚠️ Photo could not be verified (${quality || 'poor quality'}). Please retake the photo or manager must review.`;
}

// ── Query ──────────────────────────────────────────────────────────────────────
async function getPendingAudits(limit = 20) {
  await ensureTables();
  return all(`SELECT * FROM photo_audits WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT ?`, [limit]);
}

async function getAuditStats() {
  await ensureTables();
  const row = await get(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'PASSED' THEN 1 ELSE 0 END) as passed,
      SUM(CASE WHEN status = 'MISMATCH' THEN 1 ELSE 0 END) as mismatch,
      SUM(CASE WHEN status = 'NEEDS_REVIEW' THEN 1 ELSE 0 END) as needs_review,
      SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END) as expired,
      MAX(created_at) as last_audit_at
    FROM photo_audits
  `);
  return row;
}

function hasPendingAudit(chatId, senderId) {
  return PENDING_AUDITS.has(`${chatId}:${senderId}`);
}

module.exports = {
  ensureTables,
  startPhotoAudit,
  handlePhotoReceived,
  handleMismatchResolution,
  hasPendingAudit,
  getPendingAudits,
  getAuditStats,
  buildPassReply,
  buildMismatchReply,
  buildNeedsReviewReply,
};