/**
 * WhatsApp Session Manager — Central Owner-Locked Session Controller
 * 
 * Phase 21.7: Session & Context Isolation Hard Fix
 *
 * Hard rules:
 *   - ONE chat_id + sender_phone can have ONE active owner at a time
 *   - When Mi-Core claims a session, all other owners are closed
 *   - Every handler MUST call assertOwner() before processing
 *   - Owner values: mi_core | food_safety | marketing_preview | approval | team_support | unknown
 *
 * Canonical session key: chatId + senderPhone + owner
 * Owner lock: only one owner active per chatId + senderPhone
 */

const { makeLogger } = require('../logger');
const log = makeLogger('session-manager');

// ── Owner Types ─────────────────────────────────────────────────────────────
const OWNERS = Object.freeze({
  MI_CORE: 'mi_core',
  FOOD_SAFETY: 'food_safety',
  MARKETING_PREVIEW: 'marketing_preview',
  APPROVAL: 'approval',
  TEAM_SUPPORT: 'team_support',
  UNKNOWN: 'unknown',
});

const SESSION_STATUS = Object.freeze({
  ACTIVE: 'active',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
  BLOCKED: 'blocked',
});

const SESSION_TTL_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

class WhatsAppSessionManager {
  constructor() {
    this._sessions = new Map();
    this._cleanupTimer = null;
    this._startCleanup();
    this._traceLog = [];
    log.info('WhatsApp Session Manager initialized');
  }

  static lockKey(chatId, senderPhone) {
    return `${chatId || ''}::${senderPhone || ''}`;
  }

  static sessionKey(chatId, senderPhone, owner) {
    return `${chatId || ''}::${senderPhone || ''}::${owner}`;
  }

