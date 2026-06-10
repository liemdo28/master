/**
 * Form Photo Workflow — Option B: Photo-First Food Safety
 * State machine: START → STORE_SELECTED → WAITING_FORM_PHOTO → OCR_PROCESSING
 *               → OCR_REVIEW_READY → CONFIRMED → SAVED
 * Non-blocking: Google Sheet failure does NOT block local save.
 */

const { makeLogger } = require('../logger');
const formPhotoStorage = require('./form-photo-storage');
const formPhotoOcr = require('./form-photo-ocr');
const formPhotoSheetSync = require('./form-photo-sheet-sync');
const replyService = require('../whatsapp/reply-service');
const storeRegistry = require('../stores/store-registry');

const log = makeLogger('form-photo');

const sessions = new Map();
function sessionKey(chatId, sender) { return `${chatId}:${sender}`; }

const STATES = {
  START: 'START',
  STORE_SELECTED: 'STORE_SELECTED',
  WAITING_FORM_PHOTO: 'WAITING_FORM_PHOTO',
  OCR_PROCESSING: 'OCR_PROCESSING',
  OCR_REVIEW_READY: 'OCR_REVIEW_READY',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  MANAGER_REVIEW: 'MANAGER_REVIEW',
  CONFIRMED: 'CONFIRMED',
  SAVED: 'SAVED',
  RETAKE_REQUESTED: 'RETAKE_REQUESTED',
  CANCELLED: 'CANCELLED',
};

function hasActiveSession(chatId, sender) { return sessions.has(sessionKey(chatId, sender)); }
function getAllSessions() { return Object.fromEntries(sessions.entries()); }
function isFormPhotoCommand(text) {
  return ['/FORM', '/FORMPHOTO', '/DAILY', '/DAILYPHOTO'].includes(String(text || '').trim().toUpperCase());
}

