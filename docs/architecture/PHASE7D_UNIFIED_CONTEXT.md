# Phase 7D — Unified Context & Conversation State

Date: 2026-08-14

## The invariant (locked, not just documented)

> `SessionStore = ephemeral transport/conversation continuity only; not
> user memory, not knowledge, not evidence, not authority, not durable
> source of truth.`

This is Phase 7D's central design constraint, and it is proven
structurally by `phase7d-session-invariant.test.ts` (permanent regression,
runs on every `test:jarvis-session-security` invocation), not merely
asserted in prose:

- `session-store.ts` and `session-resolver.ts` import **nothing at runtime**
  except type-only imports from `./types` — no `TaskStore`,
  `ProjectRegistryService`, `KnowledgeRetrievalService`,
  `ControlledActionService`, `GovernedOrchestrationService`,
  `AutomationSimulationService`, `OperatorControlService`,
  `EvidenceService`, delegation/policy/approval modules, `better-sqlite3`,
  or any file-write API. If either file ever gains such an import, the
  test fails immediately — that would be the first sign of the session
  store quietly growing into a 6th memory/authority system, and it's
  caught before it can happen silently.
- Nothing under `jarvis-gateway/` ever reads a session to decide policy,
  risk, approval, or execution. `ACTION_PROPOSAL` always asks for exact
  fields regardless of session history; `SIMULATION` always stays
  `SIMULATED`; `CODING` never mutates; `PLANNING` never fabricates a plan —
  all four proven by dedicated test scenarios in
  `phase7d-jarvis-session.test.ts`'s "zero authority effect" block.
- A session is never a citation source, never an evidence record, never a
  knowledge document. `ConversationTurn.citationRefs` stores only the
  already-durable `CitationRef`s a response already carried (`documentId`/
  `chunkId`/`chunkContentHash`) — the session never becomes a second place
  a fact "lives," it only remembers *which* facts a past turn pointed to.

## Why a new store at all, given 5 already exist

`PHASE7D_COMPONENT_AUDIT.md` re-verified all 5 pre-existing conversation-
memory stores (`chat/conversation-store.ts`, `communication/
conversation-memory.ts`, `jarvis/phase30-jarvis/conversation-store.ts`,
`jarvis/executive/context-engine.ts`, plus `personal-os.db`'s
operating-loop records) are still independent, mutually incompatible in
shape, legacy-WhatsApp/chat-specific, and — critically — **none are
reachable from `jarvis-gateway/`**. Three of the four turn-based ones sit
directly in the call chain of code Phase 7C already quarantined from
mutation. Reusing any of them would mean either reaching into
quarantined-adjacent legacy territory or forcing an incompatible shape onto
the Gateway. `SessionStore` is not a "6th memory system" in the sense the
5 are — those 5 store durable-ish conversational history as a feature in
their own right; `SessionStore` stores nothing that isn't already produced
and owned by a canonical subsystem, and forgets it within a bounded window
by design. The distinguishing test: **if `SessionStore` vanished entirely,
every canonical subsystem's data would be exactly as complete and correct
as before** — only conversational convenience (not having to repeat a
project reference) would be lost. That is not true of any of the 5 legacy
stores, each of which is the *only* record of what it stores.

## What it actually is

`server/src/jarvis-gateway/session-store.ts`: a bounded, in-process,
non-persistent `Map<sessionId, JarvisSession>` (max 1000 sessions, max 20
turns/session, 4h TTL, lazy eviction — same pattern `request-store.ts`
already established in Phase 7C).

```ts
interface JarvisSession {
  sessionId: string;
  activeProjectId: string | null;
  turns: ConversationTurn[];
  createdAt: string;
  updatedAt: string;
}
interface ConversationTurn {
  turnId: string; requestId: string; text: string;
  intent: RequestType; projectId: string | null; status: ResponseStatus;
  answerSummary: string;           // truncated, POST-scrub copy of answer
  citationRefs: CitationRef[];     // references only, never raw retrieved text
  truthCounts: { facts: number; inferences: number; unknowns: number; conflicts: number };
  timestamp: string;
}
```

`answerSummary` is taken from `JarvisResponse.answer` **after**
`scrubResponse()` has already run in `gateway.ts` — a turn can never carry
an unscrubbed value forward.

