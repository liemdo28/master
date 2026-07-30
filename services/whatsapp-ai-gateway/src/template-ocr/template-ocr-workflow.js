const registry = require('./template-registry');
const router = require('./template-image-router');
const preprocessor = require('./image-preprocessor');
const ocrEngine = require('./ocr-engine');
const validator = require('./template-ocr-validator');
const storage = require('./template-ocr-storage');
const sheetWriter = require('./template-ocr-sheet-writer');
const storeRegistry = require('../stores/store-registry');
const managerAlerts = require('../alerts/manager-alert-service');
const replyService = require('../whatsapp/reply-service');

const sessions = new Map();

function sessionKey(chatId, sender) {
  return `${chatId}:${sender}`;
}

function hasActiveSession(chatId, sender) {
  return sessions.has(sessionKey(chatId, sender));
}

function getAllSessions() {
  return Object.fromEntries(sessions.entries());
}

async function processImage(imagePath, metadata = {}) {
  const detection = await router.looksLikeTemplate(imagePath, metadata);
  if (!detection.isTemplate) return { handled: false, detection };

  const template = registry.getTemplate(detection.templateId) || registry.getDefaultTemplate();
  if (!template) return { handled: false, detection: { isTemplate: false, reason: 'no_template_registered' } };

  const mapping = metadata.chatId ? await storeRegistry.resolveGroup(metadata.chatId).catch(() => null) : null;
  const prep = await preprocessor.preprocessTemplateImage(imagePath, template, metadata);
  const ocr = await ocrEngine.ocrCrops(prep.crops);
  const validation = validator.validateOcrResults(ocr, template);
  const ocrId = storage.makeOcrId(metadata.chatId, metadata.messageId);

  // Prefer store info from detection (store-specific template routing), fall back to mapping
  const resolvedStore = detection.storeName || mapping?.store_name || 'Unknown';
  const resolvedStoreId = detection.storeId || mapping?.store_id || '';

  const payload = {
    ocrId,
    chatId: metadata.chatId || '',
    sender: metadata.sender || '',
    senderName: metadata.senderName || '',
    messageId: metadata.messageId || '',
    timestamp: metadata.timestamp || new Date().toISOString(),
    store: metadata.store || resolvedStore,
    storeId: metadata.storeId || resolvedStoreId,
    groupName: metadata.groupName || mapping?.group_name || '',
    templateId: template.template_id,
    templateVersion: template.version,
    imagePath,
    alignedImagePath: prep.alignedPath,
    originalPath: prep.originalPath,
    validation,
    detection,
    alignment: prep.alignment,
  };

  await storage.saveRun({
    ocrId,
    chatId: payload.chatId,
    sender: payload.sender,
    senderName: payload.senderName,
    store: payload.store,
    templateId: payload.templateId,
    templateVersion: payload.templateVersion,
    imagePath,
    alignedImagePath: prep.alignedPath,
    status: validation.status,
    sheetWriteStatus: 'WAITING_CONFIRM',
    payload,
  });

  sessions.set(sessionKey(payload.chatId, payload.sender), {
    state: 'WAITING_CONFIRM',
    ocrId,
    payload,
    updatedAt: new Date().toISOString(),
  });

  return { handled: true, result: validation.status, reply: buildSummary(payload), payload };
}

