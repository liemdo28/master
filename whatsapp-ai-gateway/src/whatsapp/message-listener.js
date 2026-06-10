const { makeLogger } = require('../logger');
const { saveMessage } = require('../storage/conversations');
const { classifyIntent } = require('../ai/intent-classifier');
const { generateResponse, getConfidence } = require('../ai/response-generator');
const { shouldEscalate, getEscalationReason } = require('../ai/escalation-engine');
const { forwardMessage } = require('../telegram/telegram-forwarder');
const replyService = require('./reply-service');
const rateLimiter = require('../safety/rate-limiter');
const businessHours = require('../safety/business-hours');
const aiControl = require('../safety/ai-control');
const commandRouter = require('../commands/command-router');
const agentMgr = require('../sessions/agent-session-manager');
const ldagentCmd = require('../commands/ldagent-command');
const brothCommandMod = require('../commands/broth-command');
const langMem = require('../i18n/language-memory');
const { detectWithConfidence } = require('../i18n/detector');
const fallbackAudit = require('../audit/fallback-audit');
const { getBuildInfo } = require('../runtime/build-info');
const nlpResolver = require('../nlp/command-resolver');

// Food Safety module
const foodSafetyPipeline = (() => {
  try { return require('../food-safety/food-safety-pipeline'); } catch (_) { return null; }
})();
const foodSafetyWorkflow = (() => {
  try { return require('../workflows/food-safety-workflow'); } catch (_) { return null; }
})();
const sheetSource = (() => {
  try { return require('../food-safety/sheet-source'); } catch (_) { return null; }
})();
const templateOcrWorkflow = (() => {
  try { return require('../template-ocr/template-ocr-workflow'); } catch (_) { return null; }
})();
const formPhotoWorkflow = (() => {
  try { return require('../workflows/form-photo-workflow'); } catch (_) { return null; }
})();
const formPhotoImageStorage = (() => {
  try { return require('../workflows/form-photo-image-storage'); } catch (_) { return null; }
})();

const log = makeLogger('whatsapp');

let messageCount = 0;

async function getLanguageQuestionReply(phone, name, text) {
  const lang = langMem.detectLanguageQuestion(text);
  if (!lang) return null;
  const reply = langMem.buildLanguageQuestionReply(lang, name);
  if (!reply) return null;
  await langMem.rememberFromMessage(phone, name, text).catch(() => {});
  return reply;
}

function attach(client) {
  // ── Image messages ───────────────────────────────────────────
  client.on('message', async (msg) => {
    if (msg.hasMedia && (msg.type === 'image' || (msg.body === '' && msg.mimetype && msg.mimetype.startsWith('image/')))) {
      try {
        await handleImageMessage(client, msg);
      } catch (err) {
        log.error('Food safety image handler error', { error: err.message, stack: err.stack });
      }
      return;
    }
    // Fall through to text handler for non-image messages
    try {
      await handleTextMessage(client, msg);
    } catch (err) {
      log.error('Message handler error', { error: err.message, stack: err.stack });
    }
  });
  log.info('Message listener attached (with food-safety image support)');
}

