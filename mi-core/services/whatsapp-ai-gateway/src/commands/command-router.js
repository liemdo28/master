/**
 * Command Router
 *
 * Routing order:
 *   1. /help, /status, /template, /log → no access gate (wake commands)
 *   2. /ldagent → start agent session
 *   3. Active agent session → route to ldagent-command
 *   4. /broth entry point (no agent session)
 *   5. Active broth session continuation
 *   6. Access check for all other commands
 *
 * Test-mode logic (FOOD_SAFETY_TEST_MODE):
 *   true + allowlist → only allowlist
 *   true + empty     → direct chat only, groups blocked
 *   false / unset    → all chats allowed
 */

const brothCommand  = require('./broth-command');
const infoCommands  = require('./info-commands');
const ldagentCmd    = require('./ldagent-command');
const agentMgr      = require('../sessions/agent-session-manager');
const storeRegistry = require('../stores/store-registry');
const tempWorkflow  = require('../workflows/guided/temperature-workflow');
const formPhotoWorkflow = (() => { try { return require('../workflows/form-photo-workflow'); } catch (_) { return null; } })();
const historyCmds   = (() => { try { return require('./history-commands'); } catch (_) { return null; } })();
const langMem       = (() => { try { return require('../i18n/language-memory'); } catch (_) { return null; } })();
const cmdAliases    = (() => { try { return require('../i18n/command-aliases'); } catch (_) { return null; } })();
const { t: tI18n }  = require('../i18n/translations');
const nlpResolver    = require('../nlp/command-resolver');
const { makeLogger } = require('../logger');
const log = makeLogger('whatsapp');

// Phase 1.5: /language command handler (multi-locale: /language en, /idioma es, /ngonngu vi, /langue fr)
async function handleLanguageCommand({ text, sender, senderName, lang }) {
  if (!langMem) return { reply: tI18n('language_supported', lang || 'en') };
  const target = (cmdAliases?.matchLanguageCommand(text) || '').slice(0, 2);
  const fallbackLang = (lang || 'en');
  if (!target) {
    const current = await langMem.getUserLanguage(sender);
    return { reply: tI18n('language_current', fallbackLang, { lang: current?.language || fallbackLang }) + '\n\n' + tI18n('language_supported', fallbackLang) };
  }
  if (!langMem.SUPPORTED.includes(target)) {
    return { reply: tI18n('language_invalid', fallbackLang, { lang: target }) };
  }
  await langMem.setUserLanguage(sender, target, { displayName: senderName, confidence: 1.0, source: 'user' });
  return { reply: tI18n('language_set', target, { lang: target }) + '\n\n' + tI18n('language_supported', target) };
}


