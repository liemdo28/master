# Phase 9N — Windows Security Log Retention Implementation (2 GB Controlled Capacity Increase)

**Status: SINGLE MUTATION APPLIED AND VERIFIED. Long-term retention duration is NOT yet empirically measured.** This phase performed exactly one Windows host configuration change — increasing the Security event log's configured maximum size from 20 MB to 2 GB — as recommended by [Phase 9M](PHASE9M_SECURITY_LOG_RETENTION_CAPACITY_DISCOVERY.md). No other setting was touched. No application, schema, authority, or PM2 configuration changed.

## A. Frozen Phase 9M basis

Phase 9M ([PHASE9M_SECURITY_LOG_RETENTION_CAPACITY_DISCOVERY.md](PHASE9M_SECURITY_LOG_RETENTION_CAPACITY_DISCOVERY.md), merged as PR #148, merge commit `36e8c752d6a77e6b6441a4b5f66861654759908e`) froze:

- `HIGH_BURSTINESS`
- `RETENTION_INSUFFICIENT`
- `RETENTION_INCREASE_JUSTIFIED`
- Empirical churn model: LOW ≈ 88 MB/day, CENTRAL ≈ 139 MB/day, HIGH ≈ 375 MB/day
- `RECOMMENDED_TARGET_RANGE = 1 GB – 4 GB`, with the explicit corrected caveat that this range supports **either** ~7 days under HIGH+1.5× headroom (~3.9 GB) **or** ~14 days under CENTRAL+1.5× headroom (~2.9 GB) — not both simultaneously, and that a 4 GB log does **not** guarantee 14-day retention under the observed HIGH workload.

This phase selects **2 GB**, the midpoint of the recommended range, as a single, non-automatic, host-owner-authorized capacity increase.

## B. Exact pre-change baseline

Captured by the operator in a genuinely elevated `Administrator: Windows PowerShell` session immediately before the mutation:

| Item | Value |
|---|---|
| Process Creation auditing | `Success` (unchanged carry-over from Phase 9L) |
| `ProcessCreationIncludeCmdLine_Enabled` | Not configured (`ERROR: unable to find the specified registry key or value`) — command-line capture off |
| `maxSize` | `20971520` (20 MB) |
| `retention` | `false` |
| `autoBackup` | `false` |
| `fileMax` | `1` |
| `channelAccess` | `O:BAG:SYD:(A;;0xf0005;;;SY)(A;;0x5;;;BA)(A;;0x1;;;S-1-5-32-573)` |
| `RecordCount` | `30973` |
| Oldest retained event | `Tuesday, August 25, 2026 11:22:42 PM` |
| Newest retained event | `Wednesday, August 26, 2026 8:21:03 AM` |
| `Security.evtx` file size | `20,975,616` bytes |

This baseline is the exact rollback target.

## C. Disk-headroom check

Confirmed (non-elevated, this agent's own session): `C:` free space = **322.71 GB**. A 2 GB configured ceiling is trivially safe against this headroom — even full physical allocation to 2 GB would consume well under 1% of free space.

## D. Exact authorized mutation

**Single command, executed once, by the operator in the same elevated session:**

```
wevtutil sl Security /ms:2147483648
```

`2147483648` bytes = exactly 2 GiB. No other `wevtutil sl` flag (`/r`, `/ab`, `/ca`) was passed — `retention`, `autoBackup`, and `channelAccess` were left untouched by this command by construction. No reboot was required or performed. No other command was run against the Security log, audit policy, Sysmon, or PowerShell logging configuration in this phase.

## E. Exact post-change configuration

Captured immediately after, same elevated session:

| Item | Pre-change | Post-change | Changed? |
|---|---|---|---|
| `maxSize` | `20971520` | `2147483648` | **YES — the one authorized change** |
| `retention` | `false` | `false` | NO |
| `autoBackup` | `false` | `false` | NO |
| `fileMax` | `1` | `1` | NO |
| `channelAccess` | `O:BAG:SYD:(A;;0xf0005;;;SY)(A;;0x5;;;BA)(A;;0x1;;;S-1-5-32-573)` | identical | NO |
| Process Creation auditing | `Success` | `Success` | NO |
| Command-line capture | absent/off | absent/off | NO |
| `RecordCount` | `30973` | `30977` | grew by 4 (normal churn during the check/mutate/check sequence) |
| Oldest retained event | `Tuesday, August 25, 2026 11:22:42 PM` | `Tuesday, August 25, 2026 11:22:42 PM` | **UNCHANGED — no evidence lost** |
| Newest retained event | `Wednesday, August 26, 2026 8:21:03 AM` | `Wednesday, August 26, 2026 8:21:06 AM` | advanced 3s, normal |
| `Security.evtx` file size | `20,975,616` bytes | `20,975,616` bytes | unchanged (expected — 2 GB is a configured ceiling, not immediate physical allocation) |

**The oldest-retained-event invariant is the critical safety check for this mutation class**: had the oldest timestamp jumped forward, that would indicate the log was cleared or truncated as a side effect of the `maxSize` change. It did not. No existing evidence was lost.

## F. Event 4688 continuity

Ten fresh `Id=4688` events were observed at `8:21:05`–`8:21:06 AM` — strictly after the mutation completed. Process-creation auditing continued generating events normally with no gap, error, or service interruption caused by the configuration change.

## G. Privacy verification

- Command-line capture: still **OFF** (unchanged by this phase; this phase only changed log capacity, not audit scope).
- No new audit subcategory was enabled.
- No Sysmon, no PowerShell logging.
- The only change is that more of the same already-audited data (process name, PID, creator/parent, account/logon context, timestamp — no command-line) is now retained for longer before being overwritten. This is a retention-duration change, not a new-data-collection change.

## H. Production safety verification

Performed independently, from this agent's own non-elevated session, after the mutation was reported:

| Check | Result |
|---|---|
| PM2 process list | All 6 processes `status=online` |
| `restart_time` per process | `pm2-logrotate=0, mi-core=7, mi-ai-service=0, mi-accounting=3, qb-ops-agent=1, mi-node-agent=0` — **identical to the values already observed in this session's fresh-reality-audit before the mutation**. No new restart occurred as a result of this change. |
| `/api/health` | `server:"ok"`, `overall:"DEGRADED"` (due to `python_ai_service`/`ollama` being down — a pre-existing, unrelated condition noted before this phase began, out of scope here), HTTP `200` |
| Deployed source SHA | `2bd6752ef132bca37318f37fe73ddad26e91fac5` — unchanged |
| Schema version | `v10` (`MAX(version)` from `schema_migrations`) — unchanged |
| Authority manifest counts | `total:1072, readOnly:679, mutations:393, canonical:668, adapters:143, quarantined:154, forbidden:0, internalTest:107, unknownMutations:0, legacyMutations:174, adaptedLegacy:7, quarantinedLegacy:167, disabledDeadLegacy:0, unresolvedLegacyMutations:0` — identical to every prior phase in this program |
| DB integrity | `personal-os.db`, `tasks.db`, `projects.db`, `knowledge.db` — all `integrity_check: ok`, `foreign_key_check: 0 violations` |

**No PM2 restart, no application change, no schema change, no authority change resulted from this Windows-level configuration mutation.**

## I. Rollback command and rollback criteria

**Rollback command (documented, NOT executed — no safety problem occurred):**

```
wevtutil sl Security /ms:20971520
```

This restores the exact pre-change `maxSize` captured in Section B. **Rollback criteria** (none of which were met): disk free space dropping to an unsafe margin because of Security-log growth; any evidence of log corruption or service instability introduced by the capacity change; any unplanned interaction with production processes. None occurred.

## J. Long-term retention measurement plan (defined, not automated)

No Scheduled Task, watcher, or automation of any kind is created by this phase. The following checkpoints are **manual, operator-run measurements**, structurally identical to the Phase 9M T1/T2/T3 methodology, to be supplied by the operator whenever real elapsed time has genuinely passed:

| Checkpoint | What to record |
|---|---|
| T+24h | `wevtutil gl Security` (`maxSize` unchanged=2 GB confirmation), `RecordCount`, oldest/newest retained timestamp, `Security.evtx` size |
| T+72h | same fields — first check for whether the log has begun approaching or has stabilized as a genuine rolling window under 2 GB |
| T+7d | same fields — first checkpoint capable of confirming or refuting the ~7-day HIGH-scenario planning estimate from Section K |

Each checkpoint should be treated exactly as Phase 9M treated T1/T2/T3: a genuine timestamped sample, not an extrapolation, with `WINDOW_CLIPPED_BY_RETENTION` explicitly flagged if the oldest event has already rolled past the prior checkpoint's oldest event (indicating the log reached steady-state overwrite before the full window elapsed).

## K. Explicit limitations

- **2 GB is an initial operational target, not a proven retention duration.** Using the frozen Phase 9M churn model as a planning estimate only (not yet empirically measured against this specific 2 GB ceiling): LOW ≈ 22.7 days, CENTRAL ≈ 14.4 days, HIGH ≈ 5.3 days at 2048 MB ÷ (88 / 139 / 375 MB/day) respectively.
- **None of those durations are yet empirically proven after this change.** Only the long-term measurement plan in Section J can confirm actual behavior.
- **No 7-day, 14-day, or 30-day retention guarantee is made by this document.** The prior Phase 9M finding — that a single fixed log size cannot simultaneously guarantee both a long duration and coverage of the observed HIGH-burstiness scenario — still applies; 2 GB shifts the achievable range upward but does not eliminate the tradeoff.
- **No further capacity change, retention flag, autoBackup change, audit-scope expansion, Sysmon installation, or PowerShell logging change is proposed or authorized by this document.** Any of those would require a separate, explicitly authorized phase.
- **The 13 historical UNKNOWN PM2 restart events from Phase 9H/9L remain UNKNOWN and out of scope.** This phase does not reopen, and was not intended to reopen, restart-origin investigation.
- **`python_ai_service`/`ollama` health degradation is pre-existing and unrelated to this phase.** Not investigated here, per explicit prior-session instruction to keep unrelated incidental observations out of scope.

## Authority / production boundary

- No application code changed.
- No schema changed (v10, unchanged).
- No `ActionType` changed (still exactly 7 values, unaffected — not re-enumerated this phase since no code path touches it, and the authority manifest total above is itself the unchanged confirmation).
- No authority model changed (`unknownMutations=0`, `unresolvedLegacyMutations=0`, unchanged).
- No PM2 configuration changed; no PM2 restart occurred.
- No deploy performed.
- No audit-policy change (Process Creation auditing and command-line-capture state both unchanged from Phase 9L).
- No Sysmon installed or configured.
- No PowerShell logging enabled.
- Exactly one Windows Security-log configuration value changed: `maxSize` (20 MB → 2 GB).

**Authority delta: ZERO. The only production delta in this phase is the single Windows Security-log `maxSize` value, which is host configuration, not repository/application state, and therefore does not appear in `git diff`.**

## Final classification

```
PHASE 9N CLASSIFICATION:        CAPACITY_CHANGE_VERIFIED
LONG_TERM_RETENTION_STATUS:     LONG_TERM_RETENTION_NOT_YET_MEASURED
ROLLBACK_READY:                 YES (not executed — no safety issue occurred)
PRODUCTION_SAFETY:               NO_IMPACT_OBSERVED
```

## Recommendation

**PRESERVE THE 2 GB CAPACITY CHANGE AND MEASURE.** No further Security-log, audit-policy, Sysmon, or PowerShell-logging phase should start automatically. The next decision, if any, should be a separate, explicitly authorized review once genuine T+24h/T+72h/T+7d measurements (Section J) are available — not bundled into this closure.
