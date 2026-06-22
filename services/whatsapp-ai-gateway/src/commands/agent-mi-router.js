/**
 * Agent/MI Command Router
 *
 * Parses WhatsApp messages for /agent and /mi prefixes.
 * Routes messages to the correct external endpoint.
 * 
 * Hard rules:
 * - /agent → Agent-Coding only
 * - /mi    → Mi-Core only
 * - no prefix → routed by message-listener policy
 * - agent must never route to Mi-Core
 * - mi must never route to Agent-Coding
 */

const { makeLogger } = require('../logger');
const log = makeLogger('agent-mi-router');

const HELP_MESSAGE = `🤖 *Agent / MI Commands*

\`/agent <message>\` — Coding/workflow agent
   Run QA, source map, build tasks, fix prompts, dev/QA loops.

\`/mi <message>\` — Mi executive assistant
   Summarize chats, extract action items, create task proposals,
   check dashboards, draft replies.

_Use /agent for coding/workflow tasks._
_Use /mi for assistant/executive questions._

_Private admin chats can talk to Mi without a prefix._`;

const NO_PREFIX_MESSAGE = '';

/**
 * Check if text starts with /agent command.
 * @param {string} text
 * @returns {boolean}
 */
function isAgentCommand(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim().toLowerCase();
  return trimmed === '/agent' || trimmed.startsWith('/agent ');
}

/**
 * Check if text starts with /mi command.
 * @param {string} text
 * @returns {boolean}
 */
function isMiCommand(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim().toLowerCase();
  return trimmed === '/mi' || trimmed.startsWith('/mi ');
}

/**
 * Check if text has no recognized prefix.
 * @param {string} text
 * @returns {boolean}
 */
function isNoPrefix(text) {
  if (!text || typeof text !== 'string') return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  // Check if it starts with any known command prefix
  const knownPrefixes = ['/agent', '/mi ', '/mi', '/ldagent', '/broth', '/help', '/status', '/temp', '/language', '/history', '/form'];
  for (const prefix of knownPrefixes) {
    if (trimmed.toLowerCase() === prefix || trimmed.toLowerCase().startsWith(prefix + ' ')) {
      return false;
    }
  }
  return true;
}

/**
 * Extract the message content after /agent prefix.
 * @param {string} text
 * @returns {string}
 */
function extractAgentMessage(text) {
  if (!text) return '';
  const trimmed = text.trim();
  const normalized = trimmed.replace(/^\/agent\s+/i, '').replace(/^\/agent/i, '');
  return normalized.trim();
}

/**
 * Extract the message content after /mi prefix.
 * @param {string} text
 * @returns {string}
 */
function extractMiMessage(text) {
  if (!text) return '';
  const trimmed = text.trim();
  const normalized = trimmed.replace(/^\/mi\s+/i, '').replace(/^\/mi/i, '');
  return normalized.trim();
}

function buildMessageId(msg, prefix) {
  if (msg.messageId) return String(msg.messageId);
  const chatId = String(msg.chatId || 'chat').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  const ts = msg.timestamp ? String(msg.timestamp).replace(/[^0-9]/g, '') : String(Date.now());
  return `${prefix}-${chatId}-${ts}-${Math.random().toString(16).slice(2, 8)}`;
}

/**
 * Handle a /agent message — prepare payload for forwarding to Agent-Coding.
 * @param {Object} msg — { chatId, groupId, sender, senderName, text, timestamp, attachments, client }
 * @returns {Promise<Object>} { handled, reply, payload }
 */
async function handleAgentMessage(msg) {
  const { chatId = '', groupId = '', sender = '', senderName = '', text = '', timestamp = '', attachments = [] } = msg;
  const agentMsg = extractAgentMessage(text);

  if (!agentMsg) {
    return {
      handled: true,
      reply: `⚠️ *Agent-Coding*\n\nPlease include a message after /agent.\n\nExample: \`/agent run QA RawWebsite\``,
      payload: null,
    };
  }

  const payload = {
    source: 'whatsapp',
    client_id: 'agent-coding',
    message_id: buildMessageId(msg, 'agent'),
    chat_id: chatId,
    group_id: groupId,
    sender,
    sender_name: senderName,
    text: agentMsg,
    timestamp,
    attachments: attachments || [],
    api_key: '',  // filled by forwarder
  };

  log.info('[AGENT] parsed message', { chatId, sender, text: agentMsg.slice(0, 80) });

  return {
    handled: true,
    reply: null,  // forwarder will provide the actual reply
    payload,
  };
}

/**
 * Handle a /mi message — prepare payload for forwarding to Mi-Core.
 * @param {Object} msg
 * @returns {Promise<Object>} { handled, reply, payload }
 */
async function handleMiMessage(msg) {
  const { chatId = '', groupId = '', sender = '', senderName = '', text = '', timestamp = '', attachments = [] } = msg;
  const miMsg = extractMiMessage(text);

  if (!miMsg) {
    return {
      handled: true,
      reply: `⚠️ *Mi Assistant*\n\nPlease include a message after /mi.\n\nExample: \`/mi hôm nay anh nên làm gì?\``,
      payload: null,
    };
  }

  const payload = {
    source: 'whatsapp',
    client_id: 'mi-core',
    message_id: buildMessageId(msg, 'mi'),
    chat_id: chatId,
    group_id: groupId,
    sender,
    sender_name: senderName,
    text: text.trim(),
    command_text: miMsg,
    timestamp,
    attachments: attachments || [],
    api_key: '',  // filled by forwarder
  };

  log.info('[MI] parsed message', { chatId, sender, text: miMsg.slice(0, 80) });

  return {
    handled: true,
    reply: null,
    payload,
  };
}

/**
 * Get help message for agent/mi commands.
 * @returns {string}
 */
function getHelpMessage() {
  return HELP_MESSAGE;
}

/**
 * Get no-prefix guidance message.
 * @returns {string}
 */
function getNoPrefixMessage() {
  return NO_PREFIX_MESSAGE;
}

module.exports = {
  isAgentCommand,
  isMiCommand,
  isNoPrefix,
  extractAgentMessage,
  extractMiMessage,
  handleAgentMessage,
  handleMiMessage,
  getHelpMessage,
  getNoPrefixMessage,
};
