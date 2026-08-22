# Gap-A Fresh Discovery — Restart Intent Ledger

**Status: DISCOVERY ONLY. Nothing implemented.** No code changed, no schema created, no PM2/Windows/SelfHeal/governance change of any kind.

## Fresh reality audit

- Current `master` = `ea9021ab5131476e8d3cff4a7fdc9ac289e2ed16` (PR #143 merged). Deployed functional SHA unchanged: `2bd6752ef132bca37318f37fe73ddad26e91fac5`.
- `server/src` re-diffed against the deployed snapshot — still byte-identical, zero drift.
- PM2 live state re-checked: all 6 processes online, `restart_time:0` since the last full-fleet event, no new restart.
- This discovery re-reads current source directly (not PR #143's summary of it) for every restart-capable call site below.

## Complete reachable internal PM2-restart-capable code paths

Three call sites can currently cause a **local** `pm2 restart` (excluding `node-controller.ts`, which targets remote secondary-device nodes over HTTP, and `auto-task-engine.ts`, re-confirmed dead code with zero imports anywhere in the deployed dist):

### 1. `self-healing-monitor.ts` — `restartPm2Service()`

- **Source**: `server/src/company-os/self-healing-monitor.ts:292` (`execAsync`, 15s timeout)
- **Runtime reachability**: LIVE — runs every 60s via the health-scan loop
- **Trigger**: a monitored service's health check fails
- **Target selection**: `svc.pm2_name`, always from the fixed `SERVICES_TO_MONITOR` array — never caller-influenced
- **Approval/governance boundary**: `evaluateRestartEligibility()` — `RESTART_ALLOWLIST` (derived from `SERVICES_TO_MONITOR`'s own `pm2`-typed entries, so it can't drift from configuration) → `intentionallyStoppedServices()` check → restart-count cap (`MAX_AUTO_RESTART = 2`) → GLOBAL kill-switch read
- **GLOBAL kill-switch behavior**: `isGlobalKillSwitchActive()` reads a read-only `KillSwitchService` state for `actionType: 'internal:self-healing-monitor:restart'`; a governance-store read failure is treated as **blocked** (fail-safe, not fail-open) — re-confirmed directly in source this session
- **Intentional-stop behavior**: checked before eligibility; an intentionally-stopped service is never restarted and never alerted on
- **Evidence emitted before restart**: **none** — `restartPm2Service()` is called directly with no prior write
- **Evidence emitted after restart**: `recordRestartEvidence()` — called *after* `restartPm2Service()` returns, writes one row to `self_heal_restart_log` (decision, outcome, attempt number, detail, timestamp). Wrapped in its own try/catch — a logging failure cannot affect the restart decision itself.
- **Failure distinguishable from success**: yes — `outcome` is `'command_issued'` or `'command_failed'` based on whether `execAsync` threw
- **Survives the restarted process**: yes for `self_heal_restart_log` itself (WAL SQLite, proven durable across every event this program has observed) — but **not** for the specific write timing: if the calling `mi-core` process dies between `restartPm2Service()` returning and `recordRestartEvidence()` executing, the row is never written at all. This matters specifically because `mi-core` is one of the processes this monitor could (structurally, if ever re-allowlisted) restart — a self-restart would kill the very process about to write its own evidence.
- Only ever restarts `mi-core` if `mi-core-http`'s `type` were ever changed from `'internal'`/non-`pm2`-typed to a `pm2`-typed allowlisted entry — currently it is not (re-confirmed: 151/151 historical evaluations return `not_pm2_type`).

### 2. `skill-registry.ts` — `pm2_restart` skill

- **Source**: `server/src/gstack/skills/skill-registry.ts:321-325` (`execSync`, 20s timeout)
- **Runtime reachability**: LIVE, but gated — reachable only via `executeSkill('pm2_restart', ...)`, itself only reachable through the work-order/GStack skill-execution framework
- **Trigger**: a work order invoking this skill
- **Target selection**: `params.process_name || 'mi-core'` — **caller-controlled**, defaults to `mi-core` if unspecified. No allowlist check exists in this function itself (unlike `self-healing-monitor.ts`'s defense-in-depth re-check) — the only gate is upstream approval.
- **Approval/governance boundary**: `approval_class: 'REQUIRES_APPROVAL'`, `risk_level: 3` in the skill definition; independently re-confirmed as gated in `gstack/approval-engine.ts:54` and `gstack/role-registry.ts:67,69` (`requires_approval_for` includes `'pm2_restart'`)
- **GLOBAL kill-switch behavior**: not applicable — this path has its own separate governance gate (approval), not the SelfHeal kill-switch
- **Intentional-stop behavior**: not applicable — no such concept in this call path
- **Evidence emitted before restart**: **none**
- **Evidence emitted after restart**: only on the success path — `writeCommandOutput(wo, ...)` to `.local-agent-global/evidence/WO-*/`, and only if a work-order object (`wo`) was passed. On the failure path (`execSync` throws), the outer `catch` in `executeSkill()` calls `recordExecution(id, skillVersion, false, dur, workOrderId, errorMessage)` — a **different** store (skill-reliability tracking), not `writeCommandOutput`. Re-confirmed directly in source this session: these are two separate mechanisms depending on success/failure, and neither is a pre-write.
- **Failure distinguishable from success**: yes, but via two different evidence stores depending on outcome
- **Survives the restarted process**: file-based (`WO-*` evidence) and DB-based (skill-reliability tracker) — both durable once written, but, identically to path 1, nothing is written *before* the attempt
- **Zero historical evidence this has ever fired**: `.local-agent-global/evidence/` has zero `WO-*` subdirectories (re-confirmed this session)

### 3. `release-agent.ts` — release restart step

- **Source**: `server/src/gstack/role-agents/release-agent.ts:99` (`execSync`, 30s timeout)
- **Runtime reachability**: LIVE, gated identically to path 2 (same skill/approval/work-order framework, `action_type: 'pm2_restart'`)
- **Target selection**: `pm2Name` parameter, caller-controlled, no in-function allowlist re-check
- **Approval/governance boundary**: same `REQUIRES_APPROVAL` framework
- **Evidence emitted before restart**: none
- **Evidence emitted after restart**: `command_run` field written to work-order evidence, after `execSync` returns; same no-pre-write pattern
- **Zero historical evidence this has ever fired** (same empty `WO-*` check)

## The deploy-restart gap (new finding this session)

None of the 17 `CONFIRMED_DEPLOY_ACTION` restarts identified in Phase 9H, and none of the 9 `UNKNOWN` restarts, show any evidence of having gone through any of the 3 call sites above (zero `self_heal_restart_log` rows, zero `WO-*` evidence, for any of them). A repo-wide search for a committed script that runs `pm2 restart mi-core` as part of deploy tooling (`*.sh`, `*.cmd`, `*.ps1`, `*.mjs`, `package.json` scripts) found **none** — the restart step in this project's deploy procedure is a documented **manual** action (referenced across many `docs/architecture/PHASE*.md` files as an instruction to run, not a script that runs itself), issued directly by whatever session performs the deploy, entirely outside this codebase's own instrumented functions.

**This means a ledger scoped to these 3 call sites would not have produced a row for any of Phase 9H's 26 confirmed/probable historical events, and would not produce one for a future ordinary deploy either** — only for a SelfHeal-driven restart of an allowlisted non-`mi-core` service (already partially covered by `self_heal_restart_log`), or for a future first-ever use of the `pm2_restart` skill / release-agent path. This is the single most important finding of this discovery and directly shapes the recommendation below.

## State-distinction requirement

Per the explicit instruction, these are not equivalent and the design below keeps them structurally separate:

1. **Restart intent issued** — a governed call site has decided to attempt a restart and is about to call `execSync`/`execAsync`.
2. **PM2 accepted command** — the `execSync`/`execAsync` call returned without throwing (does not mean the target is healthy, only that PM2 acknowledged the command).
3. **Process exited** — visible only in `pm2.log`, not in any of the 3 call sites' own evidence.
4. **New process became online** — same, PM2-log-only.
5. **Service recovered** — only `self-healing-monitor.ts` currently has a mechanism for this (the *next* scan's health check), and it is a separate, later event from any of the above, not a guaranteed consequence of a successful restart command.

## Can Gap-A reuse `ops.db`?

**Yes.** `ops.db` (`F:\.local-agent-global\ops\ops.db`) is already WAL-mode SQLite, already houses `self_heal_restart_log`, and has been directly observed surviving every restart/reboot/daemon-recovery event this entire program has produced. No new database is warranted.

## Should `self_heal_restart_log` be migrated or correlated?

**Correlated, not migrated.** `self_heal_restart_log` is a proven, tested (Phase 9A, 14 invariants), load-bearing evidence source that Phase 9G and 9H both directly relied on. Changing its schema risks regressing something that already works. The proposed design below adds a **new**, separate table that `self-healing-monitor.ts` writes to *in addition to*, not instead of, its existing `recordRestartEvidence()` call — the two tables are correlated after the fact by `(target, timestamp)`, exactly as Phase 9H already correlated `self_heal_restart_log` against `pm2.log` and Windows Event Log without merging any of them into one schema.

## Proposed minimal schema

```sql
CREATE TABLE restart_intent_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  intent_uuid TEXT NOT NULL,              -- correlates the pre-write and its later update as one logical event
  issuing_surface TEXT NOT NULL,          -- 'self_heal' | 'skill:pm2_restart' | 'release_agent'
  issuing_pid INTEGER NOT NULL,           -- process.pid of the calling mi-core instance
  target_pm2_name TEXT NOT NULL,
  governance_ref TEXT,                    -- work_order_id, or self-heal's own decision string; nullable
  reason TEXT,                            -- free text; nullable
  status TEXT NOT NULL,                   -- 'attempting' | 'command_issued' | 'command_failed'
  error_detail TEXT,                      -- nullable
  confirmation_status TEXT NOT NULL DEFAULT 'not_tracked', -- 'not_tracked' | 'unconfirmed' | 'recovered' | 'still_down'
  created_at TEXT NOT NULL,               -- pre-write timestamp (intent issued)
  updated_at TEXT                         -- post-write timestamp; nullable until the command returns/throws
);
```

10 columns. Deliberately excludes a captured PM2 PID/restart-counter field (would require a racy follow-up `pm2 jlist` query at write time; self-healing-monitor's own "confirm on next scan" pattern is a cleaner, already-proven way to learn this later, without adding coupling to the ledger write itself) and excludes any foreign-key relationship to `self_heal_restart_log` (correlation is by timestamp+target, matching the established pattern, not a schema-level join).

## Write ordering (the actual proposed change)

Each of the 3 call sites gains: (a) one `INSERT` with `status='attempting'` immediately before its `execSync`/`execAsync` call, and (b) one best-effort `UPDATE ... SET status=?, error_detail=?, updated_at=?` immediately after, inside the same try/catch that already wraps the call. Both writes are wrapped so a ledger failure can never block, delay, or alter the actual restart — identical in spirit to `recordRestartEvidence()`'s existing "never throws" guarantee.

## Failure-ordering analysis (worked through explicitly, per the request)

| Scenario | Resulting ledger state | Honest? |
|---|---|---|
| Ledger pre-write succeeds, restart command fails | `status='command_failed'`, `error_detail` populated | Yes — never marked as success |
| Restart command succeeds, but the post-write can't run because the issuing process itself restarted (self-restart case) | Row stays `status='attempting'` forever | Honest ambiguity — not falsely marked `command_issued` or `command_failed`; a human/tool reading this later sees "an attempt was declared, outcome unknown" rather than a fabricated result |
| PM2 accepts the command but the target never becomes healthy | `status='command_issued'`, `confirmation_status` stays `'not_tracked'` unless a future scan updates it (only self-heal's path currently can) | Yes — command-acceptance and recovery are never conflated |
| `ops.db` unavailable | Both writes best-effort/try-catch; restart attempt proceeds regardless; ledger simply has no row for this event | Yes — matches existing `recordRestartEvidence` behavior exactly |
| Process crashes between the pre-write and the `execSync` call itself | Row exists with `status='attempting'` for an action that may never have actually been issued | Irreducible ambiguity, stated honestly rather than solved — this is the one case no ordering choice can fully resolve |
| Host reboots immediately after a completed write | Row survives (WAL SQLite, proven durable) | Yes |

## Deterministic test/evaluation strategy

1. Legitimate governed restart (self-heal eligible, target allowlisted) → pre-write `attempting`, command succeeds → `command_issued`
2. Denied restart (`not_allowlisted`, `restart_limit_reached`) → **no ledger row at all** (only `self_heal_restart_log` logs denials; the new ledger only ever logs actual attempts — a deliberate scope boundary, not a gap)
3. Intentional-stop target → no restart attempted, no ledger row (same reasoning as #2)
4. GLOBAL kill switch active → `kill_switch_blocked`, no restart attempted, no ledger row
5. Invalid/non-allowlisted target via the `pm2_restart` skill → note (not fixed by this design): the skill path has no in-function allowlist re-check today, unlike `self-healing-monitor.ts`'s defense-in-depth; the ledger would faithfully record whatever target was attempted, allowlisted or not — this documents an existing governance characteristic, it does not change it
6. Command execution failure → `attempting` → `command_failed` with `error_detail`
7. Process exits before confirmation → row stays `attempting` (see failure-ordering table)
8. Duplicate intent (two restart attempts for the same target close together) → two independent rows, two independent `intent_uuid`s, never merged
9. Concurrent intents (different surfaces, same or different targets) → independent rows; the ledger does not attempt to serialize or deduplicate — that is PM2's own concern
10. Host/process restart between attempt and confirmation → pre-write survives; confirmation only updates if a surface with a "next scan" concept re-checks (currently only self-heal)
11. Evidence DB unavailable → best-effort, restart unaffected, no row written
12. **Unrelated external PM2 restart with no internal intent** → **no ledger row exists for it at all.** When cross-referencing the ledger against `pm2.log`'s own independent restart timeline (the Phase 9H method), any restart with no matching ledger row within a reasonable window (e.g. ±30s) must be classified **`EXTERNAL_OR_UNKNOWN`** — explicitly never attributed to an internal surface merely because of proximity to something else. This is the load-bearing guarantee of the whole design: absence of a row is itself meaningful evidence, not an error state to paper over.

## Production acceptance strategy

The next naturally-occurring SelfHeal-driven restart (e.g., of `mi-accounting`, which fires periodically and is already well-understood) is the acceptance test: read-only verify that both `self_heal_restart_log` and the new `restart_intent_ledger` produce correlatable rows for the same event (same target, timestamps within the write-ordering's expected gap), and that `confirmation_status` updates to `'recovered'` on the following scan. No new production risk — purely additive logging around an already-existing, already-observed restart path.

## Explicit non-goals

- Does not become mandatory authorization middleware — nothing checks this ledger before permitting a restart.
- Does not create new restart authority, broaden any allowlist, bypass approval, bypass the GLOBAL kill switch, or change intentional-stop, retry, PM2, or Windows-startup behavior.
- Does not intercept arbitrary shell commands or wrap/replace `pm2`.
- Does not solve any of Phase 9H's 9 UNKNOWN historical events.
- **Does not attribute the actual, historically-observed deploy-restart mechanism for `mi-core`**, because that mechanism does not go through any of the 3 instrumented call sites (see "the deploy-restart gap" above) — this is the central limitation of Gap-A as scoped, and must not be minimized in any future summary of this work.

## Estimated benefit

- Closes a real (if narrow) evidence-ordering gap in the *already-existing* SelfHeal restart path: today, a crash between `restartPm2Service()` returning and `recordRestartEvidence()` running loses the row entirely; a pre-write closes this for that one path.
- Provides forward-looking attribution for the `pm2_restart` skill and `release-agent` paths, which have never fired historically but would be fully attributed the first time they do.
- Formalizes `EXTERNAL_OR_UNKNOWN` as an explicit, evidence-backed classification for future restart forensics (rather than Phase 9H's ad-hoc "UNKNOWN" label), which is a methodological improvement independent of how many rows the ledger ever actually produces.

## Residual limitations

- **Will not attribute `mi-core`'s own historical restart pattern** — the actual mechanism (manual/external `pm2 restart mi-core` during deploys, and whatever produced the 9 UNKNOWN events) lives entirely outside the 3 call sites this design can instrument.
- Only closes the narrow crash-between-attempt-and-write window for paths that already attempt a local restart; cannot attribute a command issued by a process this codebase never runs.
- The `pm2_restart` skill's caller-controlled target with no in-function allowlist re-check remains a governance characteristic this design does not change.

## GAP_A_RECOMMENDATION: MORE_DISCOVERY_REQUIRED

Not because the architecture is unclear — the schema, write ordering, failure-mode analysis, and test strategy above are complete and, on their own, low-risk enough to implement. The reason is the new finding above: **none of the 3 candidate call sites is shown to be the actual source of any observed `mi-core` restart, confirmed or unknown.** Implementing Gap-A now would be correct and safe, but would very likely produce an almost-permanently-empty ledger for the one target (`mi-core`) motivating this whole investigation. Before spending the (small, but nonzero) implementation cost, it is worth the user deciding, with this information in hand, whether: (a) the narrow, real benefit to the SelfHeal/skill/release-agent paths justifies implementing it now regardless, or (b) effort should go first toward identifying what the actual manual/external deploy-restart mechanism is (a separate, small discovery — e.g., checking whatever session/script/runbook actually issues the command during a deploy), since if *that* mechanism turns out to be scriptable and within this repo's control after all, it would be a far higher-value 4th call site to instrument than any of the 3 examined here.