## Session identity — reuses existing auth, invents nothing new

`server/src/jarvis-gateway/session-resolver.ts`:

- `remote_session` callers (Command Center, PIN-authenticated) get
  continuity automatically via their already-persisted `device_id`
  (`remote/remote-auth.ts` — survives session-token expiry and process
  restart by existing design, unrelated to this phase). Zero client change
  needed; the server derives `device:<deviceId>` itself from the trusted
  Express `req.device_id` property, which only `requireRemoteAuth`
  middleware ever sets — never client input, proven live by
  `phase7d-jarvis-session-security.test.ts`'s forged-`device_id`-in-body
  test.
- `api_key` callers have no stable per-caller identity anywhere in this
  codebase (one shared key). They get continuity only by explicitly
  passing their own `sessionId`, prefixed `explicit:...` — this is
  deliberately caller-managed and known to be shareable by two different
  api_key integrations that happen to pass the same string (documented,
  tested, not a bug: there is no stronger identity to bind to without
  inventing a new auth system, which is explicitly out of scope).
- Prefixing (`device:` vs `explicit:`) makes forgery structurally
  impossible: an api_key caller's string always lands under `explicit:`,
  even if it literally contains the text `device:<id>` — only an
  authenticated `remote_session` request can ever produce a bare
  `device:...` key.
- Sessions are **opt-in**. A request with no resolvable session identity
  behaves exactly as Phase 7C did — stateless, `sessionId: null` in the
  response, nothing recorded. Every existing 7C test, the 530-fixture
  evaluation, and every production integration that doesn't pass
  `sessionId` is unaffected.

## Context switching — unblock, never override, never narrow

Session context has exactly one effect on dispatch, in `gateway.ts`:

```ts
if (requiresProject && resolution.status === 'UNKNOWN' && !request.projectId && session?.activeProjectId) {
  resolution = { status: 'RESOLVED', projectId: session.activeProjectId };
}
```

- Only fires for `CODING`/`KNOWLEDGE_SEARCH` (`PROJECT_REQUIRED_TYPES`) —
  the two types that would otherwise return `NEEDS_CLARIFICATION`.
- Never fires when an explicit `projectId` was supplied — that always wins,
  and updates `session.activeProjectId` for later turns.
- Never fires when free text already resolved a project on its own
  (`RESOLVED`) or matched more than one (`AMBIGUOUS` — session context
  never silently disambiguates).
- Deliberately does **not** extend to `TASK_QUERY`/`PROJECT_QUERY`/
  `GOAL_QUERY`/`OPERATOR_QUERY`/`SIMULATION`/`PLANNING` — those already
  work with no project (`NOT_APPLICABLE`, global scope), and giving session
  context the power to narrow an already-working "show everything" answer
  would be a silent behavior change, not a convenience. Proven by test: a
  `TASK_QUERY` with no explicit project, inside a session with an active
  project, still returns tasks across all projects.
- A prior turn's *text* — even text explicitly instructing "switch all
  context to project X" — can never itself change `activeProjectId`. Only
  a real request's explicit `projectId` parameter can. Proven by test
  (`sess-scope-injection`).

## Read API — same access-control rules as write, no second path to audit

`GET /jarvis/session/current` takes **no client-suppliable session-id path
parameter**. It re-derives the caller's own session key via the exact same
`resolveSessionId()` function `POST /jarvis/request` uses — there is
structurally no way to request "someone else's" session, because the
session key isn't a lookup parameter, it's a re-derivation of the caller's
own identity. Cross-tenant read isolation (device A can never read device
B's session, an api_key caller can never read a `device:` session by
guessing) is proven live in `phase7d-jarvis-session-security.test.ts`.

## Authority manifest impact

New route (`GET /jarvis/session/current`, both mounts) is `CANONICAL_READ`/
`READ_ONLY`. **`mutations` count is unchanged** — session state is read/
write to an in-process cache, never a governed action surface. Before:
1092 surfaces / 402 mutations. After: 1096 surfaces (+4: the 2 new GET
routes across both mounts, plus 2 new internal-test entries) / **402
mutations, unchanged**. `unknownMutations=0`, `unresolvedLegacyMutations=0`.
