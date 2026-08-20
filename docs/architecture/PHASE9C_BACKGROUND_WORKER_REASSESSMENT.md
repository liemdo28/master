# Phase 9C — Background Worker Re-Assessment

Re-audits the 4 background workers Phase 9A honestly reclassified (manifest no longer falsely claims HTTP-only enforcement) but did not behaviorally harden. Each was independently read in full; the two most consequential claims below were independently re-verified by direct file read and grep before being written here, not taken from research alone.

**Manifest confirmation**: all 4 remain `authorityClass: LEGACY_QUARANTINED`, `phase6bDisposition: QUARANTINE_ONLY`, `approvalRequired: false`, `quarantineHandler: null` — honest, unchanged since Phase 9A, still correctly flagged as unresolved rather than silently closed.

## 1. `background:self-healing-scheduler` — `server/src/operations/self-healing.ts`

**Runtime behavior**: 5-minute interval (`index.ts:549`) runs 5 detectors — `detectRestartStorm` (PM2 restart-count delta via `pm2 jlist` + local DB read), `detectStaleConnectors` (reads a local JSON registry), `detectQueueStuck` (loopback `curl` to its own `/api/chat/metrics`), `detectWorkflowsStuck`/`detectApprovalStuck` (local SQL `SELECT COUNT(*)`). If `queue_stuck` fails, calls `safeClearMetrics()` — a loopback POST resetting its own in-memory counters.

**Mutation capability**: `raiseIncident()` writes a real row to the local `incidents` table (internal record-keeping only, no external system informed). `safeClearMetrics()` mutates only its own process's in-memory state via a self-directed HTTP call.

**Caller/trigger**: fully hardcoded thresholds, no external/dynamic input.

**Governance boundary / kill-switch**: zero references to `ActionPolicyEngine`/`KillSwitchService`/`BudgetManager`/`ControlledActionService` or to "kill" anywhere in the file — independently confirmed via direct grep.

**Evidence**: mixed — incident rows are durable DB writes; everything else is `console.warn` only.

**Classification: `OBSERVE_ONLY`.** Every real action is a read or a self-scoped no-op-adjacent reset; the only durable write is an internal incident log a human or another system must separately act on. No external message, no external mutation.

## 2. `background:jarvis-proactive-monitor` — `server/src/jarvis/proactive-monitor.ts`

**Runtime behavior**: 15-minute interval evaluates system risk via 5 loopback HTTP GETs to the server's own health/status endpoints, classifies signals as critical/warning, and fires an alert if any exist and aren't muted.

**Mutation capability**: `fire()` sends a real outbound WhatsApp message to the CEO via `sendWhatsApp` — a message a human reads, not a database or external-system write. Deduplicated within a 30-minute window per alert.

**Caller/trigger**: message content is dynamic, assembled from 5 internal HTTP responses without output sanitization before interpolation into the WhatsApp text. Flagged: a bug or bad data in any of those 5 internal endpoints could put unsanitized text in front of the CEO — a narrow content-injection surface, not a code-execution or external-mutation risk.

**Governance boundary / kill-switch**: zero references — independently confirmed via direct grep. Only a local mute preference gates delivery, not a kill switch.

**Evidence**: ephemeral only — in-memory alert history (capped, lost on restart) plus a flat-file WhatsApp outbox log; no durable DB row.

**Classification: `ALERT_ONLY`**, flagged for two follow-up-worthy weaknesses (not blocking): unsanitized message-content assembly, and evidence weaker than the incident-DB pattern used elsewhere.

## 3. `background:daily-briefing-scheduler` — `server/src/jarvis/daily-briefing-scheduler.ts`

**Runtime behavior**: 60-second tick compares current Vietnam time against CEO-configured morning/evening briefing times, once-per-day guarded, and sends a briefing via WhatsApp on match.

**Mutation capability**: same WhatsApp-send channel as #2. Evening briefing reads work-order JSON files, opens the QB agent DB strictly **read-only**, and reads evidence JSON files — no writes to any of these.

**Caller/trigger**: trigger time is CEO-configured but fails safe (malformed preference strings produce `NaN`, which never matches, so it simply never fires rather than firing spuriously). Message content is dynamic, sourced from local read-only data.

