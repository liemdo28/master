# Phase 9K — Gap-B Windows Process-Creation Forensics Discovery / Proposal

**Status: DISCOVERY / PROPOSAL ONLY. Nothing enabled, installed, or configured.** No Windows Audit Policy, Local Security Policy, Group Policy, registry, Sysmon, PowerShell logging, PM2, or application change was made. This document does not turn anything on.

## A. Executive conclusion

Windows process-creation evidence would materially improve **future** attribution of unexplained PM2 mutations, because the actual command-issuing process (a short-lived `node.exe` running PM2's own CLI script) is architecturally distinct from the PM2-daemon-driven process that actually tears down and relaunches `mi-core` — Windows would log both as separate process-creation events with different parent chains, and the daemon-only case (no preceding external CLI process) is itself a distinguishing absence. The **narrowest sufficient design is not a single option**: Windows Security Event 4688 (Audit Process Creation) **without** command-line capture is low-cost, has effectively no secret-exposure risk, and would already answer *who/what parent/session* launched a PM2 command — but cannot show *which target or verb* (`mi-core` vs `all`, `restart` vs `stop`) since that only exists in the command-line arguments. Full target/verb attribution requires either system-wide command-line capture (Option B, disproportionate secret exposure for this box) or a narrowly-filtered Sysmon Process Create rule scoped only to PM2-related command lines (Option C, bounded exposure, heavier operational footprint). **Classification: `GAP_B_JUSTIFIED`**, specifically for the combination of Option A (baseline) + Option C (narrow filter, for full attribution) — not for Option B, and not for broad/unfiltered Sysmon or PowerShell-only logging. This is a recommendation for a **separately-authorized future phase**, not an implementation.

## B. Frozen baseline

`master` = `2aaecbaf899a6b23f1305ee6bdbdfb487fd09726`. Deployed functional SHA `2bd6752ef132bca37318f37fe73ddad26e91fac5`. Schema v10. Authority: `total=1072, unknownMutations=0, unresolvedLegacyMutations=0`. Prior classification `NO_RELIABLE_EXTERNAL_CHOKE_POINT_FOUND`. 10/10 historical UNKNOWN events remain UNKNOWN. All preserved unchanged by this discovery.

## C. Fresh reality audit

- `origin/master` re-fetched: `2aaecbaf899a6b23f1305ee6bdbdfb487fd09726` — matches frozen baseline exactly.
- Deployed provenance (`.env`, `snapshot-manifest.json`): `2bd6752ef132bca37318f37fe73ddad26e91fac5` — unchanged.
- Authority manifest: `total:1072, unknownMutations:0, unresolvedLegacyMutations:0` — unchanged.
- Schema: v10 — unchanged.
- All 4 canonical DBs: `integrity_check: ok`, 0 FK violations.
- PM2 state: `mi-core` and `qb-ops-agent` both show `restart_time:1`, matching the already-reported, already-classified 10th UNKNOWN event exactly — **no new restart occurred** during this discovery.
- One transient health-check timeout (`STATUS:000` at 5s) was observed and immediately re-verified (`200 OK` at 8.1s on retry, same PID, same listening port) — not a restart, not a STOP condition; noted for completeness.
- **No STOP condition was triggered.**

## D. Current attribution gap

Every prior phase (9H, 9J, the external entry-point discovery) established the same gap: the actual restart command for `mi-core` is issued manually, by whatever human or coding-agent session performs a deploy or intervenes operationally, executed directly against the OS/PM2. No application code, work-order, or self-heal path is responsible for the 10 UNKNOWN events or for ordinary deploys. `pm2.log`'s own `"Stopping app:X"` marker is confirmed universal (present for both genuine external commands and pure internal crash-autorestarts) and cannot itself attribute anything. No Windows-level evidence exists today because no process-creation auditing is currently enabled (Section C.7 below).

## E. Actual PM2 command architecture on this host (read-only, inspected directly)

- `where pm2` resolves two entries: a POSIX shell script `C:\Users\liemdo\AppData\Roaming\npm\pm2` (used by Git Bash / MSYS shells) and `C:\Users\liemdo\AppData\Roaming\npm\pm2.cmd` (used by `cmd.exe`/PowerShell).
- **Confirmed via `command -v pm2` in Git Bash** (this session's own shell, and the shell most coding-agent tool calls in this program use): bare `pm2` resolves to the **extensionless POSIX script**, not `pm2.cmd`.
- That script's logic (`pm2.cmd` mirrors it for Windows-native shells): if `%dp0%\node.exe` doesn't exist (confirmed: it does not — `C:\Users\liemdo\AppData\Roaming\npm\node.exe` is absent), it falls back to bare `node` resolved via `PATH`, which on this host resolves to **`C:\Program Files\nodejs\node.exe`** (confirmed via `where node`) — the same executable already independently observed running the PM2 daemon itself (`Daemon.js`) in this session's earlier process-list captures.
- **The resulting command-issuing process** is therefore approximately: `C:\Program Files\nodejs\node.exe "C:\Users\liemdo\AppData\Roaming\npm\node_modules\pm2\bin\pm2" restart mi-core`, with its **parent process being whatever shell invoked it** (`bash.exe` for Git Bash — including this session's own tool calls — or `cmd.exe`/`powershell.exe` for Windows-native invocation).
- `PM2_HOME` is unset, defaulting to `~/.pm2` (`C:\Users\liemdo\.pm2`), matching every prior phase's log-path findings.
- **Critical distinction (Section 9's core question), confirmed**: the CLI process above only *sends a request* to the already-running PM2 daemon (PID observed as 17748 in this session, `Daemon.js`, long-lived) over its IPC mechanism, then **exits**. The daemon itself is what actually tears down and relaunches the `mi-core` child process. This means a single `pm2 restart mi-core` invocation produces **two distinct Windows process-creation events** with different parents: (1) the short-lived CLI `node.exe`, parented by the *actual issuing shell*, and (2) the new `mi-core` `node.exe`, parented by the **PM2 daemon**, regardless of who requested it. **The command originator is not the process that terminates `mi-core` — this is the load-bearing architectural fact the whole proposal is built on.** A pure internal PM2 autorestart (e.g., after an app crash, no external command at all) produces *only* event (2), with no preceding CLI process — an absence that is itself a meaningful, checkable signal.

## F. Windows 4688 without command line

Per Microsoft's authoritative Event 4688 schema (Security Auditing documentation, subcategory **Audit Process Creation**), fields present regardless of command-line capture include: `Creator Subject` (Security ID, Account Name, Account Domain, **Logon ID**), `New Process ID`, `New Process Name` (full path), `Token Elevation Type`, `Mandatory Label` (integrity level), `Creator Process ID`, and (Windows 10+, event version 2) `Creator Process Name`. **`Process Command Line` is a separate, version-1+ field that is empty by default** and only populated when the distinct policy "Include command line in process creation events" is *also* enabled.

Applied to a future `mi-core` restart: this would show `New Process Name = C:\Program Files\nodejs\node.exe`, `Creator Process Name = <bash.exe | cmd.exe | powershell.exe | ...>`, the Subject SID/Account Name/**Logon ID** of whoever's session launched it, and the Creator Process ID — **enough to answer questions 1–3 and 6 in Section 8 of the objective** (which executable, which user, which logon/session, and — via Creator Process Name — a shell-family distinction between PowerShell/cmd/Git-Bash) **without any command-line exposure at all**. It would **not** show the PM2 target or verb (`mi-core` vs `all`, `restart` vs `stop`) — that information exists only in the command line, which this option excludes by design. **`New Process Name` alone (`node.exe`) is not distinctive** — it is one of the most common executables on this host (used for `mi-core` itself, the PM2 daemon, other PM2 apps, and any Node tooling), so without the command line, an investigator would still need to correlate by exact timestamp and Creator Process ID to conclude a given `node.exe` creation was the PM2 CLI rather than an unrelated Node invocation.

## G. Windows 4688 with command line

With "Include command line in process creation events" also enabled (a separate Administrative Templates policy, per Microsoft's documentation), the `Process Command Line` field would be populated with the literal invocation text — expected, based on the architecture mapped in Section E, to resemble `C:\Program Files\nodejs\node.exe  "C:\Users\liemdo\AppData\Roaming\npm\node_modules\pm2\bin\pm2" restart mi-core` (exact quoting/whitespace not independently verified without executing the command, which this discovery does not do). This would resolve the Section F gap completely — target and verb both become visible — but at the cost of capturing the **full command line of every process created on the entire host**, not just PM2-related ones (Section J/L).

## H. Sysmon narrow-filter option

Per Microsoft's official Sysmon documentation: Event ID 1 (Process Create) always logs the full command line for both the new process and its parent (`CommandLine`, `ParentCommandLine`), plus `Image`, `ParentImage`, `User`, `LogonGuid`/`LogonId`, `ProcessGuid` (stable across PID reuse), `IntegrityLevel`, and file hashes. Sysmon's configuration schema supports `Image`/`ParentImage`/`CommandLine` filter conditions (`is`, `contains`, `begin with`, `end with`, etc.) combinable with `AND`/`OR` rule groups. A narrow rule such as *include Process Create only where `CommandLine contains "pm2"` or `ParentImage end with "\node.exe"` AND `CommandLine contains "pm2"`* is directly expressible and would exclude the overwhelming majority of unrelated process activity on this host, unlike Option B's blanket capture. This resolves both Section F's and G's target/verb question **and** bounds exposure much more tightly than Option B.

**Cost, per Microsoft's own documentation**: Sysmon is "a Windows system service and device driver" installed via `sysmon -i [config]` (requires administrative privilege), running persistently across reboots as a protected process; uninstall is `sysmon -u`, documented as not requiring a reboot either way. This is a real, standing footprint (a new service + kernel driver) that Options A/B do not add, since A/B only toggle native OS audit-policy subcategories that already exist in every Windows installation.

## I. PowerShell logging assessment

Per Microsoft's official `about_Logging_Windows` documentation: **Script Block Logging** (Event ID 4104) records full script/command content and is enabled via `HKLM:\Software\Policies\Microsoft\...\PowerShell\ScriptBlockLogging` (the exact subtree differs between Windows PowerShell 5.1's `Microsoft-Windows-PowerShell/Operational` log and PowerShell 7+'s separate `PowerShellCore/Operational` log, which additionally requires running `$PSHOME\RegisterManifest.ps1` before its provider is even registered). **This machine has both** Windows PowerShell 5.1 (build 26100) and PowerShell 7 (`C:\Program Files\PowerShell\7\pwsh.exe`) installed, confirmed this session — a real fork the design would need to handle twice. **Fatal limitation confirmed in Section E**: this session's own shell, and the shell Git-Bash-based coding-agent tool calls use, resolves `pm2` to a POSIX script executed directly by `bash.exe`/`sh.exe` — **never touching PowerShell at all**. PowerShell-family logging would have **zero visibility** into that entire invocation path, which is demonstrably one of the real operational paths for this project (this session is proof). PowerShell logging is therefore **not evaluated further as a standalone design** — it cannot cover the likely external/manual paths (Decision Gate 2), regardless of its command-content fidelity. Microsoft's own documentation additionally flags Script Block Logging's secret-exposure risk directly, recommending "Protected Event Logging" (asymmetric encryption of log content) whenever it's used beyond diagnostics — corroborating the credential-exposure concern independently of this discovery's own analysis.

## J. Secret-exposure analysis

**No real secret values are reproduced anywhere in this document; only redacted markers.** This host runs, across its many PM2-managed services and this ongoing development program, commands that plausibly carry sensitive values inline: `MI_CORE_API_KEY` (used as an `x-api-key` header value, confirmed present in `self-healing-monitor.ts`'s alert-sending code and elsewhere this session), `gh` CLI operations (GitHub token-authenticated), `git push`/`git remote` operations (potential embedded-credential remote URLs), `npm`/`pm2` environment configuration, and QuickBooks/accounting-adjacent credentials referenced by `qb-ops-agent`. **`SECRET_PRESENT_REDACTED`** is the appropriate marker for any of these if a future review ever needed to describe one — this discovery did not encounter or print any concrete value.

- **Option A (4688, no command line): no command-line exposure at all.** Only process names, PIDs, SIDs/account names, logon IDs, and integrity levels — none of which are secrets themselves (an account name is not a credential).
- **Option B (4688 + command line, system-wide): high exposure.** Every process created on the host — including completely unrelated shell commands, scripts, or tool invocations that happen to embed a token, password, or authorization header as a literal argument — would be captured indiscriminately in the Security event log.
- **Option C (narrow Sysmon, filtered to PM2-related command lines): bounded exposure.** The filter itself (`CommandLine contains "pm2"`) is narrow enough that ordinary unrelated secret-bearing commands (a `curl` call with a bearer token, a `git push` with an embedded credential, a QuickBooks API call) would not match unless they happen to also literally contain the substring `"pm2"` — plausible but far less likely than Option B's blanket capture. The PM2 command line itself (`pm2 restart mi-core`) is not expected to carry a secret argument.
- **Option D (PowerShell Script Block/Transcription): high exposure** for whatever it does capture (full script content, explicitly flagged as high-risk by Microsoft's own docs) — moot regardless per Section I's coverage gap.

**Who can read these logs**: the Windows Security event log is readable by local Administrators and the built-in `Event Log Readers` group by default; ordinary non-elevated users cannot read it (confirmed indirectly this session — the `auditpol /get` query itself failed with "A required privilege is not held by the client" from this non-elevated shell, meaning this session's own execution context cannot read *or* write audit-policy state, a relevant, honest data point about the current privilege boundary). Sysmon's own operational log (`Applications and Services Logs\Microsoft\Windows\Sysmon\Operational`) follows the same general Windows Event Log ACL model. **Retention/export**: standard Windows Event Log export (`.evtx`) or forwarding (WEF/WEC) could duplicate this data to a secondary location; this discovery does not evaluate or propose any such export pipeline.

## K. Privacy analysis

| Option | Privacy impact | Why |
|---|---|---|
| A (4688, no cmdline) | **LOW** | Only process names/PIDs/account identifiers; no content of what a user was doing beyond "ran `node.exe`" |
| B (4688 + cmdline, system-wide) | **HIGH** | Captures literal command lines for every process on the host — file paths, business/customer/financial data if ever passed as CLI arguments, personal shell activity unrelated to `mi-core` entirely |
| C (Sysmon, narrow PM2 filter) | **MODERATE** | Bounded to matching command lines only, but a false-positive match (an unrelated command containing "pm2") would still be captured with full content |
| D (PowerShell Script Block/Transcription) | **HIGH** | Full script/command content by design, explicitly flagged by Microsoft as needing encryption-at-rest for anything beyond diagnostics |

## L. Log volume (relative estimate, not fabricated absolute numbers)

No existing process-creation telemetry is enabled on this host today, so no direct historical baseline exists to extrapolate from. Relative ordering, derived from what each option actually captures: **A (4688, no cmdline) < C (Sysmon, narrow filter) ≪ B (4688 + cmdline, system-wide) ≈ D (PowerShell Script Block, all PowerShell activity)**. This machine runs six PM2-managed services plus ordinary interactive/agent shell use, so **B and D would log substantially more volume than the handful of PM2-relevant events A/C are designed to capture** — a system-wide 4688-with-cmdline or PowerShell-Script-Block policy captures *every* process/script on the box, not just PM2-adjacent ones. **Rollover risk**: Phase 9H already demonstrated this pattern with existing evidence sources — `self_heal_restart_log`'s retention was observed at ~49 hours (then ~2 days) purely from natural growth, and `pm2.log` itself is unbounded/unrotated by `pm2-logrotate` (which only rotates per-app logs). The Windows Security/Sysmon event logs are themselves size-capped ring buffers by default; a broad, high-volume option (B or D) would roll over *faster* than a narrow one (A or C) for the same configured log size, directly working against the retention goal in Section M.

## M. Retention analysis

Phase 9H's own findings are the direct precedent: `pm2.log` retention reached ~9 days naturally; `self_heal_restart_log` reached only ~49 hours before this program's own use extended it further; an unexplained restart is not always noticed the same day it happens (the 10th UNKNOWN event in this program was itself discovered incidentally, not through active monitoring). **Proposed retention target (not implemented): 30 days**, matching the existing `dev2-operations.ts` `runtime-history.json` rolling window already in production use for a related purpose — long enough to survive a delayed-discovery scenario like the 10th event, short enough to bound log volume for options A/C (whose volume is already low). This is a target for a future phase's design, not a change made here.

## N. Tamper/trust model

- **`PROCESS_ATTRIBUTION`**: Windows observed a specific process (by PID/name/hash) being created at a specific time. All options provide this.
- **`USER_SESSION_ATTRIBUTION`**: the SID/Account Name/Logon ID tie the creation to a specific Windows logon session. Options A, B, C provide this (4688's Creator Subject / Sysmon's `User`/`LogonId`).
- **`COMMAND_ATTRIBUTION`**: the literal command/arguments used. Only B and C provide this; A does not.
- **`HUMAN_INTENT_ATTRIBUTION`**: *why* a human or agent decided to run the command, or whether the session itself was legitimate rather than compromised. **No option in this document provides this.** A log entry proves the OS observed a process creation under a given logon; it does not prove who was physically present at the keyboard, what an AI agent "intended," or that the account/session itself wasn't already compromised. **An administrator with access to the machine can, by definition, also alter or delete these logs** (Windows Event Log is not immutable against a user with sufficient privilege on the local box) — none of these options are tamper-proof against a fully compromised or administratively-hostile local session. This ceiling is stated honestly, not glossed over.

## O. False-positive / false-negative matrix

| Scenario | Captured by A/B (4688)? | Captured by C (narrow Sysmon)? | Distinguishable as command-origin? |
|---|---|---|---|
| PM2 CLI via PowerShell | Yes | Yes (filter matches) | Yes |
| PM2 CLI via cmd | Yes | Yes | Yes |
| PM2 CLI via Git Bash | Yes (kernel-level, shell-agnostic) | Yes | Yes |
| Node invoking `pm2.cmd` programmatically | Yes | Yes | Yes |
| PM2 daemon internal autorestart (no external command) | Only the resulting `mi-core` creation, parented by the daemon — **no preceding CLI process** | Same | Yes — by *absence* of a preceding CLI-process event, this is distinguishable from an external command |
| `pm2 resurrect` at Windows boot | Yes (the `wscript.exe`→`pm2_resurrect.cmd` chain would itself be a 4688/Sysmon event) | Yes | Yes |
| PM2 max-memory-restart | No preceding external CLI process; daemon-driven only | Same | Yes, by absence |
| Windows shutdown/host crash | Not a process-creation event at all (this is process *termination*/host-level, outside 4688/Sysmon Event ID 1's scope) | Same | N/A — different evidence class (Windows Event 41/1074, already used in prior phases) |
| Manual `taskkill node.exe` | 4688 only logs *creation*, not termination — **not captured by these events at all** | Same | **False negative** — a termination-only action needs a different event (4689 process-termination auditing, or Sysmon Event ID 5), not evaluated in depth here |
| `pm2 restart all` vs `pm2 restart mi-core` | Distinguishable only with command-line capture (B or C); **not with A** | Distinguishable | Partial — A alone cannot tell these apart |
| Command line contains an unrelated secret | N/A for A; **false-positive-adjacent exposure risk for B**; low risk for C (filtered) | — | Privacy/secret cost, not an attribution false-positive per se |
| Different user/session issues the command | Distinguishable via Logon ID/Account Name in all of A/B/C | — | Yes |

## P. 18-scenario recommendation challenge

| # | Scenario | Attributable with A (4688, no cmdline)? | Attributable with A+C (4688 + narrow Sysmon)? |
|---|---|---|---|
| 1 | Human, PowerShell | Partial (who/parent, not target) | Yes |
| 2 | Human, cmd | Partial | Yes |
| 3 | Human, Git Bash | Partial | Yes |
| 4 | Agent spawns PowerShell → PM2 | Partial | Yes |
| 5 | Agent spawns cmd → PM2 | Partial | Yes |
| 6 | Node `child_process` invokes `pm2.cmd` | Partial | Yes |
| 7 | Scheduled Task invokes PM2 | Partial (Creator Process Name would show the task-host chain) | Yes |
| 8 | Windows boot executes `pm2 resurrect` | Partial (would show the `wscript.exe`/`pm2_resurrect.cmd` chain) | Yes |
| 9 | PM2 max-memory-restart | Yes, by absence of a preceding CLI process | Yes |
| 10 | `mi-core` crashes by itself | Yes, by absence | Yes |
| 11 | Windows host crashes | **Not applicable** — different evidence class entirely (already covered by existing Event 41/1074 correlation from Phase 9H) | Same |
| 12 | `taskkill` instead of PM2 | **No** — 4688 is process-*creation*; a `taskkill` is a termination action with no new relevant process creation to attribute (the `taskkill.exe` process's own creation would be logged, which is itself informative, but the target's termination is not a "creation" event) | Partially — `taskkill.exe`'s own creation (with command line, under Option C's filter if scoped to include it) would be visible if the filter were extended to cover it; not covered by the PM2-only filter as scoped |
| 13 | `pm2 restart all` | Not distinguishable from a single-target restart without command line | Yes |
| 14 | Different user/session | Yes | Yes |
| 15 | Command contains unrelated secret | N/A (no exposure) | Bounded (only if that command also matches the PM2 filter) |
| 16 | Logs roll over before investigation | **No** — this is exactly the retention risk Section M targets | Same risk, mitigated by proposing 30-day retention (not implemented) |
| 17 | Forensic logging service/policy disabled | **No** — an absent/disabled control cannot produce evidence for events during the disabled window | Same |
| 18 | Administrator intentionally deletes evidence | **No** — stated plainly in Section N's trust-model ceiling; this is a real limit of any locally-stored Windows-native evidence source | Same |

## Q. Option scorecard

Scale: 1 (worst) – 5 (best) for positive attributes; for cost attributes, 1 = highest cost, 5 = lowest cost.

| Option | Attribution value | Coverage (all shells) | Secret exposure (5=none) | Privacy cost (5=lowest) | Operational complexity (5=lowest) | Performance cost (5=lowest) | Tamper resistance | Retention burden (5=lowest) | Rollback complexity (5=simplest) | Usefulness for the 10 UNKNOWN-like future case |
|---|---|---|---|---|---|---|---|---|---|---|
| A: 4688, no cmdline | 3 (partial: user/session/parent only) | 5 | 5 | 5 | 5 | 5 | 2 (same as any local Windows log) | 4 | 5 (single policy toggle) | 3 |
| B: 4688 + cmdline (system-wide) | 5 (full) | 5 | 1 | 1 | 4 | 4 | 2 | 2 (highest volume) | 5 (two policy toggles) | 5 |
| C: Sysmon, narrow PM2 filter | 5 (full, plus process hash/GUID/parent chain) | 5 | 4 | 3 | 2 (new service+driver) | 3 (kernel driver overhead) | 2 | 4 | 3 (service+driver uninstall) | 5 |
| D: PowerShell logging (any form) | 4 (full, PowerShell only) | **1** (misses Git Bash/cmd entirely — demonstrated blind spot) | 1–2 | 1 | 3 | 3 | 2 | 3 | 4 | 2 (misses the shell this very session uses) |

**A + C combined** inherits A's low-cost baseline plus C's full attribution for the PM2-specific filtered subset, without B's blanket exposure — this combination scores best overall once B's disproportionate secret/privacy cost and D's coverage gap are weighed against the marginal attribution gain each would add over A+C.

## R. Narrowest-sufficient proposal (not implemented)

**Baseline: Option A** — enable "Audit Process Creation" (Success) with command-line capture left **off**. Cost: one native Windows audit-policy subcategory, zero new service/driver, zero secret exposure, immediate rollback (disable the subcategory). Value: user/session/logon/parent-process attribution for any future process creation, and the crucial ability to distinguish "an external CLI process existed" from "only the daemon acted" (Section O), for **any** shell family (PowerShell, cmd, or Git Bash) since 4688 is kernel-level and shell-agnostic.

**Enhancement, if full target/verb attribution is later judged necessary: Option C** — a Sysmon Process Create filter narrowly scoped to `CommandLine contains "pm2"` (optionally combined with `ParentImage`/`Image` conditions per Microsoft's documented AND/OR rule-group syntax), accepting the added service/driver footprint in exchange for bounded, full-command attribution.

**Explicitly not proposed**: Option B (system-wide command-line capture) or any PowerShell-specific logging as a standalone solution — both fail the narrowest-sufficient bar given A+C achieves comparable or better coverage at materially lower cost.

## S. Rollback design (documented only, not executed)

- **Option A/B (4688)**: disable the "Audit Process Creation" success/failure auditing via the same `auditpol`/Group Policy interface used to enable it; if command-line capture was separately enabled, disable that Administrative Templates policy independently; confirm via a read-only policy query that both have returned to "No Auditing" / disabled; export any already-collected `.evtx` data first if it must be preserved.
- **Option C (Sysmon)**: reconfigure to a no-op/default filter (`sysmon -c --`) or fully uninstall (`sysmon -u`), per Microsoft's documented usage — explicitly stated as not requiring a reboot in either direction; confirm the Sysmon service/driver and its event-log provider registration are both gone; export the `Sysmon/Operational` log first if retention is required.
- No rollback command was executed as part of this discovery.

## T. Future incident-review workflow (design only)

1. Detect a `mi-core` restart timestamp from `pm2.log` (as in every prior phase).
2. Query 4688 (and, if implemented, Sysmon Event ID 1) for the ±60-second window.
3. Identify any `node.exe` (or `pm2.cmd`/shell) process creation whose `Creator Process ID` is **not** the known PM2 daemon PID.
4. Capture that process's PID, `New Process Name`, and (if Option C) command line.
5. Trace `Creator Process ID` to its own creation event to identify the parent shell/agent.
6. Trace the associated Logon ID/Account Name/SID to identify the user/session.
7. If command-line evidence exists (Option C only), confirm the specific PM2 target/verb.
8. Correlate against `pm2.log`'s own daemon-side event for the same restart.
9. Correlate against Windows shutdown/crash events (Event 41/1074/12), as in Phase 9H.
10. Correlate against `self_heal_restart_log`.
11. Correlate against any deploy/release evidence (predeploy-backup timestamps, work-order evidence).
12. Assign one classification: `CONFIRMED_OPERATOR_COMMAND`, `CONFIRMED_AGENT_COMMAND`, `CONFIRMED_SCHEDULED_TASK`, `CONFIRMED_PM2_INTERNAL_RESTART`, `CONFIRMED_HOST_REBOOT`, `CONFIRMED_SELFHEAL`, or `UNKNOWN` if no matching process-creation event exists (e.g., retention already expired, or logging was disabled at the time).

No tooling for this workflow is implemented by this discovery.

## U. Gap-A relationship (conceptual only, not implemented)

Gap-A (an internal `restart_intent_ledger`, per the Phase 9J/9I discoveries) and Gap-B are complementary, not redundant, **in principle**: Gap-A would attribute a restart to a specific *governed internal code path* (self-heal, skill, release-agent) when one of those genuinely fires; Gap-B would attribute a restart to an *external process/user/session* when the command originates outside the application entirely — which every finding to date suggests is the actual source of the 10 UNKNOWN events and of ordinary deploys. Given Phase 9J already found Gap-A's expected value for `mi-core` itself to be near-zero (none of the 3 governed call sites have ever fired for it), **Gap-A is not resurrected by this discovery** — the diagram in the originating prompt is a valid conceptual model, but the evidence does not currently justify implementing both; only Gap-B shows a plausible path to closing the actual observed gap.

## V. Historical limitations

**Gap-B cannot retroactively identify any of the 10 UNKNOWN events.** No Windows process-creation auditing of any kind is currently enabled on this host (confirmed: `auditpol /get` itself failed for lack of privilege from this session, and no Sysmon service exists) — meaning no forensic record exists for any past event, and none can ever be recovered for them. This proposal, if ever authorized and implemented, is **exclusively about future recurrences** from the moment it is enabled onward. It does not, and cannot, explain 2026-08-21T23:34:37, 2026-08-22T00:23:19, 2026-08-22T05:03:13, 2026-08-22T09:15:17, 2026-08-22T18:54:20–25, or any of the other 5 preserved UNKNOWN events. They remain permanently UNKNOWN unless some other, currently-unidentified evidence source is found.

## W. Authority assessment — zero authority delta

Every option evaluated is **observation only**. None of them: create a new `ActionType`, add an execution route, grant autonomous remediation capability, allow the application to change Windows policy dynamically, allow the application to suppress or alter forensic logs, or create any new PM2-mutation endpoint. `mi-core`'s own runtime would have no read or write access to whichever evidence store is eventually chosen (Windows Event Log / Sysmon's operational log) beyond what any other process on the host already has by default — and per Section J, a compromised `mi-core` process could not read the Security event log without elevated privilege in the first place, and could not have write/delete access to it either without administrative rights. This preserves the same "prefer independent evidence sources" principle already used for `self_heal_restart_log` (a separate SQLite file, not inside `mi-core`'s own process memory).

## X. Explicit non-goals

- Does not enable, install, or configure anything (4688, Sysmon, PowerShell logging, Group Policy, registry).
- Does not implement Gap-A.
- Does not retroactively explain any of the 10 UNKNOWN historical events.
- Does not reclassify any of the 10 UNKNOWN events.
- Does not claim any option is tamper-proof, or that it proves human intent — only process/user/session-level observation (Section N).
- Does not recommend PowerShell-specific logging as sufficient, given its demonstrated blind spot for Git-Bash-originated commands.
- Does not recommend system-wide command-line capture (Option B) given its disproportionate secret/privacy cost relative to the narrower A+C combination.
- Creates no schema, DB migration, or authority-manifest change.

---

## FINAL CLASSIFICATION

**GAP_B_JUSTIFIED**

Specifically for the combination of **Option A (Windows Security Event 4688, Audit Process Creation, without command-line capture)** as a low-cost baseline, plus **Option C (a narrowly-filtered Sysmon Process Create rule scoped to PM2-related command lines)** if full target/verb attribution is judged necessary — **not** for system-wide command-line capture (Option B) or PowerShell-specific logging (Option D) as standalone solutions. This classification concerns a **future, separately-authorized implementation phase only**; nothing was enabled by this discovery, and none of the 10 historical UNKNOWN events are affected by it.
