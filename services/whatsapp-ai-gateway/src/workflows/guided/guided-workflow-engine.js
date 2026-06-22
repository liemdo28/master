/**
 * Guided Workflow Engine
 * Phase 1 Fix (2026-06-04): Numeric input now always parsed;
 * out-of-range shows 1=Confirm/2=Re-enter/3=Skip flow.
 */

const { t } = require('../../i18n/translations');
const { detect } = require('../../i18n/detector');
const templateCache = require('../../templates/template-cache');
const dailyTemplate = require('../../templates/daily-entry-template-service');
const { makeLogger } = require('../../logger');
const nlpResolver = require('../../nlp/command-resolver');

const log = makeLogger('whatsapp');

// YoLink sensor cross-validation (optional)
let _crossValidate = null;
function getYoLinkCrossValidate() {
  if (_crossValidate !== null) return _crossValidate;
  try {
    const svc = require('../../integrations/yolink/yolink-device-service');
    _crossValidate = async (storeId, itemName, humanValue) => {
      try { return await svc.crossValidate(storeId, itemName, humanValue); } catch (_) { return null; }
    };
  } catch (_) { _crossValidate = null; }
  return _crossValidate;
}

// ── Session states ─────────────────────────────────────────────────────────
const STATES = {
  BREADCRUMB_ASK:            'BREADCRUMB_ASK',
  BREADCRUMB_RANGE_CONFIRM:  'BREADCRUMB_RANGE_CONFIRM',
  BREADCRUMB_MISSING:        'BREADCRUMB_MISSING',
  SUMMARY:                   'SUMMARY',
  CONFIRM:                   'CONFIRM',
};

const sessions = new Map();

function sessionKey(chatId, sender) { return `${chatId}:${sender}`; }

// ── Control commands ───────────────────────────────────────────────────────
function parseControl(text) {
  const nlp = nlpResolver.resolveCommand(text);
  if (nlp.autoHandle) {
    if (nlp.intent === 'CONFIRM') return { type: 'CONFIRM' };
    if (nlp.intent === 'CANCEL') return { type: 'CANCEL' };
    if (nlp.intent === 'STATUS') return { type: 'STATUS' };
    if (nlp.intent === 'REENTER') return { type: 'REENTER' };
    if (nlp.intent === 'SKIP') return { type: 'SKIP' };
  }
  const u = String(text || '').trim().toUpperCase();
  if (u === 'CONFIRM' || u === 'YES' || u === 'OK') return { type: 'CONFIRM' };
  if (u === 'CANCEL'  || u === 'ABORT' || u === 'STOP') return { type: 'CANCEL' };
  if (u === 'STATUS'  || u === 'DRAFT') return { type: 'STATUS' };
  const m = String(text || '').trim().match(/^edit\s+(\d{1,2})\s+(\d+(?:[.,]\d+)?)$/i);
  if (m) return { type: 'EDIT', index: parseInt(m[1], 10), value: parseFloat(m[2].replace(',', '.')) };
  const n = String(text || '').trim().match(/^edit\s+(.+?)\s+(\d+(?:[.,]\d+)?)$/i);
  if (n) return { type: 'EDIT', name: n[1].trim(), value: parseFloat(n[2].replace(',', '.')) };
  if (u === '1' || u === 'CORRECT' || u === 'CONFIRM') return { type: 'CORRECT' };
  if (u === '2' || u === 'RE-ENTER' || u === 'REENTER') return { type: 'REENTER' };
  if (u === '3' || u === 'SKIP') return { type: 'SKIP' };
  return { type: null };
}

