/**
 * Phase 7D — bounded, in-process, non-persistent conversation/session store
 * (directive: "typed conversation/session model... restart persistence only
 * if justified by component audit"). Not justified here — see
 * docs/architecture/PHASE7D_COMPONENT_AUDIT.md's "Restart persistence"
 * section. This is a 7D-owned addition, reachable only from `gateway.ts`;
 * it does not replace, read, or write any of the 5 pre-existing
 * conversation-memory stores documented in that same audit.
 *
 * A turn never stores raw retrieved knowledge text — only citation
 * references (already-durable `CitationRef`s from the response) and small
 * counts, so factual content always resolves back through the canonical
 * KnowledgeRetrievalService/citation chain rather than being copied here.
 * A turn's `answerSummary` is taken from the response's `answer` AFTER
 * `scrubResponse()` has already run in gateway.ts — never a pre-scrub value.
 */
import type { CitationRef, JarvisResponse, RequestType, ResponseStatus } from './types';

const MAX_SESSIONS = 1000;
const MAX_TURNS_PER_SESSION = 20;
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours — matches the longest-lived of the 5 legacy stores (communication/conversation-memory.ts)
const ANSWER_SUMMARY_MAX_CHARS = 300;

export interface ConversationTurn {
  turnId: string;
  requestId: string;
  text: string;
  intent: RequestType;
  projectId: string | null;
  status: ResponseStatus;
  answerSummary: string;
  citationRefs: CitationRef[];
  truthCounts: { facts: number; inferences: number; unknowns: number; conflicts: number };
  timestamp: string;
}

export interface JarvisSession {
  sessionId: string;
  activeProjectId: string | null;
  turns: ConversationTurn[];
  createdAt: string;
  updatedAt: string;
}

interface StoredSession extends JarvisSession {
  expiresAt: number;
}

const store = new Map<string, StoredSession>();

function evictExpired(): void {
  const now = Date.now();
  for (const [id, session] of store) {
    if (session.expiresAt <= now) store.delete(id);
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Returns the existing session, or a fresh one — never throws on a
 *  never-seen sessionId, matching request-store's own "absent = null/empty"
 *  philosophy rather than a 404-shaped error for what is normal first-turn
 *  behavior. */
export function getOrCreateSession(sessionId: string): JarvisSession {
  evictExpired();
  const existing = store.get(sessionId);
  if (existing) return existing;

  if (store.size >= MAX_SESSIONS) {
    const oldestKey = store.keys().next().value;
    if (oldestKey) store.delete(oldestKey);
  }
  const now = new Date().toISOString();
  const fresh: StoredSession = {
    sessionId,
    activeProjectId: null,
    turns: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  store.set(sessionId, fresh);
  return fresh;
}

/** Read-only lookup — does NOT create a session, for the GET endpoint and
 *  for gateway.ts's read of session.activeProjectId before dispatch (which
 *  must never silently create session state for a caller just because they
 *  happened to pass a sessionId on an otherwise-unrelated request type). */
export function peekSession(sessionId: string): JarvisSession | null {
  evictExpired();
  return store.get(sessionId) ?? null;
}

/** Appends a turn (deterministic FIFO compaction — oldest turn dropped
 *  first once MAX_TURNS_PER_SESSION is exceeded, never an LLM summary) and
 *  updates activeProjectId only when this turn resolved one explicitly —
 *  never clears an existing activeProjectId just because a later turn
 *  didn't need a project (e.g. a SYSTEM_STATUS question mid-conversation
 *  must not silently drop the operator's active project context). */
export function recordTurn(sessionId: string, response: JarvisResponse, rawText: string): void {
  const session = getOrCreateSession(sessionId);
  const turn: ConversationTurn = {
    turnId: response.requestId,
    requestId: response.requestId,
    text: truncate(rawText, 4000),
    intent: response.intent,
    projectId: response.projectId,
    status: response.status,
    answerSummary: truncate(response.answer, ANSWER_SUMMARY_MAX_CHARS),
    citationRefs: response.citations,
    truthCounts: {
      facts: response.facts.length,
      inferences: response.inferences.length,
      unknowns: response.unknowns.length,
      conflicts: response.conflicts.length,
    },
    timestamp: response.generatedAt,
  };
  session.turns.push(turn);
  if (session.turns.length > MAX_TURNS_PER_SESSION) session.turns.shift();
  if (response.projectId) session.activeProjectId = response.projectId;
  session.updatedAt = turn.timestamp;
}

/** Test-only: reset store between test runs. */
export function _clearForTests(): void {
  store.clear();
}

/** Test-only: force a session to be treated as already-expired, for
 *  deterministic stale-context testing without waiting SESSION_TTL_MS. */
export function _expireForTests(sessionId: string): void {
  const session = store.get(sessionId);
  if (session) session.expiresAt = 0;
}