async function handleImageMessage(client, msg) {
  const chatId = msg.from;
  const timestamp = msg.timestamp ? new Date(msg.timestamp * 1000).toISOString() : new Date().toISOString();
  const messageId = msg.id._serialized || String(Date.now());

  // ── Safety gate: check allowed chats ───────────────────────
  if (!sheetSource) {
    log.info('Food safety module not available — ignoring image', { chatId });
    return;
  }

  if (process.env.FOOD_SAFETY_ENABLED !== 'true') {
    log.info('Food safety disabled — ignoring image', { chatId });
    return;
  }

  // Test mode enforcement: process only explicitly allowed test chats.
  if (process.env.FOOD_SAFETY_TEST_MODE === 'true') {
    if (!sheetSource.isAllowedChat(chatId)) {
      log.info('Image from non-allowed chat in test mode — ignored', { chatId });
      return;
    }
  }

  log.info('Food safety image received', { chatId, timestamp, messageId });

  // Get sender info
  const contact = await msg.getContact().catch(() => null);
  const senderName = contact?.pushname || contact?.name || 'Unknown';
  const sender = msg.author || msg.from?.replace('@c.us', '').replace('@g.us', '') || 'unknown';
  const chat = await msg.getChat().catch(() => null);
  const groupName = chat?.name || '';

  // Download image
  let media;
  try {
    media = await msg.downloadMedia();
  } catch (err) {
    log.error('Failed to download media', { error: err.message });
    await replyService.send(client, chatId, '⚠️ Failed to download the image. Please try again.');
    return;
  }

  if (!media || !media.data) {
    log.warn('No media data in message', { chatId });
    return;
  }

  const metadata = { chatId, sender, senderName, timestamp, messageId, groupName, caption: msg.body || '' };

  // ── Form Photo Workflow: check for active session ─────────────────────────
  if (formPhotoWorkflow && formPhotoWorkflow.hasActiveSession(chatId, sender)) {
    log.info('Form photo workflow — image received in active session', { chatId, sender });
    try {
      // Save image using form photo storage
      const imagePath = formPhotoImageStorage
        ? formPhotoImageStorage.saveFormPhotoImage(media, metadata)
        : null;
      if (!imagePath) {
        await replyService.send(client, chatId, '⚠️ Image save failed. Please try again.');
        return;
      }
      // Route to form photo workflow
      const result = await formPhotoWorkflow.handleFormPhotoUpload({
        chatId, sender, senderName, imagePath, metadata, client,
      });
      if (result.handled && result.reply) {
        await replyService.send(client, chatId, result.reply);
      }
      return;
    } catch (err) {
      log.error('Form photo workflow error', { error: err.message, stack: err.stack });
      await replyService.send(client, chatId, '⚠️ Form processing error. Please try again or notify manager.');
      return;
    }
  }

  // ── Standard food safety pipeline ──────────────────────────────────────────
  let imagePath;
  try {
    imagePath = foodSafetyPipeline.saveImage(media, metadata);
  } catch (err) {
    log.error('Failed to save image', { error: err.message });
    return;
  }

  if (templateOcrWorkflow) {
    try {
      const ocr = await templateOcrWorkflow.processImage(imagePath, metadata);
      if (ocr.handled) {
        await replyService.send(client, chatId, ocr.reply);
        log.info('Template OCR image processed', { chatId, result: ocr.result });
        return;
      }
    } catch (err) {
      log.error('Template OCR pipeline error', { error: err.message, stack: err.stack });
      await replyService.send(client, chatId, 'Template OCR failed due to an internal error. Please retake the photo or notify manager.');
      return;
    }
  }

  // Run pipeline
  let result, warning;
  try {
    if (foodSafetyWorkflow) {
      ({ result, warning } = await foodSafetyWorkflow.runFoodSafetyWorkflow(imagePath, metadata));
    } else {
      ({ result, warning } = await foodSafetyPipeline.runPipeline(imagePath, metadata));
    }
  } catch (err) {
    log.error('Food safety pipeline error', { error: err.message });
    await replyService.send(client, chatId, '⚠️ Food safety check failed due to an internal error. Please try again.');
    return;
  }

  // Send reply based on FOOD_SAFETY_REPLY_MODE
  const replyMode = process.env.FOOD_SAFETY_REPLY_MODE || 'warning_only';
  if (warning) {
    await replyService.send(client, chatId, warning);
  } else if (replyMode === 'always_reply' && result === 'PASS') {
    const { generatePassNotice } = require('../food-safety/warning-generator');
    await replyService.send(client, chatId, generatePassNotice({ store: 'Unknown' }));
  }
  // For PASS with warning_only: do nothing (log only)

  log.info('Food safety image processed', { chatId, result, warningSent: !!warning });
}

