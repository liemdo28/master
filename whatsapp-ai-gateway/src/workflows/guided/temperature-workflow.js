/**
 * Temperature Workflow
 *
 * One-at-a-time temperature check workflow.
 * Reads items and thresholds from a dedicated Temperature_Entry_Template sheet.
 * Writes results to Food_Safety_Temperature_Log sheet.
 *
 * This workflow is a separate path from /broth (broth count).
 * It can be triggered from the /ldagent menu or via /temp command.
 */

const { t } = require('../../i18n/translations');
const { detect } = require('../../i18n/detector');
const templateCache = require('../../templates/template-cache');
const sheetsClient = require('../../google/sheets-client');
const replyService = require('../../whatsapp/reply-service');
const managerAlerts = require('../../alerts/manager-alert-service');
const { makeLogger } = require('../../logger');

const log = makeLogger('whatsapp');

const DEFAULT_TEMP_ITEMS = [];

// ── Session management ───────────────────────────────────────────────────
const sessions = new Map();
const sessionClients = new Map();

function sessionKey(chatId, sender) { return `${chatId}:${sender}`; }

// ── Get temperature template items ─────────────────────────────────────────
/**
 * Returns temperature items with min/max from the cached Daily_Entry_Template.
 */
function getTempItems() {
  return templateCache.getItems().map(item => ({
    name: item.name,
    min: item.min ?? null,
    max: item.max ?? null,
  }));
}

function getTempThresholds() {
  const items = getTempItems();
  const out = {};
  for (const item of items) {
    out[item.name] = { min: item.min, max: item.max };
  }
  return out;
}

// ── Start temperature workflow ─────────────────────────────────────────────
async function startTempWorkflow({ chatId, isGroup, sender, senderName, text, groupName, store, storeId, timestamp, client }) {
  const key = sessionKey(chatId, sender);
  const items = getTempItems();
  const thresholds = getTempThresholds();

  if (client) sessionClients.set(key, client);

  sessions.set(key, {
    state:           'ASKING',
    chatId, sender, senderName, store,
    storeId,
    groupName: groupName || '',
    itemList:        items.map(i => i.name),
    thresholds,
    draftCounts:     {},
    missingItems:    [...items.map(i => i.name)],
    rangeConfirmPending: null,
    lang:            'en',
    createdAt:       new Date().toISOString(),
    updatedAt:       new Date().toISOString(),
  });

  log.info('Temperature workflow started', { chatId, sender, store, itemCount: items.length });

  return {
    handled: true,
    reply: buildWelcome(sessionKey(chatId, sender)),
  };
}

// ── Handle reply ─────────────────────────────────────────────────────────
async function handleTempReply({ chatId, isGroup, sender, senderName, text, timestamp, groupName = '', client }) {
  const key = sessionKey(chatId, sender);
  const session = sessions.get(key);
  if (!session) return { handled: false };

  if (client) sessionClients.set(key, client);
  if (groupName && !session.groupName) session.groupName = groupName;

  // Detect language
  session.lang = detect(text);
  const ctrl = parseControl(text);

  // ── Global controls ─────────────────────────────────────────────
  if (ctrl.type === 'CANCEL') {
    sessions.delete(key);
    return { handled: true, reply: t('edit_applied', session.lang, { item: '—', value: '—' }).replace('✏️ Updated: — = —', '❌ Temperature check cancelled. Send /temp to start again.') };
  }

  if (ctrl.type === 'STATUS') {
    return { handled: true, reply: buildStatus(session) };
  }

  if (ctrl.type === 'CONFIRM') {
    return handleTempConfirm(session, key, chatId, sender, timestamp);
  }

  if (ctrl.type === 'EDIT') {
    return handleTempEdit(session);
  }

  // ── State machine ─────────────────────────────────────────────
  if (session.state === 'RANGE_CONFIRM') {
    return handleRangeConfirm(session, key, text);
  }

  if (session.state === 'ASKING') {
    return handleTempAsk(session, key, text);
  }

  if (session.state === 'CONFIRMING') {
    // Re-show summary
    return { handled: true, reply: buildSummary(session) };
  }

  return { handled: false };
}

