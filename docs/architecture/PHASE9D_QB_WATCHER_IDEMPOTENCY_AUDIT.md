# Phase 9D — QB Online Watcher Idempotency / Command De-dup Hardening

**Authority delta: NONE.** This phase adds zero external authority, zero new `ActionType`, zero new remote command type, zero auto-approval, zero new target machine. It closes the idempotency gap Phase 9C found in an already-existing, already-unattended external-mutation capability — the exact same shape of fix Phase 9A applied to `self-healing-monitor.ts`.

## 1. Exact path mapping (before any change)

`setInterval` (`qb-online-watcher.ts:168`, `startQbOnlineWatcher()`, unconditional at process boot, no HTTP request involved, 60s interval) → `poll()` reads the latest `heartbeats` row for the fixed `MACHINE_ID = 'qb-laptop-01'` → on an offline→online transition (gap was >1h, a fresh heartbeat now arrived) → `insertSyncCommand()` → `INSERT INTO commands (...)` with `command_type = 'TRIGGER_SYNC'`, `status = 'pending'` → a physically separate machine (`qb-laptop-01`'s own QB Desktop agent) polls `GET /commands?machine_id=X` and executes it on its next heartbeat, with zero human approval on this server's side.

**Confirmed by direct code reading, before any fix:**
- **What uniquely identifies a logical sync request**: nothing, before this fix. The insert's payload was a fixed literal (`{"reason":"laptop_came_online","auto":true}`), not attacker-influenceable — but there was no deterministic key or existing-row check distinguishing "a sync request for this recovery event" from "a sync request for a different recovery event five minutes later." Any offline→online transition, however frequent, produced a fresh insert.
- **Command statuses (`server/src/routes/qb-agent.ts:156-168`)**: `pending` (default, set on insert) → `acked` (via `POST /commands/:id/ack`, the remote agent claiming it) → caller-supplied `result.status`, defaulting to `completed` (via `POST /commands/:id/result`); `failed` is also observed in practice as a terminal status.
- **Pending/in-flight/completed queryability**: yes — `GET /commands?machine_id=X` already filters `WHERE machine_id=? AND status='pending'`, the exact reusable query shape this fix's `findActiveSyncCommand()` extends (adding `command_type`, `acked` to the active set, and a staleness cutoff).
- **Duplicate insertion under flapping**: confirmed possible before the fix — `insertSyncCommand()` had no existence check of any kind. Any genuine flapping condition (network jitter near the 1-hour threshold, repeated real outages in quick succession) would insert one `TRIGGER_SYNC` row per transition, each acted on independently by the remote machine.
- **Restart/reboot effect on watcher state**: `wasOffline`/`lastSeenAt` are plain in-memory module variables — reset to their boot-time-derived values on every process restart. `startQbOnlineWatcher()` re-derives `wasOffline` from the current heartbeat gap, so a restart while still genuinely offline does not spuriously fire; but the *duplicate-suppression* memory (none existed) would also have reset, meaning a restart immediately after a genuine reconnect and before the original code's non-existent dedup could matter would not itself have double-fired — but was never the actual risk. The actual risk is flapping within a single process lifetime, or across many.
- **Multiple watcher instances racing**: `mi-core` runs in PM2 `fork_mode`, single instance (confirmed via `pm2 jlist`) — no live multi-process race today, combined with this module's own `started` boolean guard against double-starting `setInterval`. Verified with a targeted evaluation scenario regardless (see Section 4), since the fix must not silently depend on single-instance deployment to hold.
- **DB uniqueness vs. service-level idempotency**: `command_id` already has a DB-level `UNIQUE` constraint, but it is a randomly generated value per call (`auto-sync-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`) — it prevents two calls from colliding on the same generated ID, not two calls from representing the same logical recovery event. A schema-level `UNIQUE(machine_id, command_type)` constraint was considered and rejected: it would permanently block a second *legitimate* sync after the first one completes, which is wrong (a new reconnect deserves a new sync). Service-level idempotency — checking for an existing active row before inserting — is the correct invariant here, matching the directive's explicit preference for a deterministic existing-row check over a time-only cooldown.
- **Existing cooldown semantics elsewhere**: `jarvis/proactive-monitor.ts` has an explicit 30-minute in-memory dedup map before sending an alert — the one sibling worker with any de-dup at all, but it's alert-dedup (suppressing a repeated *notification*), not command-dedup (preventing a repeated *mutation*), and it's in-memory-only (does not survive restart). Not reusable as-is; the same *shape* of idea (a bounded time window) informed `STALE_COMMAND_MS`, but the actual gate is the durable existing-row check, not the timer.

## 2. Design decision — deterministic existing-row check, not a time-only cooldown

Per the required invariant ("at most one active `TRIGGER_SYNC` command may exist for the same remote target/idempotency scope") and the explicit directive preference:

**Idempotency scope = `(machine_id, command_type)`.** There is exactly one fixed target (`qb-laptop-01`) and one fixed command type (`TRIGGER_SYNC`) this watcher ever issues — no caller input, no dynamic dispatch — so this scope is both minimal and complete for the one watcher that exists. It is not generalized into a reusable cross-worker idempotency service, since no second caller exists yet and building one would be speculative.

**Active statuses = `{pending, acked}`.** `completed` and `failed` are terminal — a new reconnect after either one is a new, legitimate sync request, not a duplicate. `acked` (claimed by the remote agent but not yet resulted) still counts as active: the remote machine is already working on it, so a second command would be a genuine duplicate mutation.

**Staleness bound = 30 minutes (`STALE_COMMAND_MS`), generous relative to both the 60s poll interval and the remote agent's own heartbeat cadence.** A `pending`/`acked` row older than this no longer blocks a fresh insert. Without this, one lost or dropped command (remote agent offline, crashed, or simply never polling again) would permanently disable the recovery feature — the check reads the durable `commands` table, not any in-memory state, so it is correct across restarts, but durability alone doesn't help if the one durable row is stuck forever.

**Atomicity**: `findActiveSyncCommand()` (read) and the `INSERT` are wrapped in a single `better-sqlite3` `db.transaction()`, so the check-then-insert is atomic against a concurrent `poll()` invocation — verified directly by the 20-way and 100-way concurrent-call scenarios in Sections 3 and 4 (exactly one insert succeeds every time, never zero, never more than one).

## 3. Required test scenarios — permanent coverage

`server/src/jarvis/__tests__/qb-online-watcher-idempotency.test.ts` (12 assertions, wired into `test:ci`) proves, against a real (isolated, ephemeral) SQLite fixture — not mocks:

1. Baseline: no active command exists — insert succeeds.
2. **Same outage detected repeatedly**: a second `insertSyncCommand()` call while the first is still `pending` is skipped, not duplicated.
3. **Offline→online→offline→online transitions**: via `poll()` end-to-end, a second reconnect while the first sync is still pending inserts nothing further.
4. **Stale pending command**: a `pending` row older than `STALE_COMMAND_MS` does not block a fresh insert.
5. **Completed prior command**: does not block a fresh insert.
6. **Failed prior command**: does not block a fresh insert (retry must remain possible).
7. `acked` (in-flight, not yet resulted) command still counts as active and blocks a duplicate.
8. **Different remote target**: an active command for a different `machine_id` or `command_type` does not interfere; the inserted row always targets the fixed `(MACHINE_ID, COMMAND_TYPE)` pair, never anything else.
9. **Malformed/unknown target**: structural proof that `qb-online-watcher.ts` has no HTTP entrypoint at all and never reads `req.body`/`req.query`/`req.params` — there is no code path through which a caller-supplied or malformed target could ever reach this module.
10. **Concurrent watcher invocations / DB contention**: 20 overlapping `insertSyncCommand()` calls — exactly one succeeds.
11. **Process restart during outage**: simulated module-state reset while still genuinely offline inserts nothing; a restart while an active command from before the restart still exists does not duplicate it.
12. No new authority: `ActionType` enum remains exactly 7 values; no shell/process execution introduced.

## 4. Deterministic evaluation

`server/src/jarvis/qb-online-watcher-evaluation.ts` (`npm run phase9d:evaluation`) — **908 cases**: a full single-existing-row sweep (6 statuses × 4 ages spanning both sides of `STALE_COMMAND_MS` × 8 machine-id variants including spoofed/malformed values × 4 command-type variants = 768 cases, each checking both the block/allow decision and that at most one active command ever exists for the fixed target pair), a 100-way concurrency probe, a 30-flap repeated-outage-detection probe via `poll()`, a 10-cycle process-restart-survival probe, plus structural checks against the live source and a freshly regenerated authority manifest. Result:

```
totalCases: 908, failures: 0
duplicateActiveCommand: 0
arbitraryTargetReachability: 0
authorityExpansion: 0
financialExecutionExpansion: 0
shellEscalation: 0
unknownMutations: 0
unresolvedLegacyMutations: 0
```

All seven hard targets exactly 0, as required.

## 5. Manifest

No existing surface's classification changed — `background:qb-online-watcher` remains `LEGACY_QUARANTINED` / `QUARANTINED` / `QUARANTINE_ONLY`, still honestly flagged as unresolved (this fix closes a reliability gap, it does not resolve or reclassify the legacy status; that remains explicitly out of scope, matching the Phase 9C roadmap's stated exclusions). The only manifest delta is the one new `test:*` script this phase adds, per the established pattern: `total` 1069→1070, `readOnly` 676→677, `internalTest` 104→105. **`unknownMutations=0`, `unresolvedLegacyMutations=0` — unchanged, both required targets held throughout.**

