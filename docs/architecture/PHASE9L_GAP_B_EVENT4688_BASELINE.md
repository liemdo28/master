# Phase 9L — Gap-B Phase 1: Windows Process-Creation Forensic Baseline (Event 4688)

**Status: IMPLEMENTATION + NATURAL-EVENT ACCEPTANCE, COMPLETE.** Windows "Audit Process Creation" (Success) was enabled — the narrowest possible Gap-B baseline — and, within hours, a naturally-occurring `mi-core`/`qb-ops-agent` restart provided real acceptance evidence without any deliberate test restart. No further mutation is proposed by this document.

## 1. Phase 9L baseline

**Pre-change state (captured from a genuinely elevated PowerShell session before any mutation):**

| Item | Value |
|---|---|
| Process Creation auditing | `No Auditing` |
| `ProcessCreationIncludeCmdLine_Enabled` | Not configured (registry query: `ERROR: unable to find the specified registry key or value`) — command-line capture off by default |
| Security log max size | 20,971,520 bytes (20 MB) |
| Security log retention | `false` (overwrite oldest when full) |
| Security log autoBackup | `false` |
| Sysmon | Not installed (`Get-Service -Name Sysmon` → not found) |
| PowerShell Script Block / Module / Transcription logging | Off (all three registry policy paths confirmed absent; no local-GPO `audit.csv` exists) |
| Schema | v10 |
| Authority | `unknownMutations=0`, `unresolvedLegacyMutations=0` |
| Deployed functional SHA | `2bd6752ef132bca37318f37fe73ddad26e91fac5` |

**Policy mutation performed** (single command, run by the operator in a verified-elevated PowerShell session — this agent has no elevation path and did not and cannot execute it):

```
auditpol /set /subcategory:"Process Creation" /success:enable
```

Verified immediately after: `Process Creation` → `Success` (was `No Auditing`). **Only this one subcategory was changed.** Command-line capture remained off throughout (independently re-verified via real Event 4688 samples showing `Process Command Line:` empty in every case). No reboot was required or performed.

**Rollback target** (documented, not executed): restore to the original `No Auditing` state via `auditpol /set /subcategory:"Process Creation" /success:disable`. This is the exact pre-change baseline captured above, not an assumption.

## 2. Natural acceptance event

A naturally-occurring restart of both `mi-core` and `qb-ops-agent` occurred at **2026-08-24 14:06:48–49 local**, PM2 daemon PID `19640` / `0x4CB8`, while Process Creation Success auditing was already active. Per the Phase 9L design, **no deliberate `pm2 restart` was performed or requested** — this natural event serves as the acceptance test in its place.

## 3. Expanded Event 4688 result

An expanded window (`2026-08-24 14:05:30` through `14:06:53`, ~83 seconds) was reviewed. Findings:

- **No external PM2 daemon-client process was found anywhere in the window.** No unexplained `powershell.exe`, `cmd.exe`, `bash.exe`, `explorer.exe`-rooted shell, Scheduled-Task host, or coding-agent-rooted process chain issued anything toward the PM2 daemon.
- Every relevant process creation traces to one of two long-lived, pre-existing processes: the PM2 daemon (`0x4CB8`) itself, or the old `mi-core` process (`0x1D70` / 7536) performing its own routine background work.
- A large volume of unrelated `git.exe` activity from the Claude Desktop application (`claude.exe`, WindowsApps package, PID `0x1B28`) was also present in the window — confirmed unrelated: it shares no PM2/`node.exe`/`cmd.exe` chain with the restart, and is excluded from the causal analysis. Its presence is noted only as an example of ordinary background noise that Event 4688 will capture indiscriminately.

## 4. PID `0x1D70` correction

**PID `0x1D70` (decimal 7536) — identity: the old `mi-core` process.** This directly matches PM2's own daemon log line for this event (`pid=7536 msg=process killed`).

