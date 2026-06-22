/**
 * Message Router Owner — single-owner routing for WhatsApp messages.
 *
 * Architecture:
 *   Incoming WhatsApp message
 *   → Message Deduplication
 *   → Group / Chat Policy Resolver
 *   → Intent Gate
 *   → Single Handler (returns proposed response)
 *   → Response Builder
 *   → Send Once
 *
 * Hard rule: One message_id = one decision = one response max.
 * Only router can send WhatsApp replies.
 */

const { makeLogger } = require('../logger');
const dedupStore = require('./message-dedup-store');

const log = makeLogger('router');

/**
 * Allowed owner handlers — exactly one wins per message.
 */
const OWNER_HANDLERS = {
  MI_CORE: 'mi_core',
  FOOD_SAFETY: 'food_safety',
  MARKETING_PREVIEW: 'marketing_preview',
  TEAM_SUPPORT: 'team_support',
  UNKNOWN_NO_REPLY: 'unknown_no_reply',
};

/**
 * Intent detection patterns
 */
const MI_CORE_PATTERNS = [
  /^mi\s+ơi/i,
  /^\/mi\s/i,
  /^\/mi$/i,
];

const DRAFT_APPROVAL_PATTERNS = [
  /duyệt|approve|confirmed|đồng ý|xác nhận/i,
  /draft.*ok|ok.*draft/i,
];

const BOT_MENTION_PATTERNS = [
  /\bmi\b.*\?/i,
  /\bmi\b.*task/i,
  /\bmi\b.*help/i,
];

/**
 * @typedef {Object} HandlerResponse
 * @property {string} owner
 * @property {number} confidence
 * @property {string|null} response
 * @property {string} evidence
 * @property {boolean} shouldSend
 */

/**
 * @typedef {Object} RoutingDecision
 * @property {string} message_id
 * @property {string} chat_id
 * @property {string} group_name
 * @property {string} sender
 * @property {string} timestamp
 * @property {string} normalized_text
 * @property {string} policy
 * @property {string} intent
 * @property {string} owner_handler
 * @property {string} decision_reason
 * @property {boolean} response_allowed
 * @property {string} dedup_key
 * @property {HandlerResponse} [handler_response]
 */

/**
 * Resolve group policy from chat name and context.
 * @param {string} groupName
 * @param {string} chatId
 * @returns {string}
 */
function resolveGroupPolicy(groupName, chatId) {
  const name = String(groupName || '').toLowerCase();
  const id = String(chatId || '').toLowerCase();

  if (name.includes('food safety') || name.includes('an toàn thực phẩm') || name.includes('food-safety')) {
    return 'food_safety';
  }
  if (name.includes('marketing') || name.includes('content') || name.includes('draft')) {
    return 'marketing';
  }
  if (name.includes('team') || name.includes('staff') || name.includes('nhân viên')) {
    return 'team_support';
  }
  if (name.includes('ceo') || name.includes('admin') || name.includes('liem')) {
    return 'admin';
  }
  return 'general';
}

/**
 * Detect intent from message text and context.
 * @param {string} text
 * @param {string} groupName
 * @param {boolean} hasImage
 * @param {boolean} hasActiveSession
 * @returns {{ owner: string, reason: string, confidence: number, intent: string }}
 */