// ── Init ─────────────────────────────────────────────────────────────────
function startGuidedWorkflow({ chatId, sender, senderName, store, workflowType, items = null, thresholds = null, groupName = '', templateVersion = null, lang = 'en' }) {
  const key = sessionKey(chatId, sender);
  const rawItems = items && items.length > 0 ? items : dailyTemplate.getTemplateItems();
  const itemObjects = rawItems.map((item, idx) => typeof item === 'string'
    ? { item_name: item, category: null, target_min: null, target_max: null, unit: 'F', sort_order: idx + 1 }
    : item);
  const itemList = itemObjects.map(item => item.item_name || item.name).filter(Boolean);
  const itemMeta = Object.fromEntries(itemObjects.map((item, idx) => [
    item.item_name || item.name,
    { ...item, sort_order: item.sort_order || idx + 1 },
  ]));
  const derivedThresholds = Object.fromEntries(itemObjects.map(item => [
    item.item_name || item.name,
    { min: item.target_min ?? item.min ?? null, max: item.target_max ?? item.max ?? null },
  ]));
  const thr = thresholds && Object.keys(thresholds).length > 0 ? thresholds : (Object.keys(derivedThresholds).length ? derivedThresholds : templateCache.getThresholds());
  sessions.set(key, {
    state: STATES.BREADCRUMB_ASK, workflowType, chatId, sender, senderName, store, groupName,
    itemList, itemMeta, thresholds: thr, templateVersion,
    draftCounts: {}, askedItems: [], currentAskIndex: 0,
    missingItems: [...itemList], rangeConfirmPending: null, lang,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    skipHistory: [], editHistory: [], _lastText: '',
  });
  log.info('Guided workflow started', { key, workflow: workflowType, itemCount: itemList.length });
  return buildAskMessage(key);
}

// ── Handle reply ─────────────────────────────────────────────────────────
async function handleReply({ chatId, sender, senderName, text, groupName = '', thresholds = null }) {
  const key = sessionKey(chatId, sender);
  const session = sessions.get(key);
  if (!session) return null;
  if (groupName && !session.groupName) session.groupName = groupName;
  session.lang = session.lang || detect(text);
  session._lastText = text;
  const ctrl = parseControl(text);

  if (ctrl.type === 'CANCEL') { sessions.delete(key); return { handled: true, cancelled: true, reply: '❌ Workflow cancelled.' }; }
  if (ctrl.type === 'STATUS') return { handled: true, reply: buildStatusMessage(session) };
  if (ctrl.type === 'CONFIRM') return handleConfirm(session);
  if (ctrl.type === 'EDIT') return handleEdit(session, ctrl);
  if (session.state === STATES.BREADCRUMB_RANGE_CONFIRM) return handleRangeConfirm(session, ctrl);
  if (session.state === STATES.BREADCRUMB_ASK) return handleBreadcrumbAsk(session, text);
  if (session.state === STATES.BREADCRUMB_MISSING) return handleMissingContinuation(session, text);
  if (session.state === STATES.CONFIRM || session.state === STATES.SUMMARY) return { handled: true, reply: buildSummaryMessage(session) };
  return { handled: true, reply: buildAskMessage(key) };
}

// ── Breadcrumb ask ────────────────────────────────────────────────────────
async function handleBreadcrumbAsk(session, text) {
  const { missingItems, thresholds } = session;
  const current = missingItems[0];
  if (!current) return handleAllCollected(session);
  const raw = String(text || '').trim();
  const { value: parsedValue, unit } = parseHumanInput(raw);

  if (parsedValue === null) {
    const textNum = parseTextNumber(raw);
    if (textNum !== null) return await handleValidValue(session, current, textNum, raw, thresholds, null);
    const thr = thresholds[current];
    const rangeHint = thr && (thr.min != null || thr.max != null) ? `\nTarget: ${formatRange(thr.min, thr.max)}` : '';
    return { handled: true, reply: `⚠️ Please enter a number.\n${current}${rangeHint}\n\nExample: 35` };
  }
  return await handleValidValue(session, current, parsedValue, raw, thresholds, unit);
}

