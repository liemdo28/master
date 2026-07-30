/**
 * Agent Session Manager
 *
 * Manages /ldagent group sessions:
 *   - One active session per chatId (group or direct)
 *   - Session owner lock: only owner can control the active session
 *   - State machine: IDLE → WAITING_STORE → MENU → WORKFLOW_ACTIVE → WAITING_MORE → CLOSED
 *   - Timeout tracked via expiresAt
 *   - In-memory store + SQLite persistence
 *
 * Session key: chatId  (one per group, one per direct chat user)
 */

const { run, all, get } = require('../storage/sqlite');
const { makeLogger }    = require('../logger');
const log = makeLogger('whatsapp');

// ── In-memory store ────────────────────────────────────────────────────────────
const sessions = new Map(); // chatId → session

// ── Session state constants ────────────────────────────────────────────────────
const STATES = {
  WAITING_STORE:   'WAITING_STORE',
  MENU:            'MENU',
  WORKFLOW_ACTIVE: 'WORKFLOW_ACTIVE',
  WAITING_MORE:    'WAITING_MORE',
  CLOSED:          'CLOSED',
};

const CLOSE_REASONS = {
  USER_END:    'USER_END',
  USER_NO:     'USER_NO',
  TIMEOUT:     'TIMEOUT',
  FORCE_CLOSE: 'FORCE_CLOSE',
};

// ── Timeout config ─────────────────────────────────────────────────────────────
function getTimeoutMs() {
  return parseInt(process.env.SESSION_TIMEOUT_MINUTES || '5', 10) * 60_000;
}

// ── Session ID ─────────────────────────────────────────────────────────────────
function makeSessionId(chatId) {
  return `${chatId.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`;
}