async function handleReply({ chatId, sender, senderName, text, client }) {
  const key = sessionKey(chatId, sender);
  const session = sessions.get(key);
  if (!session) return { handled: false };
  const ctrl = parseControl(text);

  if (ctrl.type === 'CANCEL' || ctrl.type === 'OPTION_4') {
    sessions.delete(key);
    await storage.updateRunStatus(session.ocrId, { status: 'CANCELLED', sheetWriteStatus: 'CANCELLED' });
    return { handled: true, reply: '❌ Template OCR discarded. Nothing was written.' };
  }

  if (ctrl.type === 'RETAKE' || ctrl.type === 'OPTION_2') {
    sessions.delete(key);
    await storage.updateRunStatus(session.ocrId, { status: 'RETAKE_REQUESTED', sheetWriteStatus: 'NOT_WRITTEN' });
    return { handled: true, reply: '📷 Please retake the photo and upload the new template image.' };
  }

  if (ctrl.type === 'MANAGER_REVIEW' || ctrl.type === 'OPTION_3') {
    // Flag for manager review — keep session but escalate
    await storage.updateRunStatus(session.ocrId, { status: 'MANAGER_REVIEW', sheetWriteStatus: 'PENDING_MANAGER' });
    const managerChatId = managerAlerts.getManagerChatId();
    if (client && managerAlerts.isEnabled() && managerChatId) {
      const v = session.payload.validation;
      const issues = v.failCount > 0
        ? v.failures.map(f => `- ${f.item}: ${f.value}°F | target ${f.target}`)
        : v.unclearCount > 0
          ? v.items.filter(i => i.status === 'NEEDS_REVIEW').map(i => `- ${i.item}: UNCLEAR`)
          : ['(no issues flagged)'];
      const managerText = [
        '🔔 Manager Review Requested',
        '',
        `Store: ${session.payload.store || 'Unknown'}`,
        `Employee: ${session.payload.senderName || senderName || 'Unknown'}`,
        `Chat: ${session.payload.chatId}`,
        `OCR ID: ${session.ocrId}`,
        '',
        'OCR Summary:',
        ...issues,
        '',
        'Image: ' + (session.payload.imagePath || 'saved'),
        '',
        'Actions:',
        '- Reply CONFIRM to save to Google Sheet',
        '- Reply RETAKE to request new photo',
        '- Reply CANCEL to discard',
      ].join('\n');
      await replyService.send(client, managerChatId, managerText);
    }
    sessions.delete(key);
    return {
      handled: true,
      reply: [
        '📋 Manager has been notified.',
        '',
        'A manager will review your submission and confirm or request a retake.',
        '',
        'You may also:',
        '1 — CONFIRM  → save to Google Sheet',
        '2 — RETAKE   → upload new photo',
        '4 — CANCEL   → discard',
      ].join('\n'),
    };
  }

  if (ctrl.type === 'EDIT') {
    const item = session.payload.validation.items[ctrl.index - 1];
    if (!item) return { handled: true, reply: `Item #${ctrl.index} not found. Use EDIT 1 40.` };
    item.value = ctrl.value;
    item.raw_text = String(ctrl.value);
    item.confidence = 1;
    session.payload.validation = validator.validateOcrResults(
      session.payload.validation.items.map(i => ({ item: i.item, value: i.value, confidence: i.confidence, raw_text: i.raw_text, crop_path: i.crop_path })),
      { fields: session.payload.validation.items.map((i, idx) => ({ item_name: i.item, row: idx + 1, target_min: i.target_min, target_max: i.target_max })) },
    );
    session.updatedAt = new Date().toISOString();
    await storage.updateRunStatus(session.ocrId, { status: session.payload.validation.status, payload: session.payload });
    return { handled: true, reply: buildSummary(session.payload) };
  }

  if (ctrl.type === 'CONFIRM' || ctrl.type === 'OPTION_1') {
    const write = await sheetWriter.writeConfirmedOcr(session.payload);
    sessions.delete(key);
    let reply = buildConfirmedReply(session.payload, write.status);
    if (session.payload.validation.failCount > 0) {
      const alert = await sendManagerAlert({ payload: session.payload, sheetWriteStatus: write.status, client, senderName });
      if (alert.storeWarning) reply = alert.storeWarning;
    }
    return { handled: true, reply };
  }

  return { handled: true, reply: 'Reply 1 CONFIRM, 2 RETAKE, 3 MANAGER, 4 CANCEL, or EDIT 1 40.' };
}

function parseControl(text) {
  const t = String(text || '').trim();
  const u = t.toUpperCase();

  // Numeric options (1, 2, 3, 4)
  if (t === '1') return { type: 'CONFIRM' };
  if (t === '2') return { type: 'RETAKE' };
  if (t === '3') return { type: 'MANAGER_REVIEW' };
  if (t === '4') return { type: 'CANCEL' };

  // Word commands
  if (u === 'CONFIRM' || u === 'YES' || u === 'OK') return { type: 'CONFIRM' };
  if (u === 'RETAKE') return { type: 'RETAKE' };
  if (u === 'MANAGER' || u === 'MANAGER_REVIEW') return { type: 'MANAGER_REVIEW' };
  if (u === 'CANCEL' || u === 'ABORT') return { type: 'CANCEL' };

  // EDIT 1 40
  const m = t.match(/^EDIT\s+(\d+)\s+(-?\d+(?:\.\d+)?)$/i);
  if (m) return { type: 'EDIT', index: Number(m[1]), value: Number(m[2]) };

  return { type: 'UNKNOWN' };
}

