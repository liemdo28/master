/**
 * Broth Command — v2
 *
 * Session states:
 *   WAITING_STORE          → user sent /broth with no store detected
 *   WAITING_COUNTS         → store known, waiting for all values
 *   WAITING_MISSING_VALUES → partial counts received; waiting for rest in order
 *   WAITING_CONFIRM        → all counts present; waiting for CONFIRM/EDIT/CANCEL
 *
 * Session key: `${chatId}:${sender}`
 * Multiple staff in the same group never share a session.
 */

const { parseBrothCommand, parseSubmission, parseContinuation, parseControlCommand } = require('./broth-parser');
const { validateCounts } = require('./broth-validator');
const { validateAll, formatItemLine } = require('../templates/template-validator');
const brothLogWriter  = require('../google/broth-log-writer');
const templateCache   = require('../templates/template-cache');
const dailyTemplate   = require('../templates/daily-entry-template-service');
const storeRegistry   = require('../stores/store-registry');
const managerAlerts   = require('../alerts/manager-alert-service');
const { makeLogger }  = require('../logger');
const { t }           = require('../i18n/translations');
const { detect, detectAndTag } = require('../i18n/detector');
const auditTrail      = (() => { try { return require('../workflows/audit-trail'); } catch (_) { return null; } })();
const sheetQueue      = (() => { try { return require('../workflows/sheet-write-queue'); } catch (_) { return null; } })();

const log = makeLogger('whatsapp');

const storage = (() => { try { return require('../storage/food-safety-storage'); } catch (_) { return null; } })();

const STORES = ['Rim', 'Stone Oak', 'Bandera'];
const sessions = new Map();
const sessionClients = new Map();

// ── Session key ────────────────────────────────────────────────────────────────
function sessionKey(chatId, sender) { return `${chatId}:${sender}`; }

// ── Public API ─────────────────────────────────────────────────────────────────
function isBrothCommand(text)          { return parseBrothCommand(text).isCommand; }
function isHelpCommand(text)           { return /^\/help\s*$/i.test(String(text||'').trim()); }

function hasActiveSession(chatId, sender) {
  if (sender !== undefined) return sessions.has(sessionKey(chatId, sender));
  for (const key of sessions.keys()) {
    if (key.startsWith(chatId + ':')) return true;
  }
  return false;
}

function getSession(chatId, sender)    { return sessions.get(sessionKey(chatId, sender)); }
function clearSession(chatId, sender)  {
  const key = sessionKey(chatId, sender);
  sessions.delete(key);
  sessionClients.delete(key);
}
function getAllSessions()               { return Object.fromEntries(sessions.entries()); }
function getActiveSessions()           { return sessions.size; }

// ── /help ──────────────────────────────────────────────────────────────────────
function helpMessage(lang = 'en') {
  return t('help_direct', lang);
}

