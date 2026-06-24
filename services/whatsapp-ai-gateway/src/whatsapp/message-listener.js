const { makeLogger } = require('../logger');
const fs = require('fs');
const path = require('path');
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
const miAccess = require('../security/mi-access-control');

// ── WhatsApp Routing Collision Fix (P0) ───────────────────────────────────────
const messageRouterOwner = (() => {
  try { return require('../routing/message-router-owner'); } catch (_) { return null; }
})();
const messageDedupStore = (() => {
  try { return require('../routing/message-dedup-store'); } catch (_) { return null; }
})();

// ── Phase 21.7: Session & Context Isolation ───────────────────────────────────
const centralSessionManager = (() => {
  try { return require('../sessions/whatsapp-session-manager'); } catch (_) { return null; }
})();
const sendGuard = (() => {
  try { return require('../sessions/whatsapp-send-guard'); } catch (_) { return null; }
})();

// CEO Operating Model Router (new routing priority)
const operatingModelRouter = (() => {
  try { return require('../workflows/operating-model-router'); } catch (_) { return null; }
})();

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
const RESPONSE_LOCK_TTL_MS = 2 * 60 * 1000;
const responseLocks = new Map();
const recentMiSuccesses = new Map();
const latestInboundByChat = new Map();
const miTracePath = path.resolve(__dirname, '../../data/mi-core-forward-trace.jsonl');
const miCoreRoot = path.resolve(__dirname, '../../../mi-core');

function pruneResponseLocks() {
  const cutoff = Date.now() - RESPONSE_LOCK_TTL_MS;
  for (const [key, value] of responseLocks.entries()) {
    if (!value || value.ts < cutoff) responseLocks.delete(key);
  }
  for (const [key, value] of recentMiSuccesses.entries()) {
    if (!value || value.ts < cutoff) recentMiSuccesses.delete(key);
  }
}

function getInboundMessageId(msg) {
  return msg?.id?._serialized || msg?.id?.id || '';
}

function normalizeLockText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/^\/mi\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

function getResponseLockKey({ msg, chatId, text }) {
  const id = getInboundMessageId(msg);
  if (id) return `msg:${id}`;
  return `chat:${chatId || ''}:${normalizeLockText(text)}`;
}

function getRecentMiKey(chatId, text) {
  return `${chatId || ''}:${normalizeLockText(text)}`;
}

function summarizeReplyForTrace(reply) {
  return String(reply || '').replace(/\s+/g, ' ').slice(0, 260);
}

function getForwardEvidence(forwardResult) {
  const metadata = forwardResult?.metadata || {};
  const body = forwardResult?.response_body || {};
  return {
    workflowId: metadata.workflow_id || body.workflow_id || body.metadata?.workflow_id || null,
    approvalId: forwardResult?.approval_id || metadata.approval_id || body.approval_id || body.metadata?.approval_id || null,
    source: metadata.source || body.source || body.metadata?.source || null,
    imagePath: metadata.image_evidence_path || body.image_evidence_path || body.metadata?.image_evidence_path || null,
  };
}

function resolveMiCoreEvidencePath(filePath) {
  if (!filePath) return '';
  const raw = String(filePath).trim();
  if (!raw) return '';
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(miCoreRoot, raw);
}

function isExecutionSuccess(forwardResult) {
  if (!forwardResult?.ok) return false;
  const evidence = getForwardEvidence(forwardResult);
  return !!(evidence.workflowId || evidence.approvalId || evidence.source === 'execution-engine');
}

function traceMiForward(event, detail = {}) {
  try {
    fs.mkdirSync(path.dirname(miTracePath), { recursive: true });
    fs.appendFileSync(miTracePath, JSON.stringify({
      ts: new Date().toISOString(),
      event,
      ...detail,
    }) + '\n');
  } catch (err) {
    log.warn('Failed to write Mi trace', { error: err.message });
  }
}

