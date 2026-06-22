/**
 * Form Photo Workflow — CEO Operating Model: Photo-First Food Safety
 *
 * Auto-capture: Employee uploads form photo → bot auto-classifies → OCR → reply
 * Confirmation: CONFIRM / EDIT / RETAKE / MANAGER / CANCEL
 * EDIT supports: EDIT 3 38 (item#), EDIT SO-03 38 (field_id), EDIT 11 335
 *
 * State machine: START → WAITING_FORM_PHOTO → OCR_PROCESSING
 *              → OCR_REVIEW_READY → CONFIRMED → SAVED
 * Non-blocking: Google Sheet failure does NOT block local save.
 */

const { makeLogger } = require('../logger');
const formPhotoStorage = require('./form-photo-storage');
const formPhotoOcr = require('./form-photo-ocr');
const formPhotoSheetSync = require('./form-photo-sheet-sync');
const replyService = require('../whatsapp/reply-service');
const storeRegistry = require('../stores/store-registry');
const safetyIntelligence = require('../food-safety/safety-intelligence');
const alertExpander = (() => { try { return require('../food-safety/manager-alert-expander'); } catch (_) { return null; } })();

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
    submissionId: null,
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

  // ── DEV2: Run safety intelligence validation on OCR results ──
  const intelResult = safetyIntelligence.validateSubmission({
    items: session.items,
    imagePath,
    store: session.store,
    employee: session.senderName,
  });
  session.intelligence = intelResult;
  session.safetyStatus = intelResult.status;
  if (intelResult.issues.length > 0) {
    for (const issue of intelResult.issues) {
      if (issue.type === 'unsafe_temperature' || issue.type === 'temperature_warning') {
        session.warnings.push(`${issue.item}: ${issue.message}`);
      }
    }
  }

  const sid = await formPhotoStorage.saveSubmission({
    chatId, sender, senderName: session.senderName,
    storeId: session.storeId, store: session.store,
    imagePath, ocrResult, status: 'OCR_REVIEW_READY',
  });
  session.submissionId = sid;
  return { handled: true, reply: buildPreConfirmReply(session) };
}

// ── CEO EDIT Command Handler ──────────────────────────────────────────────────
/**
 * Parse EDIT command.
 * Supports: EDIT 3 38, EDIT SO-03 38, EDIT 11 335
 */
