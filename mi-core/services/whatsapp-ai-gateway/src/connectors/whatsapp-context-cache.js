/**
 * WhatsApp Context Cache
 *
 * Local file-system cache for WhatsApp chat context used by Mi-Core.
 * Stores messages, groups, participants, summaries, action items, and approvals.
 *
 * Base directory: .local-agent-global/connectors/whatsapp/
 */

const fs = require('fs');
const path = require('path');
const { makeLogger } = require('../logger');

const log = makeLogger('whatsapp-context-cache');

const CACHE_BASE = path.resolve(process.env.WHATSAPP_CONTEXT_CACHE_DIR || '.local-agent-global/connectors/whatsapp');

const FILES = {
  messages: 'messages.json',
  groups: 'groups.json',
  participants: 'participants.json',
  summaries: 'summaries.json',
  actionItems: 'action_items.json',
  approvals: 'approvals.json',
  lastSync: 'last_sync.json',
  errors: 'errors.json',
};

const MAX_MESSAGES = 1000;
const ROTATE_KEEP = 500;

/**
 * Ensure the cache directory exists.
 */
function ensureDir() {
  fs.mkdirSync(CACHE_BASE, { recursive: true });
  for (const file of Object.values(FILES)) {
    const filePath = path.join(CACHE_BASE, file);
    if (!fs.existsSync(filePath)) {
      const initial = file === 'last_sync.json' ? '{}' : '[]';
      fs.writeFileSync(filePath, initial, 'utf8');
    }
  }
}

// Ensure directory exists on module load
ensureDir();

/**
 * Read a JSON file from the cache.
 * @param {string} fileKey
 * @returns {Array|Object}
 */