function detectIntent(text, groupName, hasImage, hasActiveSession) {
  const trimmed = (text || '').trim();
  const normalized = trimmed.toLowerCase();

  // Rule 1: Mi ơi / /mi → owner = mi_core
  for (const pattern of MI_CORE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        owner: OWNER_HANDLERS.MI_CORE,
        reason: `mi_command_detected: ${pattern.toString()}`,
        confidence: 1.0,
        intent: 'mi_command',
      };
    }
  }

  // Rule 2: Group policy = food_safety and image/form detected → owner = food_safety
  const groupPolicy = resolveGroupPolicy(groupName, '');
  if (groupPolicy === 'food_safety' && hasImage) {
    return {
      owner: OWNER_HANDLERS.FOOD_SAFETY,
      reason: 'food_safety_group_image',
      confidence: 1.0,
      intent: 'food_safety_submission',
    };
  }

  // Rule 3: Draft approval keywords detected and active draft session → owner = marketing_preview
  for (const pattern of DRAFT_APPROVAL_PATTERNS) {
    if (pattern.test(trimmed) && hasActiveSession) {
      return {
        owner: OWNER_HANDLERS.MARKETING_PREVIEW,
        reason: `marketing_draft_approval_detected`,
        confidence: 0.9,
        intent: 'draft_approval',
      };
    }
  }

  // Rule 4: No active session and not explicit bot mention → no reply
  if (!hasActiveSession) {
    // Check for explicit bot mention
    for (const pattern of BOT_MENTION_PATTERNS) {
      if (pattern.test(trimmed)) {
        // Bot mentioned but check if wrong group
        if (groupPolicy === 'food_safety') {
          return {
            owner: OWNER_HANDLERS.UNKNOWN_NO_REPLY,
            reason: 'bot_mentioned_wrong_group',
            confidence: 0.7,
            intent: 'wrong_group_mention',
          };
        }
        return {
          owner: OWNER_HANDLERS.MI_CORE,
          reason: 'bot_mention_detected',
          confidence: 0.8,
          intent: 'bot_mention',
        };
      }
    }

    // No active session, no explicit mention → no reply
    return {
      owner: OWNER_HANDLERS.UNKNOWN_NO_REPLY,
      reason: 'no_active_session_no_mention',
      confidence: 1.0,
      intent: 'silent_drop',
    };
  }

  // Has active session — let the session handle it
  if (groupPolicy === 'food_safety') {
    return {
      owner: OWNER_HANDLERS.FOOD_SAFETY,
      reason: 'food_safety_active_session',
      confidence: 0.9,
      intent: 'session_continuation',
    };
  }

  // Fallback: unknown, no reply
  return {
    owner: OWNER_HANDLERS.UNKNOWN_NO_REPLY,
    reason: 'no_matching_intent',
    confidence: 1.0,
    intent: 'unmatched',
  };
}

/**
 * Route a single incoming message through the owner resolution pipeline.
 *
 * @param {Object} params
 * @param {string} params.messageId - WhatsApp message_id (serialized)
 * @param {string} params.chatId - WhatsApp chat ID
 * @param {string} params.groupName - Group name (empty for DM)
 * @param {string} params.sender - Sender phone
 * @param {string} params.text - Message text
 * @param {string} params.timestamp - ISO timestamp
 * @param {boolean} [params.hasImage] - Whether message contains an image
 * @param {boolean} [params.hasActiveSession] - Whether there's an active session for this chat
 * @returns {RoutingDecision}
 */
function routeMessage({ messageId, chatId, groupName, sender, text, timestamp, hasImage = false, hasActiveSession = false }) {
  const normalizedText = (text || '').trim().toLowerCase();
  const policy = resolveGroupPolicy(groupName, chatId);

  // Step 1: Dedup check
  if (dedupStore.isDuplicate(messageId)) {
    const existing = dedupStore.get(messageId);
    log.info('[ROUTER] Duplicate message blocked', {
      messageId,
      existingOwner: existing?.owner_handler,
      existingStatus: existing?.status,
    });
    return {
      message_id: messageId,
      chat_id: chatId,
      group_name: groupName || '',
      sender,
      timestamp: timestamp || new Date().toISOString(),
      normalized_text: normalizedText,
      policy,
      intent: 'duplicate_blocked',
      owner_handler: OWNER_HANDLERS.UNKNOWN_NO_REPLY,
      decision_reason: 'dedup_already_processed',
      response_allowed: false,
      dedup_key: `msg:${messageId}`,
    };
  }

  // Step 2: Intent detection → single owner
  const intentResult = detectIntent(normalizedText, groupName, hasImage, hasActiveSession);

  // Step 3: Claim in dedup store
  const { claimed } = dedupStore.claim(messageId, chatId, intentResult.owner);
  if (!claimed) {
    log.warn('[ROUTER] Dedup claim race condition — message already claimed', { messageId });
    return {
      message_id: messageId,
      chat_id: chatId,
      group_name: groupName || '',
      sender,
      timestamp: timestamp || new Date().toISOString(),
      normalized_text: normalizedText,
      policy,
      intent: 'claim_race_lost',
      owner_handler: OWNER_HANDLERS.UNKNOWN_NO_REPLY,
      decision_reason: 'dedup_claim_rejected',
      response_allowed: false,
      dedup_key: `msg:${messageId}`,
    };
  }

  // Step 4: Determine if response is allowed
  const responseAllowed = intentResult.owner !== OWNER_HANDLERS.UNKNOWN_NO_REPLY;

  // Step 5: Log routing decision
  const decision = {
    message_id: messageId,
    chat_id: chatId,
    group_name: groupName || '',
    sender,
    timestamp: timestamp || new Date().toISOString(),
    normalized_text: normalizedText.slice(0, 120),
    policy,
    intent: intentResult.intent,
    owner_handler: intentResult.owner,
    decision_reason: intentResult.reason,
    response_allowed: responseAllowed,
    dedup_key: `msg:${messageId}`,
  };

  log.info('[ROUTER] Routing decision', {
    owner: decision.owner_handler,
    intent: decision.intent,
    reason: decision.decision_reason,
    allowed: decision.response_allowed,
    chatId,
    policy,
    preview: normalizedText.slice(0, 60),
  });

  return decision;
}