async function handleValidValue(session, current, value, raw, thresholds, unit = null) {
  const thr = thresholds[current];

  if (unit === 'C') {
    const fahrenheit = celsiusToFahrenheit(value);
    const pending = session._pendingCConversion || null;
    if (!pending || pending.item !== current || pending.originalCelsius !== value) {
      session._pendingCConversion = { item: current, fahrenheit, originalCelsius: value };
      return {
        handled: true,
        reply: t('celsius_conversion_ask', session.lang, { item: current, celsius: value, fahrenheit: fahrenheit.toFixed(1) })
          + '\n\n1 — ' + t('confirm_1', session.lang) + '\n2 — ' + t('reenter_2', session.lang),
      };
    }
    value = fahrenheit;
  }
  session._pendingCConversion = null;

  if (thr && (thr.min != null || thr.max != null)) {
    const min = thr.min, max = thr.max;
    const outOfRange = (min != null && value < min) || (max != null && value > max);
    if (outOfRange) {
      const target = displayRange(session, current);
      const severity = classifyOutOfRange(value, min, max, thr);
      session.state = STATES.BREADCRUMB_RANGE_CONFIRM;
      session.rangeConfirmPending = { itemName: current, value, confirmed: false, severity, raw, unit };
      session.updatedAt = new Date().toISOString();
      return { handled: true, reply: buildRangeConfirmMessage(session, current, value, target, severity) };
    }
  }

  const cvFn = getYoLinkCrossValidate();
  let cvResult = null;
  if (cvFn) { try { cvResult = await cvFn(session.store, current, value); } catch (_) {} }

  session.draftCounts[current] = value;
  session.missingItems = session.missingItems.slice(1);
  session.askedItems.push(current);
  session.updatedAt = new Date().toISOString();

  let reply = buildAskMessage(sessionKey(session.chatId, session.sender));
  if (cvResult && cvResult.status === 'SENSOR_OK') {
    const diff = Math.abs(value - cvResult.sensor_value).toFixed(1);
    reply += `\n\n📡 Sensor cross-check: ${cvResult.sensor_value}°${cvResult.reading?.unit || 'F'} (${diff}° diff, ${cvResult.age_minutes}min ago)`;
  } else if (cvResult && cvResult.status === 'SENSOR_STALE') {
    reply += `\n\n📡 Sensor reading stale (${cvResult.age_minutes}min ago). Manual entry used.`;
  } else if (cvResult && cvResult.status === 'SENSOR_OFFLINE') {
    reply += `\n\n📡 Sensor offline. Manual entry used.`;
  }

  if (session.missingItems.length === 0) return handleAllCollected(session);
  return { handled: true, reply };
}

// ── Range confirm ─────────────────────────────────────────────────────────
function handleRangeConfirm(session, ctrl) {
  const pending = session.rangeConfirmPending || {};
  const { itemName, value } = pending;
  if (ctrl.type === 'CORRECT' || ctrl.type === 'CONFIRM') {
    session.draftCounts[itemName] = value;
    session.missingItems = session.missingItems.slice(1);
    session.askedItems.push(itemName);
    session.state = STATES.BREADCRUMB_ASK;
    session.rangeConfirmPending = null;
    session.updatedAt = new Date().toISOString();
    session._lastConfirmedOutOfRange = itemName;
    if (session.missingItems.length === 0) return handleAllCollected(session);
    return { handled: true, reply: buildAskMessage(sessionKey(session.chatId, session.sender)) };
  }
  if (ctrl.type === 'REENTER') {
    session.state = STATES.BREADCRUMB_ASK;
    session.rangeConfirmPending = null;
    session.updatedAt = new Date().toISOString();
    return { handled: true, reply: buildAskMessage(sessionKey(session.chatId, session.sender)) };
  }
  if (ctrl.type === 'SKIP') {
    session.skipHistory = session.skipHistory || [];
    session.skipHistory.push({ itemName, value, skippedAt: new Date().toISOString() });
    session.missingItems = session.missingItems.slice(1);
    session.askedItems.push(itemName);
    session.state = STATES.BREADCRUMB_ASK;
    session.rangeConfirmPending = null;
    session.updatedAt = new Date().toISOString();
    if (session.missingItems.length === 0) return handleAllCollected(session);
    return { handled: true, reply: t('skipped_item', session.lang, { item: itemName }) + '\n\n' + buildAskMessage(sessionKey(session.chatId, session.sender)) };
  }
  return { handled: true, reply: t('range_confirm_choices', session.lang) };
}

