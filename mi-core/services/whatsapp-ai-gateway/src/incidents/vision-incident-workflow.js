/**
 * Vision Incident Workflow
 * 
 * Orchestrates the full incident detection flow from image → detection → 
 * confirmation → report creation → sheet write → manager alert.
 * 
 * This workflow is triggered when an image is received in a mapped WhatsApp group.
 * It creates a pending incident session (similar to broth-command sessions)
 * that expects YES/NO/EDIT reply from staff within a timeout.
 * 
 * Tables:
 *   incident_pending_sessions  — active sessions awaiting confirmation
 */

const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');
const incidentDetector = require('./incident-detector');
const incidentReportService = require('./incident-report-service');
const incidentSheetWriter = require('./incident-sheet-writer');
const incidentAlertService = require('./incident-alert-service');
const { saveVisionImage } = require('../vision/image-storage');

const log = makeLogger('vision');

let initialized = false;

// ── Session state ─────────────────────────────────────────────────────────────
const PENDING_SESSIONS = new Map(); // chatId → session

async function ensureTables() {
  if (initialized) return;
  await run(`
    CREATE TABLE IF NOT EXISTS incident_pending_sessions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id         TEXT NOT NULL,
      incident_id     TEXT NOT NULL,
      detection_json  TEXT NOT NULL,
      image_path      TEXT,
      expires_at      TEXT,
      created_at      TEXT DEFAULT (datetime('now'))
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_incident_pending_chat ON incident_pending_sessions(chat_id)`);
  initialized = true;
}

// ── Start workflow (called when image is received) ────────────────────────────
/**
 * Start incident detection workflow for an image.
 * 
 * @param {string} imagePath
 * @param {object} metadata  - { chatId, sender, senderName, timestamp, messageId, groupName }
 * @returns {Promise<object>} - { started: true, needsConfirmation: true, detection, reply }
 */