// ── Create ─────────────────────────────────────────────────────────────────────
async function createSession({ chatId, isGroup, groupName, ownerId, ownerName, store = null, storeId = null, language = 'en' }) {
  // Close any existing session first
  const existing = sessions.get(chatId);
  if (existing) await closeSession(chatId, CLOSE_REASONS.FORCE_CLOSE, false);

  const now        = new Date().toISOString();
  const timeoutMs  = getTimeoutMs();
  const sessionId  = makeSessionId(chatId);
  const state      = store ? STATES.MENU : STATES.WAITING_STORE;

  const session = {
    sessionId, chatId, isGroup,
    groupName: groupName || '',
    ownerId, ownerName: ownerName || ownerId,
    store, storeId, language,
    state,
    activeWorkflow: null,
    workflowData: null,   // opaque blob for the active workflow
    startedAt: now,
    lastActivityAt: now,
    expiresAt: new Date(Date.now() + timeoutMs).toISOString(),
    timeoutMs,
  };

  sessions.set(chatId, session);

  // Persist to DB (non-blocking)
  run(
    `INSERT OR REPLACE INTO agent_sessions
     (session_id, chat_id, owner_id, owner_name, store, state, active_workflow, started_at, last_activity_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [sessionId, chatId, ownerId, ownerName || ownerId, store, state, null, now, now]
  ).catch(err => log.warn('Agent session DB insert failed', { error: err.message }));

  log.info('Agent session created', { sessionId, chatId, ownerId, state });
  return session;
}

// ── Read ──────────────────────────────────────────────────────────────────────
function getSession(chatId) {
  return sessions.get(chatId) || null;
}

function hasSession(chatId) {
  const s = sessions.get(chatId);
  return !!s && s.state !== STATES.CLOSED;
}

function isOwner(chatId, senderId) {
  const s = sessions.get(chatId);
  if (!s) return false;
  return s.ownerId === senderId;
}

// ── Update ────────────────────────────────────────────────────────────────────
function touchActivity(chatId) {
  const s = sessions.get(chatId);
  if (!s) return;
  const now = new Date().toISOString();
  s.lastActivityAt = now;
  s.expiresAt = new Date(Date.now() + s.timeoutMs).toISOString();
  run(`UPDATE agent_sessions SET last_activity_at=? WHERE session_id=?`, [now, s.sessionId]).catch(() => {});
}

function setState(chatId, state) {
  const s = sessions.get(chatId);
  if (!s) return;
  s.state = state;
  touchActivity(chatId);
  run(`UPDATE agent_sessions SET state=? WHERE session_id=?`, [state, s.sessionId]).catch(() => {});
}

function setStore(chatId, store) {
  const s = sessions.get(chatId);
  if (!s) return;
  s.store = store;
  run(`UPDATE agent_sessions SET store=? WHERE session_id=?`, [store, s.sessionId]).catch(() => {});
}

function setLanguage(chatId, language) {
  const s = sessions.get(chatId);
  if (!s) return;
  s.language = language || 'en';
  touchActivity(chatId);
}

function setWorkflow(chatId, workflow, workflowData = null) {
  const s = sessions.get(chatId);
  if (!s) return;
  s.activeWorkflow = workflow;
  s.workflowData   = workflowData;
  s.state = STATES.WORKFLOW_ACTIVE;
  touchActivity(chatId);
  run(`UPDATE agent_sessions SET active_workflow=?, state=? WHERE session_id=?`,
    [workflow, STATES.WORKFLOW_ACTIVE, s.sessionId]).catch(() => {});
}

function clearWorkflow(chatId) {
  const s = sessions.get(chatId);
  if (!s) return;
  s.activeWorkflow = null;
  s.workflowData   = null;
  touchActivity(chatId);
}

// ── Close ─────────────────────────────────────────────────────────────────────
async function closeSession(chatId, reason = CLOSE_REASONS.USER_END, saveDraft = true) {
  const s = sessions.get(chatId);
  if (!s) return null;

  const now = new Date().toISOString();
  s.state = STATES.CLOSED;
  sessions.delete(chatId);

  await run(
    `UPDATE agent_sessions SET state='CLOSED', closed_at=?, close_reason=? WHERE session_id=?`,
    [now, reason, s.sessionId]
  ).catch(() => {});

  // If workflow was active and not confirmed, mark draft as ABANDONED
  if (saveDraft && s.activeWorkflow && s.workflowData && reason === CLOSE_REASONS.TIMEOUT) {
    await run(
      `INSERT INTO workflow_drafts (session_id, workflow, payload_json, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?)`,
      [s.sessionId, s.activeWorkflow, JSON.stringify(s.workflowData), 'ABANDONED', s.startedAt, now]
    ).catch(() => {});
    log.warn('Workflow draft abandoned on timeout', { sessionId: s.sessionId, workflow: s.activeWorkflow });
  }

  log.info('Agent session closed', { sessionId: s.sessionId, chatId, reason });
  return s;
}

// ── Save confirmed draft ──────────────────────────────────────────────────────
async function saveConfirmedDraft(chatId, workflow, payload) {
  const s = sessions.get(chatId);
  const sessionId = s?.sessionId || 'unknown';
  const now = new Date().toISOString();
  await run(
    `INSERT INTO workflow_drafts (session_id, workflow, payload_json, status, created_at, updated_at)
     VALUES (?,?,?,?,?,?)`,
    [sessionId, workflow, JSON.stringify(payload), 'CONFIRMED', now, now]
  ).catch(() => {});
}

// ── Timeout check ─────────────────────────────────────────────────────────────
function getExpiredSessions() {
  const now = Date.now();
  const expired = [];
  for (const [chatId, s] of sessions.entries()) {
    if (s.state !== STATES.CLOSED && new Date(s.expiresAt).getTime() < now) {
      expired.push({ chatId, session: s });
    }
  }
  return expired;
}

// ── Dashboard data ────────────────────────────────────────────────────────────
function getAllActiveSessions() {
  const result = [];
  for (const [chatId, s] of sessions.entries()) {
    if (s.state !== STATES.CLOSED) result.push({ ...s });
  }
  return result.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function getActiveCount() {
  let count = 0;
  for (const s of sessions.values()) {
    if (s.state !== STATES.CLOSED) count++;
  }
  return count;
}

// ── Recent sessions from DB ───────────────────────────────────────────────────
async function getRecentSessions(limit = 20) {
  return all(`SELECT * FROM agent_sessions ORDER BY id DESC LIMIT ?`, [limit]);
}

async function getRecentDrafts(limit = 20) {
  return all(`SELECT * FROM workflow_drafts ORDER BY id DESC LIMIT ?`, [limit]);
}

module.exports = {
  STATES, CLOSE_REASONS,
  createSession, getSession, hasSession, isOwner,
  touchActivity, setState, setStore, setLanguage, setWorkflow, clearWorkflow,
  closeSession, saveConfirmedDraft,
  getExpiredSessions, getAllActiveSessions, getActiveCount,
  getRecentSessions, getRecentDrafts,
};