async function startFormPhotoWorkflow({ chatId, isGroup, sender, senderName, groupName, client }) {
  const key = sessionKey(chatId, sender);
  const existing = sessions.get(key);
  if (existing && existing.state !== STATES.CANCELLED && existing.state !== STATES.SAVED) {
    if (existing.state === STATES.WAITING_FORM_PHOTO) {
      return { handled: true, reply: existing.replyPrompt || 'Please send your completed form photo.' };
    }
  }
  let storeInfo = null;
  if (isGroup && chatId) {
    storeInfo = await storeRegistry.resolveGroup(chatId).catch(() => null);
  }
  const session = {
    state: storeInfo ? STATES.WAITING_FORM_PHOTO : STATES.STORE_SELECTED,
    chatId, sender,
    senderName: senderName || sender || 'Unknown',
    storeId: storeInfo?.store_id || null,
    store: storeInfo?.store_name || null,
    groupName: groupName || '',
    imagePath: null, ocrResult: null, ocrConfidence: 0,
    items: [], warnings: [],
    replyPrompt: null,
    submissionId: null,   // assigned after first saveSubmission() call
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  sessions.set(key, session);
  log.info('Form photo workflow started', { chatId, sender, store: session.store, state: session.state });
  if (session.state === STATES.STORE_SELECTED) {
    return { handled: true, reply: buildStoreSelectionReply() };
  }
  return { handled: true, reply: buildPhotoRequestReply(session) };
}

async function handleFormPhotoUpload({ chatId, sender, senderName, imagePath, metadata = {}, client }) {
  const key = sessionKey(chatId, sender);
  const session = sessions.get(key);
  if (!session) { log.warn('Photo but no session', { chatId, sender }); return { handled: false }; }
  if (session.state !== STATES.WAITING_FORM_PHOTO) { return { handled: false }; }
  session.imagePath = imagePath;
  session.state = STATES.OCR_PROCESSING;
  session.updatedAt = new Date().toISOString();
  await replyService.send(client, chatId, '🔍 Reading your form...').catch(() => {});
  let ocrResult;
  try {
    ocrResult = await formPhotoOcr.processFormImage(imagePath, {
      chatId, sender, senderName: session.senderName,
      storeId: session.storeId, store: session.store, groupName: session.groupName,
    });
  } catch (err) {
    log.error('OCR failed', { error: err.message, chatId, sender });
    session.state = STATES.WAITING_FORM_PHOTO;
    session.updatedAt = new Date().toISOString();
    return { handled: true, reply: '⚠️ I could not read this form clearly. Please retake the photo with better lighting and send it again.' };
  }
  session.ocrResult = ocrResult;
  session.ocrConfidence = ocrResult.ocr_confidence || 0;
  session.items = ocrResult.items || [];
  session.warnings = ocrResult.warnings || [];
  const LOW_CONFIDENCE_THRESHOLD = 0.6;
  if (session.ocrConfidence < LOW_CONFIDENCE_THRESHOLD || ocrResult.no_data) {
    session.state = STATES.NEEDS_REVIEW;
    session.updatedAt = new Date().toISOString();
    const sid = await formPhotoStorage.saveSubmission({
      chatId, sender, senderName: session.senderName,
      storeId: session.storeId, store: session.store,
      imagePath, ocrResult, status: 'NEEDS_REVIEW',
    });
    session.submissionId = sid;
    return { handled: true, reply: buildOcrReviewReply(session) };
  }
  session.state = STATES.OCR_REVIEW_READY;
  session.updatedAt = new Date().toISOString();
  const sid = await formPhotoStorage.saveSubmission({
    chatId, sender, senderName: session.senderName,
    storeId: session.storeId, store: session.store,
    imagePath, ocrResult, status: 'OCR_REVIEW_READY',
  });
  session.submissionId = sid;
  return { handled: true, reply: buildOcrSummaryReply(session) };
}

async function handleFormPhotoReply({ chatId, sender, senderName, text, client }) {
  const key = sessionKey(chatId, sender);
  const session = sessions.get(key);
  if (!session) return { handled: false };
  const trimmed = String(text || '').trim();
  const upper = trimmed.toUpperCase();
  if (session.state === STATES.STORE_SELECTED) {
    const storeInfo = resolveStoreFromText(trimmed);
    if (!storeInfo) return { handled: true, reply: 'Store not recognised. Please reply 1 (Rim), 2 (Stone Oak), or 3 (Bandera).' };
    session.storeId = storeInfo.store_id;
    session.store = storeInfo.store_name;
    session.state = STATES.WAITING_FORM_PHOTO;
    session.updatedAt = new Date().toISOString();
    await formPhotoStorage.initSession({ chatId, sender, storeId: session.storeId, store: session.store });
    return { handled: true, reply: buildPhotoRequestReply(session) };
  }
  if (session.state === STATES.OCR_REVIEW_READY || session.state === STATES.NEEDS_REVIEW) {
    if (upper === 'YES' || upper === 'Y' || upper === 'CONFIRM' || upper === '1') {
      return handleConfirm(session, key, client);
    }
    if (upper === 'RETAKE' || upper === '2') {
      return handleRetake(session, key);
    }
    if (upper === 'MANAGER' || upper === 'MANAGER_REVIEW' || upper === '3') {
      return handleManagerReview(session, key, client);
    }
    if (upper === 'CANCEL' || upper === 'ABORT' || upper === '4') {
      return handleCancel(session, key);
    }
    return { handled: true, reply: 'Reply YES to save, RETAKE to send a new photo, MANAGER to escalate, or CANCEL to discard.' };
  }
  return { handled: false };
}

async function handleConfirm(session, key, client) {
  session.state = STATES.CONFIRMED;
  session.updatedAt = new Date().toISOString();
  const saveResult = await formPhotoStorage.confirmSubmission({
    chatId: session.chatId, sender: session.sender,
    senderName: session.senderName, storeId: session.storeId,
    store: session.store, imagePath: session.imagePath,
    ocrResult: session.ocrResult, ocrConfidence: session.ocrConfidence,
    items: session.items, warnings: session.warnings,
    submissionId: session.submissionId, // prevents duplicate INSERT
  });
  // Non-blocking Google Sheet sync — never blocks local save
  formPhotoSheetSync.syncSubmission(saveResult.submissionId).catch(err => {
    log.warn('Sheet sync failed (non-blocking)', { error: err.message, submissionId: saveResult.submissionId });
  });
  session.state = STATES.SAVED;
  session.updatedAt = new Date().toISOString();
  const reply = buildSavedReply(session, saveResult);
  sessions.delete(key);
  return { handled: true, reply };
}

function handleRetake(session, key) {
  session.state = STATES.WAITING_FORM_PHOTO;
  session.imagePath = null;
  session.ocrResult = null;
  session.ocrConfidence = 0;
  session.items = [];
  session.warnings = [];
  session.updatedAt = new Date().toISOString();
  formPhotoStorage.markRetakeRequested(session.chatId, session.sender);
  return { handled: true, reply: '📷 Please retake the photo of your completed line check form and send it here.' };
}

async function handleManagerReview(session, key, client) {
  session.state = STATES.MANAGER_REVIEW;
  session.updatedAt = new Date().toISOString();

  // Mark submission as pending manager review
  if (session.submissionId) {
    await formPhotoStorage.markManagerReview(session.submissionId);
  }

  // Send alert to manager
  const managerAlerts = (() => {
    try { return require('../alerts/manager-alert-service'); } catch (_) { return null; }
  })();
  const managerChatId = managerAlerts?.getManagerChatId();

  if (managerAlerts?.isEnabled() && managerChatId && client) {
    const issues = session.warnings.map(w => ({ item: w, value: '⚠️', target: 'see warning', status: 'NEEDS_REVIEW' }));
    const alertText = [
      '🔔 Manager Review Requested — Form Photo',
      '',
      `Store: ${session.store || 'Unknown'}`,
      `Employee: ${session.senderName || 'Unknown'}`,
      `Chat: ${session.chatId}`,
      `Submission ID: ${session.submissionId || 'unknown'}`,
      '',
      'OCR Summary:',
      ...session.items.slice(0, 10).map(i => {
        const val = i.value != null ? `${i.value}°F` : 'unclear';
        const icon = i.status === 'PASS' ? '✅' : i.status === 'FAIL' ? '🔴' : '⚠️';
        return `- ${i.label || i.field_id}: ${val} ${icon}`;
      }),
      '',
      'Warnings:',
      ...session.warnings.map(w => `⚠️ ${w}`),
      '',
      'Image: ' + (session.imagePath || 'saved'),
      '',
      'Actions:',
      '- Reply CONFIRM to save to Google Sheet',
      '- Reply RETAKE to request new photo',
      '- Reply CANCEL to discard',
    ].join('\n');
    await replyService.send(client, managerChatId, alertText).catch(() => {});
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

function handleCancel(session, key) {
  session.state = STATES.CANCELLED;
  session.updatedAt = new Date().toISOString();
  formPhotoStorage.markCancelled(session.chatId, session.sender);
  sessions.delete(key);
  return { handled: true, reply: '❌ Submission cancelled. Send /form to start again.' };
}

function resolveStoreFromText(text) {
  const t = text.toLowerCase();
  const map = {
    '1': 'rim', 'rim': 'rim',
    '2': 'stone oak', 'stone oak': 'stone oak', 'stoneoak': 'stone oak',
    '3': 'bandera', 'bandera': 'bandera',
  };
  const key = map[t];
  if (!key) return null;
  const storeRegistry = require('../stores/store-registry');
  return storeRegistry.getStoreByName(key);
}

function buildStoreSelectionReply() {
  return [
    '🏪 Which store are you at?',
    '',
    '1 — Rim',
    '2 — Stone Oak',
    '3 — Bandera',
    '',
    'Reply with the number.',
  ].join('\n');
}

function buildPhotoRequestReply(session) {
  const store = session.store || 'your store';
  return [
    `📋 Food Safety Line Check — ${store}`,
    '',
    'Please take one clear photo of your completed line check form.',
    '',
    'Tips for a good photo:',
    '- Use good lighting',
    '- Keep the form flat and level',
    '- Fill in all fields before taking the photo',
  ].join('\n');
}

function buildOcrSummaryReply(session) {
  const lines = ['📋 I read this form:', ''];
  if (session.store) lines.push(`Store: ${session.store}`);
  if (session.ocrResult?.form_date) lines.push(`Date: ${session.ocrResult.form_date}`);
  if (session.ocrResult?.shift) lines.push(`Shift: ${session.ocrResult.shift}`);
  if (session.ocrResult?.employee_name) lines.push(`Employee: ${session.ocrResult.employee_name}`);
  lines.push('');
  if (session.items.length > 0) {
    lines.push('Temperatures:');
    for (const item of session.items.slice(0, 10)) {
      const val = item.value != null ? `${item.value}°F` : 'unclear';
      const icon = item.status === 'PASS' ? '✅' : item.status === 'FAIL' ? '🔴' : '⚠️';
      lines.push(`- ${item.label || item.field_id}: ${val} ${icon}`);
    }
    lines.push('');
  }
  if (session.warnings.length > 0) {
    lines.push('Warnings:');
    for (const w of session.warnings) lines.push(`⚠️ ${w}`);
    lines.push('');
  }
  lines.push('Reply YES to save, RETAKE to send a new photo, or MANAGER to escalate.');
  return lines.join('\n');
}

function buildOcrReviewReply(session) {
  const lines = ['⚠️ This form needs review.', ''];
  if (session.store) lines.push(`Store: ${session.store}`);
  if (session.ocrResult?.form_date) lines.push(`Date: ${session.ocrResult.form_date}`);
  lines.push(`OCR confidence: ${Math.round(session.ocrConfidence * 100)}%`);
  lines.push('');
  if (session.items.length > 0) {
    lines.push('Detected items:');
    for (const item of session.items.slice(0, 8)) {
      lines.push(`- ${item.label || item.field_id}: ${item.value != null ? `${item.value}°F` : 'unclear'}`);
    }
    lines.push('');
  }
  lines.push('Reply YES to save anyway, RETAKE to send a new photo, MANAGER to escalate, or CANCEL to discard.');
  return lines.join('\n');
}

function buildSavedReply(session, saveResult) {
  const lines = ['✅ Correct submission confirmed', ''];
  if (session.store) lines.push(`Store: ${session.store}`);
  lines.push(`Date: ${new Date().toLocaleDateString()}`);
  if (session.items.length > 0) {
    lines.push('');
    lines.push('Temperatures recorded:');
    for (const item of session.items.slice(0, 8)) {
      const icon = item.status === 'PASS' ? '✅' : '🔴';
      lines.push(`  ${icon} ${item.label || item.field_id}: ${item.value != null ? `${item.value}°F` : 'N/A'}`);
    }
  }
  lines.push('');
  lines.push('View on Dashboard:');
  lines.push(`${process.env.DASHBOARD_URL || 'http://localhost:3000'}`);
  return lines.join('\n');
}

module.exports = {
  startFormPhotoWorkflow,
  handleFormPhotoUpload,
  handleFormPhotoReply,
  hasActiveSession,
  getAllSessions,
  isFormPhotoCommand,
  STATES,
};