**Role: routine background activity, NOT the restart initiator.** Evidence:
- Repeated `cmd.exe → node.exe` process creation from this PID occurred at 14:05:34, :39, :44, :49, :56, :57, 14:06:35 (×2), and 14:06:39 — i.e., continuously for over 60 seconds *before* the restart, with no observable change at the restart moment.
- One `cmd.exe → curl.exe` child (14:05:57) is consistent with `connector-live-probes.ts`'s literal shell-out to `curl` — a mi-core-only subsystem, not present anywhere in `qb-ops-agent`'s source.
- The `node.exe`-CLI-style children are consistent with `self-healing-monitor.ts`'s `checkPm2Service()`, which calls `execAsync('pm2 describe ${svc.pm2_name} --no-color')` — a routine, pre-existing health-check call, not a restart command.
- PM2's own daemon subsequently killed this exact PID as part of executing the restart it had already decided on.

**Methodological lesson, preserved explicitly: a process active during a restart is not necessarily the restart's trigger.** This PID's activity pattern was identical before, during, and (by implication) would have continued after had it not been killed — it was doing its own unrelated, already-scheduled work at the moment PM2 acted on it.

## 5. Final event classification

**`PM2_INTERNAL_EXECUTION_TRIGGER_UNKNOWN`**

External command origin is ruled out for this specific event (Section 3). PM2-internal execution is confirmed (the daemon itself, `0x4CB8`, directly issued the `cmd.exe`→`taskkill.exe` sequences and spawned the fresh app processes). The specific internal reason the daemon decided to act is **not** identified. This is deliberately **not** upgraded to `CONFIRMED_PM2_INTERNAL_RESTART`, which would require actually knowing the cause.

## 6. Trigger analysis

| Candidate | Result |
|---|---|
| `max_memory_restart` | RULED_OUT — no matching log line anywhere in `pm2.log` for this event |
| `watch` | RULED_OUT — `watch: false` confirmed in current `ecosystem.config.js` for both apps |
| `cron_restart` | RULED_OUT — not configured for either app |
| SelfHeal | RULED_OUT as restart initiator — zero `command_issued` rows for either service in the event window |
| Programmatic PM2 API | RULED_OUT — zero real `pm2.connect`/`pm2.restart`/etc. calls found in current deployed source (3 grep matches were confirmed false positives: a local variable named `pm2` holding data fields like `pm2.restart_count`) |
| `qb-ops-agent` causal role | RULED_OUT — no code path found capable of triggering a `mi-core` restart, and its own old process shows the same "killed mid-routine-work" pattern as `mi-core`'s |
| App crash / fatal error | No supporting evidence — no uncaught exception, unhandled rejection, or fatal-error log line in either app's log around the event; notably, neither app's own SIGINT/SIGTERM handler log line ever appears either, confirming PM2's Windows `taskkill`-based stop mechanism bypasses the app's own signal handlers entirely |
| PM2 internal trigger | **UNKNOWN** — no mechanism is invented to fill this gap |

## 7. Event 4688 sufficiency

| Question | Result |
|---|---|
| A. Was the restart externally initiated? | **YES** — answerable; result was NO |
| B. Which process/user/session initiated it? | **PARTIAL** — the daemon's own identity is fully known; there is no external user/session to identify since none exists |
| C. Which PM2 verb was issued? | **NO** — not visible from 4688 alone; only knowable by correlating with `pm2.log`'s own `"Stopping app"` lines |
| D. Which PM2 target was issued? | **NO** from 4688 alone — same limitation |
| E. Was the restart PM2-native? | **YES** |

**This is a successful result, not a failure.** The original forensic goal of Phase 9L Phase 1 was to determine whether the UNKNOWN-class restarts are external/manual versus internal to PM2. For this first instrumented event, that question was materially and directly answered.

## 8. Sysmon decision

**`NOT_NEEDED`**