// ── Missing continuation ─────────────────────────────────────────────────
function handleMissingContinuation(session, text) {
  const raw = String(text || '').trim();
  const values = raw.split(',').map(v => v.trim());
  const { missingItems, thresholds } = session;
  if (values.length === 0 || (values.length === 1 && values[0] === '')) {
    return { handled: true, reply: t('breadcrumb_missing_remaining', session.lang, { items: missingItems.join(', '), placeholders: missingItems.map(() => '0').join(',') }) };
  }
  for (let i = 0; i < Math.min(values.length, missingItems.length); i++) {
    const item = missingItems[i];
    const { value: v } = parseHumanInput(values[i]);
    if (v === null) return { handled: true, reply: t('invalid_number', session.lang, { item, raw: values[i] }) };
    const thr = thresholds[item];
    if (thr && (thr.min != null || thr.max != null)) {
      const outOfRange = (thr.min != null && v < thr.min) || (thr.max != null && v > thr.max);
      if (outOfRange) {
        session.state = STATES.BREADCRUMB_RANGE_CONFIRM;
        session.rangeConfirmPending = { itemName: item, value: v };
        session.updatedAt = new Date().toISOString();
        return { handled: true, reply: buildRangeConfirmMessage(session, item, v, displayRange(session, item), 'OUT_OF_RANGE') };
      }
    }
    session.draftCounts[item] = v;
  }
  session.missingItems = session.missingItems.slice(values.length);
  session.askedItems = session.askedItems.concat(missingItems.slice(0, values.length));
  session.updatedAt = new Date().toISOString();
  if (session.missingItems.length === 0) return handleAllCollected(session);
  return { handled: true, reply: buildMissingMessage(session) };
}

// ── All collected ─────────────────────────────────────────────────────────
function handleAllCollected(session) {
  session.state = STATES.SUMMARY;
  session.updatedAt = new Date().toISOString();
  return { handled: true, reply: buildSummaryMessage(session) };
}

// ── Confirm ───────────────────────────────────────────────────────────────
function handleConfirm(session) {
  if (session.state !== STATES.CONFIRM && session.state !== STATES.SUMMARY) {
    return { handled: true, reply: '⚠️ No pending submission. Please complete the workflow first.' };
  }
  const key = sessionKey(session.chatId, session.sender);
  const counts = { ...session.draftCounts };
  const lang = session.lang;
  const skipHistory = [...(session.skipHistory || [])];
  const editHistory = [...(session.editHistory || [])];
  const outOfRangeItems = session._lastConfirmedOutOfRange ? [session._lastConfirmedOutOfRange] : [];
  sessions.delete(key);
  return { handled: true, confirmed: true, complete: true, counts, lang, skipHistory, editHistory, outOfRangeItems, reply: null };
}

// ── Edit ─────────────────────────────────────────────────────────────────
function handleEdit(session, ctrl) {
  if (session.state !== STATES.CONFIRM && session.state !== STATES.SUMMARY) {
    return { handled: true, reply: '⚠️ Nothing to edit yet. Please submit all counts first.' };
  }
  let targetItem = null;
  if (ctrl.index != null && ctrl.index >= 1 && ctrl.index <= session.itemList.length) {
    targetItem = session.itemList[ctrl.index - 1];
  } else if (ctrl.name) {
    targetItem = session.itemList.find(item => item.toLowerCase().includes(ctrl.name.toLowerCase())) || null;
  }
  if (!targetItem) return { handled: true, reply: '⚠️ Item not found. Use STATUS to see item numbers.' };
  session.editHistory = session.editHistory || [];
  session.editHistory.push({ itemName: targetItem, oldValue: session.draftCounts[targetItem] ?? null, newValue: ctrl.value, editedAt: new Date().toISOString() });
  session.draftCounts[targetItem] = ctrl.value;
  if (!session.missingItems.includes(targetItem)) session.missingItems.push(targetItem);
  session.updatedAt = new Date().toISOString();
  const thr = session.thresholds[targetItem];
  if (thr && (thr.min != null || thr.max != null)) {
    const outOfRange = (thr.min != null && ctrl.value < thr.min) || (thr.max != null && ctrl.value > thr.max);
    if (outOfRange) {
      session.state = STATES.BREADCRUMB_RANGE_CONFIRM;
      session.rangeConfirmPending = { itemName: targetItem, value: ctrl.value, fromEdit: true };
      session.updatedAt = new Date().toISOString();
      return { handled: true, reply: buildRangeConfirmMessage(session, targetItem, ctrl.value, displayRange(session, targetItem), 'OUT_OF_RANGE') };
    }
  }
  return { handled: true, reply: buildSummaryMessage(session) };
}