function parseEditCommand(text) {
  const t = String(text || '').trim();
  // Pattern: EDIT <item_number_or_field_id> <new_value>
  const m = t.match(/^EDIT\s+(\S+)\s+(-?\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  return { target: m[1].trim(), value: parseFloat(m[2]) };
}

/**
 * Apply an edit to the session items.
 * Returns { handled, reply, editedItem }
 */
function tryHandleEdit(session, text) {
  const edit = parseEditCommand(text);
  if (!edit) return { handled: false };
  const { target, value } = edit;

  let item = null;
  let itemIndex = -1;

  // Try numeric index first (EDIT 3 38 = edit item at index 3)
  const numericIndex = parseInt(target, 10);
  if (!isNaN(numericIndex) && numericIndex > 0) {
    itemIndex = numericIndex - 1; // 1-based in UI
    if (itemIndex >= 0 && itemIndex < session.items.length) {
      item = session.items[itemIndex];
    }
  }

  // Try field_id match (EDIT SO-03 38)
  if (!item) {
    itemIndex = session.items.findIndex(i => {
      const fid = (i.field_id || '').toLowerCase();
      const label = (i.label || '').toLowerCase().replace(/\s+/g, '_');
      return fid === target.toLowerCase() || label === target.toLowerCase() || fid === target.toLowerCase().replace(/\s+/g, '_');
    });
    if (itemIndex >= 0) item = session.items[itemIndex];
  }

  if (!item) {
    return {
      handled: true,
      reply: `Item "${target}" not found.\n\nReply CONFIRM to save, or EDIT <item_number> <value> to change another item.`,
    };
  }

  // Apply the edit
  const oldValue = item.value;
  item.value = value;
  item.confidence = 1.0;
  item.status = classifyTemperature(item.label, value);
  if (session.intelligence) {
    session.intelligence = safetyIntelligence.validateSubmission({
      items: session.items,
      imagePath: session.imagePath,
      store: session.store,
      employee: session.senderName,
      submissionId: session.submissionId,
    });
    session.safetyStatus = session.intelligence.status;
  }

  const itemNum = itemIndex + 1;
  const reply = [
    `Updated:`,
    `${itemNum}. ${item.label || item.field_id}: ${value}°F`,
    '',
    'Reply CONFIRM to save or continue editing.',
  ].join('\n');

  log.info('Item edited', { itemIndex: itemIndex + 1, oldValue, newValue: value, fieldId: item.field_id });

  return { handled: true, reply };
}

function classifyTemperature(label, value) {
  const l = (label || '').toLowerCase();
  if (l.includes('freezer') || l.includes('frozen')) return value >= -10 && value <= 0 ? 'PASS' : 'FAIL';
  if (l.includes('cooler') || l.includes('refrig') || l.includes('cold')) return value >= 32 && value <= 40 ? 'PASS' : 'FAIL';
  if (l.includes('hot') || l.includes('holding') || l.includes('chicken') || l.includes('rice')) return value >= 140 ? 'PASS' : 'FAIL';
  if (value >= -10 && value <= 200) return 'PASS';
  return 'FAIL';
}

async function handleFormPhotoReply({ chatId, sender, senderName, text, client }) {
  const key = sessionKey(chatId, sender);
  const session = sessions.get(key);
  if (!session) return { handled: false };
  const trimmed = String(text || '').trim();
  const upper = trimmed.toUpperCase();

  // ── CEO Operating Model: EDIT command ───────────────────────────────────────
  if (session.state === STATES.OCR_REVIEW_READY || session.state === STATES.NEEDS_REVIEW) {
    const editResult = tryHandleEdit(session, trimmed);
    if (editResult.handled) return editResult;
  }

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
    return {
      handled: true,
      reply: 'Reply CONFIRM to save, EDIT 3 38 to change an item, RETAKE to upload new photo, MANAGER to escalate, CANCEL to discard.',
    };
  }
  return { handled: false };
}

async function handleConfirm(session, key, client) {
  session.state = STATES.CONFIRMED;
  session.updatedAt = new Date().toISOString();

  // ── DEV2: Re-run intelligence on final items before saving ──
  const finalIntel = safetyIntelligence.validateSubmission({
    items: session.items,
    imagePath: session.imagePath,
    store: session.store,
    employee: session.senderName,
    submissionId: session.submissionId,
  });
  session.intelligence = finalIntel;
  session.safetyStatus = finalIntel.status;

  const saveResult = await formPhotoStorage.confirmSubmission({
    chatId: session.chatId, sender: session.sender,
    senderName: session.senderName, storeId: session.storeId,
    store: session.store, imagePath: session.imagePath,
    ocrResult: session.ocrResult, ocrConfidence: session.ocrConfidence,
    items: session.items, warnings: session.warnings,
    safetyStatus: session.safetyStatus,
    safetyIssues: finalIntel.issues,
    submissionId: session.submissionId,
  });
  formPhotoSheetSync.syncSubmission(saveResult.submissionId).catch(err => {
    log.warn('Sheet sync failed (non-blocking)', { error: err.message, submissionId: saveResult.submissionId });
  });

  // ── DEV2: Fire manager alerts for confirmed issues ──
  triggerManagerAlerts(session, client, saveResult.submissionId);

  session.state = STATES.SAVED;
  session.updatedAt = new Date().toISOString();
  const reply = buildSavedReply(session, saveResult);
  sessions.delete(key);
  return { handled: true, reply };
}

/**
 * DEV2: Trigger appropriate manager alerts based on intelligence results.
 */
async function triggerManagerAlerts(session, client, submissionId) {
  if (!alertExpander) return;
  const managerChatId = (() => {
    try { const ma = require('../alerts/manager-alert-service'); return ma.getManagerChatId(); } catch (_) { return ''; }
  })();
  if (!managerChatId) return;

  const opts = {
    client, managerChatId,
    store: session.store,
    employee: session.senderName,
    employeeId: session.sender,
    submissionId: submissionId || session.submissionId,
  };

  const intel = session.intelligence;
  if (!intel || !intel.issues || intel.issues.length === 0) return;

  for (const issue of intel.issues) {
    try {
      if (issue.type === 'unsafe_temperature' || issue.severity === 'UNSAFE') {
        await alertExpander.onUnsafeConfirmed({ ...opts, item: issue.item, captured: issue.captured, expected: issue.expected, imagePath: session.imagePath });
      } else if (issue.type === 'missing_field') {
        await alertExpander.onMissingField({ ...opts, missingItems: [issue.item], imagePath: session.imagePath });
      } else if (issue.type === 'low_confidence') {
        await alertExpander.onLowConfidence({ ...opts, confidence: parseFloat(String(issue.captured || '0').replace('%', '')) / 100 });
      } else if (issue.type === 'duplicate_photo') {
        await alertExpander.onDuplicateForm(opts);
      }
    } catch (err) {
      log.warn('Manager alert trigger failed', { error: err.message, issueType: issue.type });
    }
  }

  // Track low overall OCR confidence
  if (session.ocrConfidence && session.ocrConfidence < 0.5) {
    try {
      await alertExpander.onLowConfidence({ ...opts, confidence: session.ocrConfidence });
    } catch (_) {}
  }
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

  // ── DEV2: Track retakes for manager alerting ──
  if (alertExpander) {
    alertExpander.trackRetake({
      chatId: session.chatId,
      employeeId: session.sender,
      store: session.store,
      employee: session.senderName,
    }).catch(err => log.warn('Retake tracking failed', { error: err.message }));
  }

  return { handled: true, reply: '📷 Please retake the photo of your completed line check form and send it here.' };
}

async function handleManagerReview(session, key, client) {
  session.state = STATES.MANAGER_REVIEW;
  session.updatedAt = new Date().toISOString();
  if (session.submissionId) {
    await formPhotoStorage.markManagerReview(session.submissionId);
  }
  const managerAlerts = (() => {
    try { return require('../alerts/manager-alert-service'); } catch (_) { return null; }
  })();
  const managerChatId = managerAlerts?.getManagerChatId();
  if (managerAlerts?.isEnabled() && managerChatId && client) {
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

// ── CEO-Style Confirmation Message ───────────────────────────────────────────
/**
 * Builds the CEO-style confirmation message with numbered items.
 * Example:
 *   I captured this Food Safety form:
 *
 *   Store: Stone Oak
 *   Date: 5/27
 *   Employee: Sol
 *
 *   1. Walk-In Cooler: 40°F
 *   2. Walk-In Freezer: 0°F
 *   3. Prep Area Refrig: 40°F
 *   4. Fryer 1: 334°F
 *
 *   Reply:
 *   CONFIRM = save
 *   EDIT 3 38 = change item #3 to 38°F
 *   RETAKE = upload clearer photo
 *   MANAGER = send to manager review
 *   CANCEL = cancel
 */
function buildOcrSummaryReply(session) {
  const lines = ['📋 I captured this Food Safety form:', ''];
  if (session.store) lines.push(`Store: ${session.store}`);
  if (session.ocrResult?.form_date) lines.push(`Date: ${session.ocrResult.form_date}`);
  if (session.ocrResult?.employee_name) lines.push(`Employee: ${session.ocrResult.employee_name}`);
  lines.push('');
  if (session.items.length > 0) {
    for (let i = 0; i < session.items.length; i++) {
      const item = session.items[i];
      const val = item.value != null ? `${item.value}°F` : 'unclear';
      const icon = item.status === 'PASS' ? '' : item.status === 'FAIL' ? ' ⚠️' : ' ⚠️';
      lines.push(`${i + 1}. ${item.label || item.field_id}: ${val}${icon}`);
    }
    lines.push('');
  }
  if (session.warnings.length > 0) {
    lines.push('Warnings:');
    for (const w of session.warnings) lines.push(`⚠️ ${w}`);
    lines.push('');
  }
  lines.push('Reply:');
  lines.push('CONFIRM = save');
  lines.push('EDIT 3 38 = change item #3 to 38°F');
  lines.push('RETAKE = upload clearer photo');
  lines.push('MANAGER = send to manager review');
  lines.push('CANCEL = cancel');
  return lines.join('\n');
}

function buildPreConfirmReply(session) {
  const safetyReply = safetyIntelligence.buildSafetyReply(session.intelligence, session.store);
  if (!safetyReply) return buildOcrSummaryReply(session);

  const lines = [buildOcrSummaryReply(session), '', safetyReply];
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
  parseEditCommand,
  tryHandleEdit,
  buildPreConfirmReply,
};

function buildOcrReviewReply(session) {
  const lines = ['⚠️ This form needs review.', ''];
  if (session.store) lines.push(`Store: ${session.store}`);
  if (session.ocrResult?.form_date) lines.push(`Date: ${session.ocrResult.form_date}`);
  lines.push(`OCR confidence: ${Math.round(session.ocrConfidence * 100)}%`);
  lines.push('');
  if (session.items.length > 0) {
    lines.push('Detected items:');
    for (let i = 0; i < session.items.length; i++) {
      const item = session.items[i];
      lines.push(`${i + 1}. ${item.label || item.field_id}: ${item.value != null ? `${item.value}°F` : 'unclear'}`);
    }
    lines.push('');
  }
  lines.push('Reply:');
  lines.push('CONFIRM = save anyway');
  lines.push('EDIT 3 38 = change item #3');
  lines.push('RETAKE = upload new photo');
  lines.push('MANAGER = escalate');
  lines.push('CANCEL = discard');
  return lines.join('\n');
}

function buildSavedReply(session, saveResult) {
  const lines = ['✅ Correct submission confirmed', ''];
  if (session.store) lines.push(`Store: ${session.store}`);
  lines.push(`Date: ${new Date().toLocaleDateString()}`);
  if (session.items.length > 0) {
    lines.push('');
    lines.push('Temperatures recorded:');
    for (let i = 0; i < session.items.length; i++) {
      const item = session.items[i];
      const icon = item.status === 'PASS' ? '✅' : '🔴';
      lines.push(`  ${icon} ${item.label || item.field_id}: ${item.value != null ? `${item.value}°F` : 'N/A'}`);
    }
  }
  if (session.safetyStatus) {
    lines.push('');
    lines.push(`Food Safety Status: ${session.safetyStatus}`);
  }
  lines.push('');
  lines.push('View on Dashboard:');
  lines.push(`${process.env.DASHBOARD_URL || 'http://localhost:3000'}`);
  return lines.join('\n');
}