## 6. Full regression

Clean `npx tsc --noEmit` (zero errors) · `phase9d:acceptance` (own test + 908-case evaluation + manifest check) · `phase9a:acceptance` (945 cases, all hard targets 0) · `phase9b:acceptance` (9 assertions) · `test:tracked-credential-scan` · `test:ssrf-policy` (506/506) · `test:phase8a-security` · full `test:ci` (zero real failures, including the new Phase 9D test) · `authority:manifest -- --check` — all exit 0.

## 7. Explicit statement

**NO NEW AUTHORITY.** No `ActionType` added (still exactly 7). No new remote command type (`TRIGGER_SYNC` is the only one this watcher has ever issued). No auto-approval added or removed — this capability ran unattended before this phase and still runs unattended after; the fix bounds *how many times* it can act per recovery event, it does not add or remove the absence of human approval. No new target machine (the fixed `MACHINE_ID` literal is unchanged and structurally unreachable from any external input). No financial execution capability touched. No shell/process execution introduced. No PM2/process authority expansion — this fix is entirely internal to `qb-online-watcher.ts`'s own SQLite read/insert logic. No production DB schema changed (no new table, no new column — the fix reads and writes the existing `commands` table using its existing columns). No service was restarted, no process was killed as part of *making* this change — only as part of the normal, separately-authorized deploy step that would follow, if and when this PR is merged and deployment is decided.