async function handleTextMessage(client, msg) {
  if (msg.from === 'status@broadcast') return;
  if (msg.fromMe) return;

  const isGroup = msg.from.includes('@g.us');
  const chatId = msg.from;
  const phone = isGroup ? (msg.author || msg.from).replace('@c.us', '').replace('@g.us', '') : msg.from.replace('@c.us', '');
  const contact = await msg.getContact().catch(() => null);
  const name = contact?.pushname || contact?.name || phone;
  const text = msg.body || '';
  const timestamp = msg.timestamp ? new Date(msg.timestamp * 1000).toISOString() : new Date().toISOString();
  const trimmedText = text.trim();
  const languageTrace = detectWithConfidence(trimmedText);
  const nlp = nlpResolver.resolveCommand(trimmedText);
  const runtimeTraceBase = {
    chatId,
    phone,
    isGroup,
    message: trimmedText.slice(0, 120),
    language: languageTrace.lang,
    languageConfidence: languageTrace.confidence,
    buildId: getBuildInfo().build_id,
    pid: process.pid,
  };
  log.info('[MESSAGE_FLOW] received', runtimeTraceBase);

  if (templateOcrWorkflow && templateOcrWorkflow.hasActiveSession(chatId, phone)) {
    const routed = await templateOcrWorkflow.handleReply({ chatId, sender: phone, senderName: name, text, client });
    if (routed.handled) {
      if (routed.reply) await replyService.send(client, chatId, routed.reply);
      return;
    }
  }

  // ── Form Photo Workflow text replies (YES/RETAKE/CANCEL/store selection) ─────
  if (formPhotoWorkflow && formPhotoWorkflow.hasActiveSession(chatId, phone)) {
    const routed = await formPhotoWorkflow.handleFormPhotoReply({ chatId, sender: phone, senderName: name, text, client });
    if (routed.handled) {
      if (routed.reply) await replyService.send(client, chatId, routed.reply);
      return;
    }
  }

  // ── Phase 1.5: Voice message safe response (multi-language) ─────────────
  // Detected via msg.type === 'ptt' or 'audio', or body starts with voice marker.
  const isVoice = msg.type === 'ptt' || msg.type === 'audio' ||
                  (msg.hasMedia && (msg.mimetype || '').startsWith('audio/'));
  if (isVoice && !text) {
    // Resolve language: user memory → store default → detected → en
    let userLang = 'en';
    try {
      const { resolveLanguage } = require('../i18n/language-memory');
      const resolved = await resolveLanguage({ phone, storeId: null, chatId, text: '' });
      userLang = resolved.lang || 'en';
    } catch (_) { userLang = 'en'; }
    const { t: tI18n } = require('../i18n/translations');
    const reply = tI18n('voice_not_supported', userLang);
    await replyService.send(client, chatId, reply);
    return;
  }


  // ── Group quiet mode ──────────────────────────────────────────────────────────
  const groupQuietMode  = process.env.GROUP_QUIET_MODE !== 'false'; // default: true

  if (isGroup) {
    const chat = await msg.getChat().catch(() => null);
    const groupName = chat?.name || '';
    const hasAgentSession = agentMgr.hasSession(chatId);
    const hasBrothSession = brothCommandMod.hasActiveSession(chatId, phone);
    const hasOcrSession   = templateOcrWorkflow?.hasActiveSession(chatId, phone);
    const mightBeCmd      = trimmedText.startsWith('/');
    const isNlpCommand    = nlp.autoHandle && ['START_AGENT', 'DAILY_ENTRY', 'HELP', 'STATUS', 'BROTH_COUNT'].includes(nlp.intent);
    const isWakeCmd       = (mightBeCmd && ldagentCmd.isWakeCommand(trimmedText)) || isNlpCommand;

    // Phase 1.5: detect language question and short-circuit with proper reply
    if (!hasAgentSession && !hasBrothSession && !hasOcrSession) {
      const languageReply = await getLanguageQuestionReply(phone, name, trimmedText);
      if (languageReply) {
        log.info('[MESSAGE_FLOW] language_question_reply', { ...runtimeTraceBase, route: 'group_language_question' });
        await replyService.send(client, chatId, languageReply);
        return;
      }
    }

    if (groupQuietMode) {
      if (hasAgentSession) {
        // Active agent session — owner can do anything, non-owners check mode
        if (!agentMgr.isOwner(chatId, phone)) {
          const warn = ldagentCmd.getNonOwnerReply(agentMgr.getSession(chatId)?.ownerName || 'another user');
          if (warn) await replyService.send(client, chatId, warn);
          return; // never pass to AI
        }
        // Owner falls through to command routing below
      } else if (hasBrothSession || hasOcrSession) {
        // Active broth-only session (no /ldagent wrapper) — route it
        // falls through to command routing below
      } else {
        // No active session — only slash commands and wake commands are processed
        if (!mightBeCmd && !isWakeCmd) {
          log.info('[MESSAGE_FLOW] group_quiet_drop', { ...runtimeTraceBase, route: 'group_quiet_drop' });
          return;
        }
      }
    }

    // Route group message (command or session continuation)
    const needsRoute = mightBeCmd || isNlpCommand || hasBrothSession || hasAgentSession || hasOcrSession;
    if (needsRoute) {
      const routed = await commandRouter.handleCommand({
        chatId, isGroup: true, sender: phone, senderName: name, text, groupName, timestamp,
        client,
      });

      if (routed.blocked) {
        log.info('Group command blocked', { chatId, reason: routed.blockReason });
        if (routed.reply) await replyService.send(client, chatId, routed.reply);
        return;
      }

      if (routed.handled) {
        log.info('[MESSAGE_FLOW] command_handled', { ...runtimeTraceBase, route: 'command', hasReply: !!routed.reply });
        await saveMessage({ phone: chatId, name: groupName || chatId, direction: 'in', message: text, intent: 'command', aiReplied: false });
        if (routed.reply) {
          await replyService.send(client, chatId, routed.reply);
          await saveMessage({ phone: chatId, name: groupName || chatId, direction: 'out', message: routed.reply, intent: 'command', aiReplied: true });
        }
        log.info('Group command handled', { chatId, sender: phone, preview: text.slice(0, 50) });
        return;
      }
    }

    // All group messages that didn't match anything → silent drop (quiet mode)
    return;
  }

  // ── Direct chat: language question short-circuit ──────────────────────────────
  if (!brothCommandMod.hasActiveSession(chatId, phone)) {
    const languageReply = await getLanguageQuestionReply(phone, name, trimmedText);
    if (languageReply) {
      log.info('[MESSAGE_FLOW] language_question_reply', { ...runtimeTraceBase, route: 'direct_language_question' });
      await replyService.send(client, chatId, languageReply);
      return;
    }
  }

  // ── Direct chat: command routing ──────────────────────────────────────────────
  const mightBeCommand  = trimmedText.startsWith('/');
  const isNlpCommand    = nlp.autoHandle && ['START_AGENT', 'DAILY_ENTRY', 'HELP', 'STATUS', 'BROTH_COUNT'].includes(nlp.intent);
  const hasBrothSession = brothCommandMod.hasActiveSession(chatId, phone);

  if (mightBeCommand || isNlpCommand || hasBrothSession) {
    const routed = await commandRouter.handleCommand({
      chatId, isGroup: false, sender: phone, senderName: name, text, groupName: '', timestamp,
      client,
    });

    if (routed.blocked) {
      log.info('Command blocked', { chatId, reason: routed.blockReason });
      if (routed.reply) await replyService.send(client, chatId, routed.reply);
      return;
    }

    if (routed.handled) {
      log.info('[MESSAGE_FLOW] command_handled', { ...runtimeTraceBase, route: 'command', hasReply: !!routed.reply });
      await saveMessage({ phone, name, direction: 'in', message: text, intent: 'command', aiReplied: false });
      if (routed.reply) {
        await replyService.send(client, chatId, routed.reply);
        await saveMessage({ phone, name, direction: 'out', message: routed.reply, intent: 'command', aiReplied: true });
      }
      log.info('Command handled', { chatId: phone, preview: text.slice(0, 50) });
      return;
    }
  }
  // ── Agent/MI Command Routing ──────────────────────────────────────────────
  const agentMiRouter = require('../commands/agent-mi-router');
  const agentMiForwarder = require('../forwarding/agent-mi-forwarder');

  if (agentMiRouter.isAgentCommand(trimmedText)) {
    const chat = await msg.getChat().catch(() => null);
    const groupName = chat?.name || '';
    const result = await agentMiRouter.handleAgentMessage({
      chatId, groupId: isGroup ? chatId : '', sender: phone, senderName: name,
      text: trimmedText, timestamp, attachments: [], client,
    });
    if (result.handled) {
      if (result.payload) {
        const forwardResult = await agentMiForwarder.forwardToAgent(result.payload);
        if (forwardResult.ok && forwardResult.reply) {
          log.info('[MESSAGE_FLOW] agent_forward_reply', { ...runtimeTraceBase, route: 'agent_forward' });
          await replyService.send(client, chatId, forwardResult.reply);
          await saveMessage({ phone, name, direction: 'out', message: forwardResult.reply, intent: 'agent_command', aiReplied: true });
        } else if (forwardResult.reply) {
          await replyService.send(client, chatId, forwardResult.reply);
        }
      } else if (result.reply) {
        await replyService.send(client, chatId, result.reply);
      }
      await saveMessage({ phone, name, direction: 'in', message: text, intent: 'agent_command', aiReplied: false });
      return;
    }
  }

  if (agentMiRouter.isMiCommand(trimmedText)) {
    const chat = await msg.getChat().catch(() => null);
    const groupName = chat?.name || '';
    const result = await agentMiRouter.handleMiMessage({
      chatId, groupId: isGroup ? chatId : '', sender: phone, senderName: name,
      text: trimmedText, timestamp, attachments: [], client,
    });
    if (result.handled) {
      if (result.payload) {
        const forwardResult = await agentMiForwarder.forwardToMi(result.payload);
        if (forwardResult.ok && forwardResult.reply) {
          log.info('[MESSAGE_FLOW] mi_forward_reply', { ...runtimeTraceBase, route: 'mi_forward' });
          await replyService.send(client, chatId, forwardResult.reply);
          await saveMessage({ phone, name, direction: 'out', message: forwardResult.reply, intent: 'mi_command', aiReplied: true });
        } else if (forwardResult.reply) {
          await replyService.send(client, chatId, forwardResult.reply);
        }
      } else if (result.reply) {
        await replyService.send(client, chatId, result.reply);
      }
      await saveMessage({ phone, name, direction: 'in', message: text, intent: 'mi_command', aiReplied: false });
      return;
    }
  }

  // No-prefix guidance
  if (agentMiRouter.isNoPrefix(trimmedText)) {
    // Do NOT route no-prefix messages — silently ignore
  }


  if (nlp.autoHandle && nlp.intent === 'GREETING') {
    await langMem.setUserLanguage(phone, nlp.language, { displayName: name, confidence: nlp.confidence, source: 'nlp_greeting' }).catch(() => {});
    const reply = nlpResolver.greetingReply(nlp.language);
    log.info('[MESSAGE_FLOW] nlp_greeting', { ...runtimeTraceBase, route: 'nlp_greeting', intent: nlp.intent });
    await replyService.send(client, chatId, reply);
    await saveMessage({ phone, name, direction: 'in', message: text, intent: 'greeting', aiReplied: false });
    await saveMessage({ phone, name, direction: 'out', message: reply, intent: 'greeting', aiReplied: true });
    return;
  }

  messageCount++;
  log.info('[RECEIVED]', { from: phone, name, message: text.slice(0, 100) });

  // --- Safety Gate 1: Blocklist ---
  if (aiControl.isBlocked(phone)) {
    log.warn('Blocked phone — ignored', { phone });
    return;
  }

  // --- Safety Gate 2: Rate Limit ---
  const rateResult = rateLimiter.check(phone);
  if (!rateResult.allowed) {
    if (rateResult.reason === 'hard_block') {
      log.warn('Hard rate block — ignored', { phone, count: rateResult.count });
      return;
    }
    log.warn('Rate limited', { phone, count: rateResult.count });
    await saveMessage({ phone, name, direction: 'in', message: text, intent: 'rate_limited', aiReplied: false });
    await forwardMessage({ phone, name, message: text, intent: 'rate_limited', confidence: 0, escalate: true, escalateReason: `Rate limited (${rateResult.count} msgs in window)` });
    return;
  }

  const intent = classifyIntent(text);
  log.info('[CLASSIFIED]', { from: phone, intent, language: languageTrace.lang, languageConfidence: languageTrace.confidence });
  const confidence = getConfidence(intent);
  const escalate = shouldEscalate(intent, text);
  const escalateReason = escalate ? getEscalationReason(intent, text) : null;

  // Persist incoming
  await saveMessage({ phone, name, direction: 'in', message: text, intent, aiReplied: false });

  // Forward to Telegram (always)
  await forwardMessage({ phone, name, message: text, intent, confidence, escalate, escalateReason });

  // --- Safety Gate 3: Global AI pause ---
  if (aiControl.isAIPaused()) {
    log.info('AI paused — no auto-reply', { phone });
    return;
  }

  // --- Safety Gate 4: Human takeover ---
  if (aiControl.isHumanTakeover(phone)) {
    const info = aiControl.getTakeoverInfo(phone);
    log.info('Human takeover active — no auto-reply', { phone, by: info.by });
    return;
  }

  // --- Safety Gate 5: Business hours ---
  if (!businessHours.isOpen()) {
    const closedMsg = businessHours.getClosedMessage();
    log.info('[GENERATED]', { from: phone, response: closedMsg.slice(0, 120), intent: 'closed' });
    const sent = await replyService.send(client, msg.from, closedMsg);
    log.info('[REPLIED]', { from: phone, status: sent ? 'success' : 'failed', intent: 'closed' });
    await saveMessage({ phone, name, direction: 'out', message: closedMsg, intent: 'closed', aiReplied: false });
    log.info('Outside business hours — sent closed message', { phone });
    return;
  }

  // --- Escalation: send holding message, do NOT auto-respond ---
  if (escalate) {
    const holdingMsg = intent === 'complaint'
      ? "We're really sorry to hear about your experience. 😔 Our team will reach out to you shortly to make it right."
      : "Thank you for your message! Our team will get back to you shortly. 🙏";
    log.info('[GENERATED]', { from: phone, response: holdingMsg.slice(0, 120), intent });
    const sent = await replyService.send(client, msg.from, holdingMsg);
    log.info('[REPLIED]', { from: phone, status: sent ? 'success' : 'failed', intent });
    await saveMessage({ phone, name, direction: 'out', message: holdingMsg, intent, aiReplied: false });
    log.warn('Escalated — human required', { phone, intent, confidence, reason: escalateReason });
    return;
  }

  // --- AI reply ---
  const reply = generateResponse(intent, text);
  if (intent === 'unknown') {
    const buildInfo = getBuildInfo();
    await fallbackAudit.recordFallback({
      message: text,
      language: languageTrace.lang,
      language_confidence: languageTrace.confidence,
      intent,
      confidence,
      response: reply,
      phone,
      chat_id: chatId,
      build_id: buildInfo.build_id,
      commit: buildInfo.commit,
    }).catch(err => log.warn('Fallback audit write failed', { error: err.message }));
  }
  log.info('[GENERATED]', { from: phone, response: reply.slice(0, 120), intent });
  const sent = await replyService.send(client, msg.from, reply);
  log.info('[REPLIED]', { from: phone, status: sent ? 'success' : 'failed', intent });
  await saveMessage({ phone, name, direction: 'out', message: reply, intent, aiReplied: true });
  log.info('AI replied', { phone, intent, confidence, reply: reply.slice(0, 80) });
}

function getMessageCount() { return messageCount; }

module.exports = { attach, getMessageCount, _test: { getLanguageQuestionReply } };