// ── Access control ────────────────────────────────────────────────────────────
function getAllowedChatIds() {
  return (process.env.FOOD_SAFETY_ALLOWED_CHAT_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
}

function isTestMode() { return process.env.FOOD_SAFETY_TEST_MODE === 'true'; }

function checkAccess(chatId, isGroup) {
  if (!isTestMode()) return { allowed: true, reason: 'production' };
  const list = getAllowedChatIds();
  if (list.length > 0) {
    return list.includes(chatId)
      ? { allowed: true, reason: 'allowlist' }
      : { allowed: false, reason: 'Test mode: chatId not in FOOD_SAFETY_ALLOWED_CHAT_IDS' };
  }
  if (isGroup) return { allowed: false, reason: 'Test mode: no allowlist — groups blocked (direct chat only)' };
  log.warn('FOOD_SAFETY_ALLOWED_CHAT_IDS not set — allowing direct chat in test mode', { chatId });
  return { allowed: true, reason: 'test-direct-only (no allowlist)' };
}

// ── hasActiveSession helper (exposed for message-listener) ────────────────────
function hasActiveSession(chatId, sender) {
  return brothCommand.hasActiveSession(chatId, sender) || agentMgr.hasSession(chatId) || tempWorkflow.hasTempSession(chatId, sender) || (formPhotoWorkflow && formPhotoWorkflow.hasActiveSession(chatId, sender));
}

// ── Main router ───────────────────────────────────────────────────────────────
async function handleCommand({ chatId, isGroup, sender, senderName, text, groupName, timestamp, client }) {
  const trimmed      = String(text || '').trim();
  const isSlash      = trimmed.startsWith('/');
  const nlp          = !isSlash ? nlpResolver.resolveCommand(trimmed) : null;
  const isHelp       = isSlash && brothCommand.isHelpCommand(trimmed);
  const isInfoCmd    = infoCommands.isInfoCommand(trimmed);
  const isLdagent    = isSlash && ldagentCmd.isLdagentCommand(trimmed);
  const hasBroth     = brothCommand.hasActiveSession(chatId, sender);
  const hasAgentSess = agentMgr.hasSession(chatId);
  const hasTemp      = tempWorkflow.hasTempSession(chatId, sender);
  const hasFormPhoto = formPhotoWorkflow && formPhotoWorkflow.hasActiveSession(chatId, sender);
  const mappedGroup  = isGroup ? await storeRegistry.resolveGroup(chatId) : null;

  // Nothing to route if no command and no active session
  if (!isSlash && !hasBroth && !hasAgentSess && !hasTemp && !hasFormPhoto && !(nlp?.autoHandle && nlp.command)) return { handled: false };

  // ── Always-available commands (no access gate) ──────────────────────────────
  if (isHelp) {
    return { handled: true, blocked: false, reply: buildGroupHelpMessage(isGroup) };
  }

  if (!isSlash && nlp?.autoHandle && nlp.intent === 'HELP') {
    return { handled: true, blocked: false, reply: buildGroupHelpMessage(isGroup) };
  }

  // ── Active agent session — route owner messages before global /status ─────
  if (hasAgentSess) {
    if (!agentMgr.isOwner(chatId, sender)) {
      const warn = ldagentCmd.getNonOwnerReply(agentMgr.getSession(chatId)?.ownerName || 'another user');
      return warn
        ? { handled: true, blocked: false, reply: warn }
        : { handled: true, blocked: false, reply: null }; // silent
    }
    return ldagentCmd.handleOwnerMessage({ chatId, isGroup, sender, senderName, text: trimmed, timestamp, groupName, client });
  }

  if (isInfoCmd || (!isSlash && nlp?.autoHandle && nlp.intent === 'STATUS')) {
    if (isGroup && mappedGroup) await storeRegistry.markLastMessage(chatId, groupName);
    const reply = await infoCommands.handleInfoCommand(isInfoCmd ? trimmed : '/status');
    if (reply) return { handled: true, blocked: false, reply };
  }

  // ── Phase 1.5: /language (and localized /idioma / /ngonngu / /langue) ──────
  if (isSlash && /^[\/](?:language|idioma|ngonngu|ngônngữ|langue)(?:\s+[a-z]{2,5})?\s*$/i.test(trimmed)) {
    const { detect } = require('../i18n/detector');
    const lang = detect(trimmed);
    const result = await handleLanguageCommand({ text: trimmed, sender, senderName, lang });
    return { handled: true, blocked: false, reply: result.reply };
  }

  // ── /ldagent (no access gate — it manages its own session isolation) ────────
  if (isLdagent || (!isSlash && nlp?.autoHandle && ['START_AGENT', 'DAILY_ENTRY'].includes(nlp.intent))) {
    return ldagentCmd.startLdagent({ chatId, isGroup, groupName, sender, senderName, timestamp });
  }

  // ── Active temperature session continuation ─────────────────────────────────
  if (hasTemp) {
    const result = await tempWorkflow.handleTempReply({ chatId, isGroup, sender, senderName, text: trimmed, timestamp, groupName, client });
    return { handled: true, blocked: false, ...result };
  }

  const groupHasStoreHint = isGroup && (
    storeRegistry.detectStoreFromText(groupName || '') ||
    storeRegistry.detectStoreFromText(trimmed || '')
  );

  if (isGroup && !mappedGroup && !groupHasStoreHint && isSlash && brothCommand.isBrothCommand(trimmed)) {
    return { handled: true, blocked: true, blockReason: 'unmapped_group', reply: storeRegistry.unmappedGroupReply() };
  }

  if (mappedGroup) await storeRegistry.markLastMessage(chatId, groupName);

  // ── Access check for direct chats and unmapped legacy commands ─────────────
  const access = mappedGroup ? { allowed: true, reason: 'store_mapping' } : checkAccess(chatId, isGroup);
  if (!access.allowed) {
    if (isSlash || hasBroth) {
      return { handled: true, blocked: true, blockReason: access.reason, reply: `⚠️ Command blocked: ${access.reason}` };
    }
    return { handled: false };
  }

  // ── /broth entry point ──────────────────────────────────────────────────────
  if ((isSlash && brothCommand.isBrothCommand(trimmed)) || (!isSlash && nlp?.autoHandle && nlp.intent === 'BROTH_COUNT')) {
    const result = await brothCommand.startBrothCommand({ chatId, isGroup, sender, senderName, text: isSlash ? trimmed : '/broth', groupName, timestamp, storeMapping: mappedGroup, client });
    return { handled: true, blocked: false, ...result };
  }

  // ── /temp entry point ──────────────────────────────────────────────────────
  if (isSlash && tempWorkflow.isTempCommand(trimmed)) {
    const storeInfo = mappedGroup ? storeRegistry.getStoreByName(mappedGroup.store_name) : null;
    const result = await tempWorkflow.startTempWorkflow({
      chatId, isGroup, sender, senderName,
      text: trimmed,
      groupName: groupName || '',
      store: mappedGroup?.store_name || storeRegistry.detectStoreFromText(groupName || '')?.store_name || 'Store',
      storeId: storeInfo?.store_id || null,
      timestamp,
      client,
    });
    return { handled: true, blocked: false, ...result };
  }

  // ── Manager history commands ──────────────────────────────────────────────
  if (isSlash && historyCmds && historyCmds.isHistoryCommand(trimmed)) {
    const result = await historyCmds.handleHistoryCommand({
      text: trimmed, chatId, sender, senderName, isGroup, groupName, client,
    });
    if (result?.reply) {
      return { handled: true, blocked: result.blocked, reply: result.reply };
    }
    return { handled: result?.handled || false };
  }

  // ── Active broth session continuation ─────────────────────────────────────
  if (hasBroth) {
    const result = await brothCommand.handleBrothReply({ chatId, isGroup, sender, senderName, text: trimmed, timestamp, groupName, storeMapping: mappedGroup, client });
    return { handled: true, blocked: false, ...result };
  }

  // ── Active form photo session continuation ───────────────────────────────
  if (hasFormPhoto) {
    const result = await formPhotoWorkflow.handleFormPhotoReply({ chatId, sender, senderName, text: trimmed, client });
    return { handled: true, blocked: false, ...result };
  }

  // ── /form entry point — form photo workflow (Option B) ─────────────────
  if (isSlash && formPhotoWorkflow && formPhotoWorkflow.isFormPhotoCommand(trimmed)) {
    const result = await formPhotoWorkflow.startFormPhotoWorkflow({ chatId, isGroup, sender, senderName, groupName, client });
    return { handled: true, blocked: false, reply: result.reply };
  }

  return { handled: false };
}

// ── Help message differs for group vs direct ──────────────────────────────────
function buildGroupHelpMessage(isGroup) {
  if (isGroup) {
    return [
      '📋 *Available Commands*',
      '',
      '*/ldagent* — Start a controlled session in this group.',
      '*/help* — Show this list.',
      '*/status* — Show bot/system status.',
      '',
      '*During an active session:*',
      'YES / MENU — Return to workflow menu',
      'NO / END   — Close session',
      'STATUS     — Show session status',
      'CANCEL     — Cancel current workflow',
      '',
      '*(Only the staff member who started /ldagent can control the session.)*',
    ].join('\n');
  }
  return brothCommand.helpMessage();
}

// ── Legacy shims ──────────────────────────────────────────────────────────────
async function handleGroupCommand({ chatId, sender, senderName, text, groupName, timestamp }) {
  return handleCommand({ chatId, isGroup: true, sender, senderName, text, groupName, timestamp });
}

function isAllowedTestChat(chatId) { return checkAccess(chatId, true).allowed; }

module.exports = {
  handleCommand, handleGroupCommand,
  checkAccess, isAllowedTestChat, isTestMode, getAllowedChatIds,
  hasActiveSession,
};