function buildSummary(payload) {
  const v = payload.validation;
  if (v.unclearCount > Math.max(3, Math.floor(v.items.length / 2))) {
    return [
      '⚠️ Photo is unclear. Please retake the photo.',
      '',
      `Store: ${payload.store || 'Unknown'}`,
      `Employee: ${payload.senderName || 'Unknown'}`,
      `Template: ${payload.templateId} v${payload.templateVersion}`,
      `Unclear items: ${v.unclearCount}`,
      '',
      'Reply RETAKE or CANCEL.',
    ].join('\n');
  }

  // Build date/time from timestamp
  let dateStr = '';
  let timeStr = '';
  try {
    const ts = payload.timestamp ? new Date(payload.timestamp) : new Date();
    dateStr = ts.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    timeStr = ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    timeStr = '';
  }

  // Separate items by status — MISSING and UNCLEAR need review
  const REVIEW_STATUSES = new Set(['MISSING', 'UNCLEAR', 'NEEDS_REVIEW', 'UNREADABLE']);
  const detected = v.items.filter(i => !REVIEW_STATUSES.has(i.status));
  const lowConfidence = v.items.filter(i => REVIEW_STATUSES.has(i.status));

  const lines = [
    `📋 OCR Summary - ${payload.store || 'Unknown'}`,
    '',
    `Employee: ${payload.senderName || 'Unknown'}`,
    `Date: ${dateStr}${timeStr ? '  Time: ' + timeStr : ''}`,
    '',
  ];

  if (detected.length > 0) {
    lines.push('✅ Detected Items:');
    for (const item of detected) {
      const value = item.value == null ? 'unclear' : `${item.value}°F`;
      const icon = item.status === 'PASS' ? '✅' : item.status === 'FAIL_HIGH' ? '🔴 HIGH' : item.status === 'FAIL_LOW' ? '🔵 LOW' : '⚠️ REVIEW';
      const target = validator.targetText(item);
      lines.push(`  ${item.item}: ${value} ${icon}  (target ${target || 'not set'})`);
    }
    lines.push('');
  }

  if (lowConfidence.length > 0) {
    lines.push('⚠️ Low Confidence Items (please verify):');
    for (const item of lowConfidence) {
      const target = validator.targetText(item);
      lines.push(`  ${item.item}: UNCLEAR — target ${target || 'not set'}`);
    }
    lines.push('');
  }

  lines.push('─────────────────────────────');
  lines.push('Reply with:');
  lines.push('1 — CONFIRM  → save to Google Sheet');
  lines.push('2 — RETAKE   → upload new photo');
  lines.push('3 — MANAGER  → request manager review');
  lines.push('4 — CANCEL   → discard');
  return lines.join('\n');
}

function buildConfirmedReply(payload, sheetWriteStatus) {
  if (payload.validation.failCount > 0) {
    return [
      'Daily Entry Logged with Warnings',
      '',
      'Out of range:',
      ...payload.validation.failures.map(f => `- ${f.item}: ${f.value}F, target ${f.target}`),
      '',
      sheetWriteStatus === 'SENT' ? 'Recorded to Google Sheet.' : 'Saved locally. Google Sheet write queued.',
    ].join('\n');
  }
  return sheetWriteStatus === 'SENT'
    ? 'Template OCR confirmed and recorded to Google Sheet.'
    : 'Template OCR confirmed. Saved locally and queued for Google Sheet write.';
}

async function sendManagerAlert({ payload, sheetWriteStatus, client, senderName }) {
  const issues = payload.validation.failures.map(f => ({
    item: f.item,
    value: f.value,
    target: f.target,
    status: f.reason === 'above_max' ? 'HIGH' : 'LOW',
  }));

  const storeWarning = [
    'Daily Entry Logged with Warnings',
    '',
    'Out of range:',
    ...issues.map(i => `- ${i.item}: ${i.value}F, target ${i.target}`),
    '',
    sheetWriteStatus === 'SENT' ? 'Recorded to Google Sheet.' : 'Saved locally. Google Sheet write queued.',
  ].join('\n');

  const managerChatId = managerAlerts.getManagerChatId();
  if (client && managerAlerts.isEnabled() && managerChatId) {
    const text = [
      'OCR Daily Entry Warning',
      '',
      `Store: ${payload.store || 'Unknown'}`,
      `Submitted by: ${senderName || payload.senderName || 'Unknown'}`,
      'Source: Printed Template OCR',
      '',
      'Issues:',
      ...issues.map(i => `- ${i.item}: ${i.value}F | Target ${i.target} | ${i.status}`),
      '',
      'Image saved for audit.',
    ].join('\n');
    await replyService.send(client, managerChatId, text);
  }

  return { storeWarning, issues };
}

module.exports = {
  processImage,
  handleReply,
  hasActiveSession,
  getAllSessions,
  buildSummary,
  parseControl,
};
