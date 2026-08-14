/**
 * Phase 7D — session identity resolution. Sessions are opt-in and never
 * silently inferred: a `remote_session` caller gets continuity for free via
 * their already-persisted `device_id` (remote/remote-auth.ts) — the same
 * identity primitive Command Center auth already relies on, not a new one.
 * An `api_key` caller has no stable per-caller identity anywhere in this
 * codebase and gets none invented here; it only gets continuity if it
 * explicitly passes its own `sessionId` in the request body. A request with
 * neither resolves to `null` and behaves exactly as it did in Phase 7C —
 * stateless, no session recorded, no context carried.
 */
import type { CallerIdentity } from './types';

export function resolveSessionId(caller: CallerIdentity, explicitSessionId?: string): string | null {
  // Prefixed by source so an api_key caller can never forge/collide with a
  // real device's session key: an api_key-supplied string always lands
  // under `explicit:...` even if it literally contains the text
  // "device:<id>" — only an authenticated remote_session request (server-
  // derived deviceId, never client-suppliable) can ever produce a bare
  // `device:...` key.
  if (caller.source === 'remote_session' && caller.deviceId) {
    return `device:${caller.deviceId}`;
  }
  if (explicitSessionId && explicitSessionId.trim().length > 0) {
    return `explicit:${explicitSessionId.trim()}`;
  }
  return null;
}