**Governance boundary / kill-switch**: zero references — independently confirmed via direct grep. Local mute preference only.

**Evidence**: ephemeral — in-memory last-sent-date tracking, `console.log` only; same flat-file WhatsApp outbox as the only durable trace.

**Classification: `ALERT_ONLY`.** Same profile as #2, lower risk since its inputs are more constrained (local files/read-only DB vs. 5 internal HTTP endpoints).

## 4. `background:qb-online-watcher` — `server/src/jarvis/qb-online-watcher.ts`

**Runtime behavior**: 60-second poll reads the latest heartbeat row for `qb-laptop-01` from `qb-agent.db` (opened **read-write**). On an offline→online transition (gap was >1h, now a fresh heartbeat arrived), it inserts a `TRIGGER_SYNC` command row and sends a WhatsApp notification to the CEO.

**Mutation capability — the most consequential of the 4, independently verified by direct file read**: `insertSyncCommand()` (`qb-online-watcher.ts:48-59`) performs a real `INSERT INTO commands (...) VALUES (..., 'TRIGGER_SYNC', '{"reason":"laptop_came_online","auto":true}', 'pending', ...)`. Per the file's own header comment: "the QB Desktop agent picks it up on its next heartbeat poll... Mi automatically triggers a sync without CEO action." **This is a real command that a physically separate machine will execute, with zero human approval in the loop on this server's side.** The WhatsApp send that follows is a courtesy notification *after* the mutation is already queued, not a request for permission.

**Caller/trigger — idempotency gap, independently verified**: the insert's payload is a fixed literal, not attacker-influenceable. But `wasOffline`/`lastSeenAt` are plain in-memory module variables (`qb-online-watcher.ts:22-23`), not persisted. There is **no check for an existing `pending`/recent `TRIGGER_SYNC` row before inserting a new one**, and **no cooldown window** — confirmed by direct read: no such query exists anywhere in the file. Contrast with sibling worker #2 (`proactive-monitor.ts`), which has an explicit 30-minute dedup map before sending. My own trace of the restart-interaction case found the *specific* restart-causes-guaranteed-double-fire scenario less clear-cut than initially suspected (a restart while the laptop is already online correctly initializes `wasOffline=false` with no spurious re-fire) — but the core, precisely-verified risk stands independent of restart timing: **any genuine flapping condition (network jitter near the 1-hour threshold, repeated real outages in quick succession) will insert multiple `TRIGGER_SYNC` commands, each acted on by the remote machine, with no de-dup anywhere in the path.**

**Governance boundary / kill-switch**: zero references — independently confirmed via direct grep, matching the other 3.

**Evidence**: the `commands` INSERT itself is durable (a real DB row the remote agent will act on and presumably update), but the watcher's own detection state is ephemeral, and insert failures are only `console.error`'d — no incident-center row is raised on failure, unlike the pattern `self-healing.ts` uses for real problems.

**Classification: `QUARANTINED`.** This is the one worker among the 4 whose real capability matches the "too risky to leave running unexamined" bar: a genuine external-machine command with no governance, no kill-switch, and a verified de-dup gap. Recommended, not implemented in this discovery phase: either (a) add a real idempotency check (query for an existing `pending`/recent `TRIGGER_SYNC` row before inserting, plus a persisted last-triggered timestamp surviving restarts), or (b) route the insert through `ControlledActionService`/`ActionPolicyEngine` before it is allowed to run unattended again. Neither is authorized or implemented by this discovery phase.

## Summary table

| Worker | Real capability | Classification |
|---|---|---|
| `self-healing-scheduler` | Internal reads + local incident-log write + self-scoped metrics reset | `OBSERVE_ONLY` |
| `jarvis-proactive-monitor` | WhatsApp alert to CEO, deduplicated | `ALERT_ONLY` (content-sanitization + evidence-durability follow-ups flagged) |
| `daily-briefing-scheduler` | WhatsApp briefing to CEO, from local/read-only sources | `ALERT_ONLY` |
| `qb-online-watcher` | Real command inserted for a remote machine to execute, no governance, no de-dup | `QUARANTINED` (idempotency/governance hardening recommended as future work) |
