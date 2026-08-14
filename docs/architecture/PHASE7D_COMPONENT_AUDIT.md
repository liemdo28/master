# Phase 7D — Component Audit & Canonical-Owner Map

Date: 2026-08-14

## Reality audit

`server/src/jarvis-gateway/` (Phase 7C) has **zero** conversation memory today.
`request-store.ts` is a write-only-after-the-fact, 500-entry/30-min-TTL cache
that exists solely to answer `GET /jarvis/request/:id` for a request just
made — no handler reads it, nothing carries context from one request to the
next (confirmed: only `gateway.ts` and `router.ts` reference it anywhere
under `jarvis-gateway/`). `JarvisRequest`/`JarvisResponse` have no
`sessionId`/`conversationId` field. Command Center's `JarvisPage.tsx` keeps
a client-side-only React array (max 50, no persistence, lost on reload) and
sends no prior turns with a new request — each question is answered with
zero awareness of what came before.

## Component/duplication audit — the 5 (+1) pre-existing stores

`PHASE7C_COMPONENT_AUDIT.md` §6 found 5 independent conversation-memory
stores; re-verified live in this worktree, all still present, all still
mutually independent (no shared state), **none reachable from
`jarvis-gateway/`**:

| # | Store | Shape | Persistence | Scope | Sole caller |
|---|---|---|---|---|---|
| 1 | `personal-os/operating/store.ts` (`personal-os.db`) | Date-keyed brief/plan/review JSON records — **not** turn-based, no `role`/`text` concept | SQLite, disk | Date-keyed, project-adjacent | `personal-os/operating/loop.ts`/`brief.ts` |
| 2 | `chat/conversation-store.ts` | `{role,content}` turns, cap 100 | SQLite (`conversations.db`), disk, 24h TTL | Global, session_id only | `routes/chat.ts` (legacy `/api/chat`) |
| 3 | `communication/conversation-memory.ts` | Turns + entity/topic state, cap 20 | In-memory `Map`, 4h TTL | Global, phone-keyed | `communication/natural-conversation-engine.ts` (WhatsApp) |
| 4 | `jarvis/phase30-jarvis/conversation-store.ts` | Turns + hardcoded entity map, cap 20 | In-memory `Map`, 30min TTL | Global, sender-keyed | `jarvis-core.ts` (legacy WhatsApp path) |
| 5 | `jarvis/executive/context-engine.ts` | Turns + pronoun resolution, cap 10 | In-memory `Map`, no TTL | Global, sender-keyed | `executive-personality.ts` (same call chain as #4, unsynchronized) |
| — | `coo-v4/durable-workflow.ts` | Workflow/step/signal state, not conversational | SQLite (`workflows.db`), disk | Global | `routes/coo-v4-router.ts` (quarantined orchestrator) |

**Decision**: build ONE new, Gateway-owned session store. This does not
duplicate a *canonical domain* system (Tasks/Projects/Knowledge/Health/
Governance/Coding/Simulation/Controlled-Actions/Delegation/Orchestration are
untouched) — conversation/session state was never canonically owned by
anything the Gateway can call into; #1–#5 are all legacy, WhatsApp/chat-
specific, mutually incompatible in shape, and #3/#4/#5 sit directly in the
call chain of code Phase 7C already quarantined from mutation. Reusing any
of them would either reach into legacy/quarantined-adjacent territory or
force an incompatible shape onto the Gateway. None are touched, removed, or
modified by this phase.

## Canonical-owner map (additions)

| Concern | Owner |
|---|---|
| Conversation/session state (Gateway-scoped) | **NEW**: `jarvis-gateway/session-store.ts` |
| Session identity resolution | **NEW**: `jarvis-gateway/session-resolver.ts`, built on the *existing* `CallerIdentity`/`device_id` primitive (`remote/remote-auth.ts`), not a new auth concept |
| Project/workspace context resolution | **REUSED**: `jarvis-gateway/project-resolver.ts` (4-state: `RESOLVED`/`AMBIGUOUS`/`UNKNOWN`/`NOT_APPLICABLE`) — the session model wraps it, never reimplements matching logic |
| Factual knowledge reference | **REUSED**: `JarvisResponse.citations` (`CitationRef[]`, already durable — `documentId`/`chunkId`/`chunkContentHash`) |
| Response scrubbing | **REUSED**: `scrubReply()` (`middleware/response-scrubber.ts`) — turn summaries are derived from the already-scrubbed response, never from a pre-scrub value |

## Security-boundary review

- No conversation turn is ever fed into `askAi()` (`INFORMATION` handler) —
  scoped out of Phase 7D explicitly. Turns carry project-context and
  citation-ref provenance only, never raw text back into a model prompt.
  Feeding stored turns into an LLM prompt would open a new prompt-injection
  surface requiring its own dedicated red-team pass (Phase 7T's job, not
  7D's) — deferring that surface entirely rather than opening it half-done.
- Session context may only ever *fill in* an omitted `projectId` for
  request types that already resolve one deterministically
  (`project-resolver.ts`'s existing `NOT_APPLICABLE`/`RESOLVED` logic,
  unchanged). It can never bypass `ACTION_PROPOSAL`'s
  always-ask-for-exact-fields rule, never auto-approve, never influence
  authority/policy/governance decisions — those remain governed exclusively
  by the same canonical subsystems 7C already dispatches to.
- Session identity for `remote_session` callers reuses the existing,
  persisted `device_id` (survives restart and re-login by design already).
  `api_key` callers have no stable per-caller identity in this codebase
  today (`CallerIdentity.deviceId` is `undefined` for them) — Phase 7D does
  not invent one; an `api_key` caller only gets session continuity if it
  explicitly supplies its own `sessionId` in the request body. No implicit
  cross-request identity is ever inferred for anonymous API-key callers.
- **Sessions are opt-in.** A request with no resolvable session identity
  (`api_key` caller with no explicit `sessionId`, e.g. every existing
  security/evaluation test) behaves exactly as it did in Phase 7C —
  stateless, no context carried. This is a deliberate backward-compatibility
  boundary, not an oversight.

## Baseline measurements

- Clean worktree at post-7C-merge master (`6952b568`): `npx tsc --noEmit`
  clean, matching the frozen Phase 7C state exactly.
- `request-store.ts`'s existing eviction pattern (lazy `evictExpired()` on
  every write/read, oldest-first on cap) is the baseline the new
  `session-store.ts` reuses, not reinvents.

## Restart persistence — explicitly not justified

Per the directive's "restart persistence only if justified by component
audit": **not justified here**. Sessions are in-memory only, matching
`request-store.ts`'s own precedent and 3 of the 4 turn-based legacy stores
(#3/#4/#5). Reasons: (1) Phase 7C explicitly deferred full conversation-
memory consolidation rather than committing to a persistence model; (2)
turns are inherently recency-scoped and bounded — old turns are already
dropped on cap regardless of restart; (3) a new SQLite store would be new
schema surface with no existing session DB in the Gateway's domain to
extend, contradicting "reuse canonical owners, do not redesign"; (4) nothing
about correctness or safety depends on a session surviving a restart — a
lost session degrades gracefully back to Phase 7C's stateless behavior, it
never causes a wrong or unsafe answer.