Event 4688 combined with the existing PM2 daemon log was sufficient to classify this event's origin class. Sysmon's added command-line/verb/target visibility does not currently justify its service/driver installation, ongoing maintenance burden, or additional privacy exposure. This is **not** a claim that Sysmon is permanently unnecessary — only that current evidence does not justify it now.

## 9. Privacy result

- Command-line captured: **NO**
- Unexpected sensitive content: **NONE OBSERVED**

This is not "zero privacy impact." Event 4688, even without command-line capture, still records process names, PIDs, creator/parent relationships, account/logon context, and timestamps for every process created on the host — including entirely unrelated activity (as demonstrated by the Claude Desktop `git.exe` burst captured incidentally in this same window).

## 10. Retention finding

**`RETENTION_INSUFFICIENT`**

The Security log remains configured at 20 MB with overwrite-when-full behavior (unchanged by this phase). The natural-event window alone (~83 seconds) produced 200+ events, dominated by ordinary background activity unrelated to PM2. No exact retention duration is claimed without direct measurement, but at this observed rate, a 20 MB log is very unlikely to preserve even a single day of evidence, let alone the ~30-day forensic target identified in the original Phase 9K proposal. **No change to Security log size or retention was made or is proposed by this document** — that is explicitly a separate host-policy decision.

## 11. Historical events

- Historical UNKNOWN count before this natural event: **13**
- Reclassified as a result of this event: **0**
- Historical UNKNOWN remaining: **13**

The 2026-08-24 14:06:48–49 event is a **new, forward-looking, Gap-B-instrumented event** — it is not counted as a resolution of any prior historical UNKNOWN event. Its signature (paired `qb-ops-agent`+`mi-core`, ordinary `code 1/SIGINT`) partially matches several of the 13 prior events, but per this program's own epistemic rules, a signature match does not constitute proof of a shared cause for those earlier, uninstrumented events. They remain UNKNOWN.

## 12. Authority / production boundary

Explicitly confirmed, throughout Phase 9L's entire implementation and natural-event investigation:

- No application code changed.
- No schema changed (v10, unchanged).
- No `ActionType` changed (still exactly 7 values).
- No authority model changed (`unknownMutations=0`, `unresolvedLegacyMutations=0`, unchanged).
- No PM2 configuration changed.
- No SelfHeal change.
- No deploy performed.
- No controlled/deliberate restart performed — the natural event served as the acceptance test.
- No Sysmon installed or configured.
- No command-line capture enabled.
- No PowerShell logging enabled.
- No Security log size/retention change.

**Authority delta: ZERO.**

## 13. Phase 9L final classification

```
PHASE 9L CLASSIFICATION:        EVENT4688_PARTIALLY_SUFFICIENT
NATURAL EVENT CLASSIFICATION:   PM2_INTERNAL_EXECUTION_TRIGGER_UNKNOWN
SYSMON:                         NOT_NEEDED
CONTROLLED RESTART:             NOT_NEEDED
```

## 14. Remaining operational debt (kept explicitly separate — not merged into one "restart problem")

- **A.** The specific PM2-internal trigger for the 2026-08-24 14:06:48–49 event remains unknown.
- **B.** Security log retention (20 MB, overwrite-when-full) is likely insufficient for long forensic windows — unmeasured precisely, but strongly indicated by observed volume.
- **C.** 13 historical UNKNOWN restart events remain UNKNOWN — unaffected by this phase.
- **D.** Event 4688 without command-line capture does not expose the PM2 verb or target directly — only via correlation with `pm2.log`.
- **E.** No evidence currently justifies Sysmon; this may be revisited only if a future event proves 4688 + `pm2.log` correlation insufficient.

## 15. Recommendation

**PRESERVE EVENT 4688 BASELINE AND MONITOR.**

No further implementation phase should start automatically. Do not change Security log retention automatically. Do not add Sysmon. Do not add Gap-A. The next decision, if any, should be a separate, explicit host-policy decision about whether the 20 MB Security-log retention is operationally sufficient — not bundled into this closure.