async function sendMiForwardResult({ client, chatId, msg, text, forwardResult, runtimeTraceBase, route, intent, phone, name, conversationPhone, conversationName }) {
  pruneResponseLocks();
  const lockKey = getResponseLockKey({ msg, chatId, text });
  const recentKey = getRecentMiKey(chatId, text);
  const lock = responseLocks.get(lockKey);
  const recentSuccess = recentMiSuccesses.get(recentKey);
  const evidence = getForwardEvidence(forwardResult);
  const latestInbound = latestInboundByChat.get(chatId);
  const traceBase = {
    inbound_message_id: getInboundMessageId(msg),
    gateway_handler: route,
    mi_core_request_id: forwardResult?.request_message_id || '',
    workflow_id: evidence.workflowId || '',
    approval_id: evidence.approvalId || '',
    chatId,
  };

  if (forwardResult?.ok && forwardResult.reply) {
    if (latestInbound && latestInbound !== traceBase.inbound_message_id) {
      log.warn('[MESSAGE_FLOW] mi_stale_success_suppressed', { ...runtimeTraceBase, route, latestInbound, inbound: traceBase.inbound_message_id });
      traceMiForward('outbound_suppressed_stale_success', {
        ...traceBase,
        outbound_source: 'mi-core-success',
        suppress_reason: 'newer_inbound_message_exists',
        outbound_preview: summarizeReplyForTrace(forwardResult.reply),
      });
      return false;
    }

    if (lock?.finalSent) {
      log.warn('[MESSAGE_FLOW] mi_duplicate_success_suppressed', { ...runtimeTraceBase, route, workflowId: evidence.workflowId || '' });
      traceMiForward('outbound_suppressed_duplicate_success', {
        ...traceBase,
        outbound_source: 'mi-core-success',
        outbound_preview: summarizeReplyForTrace(forwardResult.reply),
      });
      return false;
    }

    // ── Phase 21.7: Send Guard — block duplicate sends for same message ───
    if (sendGuard && traceBase.inbound_message_id) {
      const guardResult = sendGuard.beginMessage(traceBase.inbound_message_id, route, 'mi_core_response');
      if (!guardResult.canSend) {
        log.warn('[SEND_GUARD] BLOCKED_DUPLICATE in sendMiForwardResult', {
          messageId: traceBase.inbound_message_id,
          route,
        });
        traceMiForward('outbound_blocked_send_guard', {
          ...traceBase,
          suppress_reason: 'send_guard_duplicate',
        });
        return false;
      }
    }

    log.info('[MESSAGE_FLOW] ' + route + '_reply', {
      ...runtimeTraceBase,
      route,
      ok: true,
      workflowId: evidence.workflowId || '',
      approvalId: evidence.approvalId || '',
    });
    await replyService.send(client, chatId, forwardResult.reply);
    const imagePath = resolveMiCoreEvidencePath(evidence.imagePath);
    if (imagePath) {
      await replyService.sendMediaFile(client, chatId, imagePath, 'Hình preview cho bản nháp.');
      traceMiForward('outbound_sent_image_evidence', {
        ...traceBase,
        outbound_source: 'mi-core-image-evidence',
        image_path: imagePath,
      });
    }
    responseLocks.set(lockKey, {
      ts: Date.now(),
      finalSent: true,
      status: isExecutionSuccess(forwardResult) ? 'execution_success' : 'success',
      workflowId: evidence.workflowId || '',
      approvalId: evidence.approvalId || '',
      route,
    });
    recentMiSuccesses.set(recentKey, {
      ts: Date.now(),
      workflowId: evidence.workflowId || '',
      approvalId: evidence.approvalId || '',
      route,
    });
    traceMiForward('outbound_sent_success', {
      ...traceBase,
      outbound_source: 'mi-core-success',
      outbound_preview: summarizeReplyForTrace(forwardResult.reply),
    });
    await saveMessage({
      phone: conversationPhone || phone,
      name: conversationName || name,
      direction: 'out',
      message: forwardResult.reply,
      intent,
      aiReplied: true,
    });
    return true;
  }

  if (forwardResult?.reply) {
    log.warn('[MESSAGE_FLOW] mi_forward_failure_reply_suppressed', {
      ...runtimeTraceBase,
      route,
      error: forwardResult.error || '',
      lockStatus: lock?.status || '',
      recentSuccess: !!recentSuccess,
    });
    traceMiForward('outbound_suppressed_failure_reply', {
      ...traceBase,
      outbound_source: 'mi-core-fallback',
      suppress_reason: lock?.finalSent ? 'success_lock' : (recentSuccess ? 'recent_success_same_chat_text' : 'mi_failure_user_fallback_disabled'),
      outbound_preview: summarizeReplyForTrace(forwardResult.reply),
    });
  }
  return false;
}