  getSession(chatId, senderPhone, owner) {
    const key = WhatsAppSessionManager.lockKey(chatId, senderPhone);
    const session = this._sessions.get(key);
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      session.status = SESSION_STATUS.EXPIRED;
      this._sessions.delete(key);
      log.info('Session auto-expired', { chatId, senderPhone, owner: session.owner });
      return null;
    }
    if (owner && session.owner !== owner) return null;
    if (session.status !== SESSION_STATUS.ACTIVE) return null;
    return session;
  }

  setSession(record) {
    const key = WhatsAppSessionManager.lockKey(record.chatId, record.senderPhone);
    const now = new Date().toISOString();
    const closedOwners = this._closeOtherOwnersLocked(record.chatId, record.senderPhone, record.owner);

    const session = {
      sessionKey: WhatsAppSessionManager.sessionKey(record.chatId, record.senderPhone, record.owner),
      chatId: record.chatId,
      senderPhone: record.senderPhone,
      owner: record.owner,
      workflow: record.workflow || 'general',
      status: SESSION_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      lastMessageId: record.lastMessageId || null,
      metadata: record.metadata || null,
    };

    this._sessions.set(key, session);

    this._trace('SESSION_SET', {
      chatId: record.chatId,
      senderPhone: record.senderPhone,
      owner: record.owner,
      workflow: record.workflow,
      closedOwners,
    });

    log.info('Session set', {
      chatId: record.chatId,
      senderPhone: record.senderPhone,
      owner: record.owner,
      workflow: record.workflow,
      closedOwners,
    });

    return session;
  }

  closeSession(chatId, senderPhone, owner) {
    const key = WhatsAppSessionManager.lockKey(chatId, senderPhone);
    const existing = this._sessions.get(key);
    if (!existing || existing.owner !== owner) return false;
    existing.status = SESSION_STATUS.COMPLETED;
    existing.updatedAt = new Date().toISOString();
    this._sessions.delete(key);
    this._trace('SESSION_CLOSED', { chatId, senderPhone, owner, reason: 'explicit_close' });
    log.info('Session closed', { chatId, senderPhone, owner });
    return true;
  }

  closeOtherOwners(chatId, senderPhone, keepOwner) {
    return this._closeOtherOwnersLocked(chatId, senderPhone, keepOwner);
  }

  getActiveOwner(chatId, senderPhone) {
    const key = WhatsAppSessionManager.lockKey(chatId, senderPhone);
    const session = this._sessions.get(key);
    if (!session) return null;
    if (session.status !== SESSION_STATUS.ACTIVE) return null;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      session.status = SESSION_STATUS.EXPIRED;
      this._sessions.delete(key);
      return null;
    }
    return session.owner;
  }

  assertOwner(chatId, senderPhone, owner) {
    const activeOwner = this.getActiveOwner(chatId, senderPhone);
    if (!activeOwner) {
      return { allowed: true, activeOwner: null, reason: 'no_active_session' };
    }
    if (activeOwner === owner) {
      return { allowed: true, activeOwner, reason: 'same_owner' };
    }
    this._trace('OWNER_BLOCKED', {
      requestedOwner: owner,
      activeOwner,
      chatId,
      senderPhone,
    });
    log.warn('Owner assertion blocked', {
      chatId,
      senderPhone,
      requestedOwner: owner,
      activeOwner,
    });
    return { allowed: false, activeOwner, reason: 'different_owner_active' };
  }

  touchActivity(chatId, senderPhone) {
    const key = WhatsAppSessionManager.lockKey(chatId, senderPhone);
    const session = this._sessions.get(key);
    if (!session) return;
    session.updatedAt = new Date().toISOString();
    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  }

  hasActiveSession(chatId, senderPhone, owner) {
    const session = this.getSession(chatId, senderPhone, owner);
    return !!session && session.status === SESSION_STATUS.ACTIVE;
  }

  hasAnyActiveSession(chatId, senderPhone) {
    return this.getActiveOwner(chatId, senderPhone) !== null;
  }

  getActiveSessions() {
    const now = Date.now();
    const result = [];
    for (const [key, session] of this._sessions.entries()) {
      if (session.status === SESSION_STATUS.ACTIVE && new Date(session.expiresAt).getTime() > now) {
        result.push({ ...session });
      }
    }
    return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getStats() {
    let active = 0;
    for (const session of this._sessions.values()) {
      if (session.status === SESSION_STATUS.ACTIVE) active++;
    }
    return { total: this._sessions.size, active };
  }

  getTraceLog(limit = 50) {
    return this._traceLog.slice(-limit);
  }

  _closeOtherOwnersLocked(chatId, senderPhone, keepOwner) {
    const closedOwners = [];
    const key = WhatsAppSessionManager.lockKey(chatId, senderPhone);
    const existing = this._sessions.get(key);
    if (existing && existing.owner !== keepOwner) {
      existing.status = SESSION_STATUS.BLOCKED;
      existing.updatedAt = new Date().toISOString();
      closedOwners.push(existing.owner);
      this._sessions.delete(key);
      this._trace('OWNER_CLOSED', {
        chatId,
        senderPhone,
        closedOwner: existing.owner,
        reason: 'replaced_by_' + keepOwner,
      });
      log.info('Owner session closed for new owner', {
        chatId,
        senderPhone,
        closedOwner: existing.owner,
        newOwner: keepOwner,
      });
    }
    return closedOwners;
  }

  _startCleanup() {
    this._cleanupTimer = setInterval(() => {
      const now = Date.now();
      let pruned = 0;
      for (const [key, session] of this._sessions.entries()) {
        if (new Date(session.expiresAt).getTime() < now || session.status === SESSION_STATUS.EXPIRED) {
          this._sessions.delete(key);
          pruned++;
        }
      }
      if (pruned > 0) {
        log.info('Session store pruned', { pruned, remaining: this._sessions.size });
      }
    }, CLEANUP_INTERVAL_MS);
  }

  _trace(event, detail) {
    const entry = { ts: new Date().toISOString(), event, ...detail };
    this._traceLog.push(entry);
    if (this._traceLog.length > 500) this._traceLog.splice(0, 300);
  }

  destroy() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
      this._cleanupTimer = null;
    }
    this._sessions.clear();
  }
}

const instance = new WhatsAppSessionManager();
module.exports = instance;
module.exports.WhatsAppSessionManager = WhatsAppSessionManager;
module.exports.OWNERS = OWNERS;
module.exports.SESSION_STATUS = SESSION_STATUS;
