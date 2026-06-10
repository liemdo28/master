/**
 * Incident Detector
 * 
 * Detects operational incidents from images in WhatsApp groups.
 * 
 * Flow:
 *   1. Image received in group → save image
 *   2. Vision AI analyzes image
 *   3. Returns structured incident detection result
 *   4. If incident detected → store in SQLite, prompt staff for confirmation
 * 
 * Respects: VISION_ENABLED, VISION_TEST_MODE, FOOD_SAFETY_ALLOWED_CHAT_IDS
 */

const fs = require('fs');
const path = require('path');
const { run, all, get } = require('../storage/sqlite');
const { makeLogger } = require('../logger');
const visionProvider = require('../vision/vision-provider');
const { visionPrompts } = require('../vision/vision-prompts');
const { saveVisionImage } = require('../vision/image-storage');

const log = makeLogger('vision');

// ── Config ────────────────────────────────────────────────────────────────────
function isEnabled() { return process.env.VISION_ENABLED === 'true'; }
function isTestMode() { return process.env.VISION_TEST_MODE !== 'false'; }

function getAllowedChatIds() {
  return (process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
}

function isAllowedChat(chatId) {
  if (!isTestMode()) return true;
  const list = getAllowedChatIds();
  if (list.length === 0) return true; // allow all in test mode with empty list (legacy behavior)
  return list.includes(chatId);
}

// ── Severity thresholds ────────────────────────────────────────────────────────
const SEVERITY_FOR_MANAGER_ALERT = new Set(['MEDIUM', 'HIGH']);

// ── Main detection function ────────────────────────────────────────────────────

/**
 * Detect incident from a WhatsApp image message.
 * 
 * @param {string} imagePath   - absolute path to saved image
 * @param {object} metadata    - { chatId, sender, senderName, timestamp, messageId, groupName }
 * @returns {Promise<object>}  - detection result
 */
async function detectIncident(imagePath, metadata = {}) {
  const { chatId, sender, senderName, timestamp, messageId, groupName } = metadata;

  log.info('Incident detection started', { chatId, imagePath });

  // Check if vision is enabled
  if (!isEnabled()) {
    // Save image anyway for manual review
    saveVisionImage(fs.readFileSync(imagePath), { ...metadata, type: 'incident' }).catch(() => {});
    log.info('Vision disabled — image saved for manual review');
    return {
      status: 'DISABLED',
      is_incident: false,
      needs_human_review: true,
      description: 'Vision is not configured. Image saved for manual review.',
    };
  }

  // Check if chat is allowed
  if (isTestMode() && !isAllowedChat(chatId)) {
    log.info('Chat not allowed in test mode — skipping incident detection', { chatId });
    return {
      status: 'BLOCKED_TEST_MODE',
      is_incident: false,
      needs_human_review: false,
    };
  }

  try {
    // Call vision provider
    const visionResult = await visionProvider.analyzeIncident(imagePath, metadata);

    if (!visionResult.ok) {
      // Vision call failed — save for manual review
      const savedPath = saveVisionImage(fs.readFileSync(imagePath), { ...metadata, type: 'incident' }).catch(() => imagePath);
      log.warn('Vision call failed', { reason: visionResult.reason, chatId });
      return {
        status: 'VISION_FAILED',
        is_incident: false,
        needs_human_review: true,
        description: `Vision analysis failed: ${visionResult.reason}. Image saved for manual review.`,
        imagePath: savedPath || imagePath,
      };
    }

    // Parse vision response
    const detection = visionProvider.parseJsonResponse(visionResult.content);

    if (!detection) {
      log.warn('Vision returned unparseable response', { content: visionResult.content?.slice(0, 200) });
      return {
        status: 'PARSE_ERROR',
        is_incident: false,
        needs_human_review: true,
        description: 'Vision response could not be parsed. Manual review required.',
        rawContent: visionResult.content,
      };
    }

    // Apply confidence threshold
    const threshold = visionProvider.getConfidenceThreshold();
    if (detection.confidence < threshold) {
      detection.needs_human_review = true;
    }

    log.info('Incident detection result', {
      is_incident: detection.is_incident,
      category: detection.category,
      severity: detection.severity,
      confidence: detection.confidence,
      needs_human_review: detection.needs_human_review,
    });

    return {
      status: 'SUCCESS',
      ...detection,
      imagePath,
      metadata,
      requiresManagerAlert: detection.needs_human_review || SEVERITY_FOR_MANAGER_ALERT.has(detection.severity),
    };

  } catch (err) {
    log.error('Incident detection error', { error: err.message, stack: err.stack });
    return {
      status: 'ERROR',
      is_incident: false,
      needs_human_review: true,
      description: `Internal error during detection: ${err.message}`,
    };
  }
}

/**
 * Build the "possible incident detected" reply message (for staff in group).
 * 
 * @param {object} detection
 * @param {string} lang  - 'en' or 'vi'
 */
function buildIncidentReply(detection, lang = 'en') {
  const lines = [];

  if (lang === 'vi') {
    lines.push('⚠️ Có Thể Phát Hiện Sự Cố');
    lines.push('');
    lines.push(`Loại: ${detection.category || 'Unknown'}`);
    lines.push(`Mức độ: ${detection.severity || 'Unknown'}`);
    lines.push(`Khu vực: ${detection.store_area || 'Unknown'}`);
    lines.push(`Độ tin cậy: ${Math.round((detection.confidence || 0) * 100)}%`);
    lines.push('');
    lines.push('Mô tả:');
    lines.push(detection.description || 'Không có mô tả');
  } else {
    lines.push('⚠️ Possible Incident Detected');
    lines.push('');
    lines.push(`Category: ${detection.category || 'Unknown'}`);
    lines.push(`Severity: ${detection.severity || 'Unknown'}`);
    lines.push(`Area: ${detection.store_area || 'Unknown'}`);
    lines.push(`Confidence: ${Math.round((detection.confidence || 0) * 100)}%`);
    lines.push('');
    lines.push('Description:');
    lines.push(detection.description || 'No description');
  }

  lines.push('');
  lines.push(lang === 'vi' ? 'Tạo báo cáo sự cố?' : 'Create incident report?');
  lines.push('');
  lines.push(lang === 'vi' ? 'YES — tạo báo cáo\nNO — bỏ qua\nEDIT — sửa loại/mức độ' : 'YES — create report\nNO — ignore\nEDIT — correct category/severity');

  return lines.join('\n');
}

/**
 * Generate incident ID.
 */
function makeIncidentId() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INC-${dateStr}-${rand}`;
}

module.exports = {
  detectIncident,
  buildIncidentReply,
  makeIncidentId,
  isEnabled,
  isTestMode,
  isAllowedChat,
};