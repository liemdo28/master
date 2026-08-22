# Phase 9H — Read-Only PM2 Restart-Origin Audit

**Status: READ-ONLY DISCOVERY, COMPLETE.** No PM2 mutation, no production change, no remediation was performed. This document, `PHASE9H_RESTART_TIMELINE.md`, and `PHASE9H_PM2_MUTATION_AUTHORITY_MAP.md` are the three required deliverables.

## 0. Mission

Phase 9G closed with one unresolved question: recurring `mi-core` restarts occurred without matching evidence from the governed SelfHeal path, without an identified PM2 max-memory event, daemon restart, or confirmed autonomous code path. This audit's sole question: **who or what is restarting `mi-core`?** No fix was attempted — only evidence-backed classification.

## 1–2. Hard boundary and stop conditions

No PM2 mutation, config change, kill, deploy, ingest, merge, or remediation was performed at any point. No STOP condition (active restart storm, multi-minute outage, new sibling restart during the audit, daemon self-restart, integrity/FK/schema/authority/provenance drift, secret exposure, or need to change production state) occurred during the audit. **STOP STATUS: none triggered.**

## 3. Fresh Reality Audit

**A. Git** — `origin/master` = `6324bb9450ab665596f3b18fe82200efc1bfc574` (Phase 9G closure), working tree clean, closure commit confirmed an ancestor of `master`. Matches the expected baseline exactly.

**B. Production provenance** — `.env`'s `MI_DEPLOYED_SOURCE_SHA`/`MI_DEPLOYED_SOURCE_ROOT` and `server/snapshot-manifest.json` both confirm `2bd6752ef132bca37318f37fe73ddad26e91fac5`; authority manifest `counts` re-read live: `total:1072, unknownMutations:0, unresolvedLegacyMutations:0` — unchanged from Phase 9G. Matches the expected functional baseline exactly.

**C. Production health** — At audit start, `pm2 jlist` showed **all 6 processes** with `restart_time:0` and an identical `pm_uptime` (`2026-08-22T07:14:3x` UTC). This was investigated first, as an unexpected finding (see §4/§11) before proceeding to the historical timeline, and turned out to be a confirmed, benign, operator-initiated host reboot — not a new anomaly requiring a STOP.

**D. Databases** — All 4 canonical DBs: `integrity_check=ok`, 0 FK violations, schema v10 (re-confirmed, unchanged since Phase 9G closure). `self_heal_restart_log` is readable; its retention is **2026-08-20T07:56:25Z – 2026-08-22T08:45:44Z** (49 hours) — narrower than the 9-day PM2-log retention, an evidence-availability boundary stated explicitly wherever it matters below.

## 4. Restart timeline

Full timeline in [`PHASE9H_RESTART_TIMELINE.md`](PHASE9H_RESTART_TIMELINE.md): **39 total restart-adjacent events** over 9 days (2026-08-13 to 2026-08-22) — 35 PM2-log-visible `mi-core` restart clusters, 2 silent host-level crash-reboots (no PM2 log entry possible — see below), and 1 full-fleet PM2-daemon-recovery event discovered live during this audit.