// ── Start command ──────────────────────────────────────────────────────────────
async function startBrothCommand({ chatId, isGroup = false, sender, senderName, text, groupName, timestamp, storeMapping = null, client = null }) {
  const parsed  = parseBrothCommand(text);
  const mapped = storeMapping || (isGroup ? await storeRegistry.resolveGroup(chatId) : null);
  const detected = mapped?.store_name || detectStore(parsed.storeText || groupName || '');
  const detectedStore = mapped || storeRegistry.getStoreByName(detected);
  const key      = sessionKey(chatId, sender);
  const template = dailyTemplate.getCurrentTemplate();
  const itemList = dailyTemplate.getTemplateItems().map(item => item.item_name);
  if (!template.available || itemList.length < 1) {
    return { reply: dailyTemplate.NOT_AVAILABLE_MESSAGE };
  }

  if (!detected) {
    if (client) sessionClients.set(key, client);
    const lang = detect(text);
    sessions.set(key, {
      state: 'WAITING_STORE',
      store: null,
      storeId: null,
      sender, senderName, chatId, isGroup,
      groupName: groupName || '',
      itemList,
      itemSource: template.source,
      draftCounts: {},
      missingItems: [],
      lang,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    log.info('Broth: awaiting store', { chatId, sender, lang });
    return { reply: askStoreMessage(sessions.get(key).lang) };
  }

  if (client) sessionClients.set(key, client);
  sessions.set(key, {
    state: 'WAITING_COUNTS',
    store: detected,
    storeId: detectedStore?.store_id || null,
    sender, senderName, chatId, isGroup,
    groupName: groupName || '',
    itemList,
      itemSource: template.source,
    draftCounts: {},
      missingItems: [],
      templateVersion: template.template_version,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  log.info('Broth: showing form', { chatId, sender, store: detected });
  return { reply: buildForm(detected, itemList) };
}

// ── Handle reply ───────────────────────────────────────────────────────────────
async function handleBrothReply({ chatId, isGroup = false, sender, senderName, text, timestamp, groupName = '', storeMapping = null, client = null }) {
  const key     = sessionKey(chatId, sender);
  const session = sessions.get(key);
  if (!session) return { handled: false };
  if (client) sessionClients.set(key, client);
  if (groupName && !session.groupName) session.groupName = groupName;
  const mapped = storeMapping || (isGroup ? await storeRegistry.resolveGroup(chatId) : null);
  if (isGroup && !mapped && !session.store) {
    clearSession(chatId, sender);
    return { reply: storeRegistry.unmappedGroupReply(), blocked: true, blockReason: 'unmapped_group' };
  }

  const itemList = session.itemList || dailyTemplate.getTemplateItems().map(item => item.item_name);
  const ctrl     = parseControlCommand(text, itemList);

  // ── Global controls (valid in any state) ──
  if (ctrl.type === 'CANCEL') {
    clearSession(chatId, sender);
    log.info('Broth: cancelled', { chatId, sender });
    return { reply: '❌ Broth count cancelled. Send /broth to start again.' };
  }

  if (ctrl.type === 'STATUS') {
    return { reply: buildStatusMessage(session, itemList) };
  }

  // ── EDIT (only in WAITING_CONFIRM) ──
  if (ctrl.type === 'EDIT') {
    if (session.state !== 'WAITING_CONFIRM') {
      return { reply: '⚠️ Nothing to edit yet. Please submit all counts first.' };
    }
    const oldValue = session.draftCounts[ctrl.itemName];
    session.draftCounts[ctrl.itemName] = ctrl.value;
    session.updatedAt = new Date().toISOString();
    sessions.set(key, session);
    log.info('Broth: edit applied', { chatId, sender, item: ctrl.itemName, value: ctrl.value });
    const validation = validateCounts({ values: session.draftCounts, invalid: [] }, itemList);
    // Record edit in audit trail if available
    if (auditTrail && session._auditLogId) {
      auditTrail.recordEdit({ auditLogId: session._auditLogId, itemName: ctrl.itemName, oldValue, newValue: ctrl.value, editedBy: session.senderName || sender }).catch(() => {});
    }
    return { reply: buildEditConfirmMessage(ctrl.itemName, ctrl.value, session, validation, itemList) };
  }

  // ── CONFIRM ──
  if (ctrl.type === 'CONFIRM') {
    if (session.state !== 'WAITING_CONFIRM') {
      return { reply: '⚠️ No pending submission to confirm. Please submit counts first.' };
    }
    return finalizeSubmission(session, chatId, sender, timestamp, itemList);
  }

  // ── State machine ──────────────────────────────────────────────────────────

  if (session.state === 'WAITING_STORE') {
    const store = parseStoreSelection(text) || detectStore(text);
    if (!store) return { reply: `⚠️ Store not recognised.\n\n${askStoreMessage()}` };
    const storeInfo = storeRegistry.getStoreByName(store);
    const updated = { ...session, state: 'WAITING_COUNTS', store, storeId: storeInfo?.store_id || null, updatedAt: new Date().toISOString() };
    sessions.set(key, updated);
    log.info('Broth: store selected', { chatId, sender, store });
    return { reply: buildForm(store, itemList) };
  }

  if (session.state === 'WAITING_COUNTS') {
    return handleCountsInput(key, session, text, itemList, chatId, sender);
  }

  if (session.state === 'WAITING_MISSING_VALUES') {
    return handleMissingInput(key, session, text, itemList, chatId, sender);
  }

  // WAITING_CONFIRM + unrecognised input → re-show confirm
  if (session.state === 'WAITING_CONFIRM') {
    // Try treating it as a resubmission
    const parsed = parseSubmission(text, itemList);
    if (Object.keys(parsed.values).length > 0 && parsed.invalid.length === 0) {
      const merged = { ...session.draftCounts, ...parsed.values };
      const validation = validateCounts({ values: merged, invalid: [] }, itemList);
      if (!validation.missing.length) {
        const updated = { ...session, draftCounts: merged, updatedAt: new Date().toISOString() };
        sessions.set(key, updated);
        return { reply: buildConfirmMessage(session.store, validation, itemList) };
      }
    }
    const validation = validateCounts({ values: session.draftCounts, invalid: [] }, itemList);
    return { reply: buildConfirmMessage(session.store, validation, itemList) };
  }

  return { handled: false };
}

// ── Count input handler ────────────────────────────────────────────────────────
function handleCountsInput(key, session, text, itemList, chatId, sender) {
  const parsed = parseSubmission(text, itemList);

  if (parsed.invalid.length) {
    return { reply: invalidMessage(parsed.invalid) };
  }

  const merged = { ...session.draftCounts, ...parsed.values };
  const validation = validateCounts({ values: merged, invalid: [] }, itemList);

  // Still have missing items → go to WAITING_MISSING_VALUES
  if (validation.missing.length) {
    const updated = {
      ...session,
      state: 'WAITING_MISSING_VALUES',
      draftCounts: merged,
      missingItems: validation.missing,
      updatedAt: new Date().toISOString(),
    };
    sessions.set(key, updated);
    log.info('Broth: partial counts, waiting for missing', { chatId, sender, missing: validation.missing.length });
    return { reply: missingMessage(validation.missing, itemList) };
  }

  // All complete → WAITING_CONFIRM
  const updated = {
    ...session,
    state: 'WAITING_CONFIRM',
    draftCounts: merged,
    missingItems: [],
    updatedAt: new Date().toISOString(),
  };
  sessions.set(key, updated);
  log.info('Broth: counts complete, awaiting confirm', { chatId, sender, store: session.store });
  return { reply: buildConfirmMessage(session.store, validation, itemList) };
}

// ── Missing values continuation handler ───────────────────────────────────────
function handleMissingInput(key, session, text, itemList, chatId, sender) {
  const parsed = parseContinuation(text, session.missingItems, itemList);

  if (parsed.invalid.length) {
    return { reply: invalidMessage(parsed.invalid) };
  }

  const merged = { ...session.draftCounts, ...parsed.values };
  const validation = validateCounts({ values: merged, invalid: [] }, itemList);

  // Still missing some
  if (validation.missing.length) {
    const updated = {
      ...session,
      draftCounts: merged,
      missingItems: validation.missing,
      updatedAt: new Date().toISOString(),
    };
    sessions.set(key, updated);
    return { reply: missingMessage(validation.missing, itemList) };
  }

  // All complete → WAITING_CONFIRM
  const updated = {
    ...session,
    state: 'WAITING_CONFIRM',
    draftCounts: merged,
    missingItems: [],
    updatedAt: new Date().toISOString(),
  };
  sessions.set(key, updated);
  log.info('Broth: missing values filled, awaiting confirm', { chatId, sender, store: session.store });
  return { reply: buildConfirmMessage(session.store, validation, itemList) };
}

// ── Finalize (CONFIRM) ─────────────────────────────────────────────────────────
async function finalizeSubmission(session, chatId, sender, timestamp, itemList) {
  const validation      = validateCounts({ values: session.draftCounts, invalid: [] }, itemList);
  const validationResult = validateAll(validation.counts); // dynamic min/max check
  const storeInfo       = session.storeId ? storeRegistry.getStoreById(session.storeId) : storeRegistry.getStoreByName(session.store);
  if (!storeInfo) {
    return { reply: '⚠️ Store is missing. This entry was not written. Please ask admin to map this group before submitting.' };
  }
  const metadata        = { chatId, sender, senderName: session.senderName, groupName: session.groupName || '', timestamp, sourceType: 'command' };
  const tmplStatus      = templateCache.getStatus();

  let entryId = null;
  if (storage) {
    try {
      entryId = await storage.saveBrothLogEntry({
        chatId,
        senderId: sender,
        senderName: session.senderName || sender,
        groupName: session.groupName || '',
        storeId: storeInfo.store_id,
        store: storeInfo.store_name,
        payload: { counts: validation.counts, validation: validationResult },
        status: validationResult.overallStatus, sheetWriteStatus: 'PENDING',
      });
    } catch (err) { log.warn('Broth: DB save failed (non-fatal)', { error: err.message }); }
  }

  const sheetWrite = await brothLogWriter.appendBrothLog({
    entryId: entryId ? `BROTH_${entryId}` : `BROTH_${Date.now()}`,
    metadata, store: storeInfo.store_name, storeId: storeInfo.store_id, counts: validation.counts,
    templateVersion: tmplStatus.version || '',
    validationResult,
    notes: validationResult.failCount > 0 ? 'Manager review recommended.' : 'Recorded via /broth command.',
  });

  await storeRegistry.markLastLogWrite(chatId).catch(() => {});

  if (storage && entryId) {
    try { await storage.updateBrothSheetStatus(entryId, sheetWrite.status); } catch (_) {}
  }

  const alertResult = await managerAlerts.handleConfirmedDailyEntry({
    client: sessionClients.get(sessionKey(chatId, sender)),
    session: { ...session, sender, chatId },
    store: storeInfo,
    validationResult,
    sheetWriteStatus: sheetWrite.status,
    timestamp,
    sessionId: `${chatId}:${sender}:${entryId || Date.now()}`,
  });

  clearSession(chatId, sender);
  log.info('Broth: confirmed and logged', {
    chatId, sender, store: session.store,
    status: validationResult.overallStatus, sheetStatus: sheetWrite.status,
  });

  return {
    result: { entryId, sheetWrite, validation, validationResult, managerAlert: alertResult.managerAlert },
    reply: alertResult.storeWarning || successMessage(storeInfo.store_name, sheetWrite.status, validationResult),
  };
}

// ── Store detection / selection ────────────────────────────────────────────────
function detectStore(text) {
  const v = String(text || '').toLowerCase();
  if (v.includes('stone oak') || v.includes('stoneoak')) return 'Stone Oak';
  if (v.includes('bandera'))                             return 'Bandera';
  if (v.includes('rim'))                                 return 'Rim';
  return null;
}

function parseStoreSelection(text) {
  const t = String(text || '').trim();
  if (t === '1') return 'Rim';
  if (t === '2') return 'Stone Oak';
  if (t === '3') return 'Bandera';
  return null;
}

// ── Message builders ───────────────────────────────────────────────────────────
function askStoreMessage(lang = 'en') {
  return t('ask_store_hint', lang);
}

function buildForm(store, itemList = dailyTemplate.getTemplateItems().map(item => item.item_name)) {
  if (!itemList || itemList.length === 0) {
    return dailyTemplate.NOT_AVAILABLE_MESSAGE;
  }
  return [
    `📋 Daily Entry Log - ${store}`,
    '',
    "Reply with today's values (comma-separated or line by line):",
    '',
    ...itemList.map((item, idx) => `${idx + 1}. ${item} (${dailyTemplate.formatRange(dailyTemplate.getItemByName(item))}) =`),
    '',
    'Example (CSV):',
    itemList.map((_, idx) => `<item ${idx + 1}>`).join(', '),
  ].join('\n');
}

/**
 * Build the full confirm/summary message with per-item PASS/FAIL and target ranges.
 * Runs dynamic validation against the current template thresholds.
 */
function buildConfirmMessage(store, validation, itemList = dailyTemplate.getTemplateItems().map(item => item.item_name)) {
  const validationResult = validateAll(validation.counts);
  const resultMap = Object.fromEntries(validationResult.results.map(r => [r.name, r]));

  const lines = [
    `📋 Daily Entry Summary - ${store}`,
    '',
    ...itemList.map((item, idx) => {
      const r = resultMap[item];
      if (!r) return `${idx + 1}. ${item}: ${validation.counts[item] ?? '—'}`;
      return formatItemLine(idx, r);
    }),
  ];

  // Show out-of-range failures prominently
  if (validationResult.failures.length > 0) {
    lines.push('', '⚠️ Out of range:');
    validationResult.failures.forEach(f =>
      lines.push(`  • ${f.name}: ${f.value}${f.target ? `, target ${f.target}` : ''}`)
    );
  }

  lines.push(
    '',
    'Reply:',
    'CONFIRM — save to Google Sheet',
    'EDIT <number> <value> — fix one item (e.g. EDIT 6 42)',
    'STATUS — view draft',
    'CANCEL — discard',
  );
  return lines.join('\n');
}

function buildEditConfirmMessage(itemName, value, session, validation, itemList) {
  return `✏️ Updated: ${itemName} = ${value}\n\n${buildConfirmMessage(session.store, validation, itemList)}`;
}

function buildStatusMessage(session, itemList = dailyTemplate.getTemplateItems().map(item => item.item_name)) {
  if (!session) return '⚠️ No active daily entry session.';
  const lines = [
    `📊 Draft Status — ${session.store || 'Store not selected'}`,
    `State: ${session.state}`,
    '',
  ];
  const counts = session.draftCounts || {};
  const hasCounts = Object.keys(counts).length > 0;
  if (hasCounts) {
    itemList.forEach((item, idx) => {
      const val = counts[item];
      lines.push(`${idx + 1}. ${item}: ${val != null ? val : '(missing)'}`);
    });
  } else {
    lines.push('No values entered yet.');
  }
  if (session.missingItems?.length) {
    lines.push('', `Still needed: ${session.missingItems.join(', ')}`);
  }
  lines.push('', 'Send CANCEL to discard.');
  return lines.join('\n');
}

function missingMessage(missing, itemList = dailyTemplate.getTemplateItems().map(item => item.item_name)) {
  return [
    '⚠️ Missing Values — please provide:',
    '',
    ...missing.map(item => `${itemList.indexOf(item) + 1}. ${item} (${dailyTemplate.formatRange(dailyTemplate.getItemByName(item))})`),
    '',
    'Reply with values in order, one per item or comma-separated.',
  ].join('\n');
}

function invalidMessage(invalid) {
  return [
    '⚠️ Invalid Values',
    '',
    'These are not valid numbers:',
    ...invalid.map(v => `  • ${v.item}: "${v.value}"`),
    '',
    'Please enter numbers only.',
  ].join('\n');
}

/**
 * Message shown after CONFIRM — split into PASS and FAIL paths.
 * @param {string} store
 * @param {string} sheetWriteStatus  - 'SENT' | 'QUEUED'
 * @param {{ overallStatus, failures, failCount }} validationResult
 */
function successMessage(store, sheetWriteStatus, validationResult) {
  const sheetLine = sheetWriteStatus === 'SENT'
    ? '📊 Recorded to Google Sheet.'
    : '💾 Saved locally. Google Sheet write queued.';

  if (validationResult?.overallStatus === 'FAIL' && validationResult.failures?.length > 0) {
    const failLines = validationResult.failures.map(
      f => `  • ${f.name}: ${f.value}${f.target ? `, target ${f.target}` : ''}`
    );
    return [
      '⚠️ Daily Entry Logged with Warnings',
      '',
      `Store: ${store}`,
      '',
      'Out of range:',
      ...failLines,
      '',
      sheetLine,
      'Please re-check and correct if needed.',
    ].join('\n');
  }

  return [
    '✅ Daily Entry Logged',
    '',
    `Store: ${store}`,
    `Status: PASS`,
    '',
    sheetLine,
  ].join('\n');
}

module.exports = {
  STORES,
  isBrothCommand,
  isHelpCommand,
  helpMessage,
  hasActiveSession,
  getSession,
  clearSession,
  getAllSessions,
  getActiveSessions,
  startBrothCommand,
  handleBrothReply,
  detectStore,
  buildForm,
  buildConfirmMessage,
  askStoreMessage,
  sessionKey,
  // Expose item list passthrough for tests — uses template cache
  get BROTH_ITEMS() {
    const names = templateCache.getItemNames();
    return names;
  },
};
