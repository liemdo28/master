# Phase 9H — `mi-core` Restart Timeline (Full Retained History)

Read-only reconstruction. Source: `~/.pm2/pm2.log` (PM2 daemon log, retained range **2026-08-13T13:25:57 to 2026-08-22T14:14:31**, all timestamps below are **local system time, UTC+7**, exactly as PM2 wrote them). Windows Event Log cross-references use the same local clock. `self_heal_restart_log` (`F:\.local-agent-global\ops\ops.db`) only retains **2026-08-20T07:56:25Z to 2026-08-22T08:45:44Z** (UTC) — anything earlier has no SelfHeal data available (retention gap, not proof of absence, stated explicitly wherever it matters below).

This is 9 days 1 hour of PM2-daemon-log retention, exceeding the 7-day minimum target.

## Method

`~/.pm2/pm2.log` was parsed for every `App [mi-core:N] exited ...` line. Consecutive exits ≤60s apart were grouped into one logical restart cluster (this collapses PM2's exponential-backoff retry bursts into a single event). Each cluster was then matched against three independently-sourced reference timestamps:
- **Deploy backups** — `mi-core-predeploy-backups/phase*-<UTC-ISO>` directory names (exact, machine-generated, not self-reported)
- **Windows shutdown/boot events** — `Get-WinEvent` System log, Event ID 1074 (shutdown-initiated) and Event ID 12 (OS started)
- **Incident evidence** — a previously-created `incident-pm2-restart-storm-2026-08-20T05-32-45.000Z` backup directory (pre-existing, not created by this audit)

A match required the reference timestamp to fall within the cluster's actual [start, end] span, extended by a 5–20 minute tolerance (wider for deploy backups, since backup-then-restart is a multi-step sequence).

## Full cluster table (35 distinct clusters)

| # | Start (local) | Exits | Exit signature | Match | Classification |
|---|---|---|---|---|---|
| 1 | 2026-08-13T13:25:57 | 15 | code 1 / SIGINT, exponential backoff 500ms→~9s | none (predates first labeled backup that day) | PROBABLE_OPERATOR_OR_EXTERNAL_COMMAND — backoff-retry shape is the signature of an actively-iterated broken deploy, no exact command evidence |
| 2 | 2026-08-13T13:33:00 | 11 | code 1 / SIGINT, same backoff pattern | none | PROBABLE_OPERATOR_OR_EXTERNAL_COMMAND (continuation of #1) |
| 3 | 2026-08-13T15:37:22 | 1 | code 1 / SIGINT | none | **UNKNOWN** |
| 4 | 2026-08-13T18:59:08 | 1 | code 1 / SIGINT | none | **UNKNOWN** |
| 5 | 2026-08-13T22:39:29 | 1 | code 1 / SIGINT | `phase7b` backup 22:31:41 (+8m) | CONFIRMED_DEPLOY_ACTION |
| 6 | 2026-08-14T16:41:32 | 1 | code 1 / SIGINT | `phase7c` backup 16:36:37 (+5m) | CONFIRMED_DEPLOY_ACTION |
| 7 | 2026-08-14T21:34:15 | 2 | code 1 / SIGINT | `phase7d` backup 21:32:17 (+2m) | CONFIRMED_DEPLOY_ACTION |
| 8 | 2026-08-15T10:47:12 | 1 | code 1 / SIGINT | `phase7e` backup 10:41:32 (+6m) | CONFIRMED_DEPLOY_ACTION |
| 9 | 2026-08-15T10:48:24 | 1 | code 1 / SIGINT | `phase7e` (deploy iteration) | CONFIRMED_DEPLOY_ACTION |
| 10 | 2026-08-15T10:52:31 | 3 | code 1 / SIGINT | `phase7e` (deploy iteration) | CONFIRMED_DEPLOY_ACTION |
| 11 | 2026-08-15T10:59:23 | 1 | code 1 / SIGINT | `phase7e` (deploy iteration) | CONFIRMED_DEPLOY_ACTION |
| 12 | 2026-08-15T17:45:41 | 1 | code 1 / SIGINT | `phase7f` backup 17:39:30 (+6m) | CONFIRMED_DEPLOY_ACTION |
| — | 2026-08-17T06:22:36 | *(no PM2 log entry — see note)* | — | Kernel-Power Id=41 unclean reboot | CONFIRMED_WINDOWS_HOST_EVENT (real crash; see note below) |
| 13 | 2026-08-17T06:33:55 | 1 | code 1 / SIGINT | 11m after crash-reboot #above (outside 5m tolerance) | **UNKNOWN** (weak temporal proximity to crash-recovery noted, not strong enough to confirm) |
| 14 | 2026-08-17T09:00:21 | 1 | code 1 / SIGINT | `phase7g` backup 08:58:26 (+2m) | CONFIRMED_DEPLOY_ACTION |
| 15 | 2026-08-17T20:47:14 | 1 | code 1 / SIGINT | none | **UNKNOWN** |
| 16 | 2026-08-18T19:36:03 | 4 | Windows CTRL-exit codes (1073807364 / 3221226091) | 1074 shutdown 19:36:03 (exact) | CONFIRMED_OPERATOR_ACTION |
| 17 | 2026-08-19T10:41:47 | 1 | code 1 / SIGINT | ~37m before `phase8b` | PROBABLE_OPERATOR_OR_EXTERNAL_COMMAND |
| 18 | 2026-08-19T10:43:08 | 1 | code 1 / SIGINT | ~35m before `phase8b` | PROBABLE_OPERATOR_OR_EXTERNAL_COMMAND |
| 19 | 2026-08-19T11:18:38 | 1 | code 1 / SIGINT | `phase8b` backup 11:14:30 (+4m) | CONFIRMED_DEPLOY_ACTION |
| 20 | 2026-08-19T11:49:58 | 1 | code 1 / SIGINT | `phase8c` backup 11:48:34 (+1m) | CONFIRMED_DEPLOY_ACTION |
| 21 | 2026-08-19T14:50:14 | 1 | code 1 / SIGINT | `phase8d` backup 14:46:55 (+3m) | CONFIRMED_DEPLOY_ACTION |
| 22 | 2026-08-19T18:57:09 | 4 | Windows CTRL-exit codes | 1074 shutdown 18:57:09 (exact) | CONFIRMED_OPERATOR_ACTION |
| 23 | 2026-08-20T09:55:05 | **782** | code 1 / SIGINT, tight ~5–20s loop | `incident-pm2-restart-storm` backup 12:32:45 (within cluster span); app log shows `EADDRINUSE` port-4001 bind race | CONFIRMED_APPLICATION_CRASH (port-bind/TIME_WAIT race; SelfHeal's pre-hardening logic attempted 2 restarts and logged `FAILED`, per `mi-core-error-tail-pre.log`) |
| 24 | 2026-08-20T14:08:12 | 1 | code 1 / SIGINT | ~47m before `phase9a` | **UNKNOWN** |
| 25 | 2026-08-20T14:55:22 | 1 | code 1 / SIGINT | `phase9a` backup 14:53:14 (+2m) | CONFIRMED_DEPLOY_ACTION |
| 26 | 2026-08-20T15:34:47 | 1 | code 1 / SIGINT | `phase9b` backup 15:32:59 (+2m) | CONFIRMED_DEPLOY_ACTION |
| 27 | 2026-08-20T18:41:25 | 1 | code 1 / SIGINT | `phase9d` backup 18:36:55 (+4m) | CONFIRMED_DEPLOY_ACTION |
| — | 2026-08-20T13:55:26 | *(no PM2 log entry)* | — | Kernel-Power Id=41 unclean reboot | CONFIRMED_WINDOWS_HOST_EVENT (real crash) |
| — | 2026-08-20T13:56:49 | *(no PM2 log entry)* | — | Kernel-Power Id=41 unclean reboot (second, ~1m after recovery) | CONFIRMED_WINDOWS_HOST_EVENT (real crash) |
| 28 | 2026-08-20T23:45:01 | 11 | Windows CTRL-exit codes | 1074 shutdown 23:45:01 (exact); reboot 23:47:27 (+2m) | CONFIRMED_OPERATOR_ACTION |
| 29 | 2026-08-21T22:52:15 | 1 | code 1 / SIGINT | `phase9f` backup 22:44:35 (+8m) | CONFIRMED_DEPLOY_ACTION |
| 30 | 2026-08-21T23:34:37 | 2 | code 1 / SIGINT | none | **UNKNOWN** (previously flagged event — remains unresolved) |
| 31 | 2026-08-22T00:23:19 | 1 | code 1 / SIGINT | none | **UNKNOWN** (previously flagged event — remains unresolved) |
| 32 | 2026-08-22T05:03:13 | 1 | code 1 / SIGINT | none for mi-core itself; `qb-ops-agent` restarted within the same minute | **UNKNOWN** (previously flagged "Event A" — sibling co-occurrence noted, causal link not established) |
| 33 | 2026-08-22T08:31:56 | 1 | code 1 / SIGINT | `phase9g` backup 08:26:54 (+5m) | CONFIRMED_DEPLOY_ACTION |
| 34 | 2026-08-22T09:15:17 | 1 | code 1 / SIGINT | none for mi-core itself; coincides with the in-flight Phase 9G production ingest window (~08:28–09:19 local); `mi-accounting` restarted within the same minute via confirmed governed SelfHeal | **UNKNOWN** (previously flagged "Event B" — this is the exact restart that interrupted the 9G ingest attempt, per `PHASE9G_CLOSURE.md`; its own cause is still not established) |
| 35 | 2026-08-22T12:10:19 | 3 | Windows CTRL-exit codes | 1074 shutdown 12:10:19 (exact); reboot 14:13:53 (+~2h) | CONFIRMED_OPERATOR_ACTION |

**Note on the two silent crash-reboots (8/17 06:22, 8/20 13:55–13:56):** a genuine unclean machine crash gives the OS no time to run PM2's graceful-stop sequence, so no `exited` line is written to `pm2.log` at all — the log simply has no entry spanning the outage. This absence is itself consistent with (not contradicting) a real crash, confirmed independently via `Kernel-Power` Event ID 41 ("The system has rebooted without cleanly shutting down first").

## Daily summary

| Date | mi-core restarts (clusters) | Confirmed | Probable | Unknown |
|---|---|---|---|---|
| 2026-08-13 | 5 | 1 | 2 | 2 |
| 2026-08-14 | 2 | 2 | 0 | 0 |
| 2026-08-15 | 5 | 5 | 0 | 0 |
| 2026-08-17 | 3 | 1 (+1 host-crash) | 0 | 2 |
| 2026-08-18 | 1 | 1 | 0 | 0 |
| 2026-08-19 | 5 | 3 | 2 | 0 |
| 2026-08-20 | 4 | 4 (+2 host-crash) | 0 | 1 |
| 2026-08-21 | 2 | 1 | 0 | 1 |
| 2026-08-22 | 4 | 2 | 0 | 2 |

## Full-fleet event (today, discovered during this audit's Fresh Reality Audit — not a `mi-core`-only restart)

`2026-08-22T14:13:52` local: user-initiated Windows shutdown (05:10:19Z, `StartMenuExperienceHost.exe` "on behalf of user LIEMDO-PC\liemdo") → machine off ~2h → clean cold boot `2026-08-22T14:13:53` local → PM2 daemon (PID 17748) relaunched `14:14:28` → all 6 PM2 apps relaunched `14:14:30–31` via the `HKCU\...\Run\PM2` registry key (`pm2-windows-startup`'s `invisible.vbs` → `pm2_resurrect.cmd` → `pm2 resurrect`). This resets every app's live `restart_time` counter to 0. Classification: CONFIRMED_OPERATOR_ACTION (shutdown) + CONFIRMED_PM2_DAEMON_RECOVERY (resurrect-on-logon, by design).

## Totals

- 35 distinct `mi-core` PM2-log restart clusters + 3 silent host-level crash-reboots + 1 full-fleet daemon-recovery event = **39 total restart-adjacent events** across 9 days.
- **26 confirmed** (17 deploy, 4 operator-shutdown, 1 application-crash/EADDRINUSE, 3 Windows-host-event/crash, 1 daemon-recovery).
- **3 probable** (backoff-retry signature consistent with development iteration, no exact command evidence).
- **9 unknown** (isolated single/double exits, code 1/SIGINT, no matching deploy/shutdown/crash/self-heal/work-order evidence found).