Retention depth achieved: **9 days 1 hour** (exceeds the 7-day minimum; short of the 30-day preference because `~/.pm2/pm2.log`'s own retained range starts at 2026-08-13).

## 5–6. Classification and stop/restart-vs-crash distinction

Of 35 PM2-log clusters: **17 CONFIRMED_DEPLOY_ACTION**, **4 CONFIRMED_OPERATOR_ACTION** (Windows shutdowns), **1 CONFIRMED_APPLICATION_CRASH** (a 782-exit EADDRINUSE port-bind loop), **3 PROBABLE_OPERATOR_OR_EXTERNAL_COMMAND** (backoff-retry shape typical of iterated deploys, no exact command evidence), **9 UNKNOWN**. Plus 2 silent **CONFIRMED_WINDOWS_HOST_EVENT** crash-reboots and 1 **CONFIRMED_PM2_DAEMON_RECOVERY** event.

A clear, evidence-backed exit-code signature separates two populations:
- **Windows CTRL-exit codes** (`1073807364` and `3221226091` together, in a cluster of 3–11 exits) appeared in **exactly 4 clusters**, and all 4 landed within 10 minutes of a directly-confirmed Windows shutdown-initiation event (`Event ID 1074`). This is Windows terminating all processes as part of an actual power-off/restart sequence, not PM2 issuing an ordinary stop command.
- **Ordinary `code 1 / SIGINT`** single (or short-backoff-multi) exits account for every other cluster, including all 17 deploy-matched ones and all 9 unknowns. This is PM2's normal graceful-stop signature (used both for legitimate `pm2 restart` commands and for a process choosing to exit itself, as seen in the EADDRINUSE case where the app explicitly logged `"exiting so PM2 can restart cleanly"`).

No cluster showed a `max-memory-restart` PM2 policy line, a watch-triggered restart, or a `cron_restart` firing — `ecosystem.config.js` confirms `watch: false` and no `cron_restart` is set for `mi-core`.

## 7. PM2 daemon audit

Daemon PID at audit time: `17748`, created `2026-08-22T14:14:28` local (07:14:28 UTC) — i.e. the daemon **did** restart today, but as a direct, confirmed consequence of a full Windows reboot (§11), not an independent daemon-level failure. No other daemon restart was found anywhere in the 9-day `pm2.log` retention (the log itself is one continuous file from 2026-08-13 onward with no gap indicating an earlier daemon restart before today). `pm2-logrotate` module is active and unrelated to process restarts (log-file rotation only). No other PM2 module/plugin is installed.

## 8. PM2 mutation authority map

Full detail in [`PHASE9H_PM2_MUTATION_AUTHORITY_MAP.md`](PHASE9H_PM2_MUTATION_AUTHORITY_MAP.md). Summary: SelfHeal is LIVE_GOVERNED but never restarts `mi-core` (classifies it `not_pm2_type` on all 151 retained evaluations). The GStack `pm2_restart` skill defaults to `mi-core` and is APPROVAL_GATED — zero work-order evidence exists that it has ever fired (the evidence directory has zero `WO-*` subdirectories). `auto-task-engine.restartService()` is a real, ungoverned, hardcoded-to-`mi-core` capability but is **re-confirmed dead code** this session (zero `require()`/`import()` anywhere in the deployed dist — re-checked directly rather than trusting the prior session's conclusion, after an initial scare from a string literal that turned out to be an unrelated status label). `node-controller`'s restart path targets remote secondary-device nodes over HTTP, not the local `mi-core` process. The Windows-logon PM2 resurrect mechanism (`HKCU\...\Run\PM2`) is unconditional but only fires at logon.

## 9. SelfHeal reconstruction

Deployed `self-healing-monitor.js` maps: 60s timer → HTTP health check → service identity → `RESTART_ALLOWLIST` membership check → intentional-stop check → GLOBAL kill-switch → restart attempt → `pm2 restart <name>` → durable log row → next-scan recovery confirmation. Distinct `service_id`s ever logged in `self_heal_restart_log`: `accounting-http, mi-accounting, mi-ceo-observer, mi-core-http, ollama, whatsapp-gateway`. **`qb-ops-agent` is not tracked by this table at all.** Every one of 151 `mi-core-http` rows (100% of its retained history) shows `decision:"not_pm2_type", outcome:null` — SelfHeal has never issued a restart command for `mi-core`, for its entire retained history. This reconciles cleanly with the PM2 log: none of the 9 UNKNOWN clusters show a `command_issued` row, because SelfHeal structurally cannot produce one for this service.

One older, pre-Phase-9A-hardening SelfHeal behavior surfaced from the `incident-pm2-restart-storm` backup's log tail (predates the DB's own retention): during the 2026-08-20 EADDRINUSE crash-loop, the app log shows `[SelfHeal] Restart command FAILED for Mi Core Server (attempt 1/2)` — i.e. an older code path *did* attempt (and fail) to restart it, before whatever hardening produced the current `not_pm2_type` gate. This is historical, not current behavior, and is consistent with that incident being the original motivation for the allowlist/kill-switch/evidence-logging design later formalized.

## 10. Operator/session correlation

PowerShell interactive history (2,513 lines, full available range) contains **zero** `pm2` references at all — and its visible content is entirely for an unrelated project (Cloudflare/`wrangler`/a different repo), confirming this history captures real interactive terminal use and simply never included a manual PM2 command. Git-Bash `.bash_history` is 24 lines, also zero `pm2` matches. This is a genuine, clean negative for *interactively-typed* commands — but it does not (and cannot) capture commands issued non-interactively by prior Claude Code / agent sessions via their own tool-call shells, which do not persist to either history file. Classification for the two 8/19 clusters ~35 minutes before the confirmed `phase8b` deploy, and the two 8/13 backoff-loop clusters, is **PROBABLE_OPERATOR_OR_EXTERNAL_COMMAND** (temporal proximity to known deploy activity plus the deploy-iteration exit signature) rather than **CONFIRMED**, precisely because no direct command-text evidence exists for them — per the false-attribution guard, temporal proximity alone was not upgraded to a confirmed classification anywhere in this audit.

## 11. Windows event correlation

Every Windows-shutdown-attributed cluster was matched to an exact `Event ID 1074` record naming the responsible process and user (`StartMenuExperienceHost.exe ... on behalf of user LIEMDO-PC\liemdo` in 5 of 6 cases; `winlogon.exe ... NT AUTHORITY\SYSTEM` for the one Windows-Update-driven restart on 2026-08-13). Two genuine unclean crash-reboots were found via `Kernel-Power` Event ID 41 ("rebooted without cleanly shutting down first"): **2026-08-17T06:22:36** and **2026-08-20T13:55:26 / 13:56:49** (a second crash ~1 minute after the first recovery attempt). Both are real host-level events, independent of the deploy/shutdown/SelfHeal findings above, and both predate this audit by 2–5 days.

Today's full-fleet event (§4/§3-C) was fully reconstructed: `Event 1074` at `12:10:19` local (user, Start Menu) → `Kernel-Boot` confirms `"last shutdown's success status was true"` at the next boot (`14:13:53`) → PM2 daemon + all 6 apps relaunched within 3 seconds via the `pm2-windows-startup` Run-key mechanism. Clean, fully explained, not a STOP condition.

## 12. Task Scheduler / startup / registry audit

No Scheduled Task with `pm2`/`mi-core`/`node` in its name or action command line was found. The relevant Run key is `HKCU\...\Run\PM2` → `pm2-windows-startup`'s `invisible.vbs`/`pm2_resurrect.cmd` (confirmed firing today, as expected). `Mi-Ultimate.vbs.disabled-phase8a-2026-08-17` remains disabled (re-confirmed present but inert). `antigravity-gateway.vbs` in the Startup folder is unrelated to `mi-core` (targets a different PM2 app). No scheduled task ran in the 07:13–07:16 UTC boot window that references PM2 or Node in its action.

## 13. External agent / tool audit

`auto-task-engine`, the GStack skill/work-order framework, `release-agent`, and `node-controller` were all covered in §8/§9. No evidence of any other local automation tool (WhatsApp command handler, CEO command handler, or external orchestration service) issuing a PM2 command was found in any available log, DB, or evidence directory.

## 14. Process parentage / command-line evidence

No Sysmon or process-creation auditing is installed (confirmed absent; not enabled by this audit, per the hard boundary). Without it, no historical parent-PID/command-line record exists for any past process termination — stated explicitly as a genuine evidence gap, not proof of absence, for all 9 UNKNOWN events.

## 15–16. PM2 watch / memory-policy audit

`ecosystem.config.js` confirms `watch: false`, no `cron_restart`, for `mi-core`. `max_memory_restart: '768M'` is configured but **zero** occurrences of a PM2 max-memory-restart log line were found for `mi-core` anywhere in the 9-day retained `pm2.log`. Classification for every restart: **MEMORY_RULED_OUT** (no PM2 memory-policy log line present) rather than inferred from ingest timing alone, per the audit's own false-positive guard.

## 17. KB-ingest correlation

No new ingest was run. Cross-referencing logged `[Scheduler] Running KB incremental ingest...` lines and the documented Phase 9G manual-ingest window (~08:26–09:19 local) against all 9 UNKNOWN restarts: **only one** (`2026-08-22T09:15:17`) falls inside an active KB-ingest window — and that is the exact restart already documented in `PHASE9G_CLOSURE.md` as the one that interrupted the 9G acceptance ingest. The other 8 UNKNOWN restarts occur with **no** KB task active at all. This weakens, rather than supports, any general KB-ingest-causality hypothesis for the unexplained restarts as a class.

## 18. Sibling-process correlation

Checked all 9 UNKNOWN events for any other PM2 app exiting within ±90 seconds:

| Event | Sibling exit within ±90s |
|---|---|
| 2026-08-13T15:37:22 | none |
| 2026-08-13T18:59:08 | `mi-node-agent` (exact same second) |
| 2026-08-17T20:47:14 | none |
| 2026-08-20T14:08:12 | none |
| 2026-08-21T23:34:37 | none |
| 2026-08-22T00:23:19 | none |
| 2026-08-22T05:03:13 | `qb-ops-agent` (exact same second — previously-flagged "Event A") |
| 2026-08-22T09:15:17 | `mi-accounting` (39s earlier — previously-flagged "Event B", mi-accounting side already CONFIRMED_GOVERNED_SELFHEAL) |

3 of 9 UNKNOWN events are sibling-paired; 6 are solitary. No common PM2-level or SelfHeal mechanism was found that could produce a paired restart of two unrelated services simultaneously (SelfHeal's own allowlist only ever targets one service per eligible decision), so the pairing itself remains unexplained rather than resolved by this correlation — stated as a coincidence-not-yet-explained, not upgraded to a confirmed common cause, per the false-attribution guard.

## 19. Evidence reconciliation

Every restart in `PHASE9H_RESTART_TIMELINE.md` states exactly which evidence sources were checked against it (deploy backups, Windows Event Log, `self_heal_restart_log`, sibling processes, KB-ingest schedule, shell history). No event is labeled `UNKNOWN` without those checks having been run — "unknown" means "checked, no match," never "not investigated."

## 20. False-positive / false-attribution guard — applied

- Suspected SelfHeal for the 9 unknowns → checked the durable table directly → disproven for all 9 (zero matching rows; for `mi-core` specifically, structurally impossible given the `not_pm2_type` gate).
- Suspected `auto-task-engine` → re-verified `require()`/`import()` presence directly this session rather than trusting the prior conclusion → still zero, confirmed dead code, with one initial false-positive scare (a status-label string) caught and resolved before being reported.
- Suspected memory policy → required an actual PM2 memory-policy log line → none found → ruled out, not inferred from ingest timing.
- Suspected deploy action → required an exact predeploy-backup timestamp within tolerance → 17 of 35 clusters met this bar with real evidence; 2 pairs of clusters with only proximate timing were downgraded to `PROBABLE`, not upgraded to `CONFIRMED`.
- Suspected Task Scheduler → required actual task history in the boot window → none found referencing PM2/Node.
- Suspected another agent/tool → required execution evidence (work-order, evidence file) → none found for any candidate.

## 21. Security question

**Does there exist, right now, a `LIVE_UNGOVERNED` path capable of restarting `mi-core`?**

**NO.** See `PHASE9H_PM2_MUTATION_AUTHORITY_MAP.md` for the full reasoning. The one hardcoded-and-ungoverned capability (`auto-task-engine`) is confirmed unreachable; every other capability is approval-gated with zero firing evidence, targets a different process/host, is read-only, or is the expected Windows-logon resurrect mechanism.

## 22. Timeline depth

9 days 1 hour achieved (PM2-daemon-log retention boundary), exceeding the 7-day minimum. `self_heal_restart_log` retention is narrower (49 hours) and is stated as an explicit evidence-availability limit, not treated as proof of absence for anything outside it.

## 23–24. Documents and sanity checks

This document plus `PHASE9H_RESTART_TIMELINE.md` and `PHASE9H_PM2_MUTATION_AUTHORITY_MAP.md` are the three required deliverables (no optional failure-mode-matrix was needed; the timeline table already carries per-event classification). `git diff --check`: clean. Credential scan of the working tree: only benign matches (a security-pattern doc and third-party `node_modules` example/README strings — no real secrets). No PM2 action, ingest, or external connector was triggered by any check in this audit.

## 25. Final classification

**C. NO_ACTIVE_UNCONTROLLED_PATH_FOUND_BUT_HISTORICAL_CAUSE_PARTIALLY_UNKNOWN**

26 of 35 historical PM2-log restart clusters (plus 3 host-crash events and today's daemon-recovery event) are now confirmed or probable with direct evidence. No live, currently-reachable, ungoverned restart mechanism was found. 9 isolated restarts across 9 days remain genuinely unexplained in origin — evidence-exhausted (deploys, shutdowns, SelfHeal, work-orders, shell history, sibling correlation, KB-ingest timing all checked and came back negative for these specific events), not evidence-absent.

## 26. Next-step decision

**RECOMMENDATION: DOCUMENT OPERATIONAL DEBT AND MONITOR**

No single exact remediation target can be named, because no live mechanism was found to fix — naming one would overclaim. Equally, "no remediation required" would understate that 9 restarts across 9 days remain genuinely uncaused in the record. The correct action is to keep this as tracked, monitored operational debt (already reflected in `PHASE9G_CLOSURE.md`'s Section C, and formalized in detail here) rather than to open a remediation phase against an unidentified target.

## 27–28. PR discipline / required final report

See PR description and the closing chat report for the required `DONE / EVIDENCE / CLASSIFICATION / RECOMMENDATION / STOP STATUS` summary.

## 29. Critical principle — self-check

This audit did not treat PM2's `restart_time` reset as evidence of a mystery (it was traced to a real reboot); did not treat temporal proximity to a deploy as proof of causation without a timestamp match (3 clusters were downgraded to `PROBABLE` for exactly this reason); did not treat the self-heal retention boundary as proof mi-core was never restarted by it (the boundary is stated, not assumed away); did not treat `auto-task-engine`'s existence as proof it is live (re-verified reachability directly); did not treat SelfHeal's restart of `mi-accounting` as proof it also explains `mi-core`'s co-occurring restart (the two are reported as an unexplained pairing, not a shared cause); and did not treat the KB-ingest window overlap for one event as proof of ingest-causality for the class (8 of 9 unknowns have no ingest activity at all).
