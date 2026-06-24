/**
 * WhatsApp Send Guard — Single-Response Enforcement
 * 
 * Phase 21.7: Session & Context Isolation Hard Fix
 *
 * Hard rule: Each inbound message_id can trigger at most ONE outbound response.
 * If a second send is attempted for the same message_id, it is BLOCKED.
 */

const { makeLogger } = require('../logger');
const log = makeLogger('send-guard');

const GUARD_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000;

class WhatsAppSendGuard {
  constructor() {
    /** @type {Map<string, { messageId: string, owner: string, responseType: string, timestamp: number, blockedCount: number }>} */
    this._sent = new Map();
    this._cleanupTimer = null;
    this._startCleanup();
  }

  /**
   * Begin tracking an outbound response for a given inbound message.
   * Must be called before sending.
   * @param {string} messageId - inbound message ID
   * @param {string} owner - which owner is sending (mi_core, food_safety, etc.)
   * @param {string} responseType - type of response (text, image, approval_checklist)
   * @returns {{ canSend: boolean, reason: string }}
   */
  beginMessage(messageId, owner, responseType) {
    if (!messageId) return { canSend: true, reason: 'no_message_id' };

    const existing = this._sent.get(messageId);
    if (existing && (Date.now() - existing.timestamp) < GUARD_TTL_MS) {
      // Already sent a response for this message
      existing.blockedCount++;
      log.warn('SEND_BLOCKED_DUPLICATE', {
        messageId,
        existingOwner: existing.owner,
        newOwner: owner,
        responseType,
        blockedCount: existing.blockedCount,
      });
      return { canSend: false, reason: 'already_sent' };
    }

    this._sent.set(messageId, {
      messageId,
      owner,
      responseType,
      timestamp: Date.now(),
      blockedCount: 0,
    });

    return { canSend: true, reason: 'first_send' };
  }

  /**
   * Record that a send was completed.
   */
  recordSend(messageId, owner, responseType) {
    if (!messageId) return;
    this._sent.set(messageId, {
      messageId,
      owner,
      responseType,
      timestamp: Date.now(),
      blockedCount: 0,
    });
  }

  /**
   * Check if a message has already been responded to.
   */
  canSend(messageId) {
    if (!messageId) return true;
    const existing = this._sent.get(messageId);
    if (!existing) return true;
    if ((Date.now() - existing.timestamp) >= GUARD_TTL_MS) return true;
    return false;
  }

  /**
   * Get stats for monitoring.
   */
  getStats() {
    let blocked = 0;
    for (const entry of this._sent.values()) {
      if (entry.blockedCount > 0) blocked++;
    }
    return { tracked: this._sent.size, blocked };
  }

  _startCleanup() {
    this._cleanupTimer = setInterval(() => {
      const cutoff = Date.now() - GUARD_TTL_MS;
      let pruned = 0;
      for (const [key, entry] of this._sent.entries()) {
        if (entry.timestamp < cutoff) {
          this._sent.delete(key);
          pruned++;
        }
      }
      if (pruned > 0) {
        log.info('Send guard pruned', { pruned, remaining: this._sent.size });
      }
    }, CLEANUP_INTERVAL_MS);
  }

  destroy() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    this._sent.clear();
  }
}

const instance = new WhatsAppSendGuard();
module.exports = instance;
module.exports.WhatsAppSendGuard = WhatsAppSendGuard;