// ── Message builders ──────────────────────────────────────────────────────
function buildAskMessage(key) {
  const session = sessions.get(key);
  if (!session) return null;
  const current = session.missingItems[0];
  if (!current) return null;
  const total = session.itemList.length;
  const itemNumber = session.itemList.indexOf(current) + 1;
  const meta = getItemMeta(session, current);
  return [
    `📋 Daily Entry Log - ${session.store}`,
    `Item ${itemNumber}/${total}`,
    `Category: ${meta.category || 'Uncategorized'}`,
    '',
    current,
    '',
    `Target: ${displayRange(session, current)}`,
    '',
    'Reply with temperature:',
  ].join('\n');
}

function buildMissingMessage(session) {
  const { missingItems } = session;
  return [
    `⚠️ Missing ${missingItems.length} value${missingItems.length === 1 ? '' : 's'}`,
    '',
    ...missingItems.map(item => `${session.itemList.indexOf(item) + 1}. ${item} (${displayRange(session, item)})`),
    '',
    'Reply with the next value, or comma-separated values in this order.',
  ].join('\n');
}

function buildSummaryMessage(session) {
  const { itemList, draftCounts, store, thresholds } = session;
  const rows = itemList.map((item, idx) => {
    const val = draftCounts[item];
    const thr = thresholds[item];
    if (val == null) return `${idx + 1}. ${item}: N/A (${displayRange(session, item)})  ⚠️`;
    const outOfRange = thr && ((thr.min != null && val < thr.min) || (thr.max != null && val > thr.max));
    const icon = outOfRange ? '⚠️' : '✅';
    return `${idx + 1}. ${item}: ${val} (${displayRange(session, item)})  ${icon}`;
  }).join('\n');
  const failures = itemList.filter(item => {
    const val = draftCounts[item];
    if (val == null) return false;
    const thr = thresholds[item];
    return thr && ((thr.min != null && val < thr.min) || (thr.max != null && val > thr.max));
  }).map(item => `- ${item}: ${draftCounts[item]}`).join('\n');
  let reply = t('summary_title', session.lang, { store }) + '\n\n' + rows;
  if (failures) reply += '\n\n' + '⚠️ Out of range:\n' + failures;
  reply += '\n\n' + t('summary_reply', session.lang);
  session.state = STATES.CONFIRM;
  session.updatedAt = new Date().toISOString();
  return reply;
}

function buildStatusMessage(session) {
  const { draftCounts, store, state, itemList } = session;
  const answered = Object.keys(draftCounts).length;
  const total = itemList.length;
  const counts = itemList.map((item, idx) => {
    const val = draftCounts[item];
    return `${idx + 1}. ${item}: ${val != null ? val : '(missing)'}`;
  }).join('\n');
  const skipped = (session.skipHistory || []).map(s => `- ${s.itemName} (skipped)`).join('\n');
  let statusText = [`📊 Draft Status — ${store}`, `State: ${state}`, `Progress: ${answered}/${total}`, '', counts || 'No values yet.'];
  if (skipped) { statusText.push('', 'Skipped:'); statusText.push(skipped); }
  statusText.push('', 'Send CANCEL to discard.');
  return statusText.join('\n');
}

function getItemMeta(session, itemName) {
  return session.itemMeta?.[itemName] || { item_name: itemName, category: null, unit: 'F' };
}

function displayRange(session, itemName) {
  const meta = getItemMeta(session, itemName);
  const thr = session.thresholds?.[itemName] || {};
  return dailyTemplate.formatRange({
    ...meta,
    target_min: meta.target_min ?? thr.min ?? null,
    target_max: meta.target_max ?? thr.max ?? null,
  });
}

function buildRangeConfirmMessage(session, itemName, value, target, severity = 'OUT_OF_RANGE') {
  const title = severity === 'CRITICAL' ? '🚨 Critical Temperature Alert' : '⚠️ Outside Target Range';
  return [
    title,
    '',
    itemName,
    `Entered: ${value}°F`,
    `Target: ${target}`,
    '',
    '1 — Confirm actual reading',
    '2 — Re-enter',
    '3 — Skip',
  ].join('\n');
}

// ── Human input parsing ────────────────────────────────────────────────────
/**
 * Parse human input into numeric value + unit.
 * Supports:
 *   - Integer: "35", decimal: "35.5", comma-decimal: "35,5"
 *   - Unit suffix: "35F", "35°F", "4C", "4°C"
 *   - Named: "Walk-in Cooler 35", "Cooler: 35", "Cooler = 35"
 *   - Whitespace trimming
 *   - Text numbers: "thirty five" → 35
 */