function isSelfChatAllowed(client, msg) {
  if (process.env.MI_ALLOW_SELF_CHAT !== 'true') return false;
  if (!msg?.fromMe) return false;
  if (String(msg.from || '').includes('@g.us')) return false;
  if ((process.env.MI_ALLOW_FROM_ME_DIRECT || 'false') === 'true') return true;
  const ownId = client?.info?.wid?._serialized || client?.info?.me?._serialized || client?.info?.wid?.user || '';
  if (!ownId) return false;
  return miAccess.normalizeWaId(msg.from) === miAccess.normalizeWaId(ownId);
}

function isMiExecutionReplyText(text) {
  const body = String(text || '');
  return /SEO-CONTENT-\d{8}-\d+|Approval ID:\s*\*?APPR-|Anh reply:\s*\*?APPROVE/i.test(body)
    || (/Status:\s*\*?Draft ready/i.test(body) && /Reference:\s*SEO-CONTENT-/i.test(body));
}

function getOwnWaId(client) {
  return client?.info?.wid?._serialized || client?.info?.me?._serialized || client?.info?.wid?.user || '';
}

function configuredSelfChatNames() {
  return String(process.env.MI_SELF_CHAT_NAMES || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

function isDirectMiChatEnabled() {
  if (process.env.LAPTOP1_TEAM_ONLY_MODE === 'true') return false;
  return process.env.MI_DIRECT_CHAT_ENABLED !== 'false';
}

async function getLanguageQuestionReply(phone, name, text) {
  const lang = langMem.detectLanguageQuestion(text);
  if (!lang) return null;
  const reply = langMem.buildLanguageQuestionReply(lang, name);
  if (!reply) return null;
  await langMem.rememberFromMessage(phone, name, text).catch(() => {});
  return reply;
}

async function handleAgentMiCommand({ client, msg, chatId, isGroup, phone, name, text, trimmedText, timestamp, runtimeTraceBase }) {
  const agentMiRouter = require('../commands/agent-mi-router');
  const agentMiForwarder = require('../forwarding/agent-mi-forwarder');

  const isAgent = agentMiRouter.isAgentCommand(trimmedText);
  const isMi = agentMiRouter.isMiCommand(trimmedText);
  if (!isAgent && !isMi) return false;
  if (!isGroup && isMi && !isDirectMiChatEnabled()) {
    log.info('[MESSAGE_FLOW] mi_direct_chat_disabled', { ...runtimeTraceBase, route: 'mi_direct_chat_disabled', phone });
    return true;
  }
  if (isMi && !miAccess.isCeoSender(phone)) {
    log.info('[MESSAGE_FLOW] mi_blocked_non_ceo', { ...runtimeTraceBase, route: 'mi_blocked_non_ceo', phone });
    return false;
  }

  // ── Phase 21.7: MI_CORE_PRIORITY_LOCK for /mi command ─────────────────
  if (isMi && centralSessionManager) {
    centralSessionManager.setSession({
      chatId,
      senderPhone: phone,
      owner: 'mi_core',
      workflow: 'mi_command',
      lastMessageId: getInboundMessageId(msg),
    });
    log.info('[SESSION_MANAGER] MI_CORE_PRIORITY_LOCK', {
      ...runtimeTraceBase,
      route: 'mi_command_session_lock',
      reason: 'ceo_mi_core_priority',
    });
  }

  const chat = await msg.getChat().catch(() => null);
  const groupName = chat?.name || '';
  const handler = isAgent ? agentMiRouter.handleAgentMessage : agentMiRouter.handleMiMessage;
  const forwarder = isAgent ? agentMiForwarder.forwardToAgent : agentMiForwarder.forwardToMi;
  const intent = isAgent ? 'agent_command' : 'mi_command';
  const route = isAgent ? 'agent_forward' : 'mi_forward';
  const result = await handler({
    chatId,
    groupId: isGroup ? chatId : '',
    sender: phone,
    senderName: name,
    messageId: msg.id?._serialized || '',
    text: trimmedText,
    timestamp,
    attachments: [],
    client,
  });

  if (!result.handled) return false;

  const conversationPhone = isGroup ? chatId : phone;
  const conversationName = isGroup ? (groupName || chatId) : name;
  await saveMessage({ phone: conversationPhone, name: conversationName, direction: 'in', message: text, intent, aiReplied: false });

  if (result.payload) {
    const forwardResult = await forwarder(result.payload);
    if (isMi) {
      await sendMiForwardResult({
        client,
        chatId,
        msg,
        text,
        forwardResult,
        runtimeTraceBase,
        route,
        intent,
        phone,
        name,
        conversationPhone,
        conversationName,
      });
    } else if (forwardResult.reply) {
      log.info('[MESSAGE_FLOW] ' + route + '_reply', { ...runtimeTraceBase, route, ok: !!forwardResult.ok, error: forwardResult.error || '' });
      await replyService.send(client, chatId, forwardResult.reply);
      await saveMessage({ phone: conversationPhone, name: conversationName, direction: 'out', message: forwardResult.reply, intent, aiReplied: true });
    }
  } else if (result.reply) {
    await replyService.send(client, chatId, result.reply);
    await saveMessage({ phone: conversationPhone, name: conversationName, direction: 'out', message: result.reply, intent, aiReplied: true });
  }

  return true;
}

function installOutboundSendGuard(client) {
  if (!client || client.__miOutboundSendGuardInstalled) return;
  const originalSendMessage = client.sendMessage.bind(client);
  client.sendMessage = async (to, content, options) => {
    const text = typeof content === 'string'
      ? content
      : (options && typeof options.caption === 'string' ? options.caption : '');
    if (replyService.isBlockedUserFacingText && replyService.isBlockedUserFacingText(text)) {
      log.warn('[MESSAGE_FLOW] blocked_banned_raw_sendMessage', {
        to,
        preview: String(text || '').replace(/\s+/g, ' ').slice(0, 160),
      });
      return null;
    }
    return originalSendMessage(to, content, options);
  };
  Object.defineProperty(client, '__miOutboundSendGuardInstalled', {
    value: true,
    enumerable: false,
    configurable: false,
  });
  log.info('[MESSAGE_FLOW] outbound_send_guard_installed');
}

function attach(client) {
  installOutboundSendGuard(client);
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
  client.on('message_create', async (msg) => {
    if (!isSelfChatAllowed(client, msg)) return;
    try {
      await handleTextMessage(client, msg);
    } catch (err) {
      log.error('Self-chat message handler error', { error: err.message, stack: err.stack });
    }
  });
  log.info('Message listener attached (with food-safety image support)');
}

async function handleImageMessage(client, msg) {
  const chatId = msg.from;
  const timestamp = msg.timestamp ? new Date(msg.timestamp * 1000).toISOString() : new Date().toISOString();
  const messageId = msg.id._serialized || String(Date.now());

  // ── Phase 21.7: CEO sender isolation — food safety MUST NOT respond in CEO direct chat
  const senderPhone = (msg.author || msg.from || '').replace('@c.us', '').replace('@g.us', '');
  if (miAccess.isCeoSender(senderPhone) && !chatId.includes('@g.us')) {
    log.info('[MESSAGE_FLOW] food_safety_blocked_ceo_direct_chat', { chatId, senderPhone, messageId });
    return; // CEO direct chat images are NOT food safety scope
  }

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
    await replyService.send(client, chatId, '⚠️ Tải ảnh thất bại. Anh thử gửi lại nhé.');
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
        await replyService.send(client, chatId, '⚠️ Lưu ảnh thất bại. Anh thử gửi lại nhé.');
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
      await replyService.send(client, chatId, '⚠️ Lỗi xử lý form. Anh thử lại hoặc báo manager nhé.');
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
      await replyService.send(client, chatId, '⚠️ OCR thất bại. Anh chụp lại ảnh rõ hơn hoặc báo manager nhé.');
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
    await replyService.send(client, chatId, '⚠️ Kiểm tra food safety thất bại. Anh thử lại nhé.');
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
  const selfChatAllowed = isSelfChatAllowed(client, msg);
  if (msg.fromMe) {
    if (!selfChatAllowed) return;
    if (replyService.isGatewaySentMessage?.(msg)) return;
    if (isMiExecutionReplyText(msg.body || '')) {
      log.info('[MESSAGE_FLOW] self_execution_reply_ignored', { chatId: msg.from });
      return;
    }
  }

  const isGroup = msg.from.includes('@g.us');
  const chatId = msg.from;
  const selfSender = msg.fromMe && selfChatAllowed && !isGroup;
  const selfChat = selfSender ? await msg.getChat().catch(() => null) : null;
  const allowedSelfChatNames = configuredSelfChatNames();
  if (selfSender && allowedSelfChatNames.length) {
    const chatName = String(selfChat?.name || '').trim().toLowerCase();
    if (!allowedSelfChatNames.includes(chatName)) {
      log.info('[MESSAGE_FLOW] self_chat_not_allowed_name', { chatId, chatName });
      return;
    }
  }
  const phone = selfSender
    ? miAccess.normalizeWaId(getOwnWaId(client))
    : (isGroup ? (msg.author || msg.from).replace('@c.us', '').replace('@g.us', '') : msg.from.replace('@c.us', ''));
  const contact = selfSender ? null : await msg.getContact().catch(() => null);
  const name = selfSender ? (client?.info?.pushname || client?.info?.wid?.user || phone) : (contact?.pushname || contact?.name || phone);
  const text = msg.body || '';
  const timestamp = msg.timestamp ? new Date(msg.timestamp * 1000).toISOString() : new Date().toISOString();
  const trimmedText = text.trim();
  const inboundMessageId = getInboundMessageId(msg);
  if (inboundMessageId) latestInboundByChat.set(chatId, inboundMessageId);
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
    inboundMessageId,
  };
  log.info('[MESSAGE_FLOW] received', runtimeTraceBase);

  // ── WhatsApp Routing Collision Fix: Dedup Gate ──────────────────────────────────
  // This is the FIRST line of defense. Any message that passes through this gate
  // has exactly one owner and exactly one response slot. No duplicates, no races.
  if (messageDedupStore && inboundMessageId) {
    const chat = await msg.getChat().catch(() => null);
    const groupName = chat?.name || '';
    const dedupResult = messageDedupStore.claim(inboundMessageId, chatId, 'gateway_router');
    if (!dedupResult.claimed) {
      log.info('[MESSAGE_FLOW] dedup_blocked_incoming', {
        ...runtimeTraceBase,
        route: 'dedup_rejected',
        existingOwner: dedupResult.existing?.owner_handler || 'unknown',
        existingStatus: dedupResult.existing?.status || 'unknown',
      });
      return; // exactly one response — this message already has its owner
    }
    log.info('[MESSAGE_FLOW] dedup_claim_acquired', {
      ...runtimeTraceBase,
      route: 'dedup_claim',
      inboundMessageId,
    });
  }

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

  // Agent/MI commands must route before group quiet mode and legacy command routing.
  // Otherwise unknown slash commands in groups are silently dropped.
  if (await handleAgentMiCommand({ client, msg, chatId, isGroup, phone, name, text, trimmedText, timestamp, runtimeTraceBase })) {
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
  // CEO messages must never be intercepted here — they route to mi-core via isNoPrefix below.
  if (!brothCommandMod.hasActiveSession(chatId, phone) && !miAccess.isCeoSender(phone)) {
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
    if (!miAccess.isCeoSender(phone)) {
      log.info('[MESSAGE_FLOW] mi_blocked_non_ceo', { ...runtimeTraceBase, route: 'mi_blocked_non_ceo', phone });
    } else {
    const chat = await msg.getChat().catch(() => null);
    const groupName = chat?.name || '';
    const result = await agentMiRouter.handleMiMessage({
      chatId, groupId: isGroup ? chatId : '', sender: phone, senderName: name,
      text: trimmedText, timestamp, attachments: [], client,
    });
    if (result.handled) {
      if (result.payload) {
        const forwardResult = await agentMiForwarder.forwardToMi(result.payload);
        await sendMiForwardResult({
          client,
          chatId,
          msg,
          text,
          forwardResult,
          runtimeTraceBase,
          route: 'mi_forward',
          intent: 'mi_command',
          phone,
          name,
        });
      } else if (result.reply) {
        await replyService.send(client, chatId, result.reply);
      }
      await saveMessage({ phone, name, direction: 'in', message: text, intent: 'mi_command', aiReplied: false });
      return;
    }
    }
  }

  // No-prefix direct admin chat routes to Mi-Core. Non-admin no-prefix remains quiet
  // here so the gateway does not answer CEO-style messages with command training text.
  if (agentMiRouter.isNoPrefix(trimmedText)) {
    if (!isGroup && !isDirectMiChatEnabled()) {
      log.info('[MESSAGE_FLOW] no_prefix_mi_direct_chat_disabled', { ...runtimeTraceBase, route: 'no_prefix_mi_direct_chat_disabled', phone });
      return;
    }
    const groupWorkflowConfig = require('../workflows/group-workflow-config');
    const isAdmin = miAccess.isCeoSender(phone) || (!isGroup && await groupWorkflowConfig.isMiAdminPrivateChat(chatId, phone) && miAccess.isCeoSender(phone));
    if (!isAdmin) {
      log.info('[MESSAGE_FLOW] no_prefix_non_ceo_silent_drop', { ...runtimeTraceBase, route: 'no_prefix_silent_drop', phone });
      return; // P0 FIX: non-CEO no-prefix must NOT fall through to GREETING block
    } else {
      // ── Phase 21.7: MI_CORE_PRIORITY_LOCK — claim owner, close others ─────
      if (centralSessionManager) {
        centralSessionManager.setSession({
          chatId,
          senderPhone: phone,
          owner: 'mi_core',
          workflow: 'ceo_no_prefix',
          lastMessageId: inboundMessageId,
        });
        log.info('[SESSION_MANAGER] MI_CORE_PRIORITY_LOCK', {
          ...runtimeTraceBase,
          closedOwners: 'all_others',
          reason: 'ceo_mi_core_priority',
        });
      }
      const result = await agentMiRouter.handleMiMessage({
        chatId,
        groupId: '',
        sender: phone,
        senderName: name,
        text: '/mi ' + trimmedText,
        timestamp,
        attachments: [],
        client,
      });
      await saveMessage({ phone, name, direction: 'in', message: text, intent: 'no_prefix', aiReplied: false });
      if (result.payload) {
        // ── Send Guard: check before forwarding ─────────────────────────────
        let canSendText = true;
        if (sendGuard && inboundMessageId) {
          const guardResult = sendGuard.beginMessage(inboundMessageId, 'mi_core', 'text');
          canSendText = guardResult.canSend;
          if (!canSendText) {
            log.warn('[SEND_GUARD] BLOCKED_DUPLICATE', { messageId: inboundMessageId, route: 'no_prefix_mi_forward' });
          }
        }
        if (canSendText) {
          const forwardResult = await agentMiForwarder.forwardToMi(result.payload);
          const sent = await sendMiForwardResult({
            client,
            chatId,
            msg,
            text,
            forwardResult,
            runtimeTraceBase,
            route: 'no_prefix_mi_forward',
            intent: 'mi_no_prefix',
            phone,
            name,
          });
          if (forwardResult.ok && forwardResult.reply && !sent) {
            log.info('[MESSAGE_FLOW] no_prefix_mi_forward_suppressed', { ...runtimeTraceBase, route: 'no_prefix_mi_forward_suppressed' });
          } else if (!forwardResult.ok) {
            log.warn('[MESSAGE_FLOW] no_prefix_mi_forward_failed_silent_drop', { ...runtimeTraceBase, route: 'no_prefix_mi_forward_failed', error: forwardResult.error || '' });
          }
        }
      } else if (result.reply) {
        // ── Send Guard: check before local reply ───────────────────────────
        let canSend = true;
        if (sendGuard && inboundMessageId) {
          const guardResult = sendGuard.beginMessage(inboundMessageId, 'mi_core', 'text');
          canSend = guardResult.canSend;
        }
        if (canSend) {
          await replyService.send(client, chatId, result.reply);
          if (sendGuard && inboundMessageId) sendGuard.recordSend(inboundMessageId, 'mi_core', 'text');
          await saveMessage({ phone, name, direction: 'out', message: result.reply, intent: 'mi_no_prefix', aiReplied: true });
        }
      }
      return;
    }
  }


  // P0 FIX: CEO senders must NEVER receive generic greeting or generic AI reply
  // Only Mi-Core may respond to CEO. This prevents collision when mi-core is slow.
  if (miAccess.isCeoSender(phone)) {
    log.info('[MESSAGE_FLOW] ceo_sender_blocked_from_generic_ai', { ...runtimeTraceBase, route: 'ceo_generic_ai_blocked' });
    return; // CEO always routes to Mi. Never use generic AI or greeting.
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
