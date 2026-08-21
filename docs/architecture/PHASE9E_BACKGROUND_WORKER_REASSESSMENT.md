# Phase 9E — Background Worker Reassessment

**Mode: DISCOVERY + VERIFICATION + CLASSIFICATION ONLY.**

Full re-inventory performed from source (not inherited from Phase 9C's count), plus deep audits of the four historically-tracked debt workers and a comparison against the Phase-9A-hardened `self-healing-monitor`.

## 1. Full re-inventory — 10 recurring background timers found, not 8

The authority manifest (`server/src/authority-control-plane/scanner.ts:87-113`) declares 8 `worker(...)` entries. All 8 are real and boot-wired; no dead manifest entries were found. Two additional recurring timers were found that are **not** declared in the manifest:

| # | Worker | Source | Declared in manifest? | Boot-wired? |
|---|---|---|---|---|
| 1 | `background:scheduler` | `cron/sync-scheduler.ts` | Yes | Yes (`index.ts:545`) |
| 2 | `background:burn-in` | `operations/burn-in.ts` | Yes | Yes (`index.ts:548`) |
| 3 | `background:self-healing-scheduler` | `operations/self-healing.ts` | Yes | Yes (`index.ts:549`) |
| 4 | `background:self-healing-monitor` | `company-os/self-healing-monitor.ts` | Yes | Yes (`index.ts:550`) |
| 5 | `background:jarvis-proactive-monitor` | `jarvis/proactive-monitor.ts` | Yes | Yes (`index.ts:566`) |
| 6 | `background:leader-heartbeat` | `nodes/leader-lock-persistent.ts` | Yes | Yes (`index.ts:571`) |
| 7 | `background:daily-briefing-scheduler` | `jarvis/daily-briefing-scheduler.ts` | Yes | Yes (`index.ts:574`) |
| 8 | `background:qb-online-watcher` | `jarvis/qb-online-watcher.ts` | Yes | Yes (`index.ts:577-579`, dynamic import) |
| 9 | **Review-approval timeout sweep** | `index.ts:554-556` (inline `setInterval`) | **No** | Yes, unconditional |
| 10 | **WhatsApp replay-cache cleanup** | `services/whatsapp-key-manager.ts:274-276` | **No** | Yes, module-load-time (no explicit start gate) |

Worker 9 is real external mutation risk: it POSTs to its own `/api/mi/review-approvals/sweep-timeouts`, which mutates approval-status DB rows and calls an external review-system escalate endpoint (`routes/mi-review-approvals.ts:75-96`) — this should have a manifest entry and currently does not (a manifest completeness gap, not a behavioral gap by itself). Worker 10 is internal-only (trims an in-memory `Set`) and low severity.

One dormant/dead function was also found: `chat/conversation-store.ts:232` exports `startCleanupInterval()`, which is never called anywhere in `server/src` — confirmed dead code, not a live worker.

## 2. Kill-switch coverage — 1 of 10

| Worker | Real kill-switch gate before its side effect? |
|---|---|
| self-healing-monitor | **Yes** — `isGlobalKillSwitchActive()` (`self-healing-monitor.ts:199-201, 229`), checked immediately before `pm2 restart` (line 292) |
| All other 9 | **No** — confirmed by grep for `KillSwitchService`/`GovernanceStore` across every one of the other worker files; zero matches in any of them |

## 3. Idempotency/dedup classification

| Worker | External effect | Class | Restart-safe? |
|---|---|---|---|
| qb-online-watcher | DB command insert + WhatsApp notify | **TRANSACTIONAL_DEDUP** (`qb-online-watcher.ts:87-107`, atomic check-then-insert) | Yes — dedup state is entirely DB-backed |
| self-healing-monitor (restart) | `pm2 restart` | Allowlist + restart-count + kill-switch gate, durable `self_heal_restart_log` | Yes |
| daily-briefing-scheduler | WhatsApp send x2/day | **IN_MEMORY_COOLDOWN** (`lastMorningDate`/`lastEveningDate`, module-level `let`) | **No** — a crash-restart landing at/after the trigger minute resets the guard, can duplicate a day's briefing |
| jarvis-proactive-monitor | WhatsApp alert push | **IN_MEMORY_COOLDOWN** (`LAST_SENT` Map, 30-min window) | **No** — restart wipes dedup state |
| self-healing-scheduler (incidents) | DB incident row | **NONE** (plain insert, no unique/active-row check) | Spam risk only, no external duplicate action |
| burn-in snapshot | Internal telemetry row | **NONE** | No external consequence |
| leader-heartbeat | Local lock-file refresh | **NOT_APPLICABLE** | Repetition is the intended behavior |
| review-approval sweep | External escalate POST + DB status | **DB_ACTIVE_ROW_CHECK**-like (status flips before escalate call) | Restart-safe against duplicate escalation; opposite risk (a crash between the two writes could leave a row stuck un-escalated) is `NOT_VERIFIED` |

## 4. Intentionally-stopped-service boundary — 1 of 5 non-validator PM2-mutating paths respects it

Canonical source of truth: `server/src/runtime-preflight/validator.ts:67`, `INTENTIONALLY_STOPPED = new Set(['mi-ceo-observer', 'mi-whatsapp-gateway', 'mi-n8n'])`.

| PM2-mutating path | Consults `intentionallyStoppedServices()`? |
|---|---|
| `self-healing-monitor.ts` (`evaluateRestartEligibility`) | **Yes** |
| `runtime-preflight/boot-cli.ts:84-86` (unconditional `pm2 resurrect` on every boot) | **No** — computes an advisory `intentionallySkipped` list for logging only; does not filter or block the resurrect call itself. Whether an intentionally-stopped service actually comes back depends entirely on the external `dump.pm2` snapshot not containing it — an implicit assumption, not an enforced invariant |
| `gstack/skills/skill-registry.ts:321-326` (`pm2_restart` skill, caller-supplied name) | **No** |
| `gstack/role-agents/release-agent.ts:96-110` (`executeRestart`) | **No** — relies on caller convention ("requires prior CEO approval") rather than a code-enforced check |
| `auto-task-engine/index.ts:306-310` (hardcoded `pm2 restart mi-core`) | **No** (lower risk — `mi-core` is not in the intentionally-stopped set) |
| `nodes/node-controller.ts:221-227` (`restartProject`, remote secondary-device nodes) | **No** — no analogous stop-boundary exists for remote nodes at all |

This is a real gap: the intentional-stop boundary is a single, well-designed check reused correctly by exactly one worker; it is not a system-wide invariant enforced at every PM2-mutation site. In practice, the two services currently intentionally stopped happen to also never be resurrected because nothing has put them in a `dump.pm2` snapshot — but that is circumstance, not a guarantee.

## 5. Deep audit: `jarvis-proactive-monitor`

- **Data sources**: loopback fetches to mi-core's own health/connector/approval/node-status endpoints; responses are JSON-stringified and interpolated into signal text with no redaction (`risk-engine.ts:34,50,66`).
- **Dedup**: in-memory `Map`, 30-min window, restart-unsafe (§3).
- **Recipient**: always the single `CEO_WHATSAPP_NUMBER` env var via `sendToCeo`/`queueToCeo` — no caller-influenced recipient path exists. Confirmed to no-op when the var is unset (same gate observed live in production during this audit).
- **Evidence**: `alert.pushed_to_whatsapp = true` is set **synchronously before** the fire-and-forget send even starts (`proactive-monitor.ts:62-63`) — optimistic, not gated on actual delivery.
- **Kill switch / approval**: none. Only a user-mute preference (`isMuted()`), not a governance gate.
- **Manifest**: `LEGACY_QUARANTINED`, `quarantineHandler: null` — honestly declares no enforcement exists (matches runtime reality; not an overclaim).
- **Classification: SAFE AS ALERT_ONLY — PARTIALLY.** Cannot reach an arbitrary recipient and correctly no-ops when unconfigured, but has zero kill-switch/approval gate and its own delivery-evidence field is unreliable.

## 6. Deep audit: `daily-briefing-scheduler`

- **Schedule**: correct IANA timezone handling for VN time (`toLocaleString(..., {timeZone: 'Asia/Ho_Chi_Minh'})`), exact-minute match on a 60s poll.
- **Duplicate-run protection**: in-memory `lastMorningDate`/`lastEveningDate`, restart-unsafe (§3) — a crash/restart landing in the trigger window can double-send a day's briefing.
- **Missed-run/catch-up**: none — an exact `hour===mHour && minute===mMin` match with no catch-up branch; a day the process is down at 07:00 is silently skipped, with no log marking the skip.
- **Recipient**: same `CEO_WHATSAPP_NUMBER` gate as every other outbound path; confirmed currently unset in the live instance (no-op at transport layer right now).
- **Evidence**: `"Morning sent for ${date}"` / `"Evening sent for ${date}"` log unconditionally, before the fire-and-forget send resolves — this is a **false-success-risk** log line, not gated on real delivery.
- **Kill switch/approval**: none, only the same mute-preference pattern as jarvis-proactive-monitor.
- **Manifest**: `LEGACY_QUARANTINED`, honestly declares no enforcement.
- **Classification: SAFE AS ALERT_ONLY — PARTIALLY**, for the same reasons as §5: cannot mutate external state or trigger a remote machine (unlike qb-online-watcher), so `ALERT_ONLY` remains a defensible ceiling, but the restart-duplicate-send risk and the optimistic "sent" log are real, previously under-disclosed gaps.

## 7. Post-9D reassessment: `qb-online-watcher`

Re-derived from current source, not from the Phase 9D closure document's claims:

- **Atomicity**: confirmed real — `insertSyncCommand()` (`qb-online-watcher.ts:87-107`) wraps the existing-active-row check and the insert in a single `better-sqlite3` `.transaction()` call.
- **Fixed target/type**: `MACHINE_ID='qb-laptop-01'` and `COMMAND_TYPE='TRIGGER_SYNC'` are hardcoded literals; no HTTP entrypoint or caller-supplied value reaches this code at all (confirmed by grep for `req.body|req.query|req.params` — zero matches, and the only caller is a zero-argument boot-time dynamic import).
- **Stale threshold**: `STALE_COMMAND_MS = 30 min`; confirmed a stale row does not block a fresh insert.
- **Concurrency**: independently re-run (not merely assumed) — `test:phase9d-qb-watcher-idempotency` (12 invariants, including a 20-way concurrent-call case) and `phase9d:evaluation` (908 cases) both pass, with all hard targets (`duplicateActiveCommand`, `arbitraryTargetReachability`, `authorityExpansion`, `financialExecutionExpansion`, `shellEscalation`, `unknownMutations`, `unresolvedLegacyMutations`) exactly 0.
- **Restart safety**: dedup state is entirely DB-backed (reads the durable `commands` table, not module-level state) — confirmed restart-safe.
- **No shell/process execution**: confirmed by grep, zero matches for `child_process|execSync|exec(|spawn(|shell: true`.
- **CEO notification**: gated strictly on a non-null `commandId` from a genuine insert — no false-positive "sync triggered" path found.

**De-quarantine question — answer: NO.** Idempotency is real, transactional, and durable, but governance prerequisites remain confirmed absent by direct grep: no `ActionType`, no `ActionPolicyEngine`, no `KillSwitchService`, no `ControlledActionService`, no approval gate of any kind. The manifest's own `legacyReason` states the disqualifying fact plainly: this is a background mutation with no HTTP request/response cycle for the quarantine boundary to intercept. Idempotency closes a duplicate-command bug; it does not add an enforcement boundary. `background:qb-online-watcher` correctly remains `LEGACY_QUARANTINED`/`QUARANTINED`.

## 8. Comparison against the Phase-9A-hardened `self-healing-monitor`

`self-healing-monitor.ts` is the only one of the 10 workers with all of: a real allowlist (`RESTART_ALLOWLIST`, derived from its own service list so it cannot drift), a real intentional-stop check consulted before both restart-attempt and alert-generation, a real GLOBAL kill-switch check immediately before the side effect, and durable per-decision evidence (`self_heal_restart_log`). No other worker has this combination. This is the correct reference pattern for any future hardening of the remaining workers — not a reason to assume any of them already meet it.

## 9. Answers to the Phase 9E background-worker questions

| Question | Answer |
|---|---|
| How many background workers exist now? | 10 recurring timers (8 in the manifest, 2 undeclared) |
| Which have real external side effects? | qb-online-watcher (DB→remote-machine command), jarvis-proactive-monitor and daily-briefing-scheduler (outbound WhatsApp), self-healing-monitor (`pm2 restart`), review-approval sweep (external escalate call) |
| Which still have manifest/runtime mismatches? | None found as **overclaims** — every `LEGACY_QUARANTINED` worker's manifest entry honestly declares no enforcement (`quarantineHandler: null`), matching runtime reality. The manifest **understates** qb-online-watcher (doesn't cite its real idempotency guard as an override), which is safe-direction debt, not a security gap. Two workers (review-approval sweep, whatsapp-key-manager cleanup) are absent from the manifest entirely — a completeness gap. |
| Which respect the GLOBAL kill switch? | Only self-healing-monitor (1 of 10) |
| Which have durable idempotency? | qb-online-watcher (transactional), self-healing-monitor (allowlist+log). jarvis-proactive-monitor and daily-briefing-scheduler are in-memory-only and restart-unsafe. |
| Which have durable evidence? | self-healing-monitor (DB log), qb-online-watcher (DB command state). jarvis-proactive-monitor/daily-briefing-scheduler's own "sent" claims are optimistic/undurable, though the underlying transport layer (`whatsapp-sender.ts`) does keep a truthful, durable outbox log, decoupled from the callers' own log lines. |
| Is qb-online-watcher materially safer after 9D? | Yes, for duplicate-command risk specifically. |
| Does it deserve de-quarantine? | No — see §7. |
| Is jarvis-proactive-monitor safe as ALERT_ONLY? | Partially — see §5. |
| Is daily-briefing-scheduler safe as ALERT_ONLY? | Partially — see §6. |
| Is self-healing-scheduler truly OBSERVE_ONLY? | Yes for its own actions (detection + a safe in-memory metrics reset only) — it does not itself call `pm2 restart` and has no kill-switch reference, consistent with a pure-observation classification. |
| Is self-healing-monitor still correctly hardened? | Yes, confirmed independently via source, the actual deployed compiled bundle, live DB evidence, and 945/945 + 14/14 passing regression cases. |