// ── Ask state ──────────────────────────────────────────────────────────────
function handleTempAsk(session, key, text) {
  const current = session.missingItems[0];
  if (!current) {
    session.state = 'CONFIRMING';
    session.updatedAt = new Date().toISOString();
    return { handled: true, reply: buildSummary(session) };
  }

  const raw = String(text || '').trim();
  const value = parseNumeric(raw);

  if (value === null) {
    return { handled: true, reply: t('invalid_number', session.lang, { item: current, raw }) + '\n\n' + buildAsk(session, current) };
  }

  // Range check
  const thr = session.thresholds[current];
  if (thr && (thr.min != null || thr.max != null)) {
    const outOfRange = (thr.min != null && value < thr.min) || (thr.max != null && value > thr.max);
    if (outOfRange) {
      const target = formatRange(thr.min, thr.max);
      session.state = 'RANGE_CONFIRM';
      session.rangeConfirmPending = { itemName: current, value };
      session.updatedAt = new Date().toISOString();
      return { handled: true, reply: t('temp_out_of_range', session.lang, { item: current, value, target }) };
    }
  }

  // Valid — record
  session.draftCounts[current] = value;
  session.missingItems = session.missingItems.slice(1);
  session.updatedAt = new Date().toISOString();

  if (session.missingItems.length === 0) {
    session.state = 'CONFIRMING';
    return { handled: true, reply: buildSummary(session) };
  }

  return { handled: true, reply: buildAsk(session, session.missingItems[0]) };
}

// ── Range confirm ─────────────────────────────────────────────────────────
function handleRangeConfirm(session, key, text) {
  const { itemName, value } = session.rangeConfirmPending || {};
  const u = String(text || '').trim();

  if (u === '1') {
    session.draftCounts[itemName] = value;
    session.missingItems = session.missingItems.slice(1);
    session.state = 'ASKING';
    session.rangeConfirmPending = null;
    session.updatedAt = new Date().toISOString();
    if (session.missingItems.length === 0) {
      session.state = 'CONFIRMING';
      return { handled: true, reply: buildSummary(session) };
    }
    return { handled: true, reply: buildAsk(session, session.missingItems[0]) };
  }

  if (u === '2') {
    session.state = 'ASKING';
    session.rangeConfirmPending = null;
    session.updatedAt = new Date().toISOString();
    return { handled: true, reply: buildAsk(session, itemName) };
  }

  return { handled: true, reply: t('temp_confirm_choices', session.lang) };
}

// ── Confirm ───────────────────────────────────────────────────────────────
async function handleTempConfirm(session, key, chatId, sender, timestamp) {
  if (session.state !== 'CONFIRMING') {
    return { handled: true, reply: '⚠️ No pending submission. Please complete the check first.' };
  }

  const client = sessionClients.get(key);

  // Build results
  const results = session.itemList.map(item => ({
    name:   item,
    value:  session.draftCounts[item],
    thr:    session.thresholds[item],
    outOfRange: isOutOfRange(session.draftCounts[item], session.thresholds[item]),
  }));

  const failures = results.filter(r => r.outOfRange);

  // Write to Google Sheet (temperature log)
  const sheetResult = await writeTempLog({
    entryId: `TEMP_${Date.now()}`,
    store: session.store,
    storeId: session.storeId,
    results,
    timestamp,
  });

  // Manager alerts if failures
  if (failures.length > 0) {
    const alertResult = await managerAlerts.handleConfirmedDailyEntry({
      client,
      session: { chatId, sender, senderName: session.senderName, groupName: session.groupName },
      store: { store_id: session.storeId, store_name: session.store },
      validationResult: {
        overallStatus: 'FAIL',
        failures: failures.map(f => ({
          name: f.name,
          value: f.value,
          target: formatRange(f.thr?.min, f.thr?.max),
          reason: `Temperature ${f.value}° outside range`,
        })),
      },
      sheetWriteStatus: sheetResult.status,
      timestamp,
      sessionId: key,
    });

    sessions.delete(key);
    return {
      handled: true,
      reply: failures.length > 0
        ? t('temp_success_warn', session.lang, {
            store: session.store,
            failures: failures.map(f => `- ${f.name}: ${f.value}° (${formatRange(f.thr?.min, f.thr?.max)})`).join('\n'),
          })
        : t('temp_success', session.lang, { store: session.store }),
    };
  }

  sessions.delete(key);

  return {
    handled: true,
    reply: t('temp_success', session.lang, { store: session.store }),
  };
}

// ── Edit ─────────────────────────────────────────────────────────────────
function handleTempEdit(session) {
  if (session.state !== 'CONFIRMING') {
    return { handled: true, reply: '⚠️ Nothing to edit yet. Please complete the check first.' };
  }

  // Get from last parseControl (already handled globally)
  // The session stores draftCounts — re-build summary
  return { handled: true, reply: buildSummary(session) };
}

