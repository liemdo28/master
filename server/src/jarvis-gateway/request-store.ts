/**
 * Phase 7C — minimal request/response retrieval store (directive §24, §47).
 *
 * The component audit (docs/architecture/PHASE7C_COMPONENT_AUDIT.md §6)
 * found FIVE already-independent conversation-memory stores in this
 * codebase. Phase 7C does not add a sixth persistent one: full memory
 * consolidation is explicitly deferred to Phase 7D (§24). This is a bounded,
 * in-process, non-persistent cache — it exists only so `GET
 * /api/jarvis/request/:id` can return a response shortly after `POST
 * /api/jarvis/request` created it (e.g. a client that lost the initial
 * response). It is NOT a conversation history feature and does not survive
 * a process restart. Schema stays v10 — no new database, no new table.
 */
import type { JarvisRequest, JarvisResponse } from './types';

const MAX_ENTRIES = 500;
const TTL_MS = 30 * 60 * 1000; // 30 minutes

interface Entry {
  request: JarvisRequest;
  response: JarvisResponse;
  expiresAt: number;
}

const store = new Map<string, Entry>();

function evictExpired(): void {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (entry.expiresAt <= now) store.delete(id);
  }
}

export function recordRequest(request: JarvisRequest, response: JarvisResponse): void {
  evictExpired();
  if (store.size >= MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey) store.delete(oldestKey);
  }
  store.set(request.requestId, { request, response, expiresAt: Date.now() + TTL_MS });
}

export function getRequest(requestId: string): { request: JarvisRequest; response: JarvisResponse } | null {
  evictExpired();
  const entry = store.get(requestId);
  return entry ? { request: entry.request, response: entry.response } : null;
}

/** Test-only: reset store between test runs. */
export function _clearForTests(): void {
  store.clear();
}