function readFile(fileKey) {
  const filePath = path.join(CACHE_BASE, FILES[fileKey]);
  try {
    if (!fs.existsSync(filePath)) {
      return fileKey === 'lastSync' ? {} : [];
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    log.warn('Failed to read cache file', { file: fileKey, error: err.message });
    return fileKey === 'lastSync' ? {} : [];
  }
}

/**
 * Write data to a JSON cache file.
 * @param {string} fileKey
 * @param {Array|Object} data
 */
function writeFile(fileKey, data) {
  const filePath = path.join(CACHE_BASE, FILES[fileKey]);
  try {
    ensureDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    log.error('Failed to write cache file', { file: fileKey, error: err.message });
  }
}

/**
 * Cache an incoming WhatsApp message.
 * @param {{ chatId, groupId, groupName, sender, senderName, text, timestamp, attachments }}
 */
function cacheMessage({ chatId, groupId, groupName, sender, senderName, text, timestamp, attachments }) {
  const messages = readFile('messages');
  messages.push({
    chat_id: chatId || '',
    group_id: groupId || '',
    group_name: groupName || '',
    sender: sender || '',
    sender_name: senderName || '',
    text: text || '',
    timestamp: timestamp || new Date().toISOString(),
    attachments: attachments || [],
    cached_at: new Date().toISOString(),
  });

  // Rotate if too large
  if (messages.length > MAX_MESSAGES) {
    const kept = messages.slice(-ROTATE_KEEP);
    writeFile('messages', kept);
  } else {
    writeFile('messages', messages);
  }

  // Update last_sync
  const lastSync = readFile('lastSync');
  lastSync.last_message_at = new Date().toISOString();
  lastSync.message_count = (lastSync.message_count || 0) + 1;
  writeFile('lastSync', lastSync);
}

/**
 * Cache/update a group mapping.
 * @param {{ chatId, groupId, groupName, storeId }}
 */
function cacheGroup({ chatId, groupId, groupName, storeId }) {
  const groups = readFile('groups');
  const idx = groups.findIndex(g => g.chat_id === (chatId || groupId));
  const entry = {
    chat_id: chatId || groupId || '',
    group_id: groupId || chatId || '',
    group_name: groupName || '',
    store_id: storeId || null,
    last_seen: new Date().toISOString(),
  };

  if (idx >= 0) {
    groups[idx] = { ...groups[idx], ...entry };
  } else {
    groups.push(entry);
  }
  writeFile('groups', groups);
}

/**
 * Cache/update a participant.
 * @param {{ chatId, sender, senderName }}
 */
function cacheParticipant({ chatId, sender, senderName }) {
  const participants = readFile('participants');
  const idx = participants.findIndex(p => p.chat_id === chatId && p.sender === sender);
  const entry = {
    chat_id: chatId || '',
    sender: sender || '',
    sender_name: senderName || '',
    last_seen: new Date().toISOString(),
  };

  if (idx >= 0) {
    participants[idx] = { ...participants[idx], ...entry };
  } else {
    participants.push(entry);
  }
  writeFile('participants', participants);
}

/**
 * Get recent messages for a chat.
 * @param {string} chatId
 * @param {number} limit
 * @returns {Array}
 */
function getMessages(chatId, limit = 50) {
  const messages = readFile('messages');
  const filtered = messages.filter(m => m.chat_id === chatId);
  return filtered.slice(-limit);
}

/**
 * Get group info by chat ID.
 * @param {string} chatId
 * @returns {Object|null}
 */
function getGroup(chatId) {
  const groups = readFile('groups');
  return groups.find(g => g.chat_id === chatId) || null;
}

/**
 * Get all known groups.
 * @returns {Array}
 */
function getAllGroups() {
  return readFile('groups');
}

/**
 * Get all known participants.
 * @returns {Array}
 */
function getAllParticipants() {
  return readFile('participants');
}

/**
 * Get last sync info.
 * @returns {Object}
 */
function getLastSync() {
  return readFile('lastSync');
}

/**
 * Store a chat summary.
 * @param {{ chatId, summary }}
 */
function storeSummary({ chatId, summary }) {
  const summaries = readFile('summaries');
  const idx = summaries.findIndex(s => s.chat_id === chatId);
  const entry = {
    chat_id: chatId,
    summary,
    updated_at: new Date().toISOString(),
  };
  if (idx >= 0) {
    summaries[idx] = entry;
  } else {
    summaries.push(entry);
  }
  writeFile('summaries', summaries);
}

/**
 * Store an action item.
 * @param {{ chatId, actionItem, proposedBy }}
 */
function storeActionItem({ chatId, actionItem, proposedBy }) {
  const items = readFile('actionItems');
  items.push({
    chat_id: chatId,
    action_item: actionItem,
    proposed_by: proposedBy,
    status: 'pending',
    created_at: new Date().toISOString(),
  });
  writeFile('actionItems', items);
}

/**
 * Store an approval record.
 * @param {{ chatId, approvalId, action, status }}
 */
function storeApproval({ chatId, approvalId, action, status }) {
  const approvals = readFile('approvals');
  approvals.push({
    chat_id: chatId,
    approval_id: approvalId,
    action,
    status: status || 'pending',
    created_at: new Date().toISOString(),
  });
  writeFile('approvals', approvals);
}

/**
 * Log an error to the errors file.
 * @param {{ chatId, operation, error }}
 */
function logError({ chatId, operation, error }) {
  const errors = readFile('errors');
  errors.push({
    chat_id: chatId || '',
    operation: operation || '',
    error: error || '',
    timestamp: new Date().toISOString(),
  });
  // Keep only last 100 errors
  if (errors.length > 100) {
    writeFile('errors', errors.slice(-100));
  } else {
    writeFile('errors', errors);
  }
}

/**
 * Get recent errors.
 * @param {number} limit
 * @returns {Array}
 */
function getErrors(limit = 10) {
  const errors = readFile('errors');
  return errors.slice(-Math.min(limit, errors.length));
}

module.exports = {
  cacheMessage,
  cacheGroup,
  cacheParticipant,
  getMessages,
  getGroup,
  getAllGroups,
  getAllParticipants,
  getLastSync,
  storeSummary,
  storeActionItem,
  storeApproval,
  logError,
  getErrors,
  ensureDir,
};