/**
 * Execute a handler and collect its proposed response.
 * The handler MUST NOT send directly — it returns a proposed response.
 *
 * @param {RoutingDecision} decision
 * @param {Function} handlerFn - async function returning { owner, confidence, response, evidence, shouldSend }
 * @returns {Promise<HandlerResponse>}
 */
async function executeHandler(decision, handlerFn) {
  if (!decision.response_allowed) {
    return {
      owner: decision.owner_handler,
      confidence: 1.0,
      response: null,
      evidence: decision.decision_reason,
      shouldSend: false,
    };
  }

  try {
    const result = await handlerFn();
    // Validate handler returned proper format
    if (!result || typeof result !== 'object') {
      log.error('[ROUTER] Handler returned invalid result', { owner: decision.owner_handler });
      return {
        owner: decision.owner_handler,
        confidence: 0,
        response: null,
        evidence: 'handler_invalid_return',
        shouldSend: false,
      };
    }

    // Ensure handler didn't send directly (it should only return proposed response)
    const response = result.response || null;
    const shouldSend = result.shouldSend !== false && !!response;

    return {
      owner: decision.owner_handler,
      confidence: result.confidence || 0.5,
      response,
      evidence: result.evidence || decision.decision_reason,
      shouldSend,
    };
  } catch (err) {
    log.error('[ROUTER] Handler exception', {
      owner: decision.owner_handler,
      error: err.message,
    });
    return {
      owner: decision.owner_handler,
      confidence: 0,
      response: null,
      evidence: `handler_exception: ${err.message}`,
      shouldSend: false,
    };
  }
}

/**
 * Final send — only the router sends.
 *
 * @param {Object} params
 * @param {import('./reply-service')} replyService
 * @param {Object} client - WhatsApp client
 * @param {string} chatId
 * @param {HandlerResponse} handlerResponse
 * @returns {Promise<boolean>}
 */
async function sendOnce(replyService, client, chatId, handlerResponse) {
  if (!handlerResponse.shouldSend || !handlerResponse.response) {
    return false;
  }

  dedupStore.updateStatus(handlerResponse.evidence?.message_id, 'completed', {
    response_sent: true,
  });

  const sent = await replyService.send(client, chatId, handlerResponse.response);
  if (sent) {
    log.info('[ROUTER] Response sent', {
      chatId,
      owner: handlerResponse.owner,
      responseLength: handlerResponse.response.length,
    });
  } else {
    log.warn('[ROUTER] Response send failed', { chatId, owner: handlerResponse.owner });
  }
  return sent;
}

module.exports = {
  OWNER_HANDLERS,
  resolveGroupPolicy,
  detectIntent,
  routeMessage,
  executeHandler,
  sendOnce,
};