async function startIncidentWorkflow(imagePath, metadata = {}, client = null) {
  await ensureTables();

  const { chatId, sender, senderName, groupName } = metadata;

  // Save image to vision dir
  let savedPath = imagePath;
  try {
    const fs = require('fs');
    savedPath = saveVisionImage(fs.readFileSync(imagePath), { ...metadata, type: 'incident' });
  } catch (err) {
    log.warn('Failed to save image to vision dir', { error: err.message });
  }

  // Run detection
  const detection = await incidentDetector.detectIncident(savedPath, metadata);

  if (!detection.is_incident && !detection.needs_human_review) {
    log.info('No incident detected — image processed normally');
    return { started: false, detection };
  }

  // Create pending session
  const incidentId = incidentDetector.makeIncidentId();
  const sessionKey = chatId;

  const session = {
    incidentId,
    detection,
    imagePath: savedPath,
    metadata,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min timeout
  };

  PENDING_SESSIONS.set(sessionKey, session);

  // Persist to DB
  await run(
    `INSERT INTO incident_pending_sessions (chat_id, incident_id, detection_json, image_path, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [chatId, incidentId, JSON.stringify(detection), savedPath, session.expiresAt]
  );

  // Create initial incident report (DETECTED state)
  await incidentReportService.createIncident({
    incidentId,
    storeId: metadata?.storeId || '',
    storeName: metadata?.storeName || metadata?.groupName || '',
    groupChatId: chatId,
    groupName: groupName || '',
    reportedById: sender || '',
    reportedByName: senderName || '',
    language: metadata?.language || 'en',
    imagePath: savedPath,
    category: detection.category || 'Unknown',
    severity: detection.severity || 'LOW',
    confidence: detection.confidence || 0,
    storeArea: detection.store_area || 'Unknown',
    description: detection.description || '',
    recommendedAction: detection.recommended_action || '',
  });

  // Build reply
  const lang = metadata?.language || 'en';
  const reply = incidentDetector.buildIncidentReply(detection, lang);

  // If severity HIGH/MEDIUM/needs_review → send manager alert immediately
  if (detection.requiresManagerAlert) {
    const incident = {
      ...detection,
      incident_id: incidentId,
      store_name: metadata?.storeName || '',
      reported_by_name: senderName || '',
      image_path: savedPath,
    };
    incidentAlertService.sendManagerAlert(incident, client).catch(err =>
      log.warn('Manager alert failed', { error: err.message })
    );
  }

  log.info('Incident workflow started', { incidentId, category: detection.category, severity: detection.severity });

  return {
    started: true,
    needsConfirmation: true,
    incidentId,
    detection,
    reply,
    sessionKey,
  };
}

// ── Handle YES/NO/EDIT reply ───────────────────────────────────────────────────
/**
 * Handle staff reply to incident detection.
 * 
 * @param {string} chatId
 * @param {string} senderId
 * @param {string} senderName
 * @param {string} text  - YES, NO, or EDIT <category> <severity>
 * @param {object} client  - WhatsApp client for sending replies
 * @returns {Promise<object>} - { handled: true, reply, result }
 */
async function handleIncidentReply(chatId, senderId, senderName, text, client = null) {
  const sessionKey = chatId;
  const session = PENDING_SESSIONS.get(sessionKey);

  if (!session) {
    log.info('No pending incident session', { chatId });
    return { handled: false };
  }

  // Check timeout
  if (new Date(session.expiresAt) < new Date()) {
    await expireSession(sessionKey);
    return {
      handled: true,
      reply: '⏰ Incident report session expired. No action taken.',
    };
  }

  const upper = String(text || '').trim().toUpperCase();

  if (upper === 'YES' || upper === 'CONFIRM') {
    return handleConfirm(sessionKey, senderId, senderName, client);
  }

  if (upper === 'NO' || upper === 'IGNORE') {
    return handleIgnore(sessionKey, senderId, senderName);
  }

  if (upper.startsWith('EDIT')) {
    return handleEdit(sessionKey, senderId, senderName, text);
  }

  return { handled: true, reply: 'Please reply YES, NO, or EDIT <category> <severity>' };
}

async function handleConfirm(sessionKey, senderId, senderName, client) {
  const session = PENDING_SESSIONS.get(sessionKey);
  if (!session) return { handled: false };

  const { incidentId, detection, imagePath, metadata } = session;

  // Confirm incident
  await incidentReportService.confirmIncident(incidentId, senderId, senderName);

  // Write to Google Sheet
  const incident = await incidentReportService.getIncident(incidentId);
  const sheetResult = await incidentSheetWriter.writeIncidentToSheet(incident);

  // Update session
  PENDING_SESSIONS.delete(sessionKey);
  await run(`DELETE FROM incident_pending_sessions WHERE incident_id = ?`, [incidentId]);

  log.info('Incident confirmed and logged', { incidentId, sheetStatus: sheetResult.status });

  const lang = metadata?.language || 'en';
  const reply = lang === 'vi'
    ? `✅ Báo cáo sự cố đã được tạo.\n\nID: ${incidentId}\nTình trạng: Đã ghi nhận${sheetResult.status === 'SENT' ? ' vào Google Sheet' : ' (đang chờ ghi)'}`
    : `✅ Incident report created.\n\nID: ${incidentId}\nStatus: Recorded${sheetResult.status === 'SENT' ? ' to Google Sheet' : ' (queued for sheet write)'}`;

  return { handled: true, incidentId, confirmed: true, reply };
}

async function handleIgnore(sessionKey, senderId, senderName) {
  const session = PENDING_SESSIONS.get(sessionKey);
  if (!session) return { handled: false };

  const { incidentId, metadata } = session;

  await incidentReportService.ignoreIncident(incidentId, senderId, senderName, 'Staff replied NO');

  PENDING_SESSIONS.delete(sessionKey);
  await run(`DELETE FROM incident_pending_sessions WHERE incident_id = ?`, [incidentId]);

  log.info('Incident ignored', { incidentId });

  const lang = metadata?.language || 'en';
  const reply = lang === 'vi'
    ? '✅ Đã bỏ qua báo cáo sự cố.'
    : '✅ Incident report ignored.';

  return { handled: true, incidentId, ignored: true, reply };
}

async function handleEdit(sessionKey, senderId, senderName, text) {
  const session = PENDING_SESSIONS.get(sessionKey);
  if (!session) return { handled: false };

  const { incidentId, metadata, detection } = session;
  const parts = text.split(/\s+/).slice(1); // strip "EDIT"
  const newCategory = parts[0] || detection.category;
  const newSeverity = parts[1] || detection.severity;

  await incidentReportService.updateIncident(incidentId, {
    category: newCategory,
    severity: newSeverity,
  });

  // Re-get updated incident
  const updated = await incidentReportService.getIncident(incidentId);
  if (updated && updated.requiresManagerAlert !== false) {
    // Re-alert if severity changed
    const alertResult = await incidentAlertService.sendManagerAlert(
      { ...updated, incident_id: incidentId, requiresManagerAlert: updated.severity === 'HIGH' || updated.severity === 'MEDIUM' },
      null
    ).catch(() => ({}));
  }

  log.info('Incident edited', { incidentId, newCategory, newSeverity });

  const lang = metadata?.language || 'en';
  const reply = lang === 'vi'
    ? `✅ Đã cập nhật: Loại=${newCategory}, Mức độ=${newSeverity}\n\nGửi YES để tạo báo cáo, NO để bỏ qua.`
    : `✅ Updated: Category=${newCategory}, Severity=${newSeverity}\n\nSend YES to create report, NO to ignore.`;

  return { handled: true, incidentId, edited: true, reply };
}

async function expireSession(sessionKey) {
  const session = PENDING_SESSIONS.get(sessionKey);
  if (!session) return;

  await incidentReportService.markNeedsReview(session.incidentId, 'Timeout — no response within 10 minutes');
  PENDING_SESSIONS.delete(sessionKey);
  await run(`DELETE FROM incident_pending_sessions WHERE incident_id = ?`, [session.incidentId]);
  log.info('Incident session expired', { incidentId: session.incidentId });
}

// ── Check for pending session ─────────────────────────────────────────────────
function hasPendingIncidentSession(chatId) {
  return PENDING_SESSIONS.has(chatId);
}

function getPendingIncidentSession(chatId) {
  return PENDING_SESSIONS.get(chatId) || null;
}

// ── Cleanup expired sessions ───────────────────────────────────────────────────
function cleanupExpiredSessions() {
  const now = new Date();
  for (const [key, session] of PENDING_SESSIONS.entries()) {
    if (new Date(session.expiresAt) < now) {
      expireSession(key).catch(() => {});
    }
  }
}

// Start cleanup timer
setInterval(cleanupExpiredSessions, 60_000);

module.exports = {
  startIncidentWorkflow,
  handleIncidentReply,
  hasPendingIncidentSession,
  getPendingIncidentSession,
  cleanupExpiredSessions,
};