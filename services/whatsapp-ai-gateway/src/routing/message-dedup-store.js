/**
 * Message Dedup Store — ensures one WhatsApp message_id triggers at most one response.
 *
 * Rules:
 *   - Store processed message_id with 24-hour TTL
 *   - Duplicate message_id must not trigger second response
 *   - Retries must update status, not send duplicate
 *
 * Uses an in-memory Map with periodic cleanup. No external DB dependency.
 */

const { makeLogger } = require('../logger');
const log = makeLogger('dedup');

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

/**
 * @typedef {'processing' | 'completed' | 'failed'} MessageStatus
 *
 * @typedef {Object} DedupEntry
 * @property {string} message_id
 * @property {string} chat_id
 * @property {string} owner_handler
 * @property {MessageStatus} status
 * @property {number} created_at
 * @property {number} updated_at
 */

class MessageDedupStore {
  constructor() {
    /** @type {Map<string, DedupEntry>} */
    this._store = new Map();
    this._cleanupTimer = null;
    this._startCleanup();
  }

  _startCleanup() {
    this._cleanupTimer = setInterval(() => {
      const cutoff = Date.now() - TTL_MS;
      let pruned = 0;
      for (const [key, entry] of this._store.entries()) {
        if (entry.created_at < cutoff) {
          this._store.delete(key);
          pruned++;
        }
      }
      if (pruned > 0) {
        log.info('Dedup store pruned', { pruned, remaining: this._store.size });
      }
    }, CLEANUP_INTERVAL_MS);
  }

  /**
   * Check if a message_id has already been processed.
   * @param {string} messageId
   * @returns {boolean}
   */
  isDuplicate(messageId) {
    if (!messageId) return false;
    const entry = this._store.get(messageId);
    if (!entry) return false;
    const age = Date.now() - entry.created_at;
    if (age > TTL_MS) {
      this._store.delete(messageId);
      return false;
    }
    return true;
  }

  /**
   * Claim a message_id for processing. Returns false if already claimed.
   *
   * @param {string} messageId
   * @param {string} chatId
   * @param {string} ownerHandler
   * @returns {{ claimed: boolean, existing?: DedupEntry }}
   */
  claim(messageId, chatId, ownerHandler) {
    if (!messageId) return { claimed: true, existing: null }; // no ID = always claim (legacy)
    const existing = this._store.get(messageId);
    if (existing) {
      const age = Date.now() - existing.created_at;
      if (age <= TTL_MS) {
        log.info('Dedup claim rejected — already processed', {
          messageId,
          owner: existing.owner_handler,
          status: existing.status,
        });
        return { claimed: false, existing };
      }
      // Expired — allow re-claim
      this._store.delete(messageId);
    }

    const now = Date.now();
    /** @type {DedupEntry} */
    const entry = {
      message_id: messageId,
      chat_id: chatId,
      owner_handler: ownerHandler,
      status: 'processing',
      created_at: now,
      updated_at: now,
    };
    this._store.set(messageId, entry);
    log.info('Dedup claim acquired', { messageId, owner: ownerHandler, chatId });
    return { claimed: true, existing: null };
  }

  /**
   * Update the status of a claimed message.
   *
   * @param {string} messageId
   * @param {MessageStatus} status
   * @param {Object} [extra]
   */
  updateStatus(messageId, status, extra = {}) {
    if (!messageId) return;
    const entry = this._store.get(messageId);
    if (!entry) return;
    entry.status = status;
    entry.updated_at = Date.now();
    Object.assign(entry, extra);
    log.info('Dedup status updated', { messageId, status, owner: entry.owner_handler });
  }

  /**
   * Get the current entry for a message_id.
   * @param {string} messageId
   * @returns {DedupEntry | undefined}
   */
  get(messageId) {
    return this._store.get(messageId);
  }

  /**
   * Get store stats.
   */
  getStats() {
    return {
      size: this._store.size,
      ttl_ms: TTL_MS,
    };
  }

  destroy() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    this._store.clear();
  }
}

// Singleton
const dedupStore = new MessageDedupStore();

module.exports = dedupStore;