function parseHumanInput(raw) {
  if (!raw) return { value: null, unit: null, original: raw };
  let text = String(raw).trim();

  // Unit suffix C/F
  const cMatch = text.match(/^(\d+(?:[.,]\d+)?)\s*°?\s*([Cc])\s*$/);
  if (cMatch) return { value: parseFloat(cMatch[1].replace(',', '.')), unit: 'C', original: raw };
  const fMatch = text.match(/^(\d+(?:[.,]\d+)?)\s*°?\s*([Ff])\s*$/);
  if (fMatch) return { value: parseFloat(fMatch[1].replace(',', '.')), unit: 'F', original: raw };

  // Strip named prefix: "Walk-in Cooler 35" or "Walk-in Cooler: 35" or "Walk-in Cooler=35"
  // Handles: "Walk-in Cooler 35", "Walk-in Cooler: 35", "Walk in Cooler 35", "Walk-inCooler 35"
  text = text.replace(
    /^(?:walk[\s-]?in[\s-]+(?:cooler|freezer|hot[\s]?holding|broth|temperature|item\s*\d+)|[a-z][a-z\s\-]+)[\s:=]*\s*/i,
    ''
  ).trim();

  // Strip "=" prefix and any trailing "=" signs
  text = text.replace(/^=+/, '').trim();

  // Parse number (handles comma-decimal: "35,5" → 35.5)
  const cleaned = text.replace(/=+$/, '').trim();
  if (/^-?\d+(?:[.,]\d+)?$/.test(cleaned)) {
    const n = parseFloat(cleaned.replace(',', '.'));
    return Number.isFinite(n) ? { value: n, unit: null, original: raw } : { value: null, unit: null, original: raw };
  }

  return { value: null, unit: null, original: raw };
}

/**
 * Parse text numbers like "thirty five", "forty-two" → 35, 42
 */
function parseTextNumber(text) {
  const t2 = String(text || '').toLowerCase().trim().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ');
  const numberMap = {
    'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
    'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
    'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13,
    'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17,
    'eighteen': 18, 'nineteen': 19, 'twenty': 20, 'thirty': 30,
    'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
    'eighty': 80, 'ninety': 90,
  };
  if (numberMap[t2] !== undefined) return numberMap[t2];
  const hyphenated = t2.replace(/-/g, ' ');
  if (numberMap[hyphenated] !== undefined) return numberMap[hyphenated];
  const parts = t2.split(/\s+/);
  if (parts.length === 2) {
    const tens = numberMap[parts[0]], ones = numberMap[parts[1]];
    if (tens !== undefined && ones !== undefined) return tens + ones;
  }
  return null;
}

function celsiusToFahrenheit(c) { return (c * 9 / 5) + 32; }

/**
 * Classify out-of-range severity.
 * OUT_OF_RANGE: slightly outside range
 * CRITICAL: more than double the range beyond max
 */
function classifyOutOfRange(value, min, max, threshold) {
  if (min != null && value < min) return 'OUT_OF_RANGE';
  if (max != null && value > max) {
    if (min != null) {
      const range = max - min;
      if (range > 0 && value > max + range * 2) return 'CRITICAL';
    } else {
      // Freezer: no min — only CRITICAL if way above 0
      if (value > 20) return 'CRITICAL';
    }
    return 'OUT_OF_RANGE';
  }
  return 'OUT_OF_RANGE';
}

function formatRange(min, max) {
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `>= ${min}`;
  if (max != null) return `<= ${max}`;
  return '—';
}

// ── Public API ────────────────────────────────────────────────────────────
function hasActiveSession(chatId, sender) { return sessions.has(sessionKey(chatId, sender)); }
function clearSession(chatId, sender) { sessions.delete(sessionKey(chatId, sender)); }
function getSession(chatId, sender) { return sessions.get(sessionKey(chatId, sender)); }
function getAllSessions() { return Object.fromEntries(sessions.entries()); }

module.exports = {
  STATES, sessionKey, parseControl,
  parseHumanInput, parseTextNumber, celsiusToFahrenheit, classifyOutOfRange,
  startGuidedWorkflow, handleReply,
  hasActiveSession, clearSession, getSession, getAllSessions,
};