// ── Write to Google Sheet ────────────────────────────────────────────────
async function writeTempLog({ entryId, store, storeId, results, timestamp }) {
  try {
    const tab = process.env.TEMPERATURE_LOG_SHEET || 'Food_Safety_Temperature_Log';
    const spreadId = process.env.FOOD_SAFETY_LOG_SPREADSHEET_ID || undefined;

    const now = new Date().toISOString();
    const rows = results.map(r => ({
      timestamp: timestamp || now,
      store,
      item: r.name,
      value: r.value,
      unit: '°F',
      status: r.outOfRange ? 'FAIL' : 'PASS',
      target: formatRange(r.thr?.min, r.thr?.max),
    }));

    const values = rows.map(r => [
      r.timestamp,
      r.store,
      r.item,
      r.value,
      r.unit,
      r.status,
      r.target,
    ]);

    await sheetsClient.appendValues({
      spreadsheetId: spreadId,
      tab,
      values,
    });

    return { status: 'SENT' };
  } catch (err) {
    log.warn('Temperature log write failed', { error: err.message });
    return { status: 'QUEUED' };
  }
}

// ── Message builders ───────────────────────────────────────────────────────
function buildWelcome(key) {
  const session = sessions.get(key);
  if (!session) return null;
  return t('temp_welcome', session.lang, { store: session.store || 'Store' }) + '\n\n' + buildAsk(session, session.missingItems[0]);
}

function buildAsk(session, itemName) {
  const thr = session.thresholds[itemName];
  if (thr && (thr.min != null || thr.max != null)) {
    return t('temp_ask_range', session.lang, { item: itemName, min: thr.min ?? '—', max: thr.max ?? '—' });
  }
  return t('temp_ask', session.lang, { item: itemName });
}

function buildSummary(session) {
  const { itemList, draftCounts, store, thresholds } = session;

  const rows = itemList.map((item, idx) => {
    const val = draftCounts[item];
    if (val == null) return null;
    const thr = thresholds[item];
    const outOfRange = isOutOfRange(val, thr);
    const icon = outOfRange ? '⚠️' : '✅';
    const rangeStr = thr ? ` (${formatRange(thr.min, thr.max)})` : '';
    return `${idx + 1}. ${item}: ${val}°${rangeStr}  ${icon}`;
  }).filter(Boolean).join('\n');

  const failures = itemList.filter(item => {
    const val = draftCounts[item];
    if (val == null) return false;
    return isOutOfRange(val, thresholds[item]);
  }).map(item => `- ${item}: ${draftCounts[item]}° (${formatRange(thresholds[item]?.min, thresholds[item]?.max)})`).join('\n');

  let reply = t('temp_summary', session.lang, { rows, failures: failures || '(none)' });

  session.state = 'CONFIRMING';
  session.updatedAt = new Date().toISOString();
  return reply;
}

function buildStatus(session) {
  const { itemList, draftCounts, store, state } = session;
  const lines = [`📊 Draft Status — ${store}`, `State: ${state}`, '', ...itemList.map((item, idx) => {
    const val = draftCounts[item];
    return `${idx + 1}. ${item}: ${val != null ? `${val}°` : '(missing)'}`;
  }), '', 'Send CANCEL to discard.'];
  return lines.join('\n');
}

// ── Helpers ───────────────────────────────────────────────────────────────
function parseControl(text) {
  const u = String(text || '').trim().toUpperCase();
  if (u === 'CONFIRM' || u === 'YES' || u === 'OK') return { type: 'CONFIRM' };
  if (u === 'CANCEL'  || u === 'ABORT' || u === 'STOP') return { type: 'CANCEL' };
  if (u === 'STATUS'  || u === 'DRAFT') return { type: 'STATUS' };

  const m = String(text || '').trim().match(/^edit\s+(\d{1,2})\s+(\d+(?:\.\d+)?)$/i);
  if (m) return { type: 'EDIT', index: parseInt(m[1], 10), value: Number(m[2]) };

  return { type: null };
}

function parseNumeric(value) {
  const cleaned = String(value || '').replace(/=/g, '').trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatRange(min, max) {
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `>= ${min}`;
  if (max != null) return `<= ${max}`;
  return '—';
}

function isOutOfRange(value, thr) {
  if (!thr) return false;
  return (thr.min != null && value < thr.min) || (thr.max != null && value > thr.max);
}

// ── Public API ────────────────────────────────────────────────────────────
function hasTempSession(chatId, sender) { return sessions.has(sessionKey(chatId, sender)); }
function clearTempSession(chatId, sender) { sessions.delete(sessionKey(chatId, sender)); }
function getAllTempSessions() { return Object.fromEntries(sessions.entries()); }
function isTempCommand(text) { return /^\/temp\s*$/i.test(String(text || '').trim()); }

module.exports = {
  startTempWorkflow,
  handleTempReply,
  hasTempSession: (chatId, sender) => sessions.has(sessionKey(chatId, sender)),
  clearTempSession: (chatId, sender) => sessions.delete(sessionKey(chatId, sender)),
  getAllTempSessions: () => Object.fromEntries(sessions.entries()),
  isTempCommand,
  DEFAULT_TEMP_ITEMS,
};
