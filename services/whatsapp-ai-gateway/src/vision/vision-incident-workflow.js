'use strict';

const { makeLogger } = require('../logger');
const visionProvider = require('./vision-provider');
const imageStorage = require('./image-storage');
const incidentDetector = require('../incidents/incident-detector');
const incidentReportSvc = require('../incidents/incident-report-service');
const incidentSheetWriter = require('../incidents/incident-sheet-writer');
const incidentAlertSvc = require('../incidents/incident-alert-service');

const log = makeLogger('vision-incident-workflow');

// In-memory pending incident confirmations: chatId:senderId -> detection result
const pendingConfirmations = new Map();

/**
 * Handle an incoming image from a WhatsApp group.
 * Analyzes for operational incidents and prompts for confirmation.
 */
async function handleImage({ imageBuffer, imagePath, chatId, senderId, senderName, groupName, storeId, storeName, language }) {
  if (!visionProvider.isEnabled()) {
    log.info('Vision disabled, saving image for manual review');
    try {
      await imageStorage.saveVisionImage(imageBuffer || imagePath, {
        type: 'incident_check',
        chatId, senderId, senderName, storeId,
        status: 'VISION_DISABLED',
      });
    } catch (_) {}
    return {
      handled: false,
      reply: '⚠️ Vision is not configured. Image saved for manual review.',
    };
  }

  try {
    // Save image
    let savedPath = imagePath;
    if (imageBuffer) {
      const saved = await imageStorage.saveVisionImage(imageBuffer, {
        type: 'incident_check',
        chatId, senderId, senderName, storeId,
      });
      savedPath = saved.path || saved;
    }

    // Analyze for incident
    const detection = await incidentDetector.detectIncident(savedPath);

    if (!detection.is_incident && !detection.needs_human_review) {
      log.debug('No incident detected', { chatId, confidence: detection.confidence });
      return { handled: false, reply: null };
    }

    // Store pending confirmation
    const key = `${chatId}:${senderId}`;
    pendingConfirmations.set(key, {
      detection,
      imagePath: savedPath,
      chatId, senderId, senderName, groupName, storeId, storeName, language,
      timestamp: new Date().toISOString(),
    });

    // Auto-expire after 10 minutes
    setTimeout(() => {
      if (pendingConfirmations.has(key)) {
        const pending = pendingConfirmations.get(key);
        pendingConfirmations.delete(key);
        // Save as NEEDS_REVIEW
        incidentReportSvc.createIncident({
          ...buildIncidentData(pending),
          status: 'NEEDS_REVIEW',
        }).catch(err => log.error('Failed to save timeout incident', { error: err.message }));
      }
    }, 10 * 60 * 1000);

    const conf = Math.round((detection.confidence || 0) * 100);
    const reply = `⚠️ *Possible Incident Detected*\n\nCategory: ${detection.category || 'Unknown'}\nSeverity: ${detection.severity || 'NEEDS_REVIEW'}\nArea: ${detection.store_area || 'Unknown'}\nConfidence: ${conf}%\n\n${detection.description || ''}\n\nCreate incident report?\n\nReply:\n*YES* — create report\n*NO* — ignore\n*EDIT* — correct category/severity`;

    return { handled: true, reply, detection };
  } catch (err) {
    log.error('Vision incident analysis failed', { error: err.message });
    return { handled: false, reply: null, error: err.message };
  }
}

/**
 * Handle staff reply to incident detection (YES/NO/EDIT).
 */
async function handleIncidentReply({ chatId, senderId, senderName, text }) {
  const key = `${chatId}:${senderId}`;
  const pending = pendingConfirmations.get(key);
  if (!pending) return { handled: false };

  const normalized = (text || '').trim().toUpperCase();

  if (normalized === 'YES' || normalized === 'Y') {
    pendingConfirmations.delete(key);
    const incidentData = buildIncidentData(pending);
    incidentData.status = 'CONFIRMED';
    incidentData.confirmed_at = new Date().toISOString();

    const incident = await incidentReportSvc.createIncident(incidentData);

    // Write to sheet (non-blocking)
    incidentSheetWriter.writeIncidentToSheet(incident).catch(err =>
      log.error('Sheet write failed', { error: err.message }));

    // Send manager alert if severity warrants
    const sev = (pending.detection.severity || '').toUpperCase();
    if (sev === 'MEDIUM' || sev === 'HIGH' || pending.detection.needs_human_review) {
      incidentAlertSvc.sendManagerAlert(incident).catch(err =>
        log.error('Manager alert failed', { error: err.message }));
    }

    return {
      handled: true,
      reply: `✅ Incident report created.\n\nID: ${incident.incident_id}\nCategory: ${incident.category}\nSeverity: ${incident.severity}\n\nManagement has been notified.`,
    };
  }

  if (normalized === 'NO' || normalized === 'N') {
    pendingConfirmations.delete(key);
    const incidentData = buildIncidentData(pending);
    incidentData.status = 'IGNORED';
    await incidentReportSvc.createIncident(incidentData);
    return { handled: true, reply: '👍 Incident report skipped. Image logged for reference.' };
  }

  return { handled: false };
}

function buildIncidentData(pending) {
  const d = pending.detection;
  return {
    store_id: pending.storeId || '',
    store_name: pending.storeName || '',
    group_chat_id: pending.chatId,
    group_name: pending.groupName || '',
    reported_by_id: pending.senderId,
    reported_by_name: pending.senderName || '',
    language: pending.language || 'en',
    image_path: pending.imagePath || '',
    category: d.category || 'Unknown',
    severity: d.severity || 'NEEDS_REVIEW',
    confidence: d.confidence || 0,
    store_area: d.store_area || 'Unknown',
    description: d.description || '',
    recommended_action: d.recommended_action || '',
    status: 'DETECTED',
  };
}

function hasPendingConfirmation(chatId, senderId) {
  return pendingConfirmations.has(`${chatId}:${senderId}`);
}

module.exports = {
  handleImage,
  handleIncidentReply,
  hasPendingConfirmation,
};
