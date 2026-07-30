// Session state machine for the Food Safety WhatsApp flow.
// Sessions persist by WhatsApp chatId. Timeouts reset on every user message.

export const STATES = Object.freeze({
  IDLE: 'IDLE',
  WAITING_FOR_STORE_SELECTION: 'WAITING_FOR_STORE_SELECTION',
  WAITING_FOR_FORM_PHOTO: 'WAITING_FOR_FORM_PHOTO',
  OCR_PROCESSING: 'OCR_PROCESSING',
  OCR_REVIEW: 'OCR_REVIEW',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
});

// Timeout windows in milliseconds.
export const TIMEOUTS = Object.freeze({
  [STATES.WAITING_FOR_STORE_SELECTION]: 15 * 60 * 1000, // 15 minutes
  [STATES.WAITING_FOR_FORM_PHOTO]: 30 * 60 * 1000, // 30 minutes
});

// States considered "active" — while in any of these the router must never
// fall through to the generic fallback handler.
const ACTIVE_STATES = new Set([
  STATES.WAITING_FOR_STORE_SELECTION,
  STATES.WAITING_FOR_FORM_PHOTO,
  STATES.OCR_PROCESSING,
  STATES.OCR_REVIEW,
]);

export class SessionStore {
  /**
   * @param {object} [opts]
   * @param {() => number} [opts.now] - clock injection for tests
   */
  constructor(opts = {}) {
    this._sessions = new Map();
    this._now = opts.now || (() => Date.now());
  }

  /**
   * Get an existing session (does not create one).
   * Expires the session first if its timeout has elapsed.
   * @param {string} chatId
   */
  get(chatId) {
    const session = this._sessions.get(chatId);
    if (!session) return null;
    if (this._isExpired(session)) {
      this._expire(session);
    }
    return session;
  }

  /**
   * Start (or reset) a session for a chatId, moving it into store selection.
   * @param {string} chatId
   */
  start(chatId) {
    const now = this._now();
    const session = {
      chatId,
      state: STATES.WAITING_FOR_STORE_SELECTION,
      store: null,
      imagePath: null,
      ocr: null,
      record: null,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
    };
    this._sessions.set(chatId, session);
    return session;
  }

  /**
   * Transition a session to a new state and record activity (resets timeout).
   * @param {string} chatId
   * @param {string} state
   * @param {object} [patch] - extra fields to merge into the session
   */
  transition(chatId, state, patch = {}) {
    const session = this._sessions.get(chatId);
    if (!session) return null;
    if (!Object.values(STATES).includes(state)) {
      throw new Error(`Invalid session state: ${state}`);
    }
    session.state = state;
    Object.assign(session, patch);
    return this.touch(chatId);
  }

  /**
   * Record activity for a chatId, resetting its timeout window.
   * @param {string} chatId
   */
  touch(chatId) {
    const session = this._sessions.get(chatId);
    if (!session) return null;
    const now = this._now();
    session.updatedAt = now;
    session.lastActivityAt = now;
    return session;
  }

  /**
   * Whether the chat currently has an active (non-terminal) session.
   * @param {string} chatId
   */
  isActive(chatId) {
    const session = this.get(chatId);
    return !!session && ACTIVE_STATES.has(session.state);
  }

  /**
   * Remove a session entirely.
   * @param {string} chatId
   */
  clear(chatId) {
    this._sessions.delete(chatId);
  }

  /** Number of tracked sessions (test/diagnostic helper). */
  size() {
    return this._sessions.size;
  }

  _isExpired(session) {
    const window = TIMEOUTS[session.state];
    if (!window) return false; // states without a timeout never expire passively
    return this._now() - session.lastActivityAt > window;
  }

  _expire(session) {
    session.state = STATES.FAILED;
    session.failureReason = 'TIMEOUT';
    session.updatedAt = this._now();
  }
}
