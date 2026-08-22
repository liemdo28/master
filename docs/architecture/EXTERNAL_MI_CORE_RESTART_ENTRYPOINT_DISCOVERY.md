# External / Manual `mi-core` Restart Entry-Point Discovery

**Status: READ-ONLY DISCOVERY, COMPLETE.** No code changed, no PM2 mutation, no redeploy, no Windows/SelfHeal/config change performed. One STOP condition occurred mid-discovery (a new restart event), was reported and acknowledged, and the investigation resumed as authorized.

## A. Executive conclusion

No real, instrumentable external/manual restart choke point was found. The actual restart mechanism for `mi-core` during known deployments is a **manual command issued by whatever human or coding-agent session performs the deploy**, executed directly against the OS/PM2 — not through any committed script, CI/CD workflow, or in-repo call site. This leaves no durable, attributable trace beyond the (non-forensic) conversational record of that session. Separately, this discovery found and corrected a real error in Phase 9H/9J's own methodology: `auto-task-engine` **is** imported at boot (via an ES `import * as` statement neither phase's regex search matched), though its restart-capable functions remain uncalled by any current caller — a materially different, more fragile "dead code" finding than previously stated. A 10th historical UNKNOWN event (a new `qb-ops-agent`→`mi-core` pairing) was discovered live during this audit's own fresh-reality-audit step, triggering a STOP that was reported and then explicitly resumed. All 10 UNKNOWN events remain UNKNOWN — none reclassified. **Classification: `NO_RELIABLE_EXTERNAL_CHOKE_POINT_FOUND`.**

## B. Fresh reality audit

- `origin/master` = `a098f982ac63e80455c5def4029d9ab7931098b5` (PR #144 merged). Working tree clean on re-check.
- Deployed functional SHA unchanged: `2bd6752ef132bca37318f37fe73ddad26e91fac5`. `server/src` byte-identical to the deployed snapshot (re-diffed).
- Schema v10, unchanged. Authority manifest: `total:1072, unknownMutations:0, unresolvedLegacyMutations:0`, unchanged.
- All 4 canonical DBs: `integrity_check: ok`, 0 FK violations.
- **PM2 live state showed material drift from the previously-reported baseline**: `mi-core` (`restart_time` 0→1, PID 19276→10756) and `qb-ops-agent` (`restart_time` 0→1, PID 3184→12300) had both restarted at `2026-08-22 18:54:20–25` local (`11:54:20–25Z`), ~57 minutes before this audit began. This was reported as a STOP condition, acknowledged by the operator as a new, 10th historical UNKNOWN event, and this discovery was then explicitly authorized to resume.
- No further STOP-triggering event occurred after resumption.

## C. Current deployed provenance

Unchanged throughout this discovery: `.env`'s `MI_DEPLOYED_SOURCE_SHA` / `MI_DEPLOYED_SOURCE_ROOT` and `server/snapshot-manifest.json` both confirm `2bd6752ef132bca37318f37fe73ddad26e91fac5`, matching the frozen Phase 9G/9H baseline exactly.

## D. Actual deployment/restart workflow

No committed script, `package.json` entry, GitHub Actions workflow, `.sh`/`.cmd`/`.ps1` file, or Git hook anywhere in the repository issues `pm2 restart mi-core` or an equivalent mutation (re-confirmed this session; matches the Phase 9J finding). `docs/architecture/PHASE*.md` files reference the restart as a step to be *performed*, not as something a script executes autonomously.

**What actually happens, based on direct operational knowledge of this program:** every deploy-associated restart in this project's history (including the ones this very session performed for Phase 9F and 9G) was issued by a coding-agent session directly invoking `pm2 restart mi-core` through its own non-interactive shell tool, as an explicit step of a documented procedure — not through any application code path. This is a real, demonstrable mechanism for the sessions that did it (this session can attest to its own actions), but it is **not durable forensic evidence for historical, prior-session restarts**: no tool-execution transcript, command log, or audit trail from those earlier sessions is retained anywhere queryable from this environment. This is classified explicitly, per the required distinction:

- **INTENT REPORT** (e.g., a closure doc saying "restarting only mi-core") — exists abundantly.
- **COMMAND TRANSCRIPT** — exists only within a given session's own chat transcript, which is not a system-level forensic artifact retained by the OS, PM2, or any DB this discovery can query.
- **TOOL EXECUTION RECORD** — does not exist as a durable, independently-queryable log.
- **OS PROCESS EVIDENCE** — does not exist (no process-creation auditing enabled; Gap-B, not authorized).
- **PM2 RESULT** — exists (`pm2.log`'s exit/restart lines), but, per finding E.3 below, cannot by itself distinguish an externally-issued command from an internally-triggered one.

This mechanism is classified **`OPERATOR_OR_AGENT_EXTERNAL_SHELL_ENTRY_POINT`**, per the required taxonomy, with **no durable execution evidence** for any restart prior to the current session.

## E. Internal restart surfaces (re-audited fresh, not from PR #144's summary)

### E.1 `self-healing-monitor.ts`
Unchanged from Phase 9J's findings, re-verified directly in current source: 60s scan, `RESTART_ALLOWLIST` derived from `SERVICES_TO_MONITOR`, GLOBAL kill-switch (fail-safe on read error), `intentionally_stopped` check, `MAX_AUTO_RESTART=2`. Evidence written only *after* the attempt (`recordRestartEvidence`), never before. `mi-core-http` remains `not_pm2_type` on every evaluation (re-confirmed: still zero rows targeting `mi-core` across the entire retained log). **New this session**: `qb-ops-agent` is `type:'pm2'` and *is* allowlist-eligible — but a full-history query of `self_heal_restart_log` found **zero rows ever** for `qb-ops-agent` (any decision, any time), meaning SelfHeal's `pm2 describe qb-ops-agent` check has never once observed it unhealthy at a 60s-interval poll — plausible given PM2 auto-restarts it in under 2 seconds, faster than the poll cadence could catch a down window.

### E.2 `skill-registry.ts` `pm2_restart` skill / E.3 `release-agent.ts`
Unchanged: `REQUIRES_APPROVAL`-gated, zero `WO-*` evidence directories exist anywhere on disk (re-confirmed), meaning neither has ever fired historically. Does not plausibly explain any of the 10 UNKNOWN events (no evidence of any kind exists for any of them).

## F. External/manual restart surfaces

No enumerable, bounded set of real external entry points was found beyond the single, informal mechanism in Section D (a human or coding-agent session's direct shell command). This is not a "choke point" in the useful sense the investigation is looking for — it is not a single script or wrapper that could be instrumented; it is simply "whoever is doing the deploy, typing the command directly."

## G. PM2-native restart mechanisms — corrected characterization

Two findings this session materially refine (not contradict) Phase 9H's prior characterization:

1. **`ecosystem.config.js` confirms**: `watch:false`, no `cron_restart`, `max_memory_restart:'768M'` for `mi-core`. Zero max-memory-restart log lines found anywhere in the 9-day-plus `pm2.log` retention, including around the new event — `max_memory_restart` remains ruled out for every observed restart.
2. **`"Stopping app:X"` is a universal PM2 teardown marker, not an explicit-command signature.** Phase 9H's own log-parsing script never matched this line (a different format from the `App [name:N] ...` lines it searched). Direct verification this session: `"Stopping app:mi-core"` appears immediately before **every one of the 45** `mi-core` exit events in the retained log — including all 22 occurrences inside the confirmed, self-inflicted EADDRINUSE crash-loop (Phase 9H's 782-exit storm), where no external command was involved at all. **This line cannot distinguish an externally-issued `pm2 restart` from PM2's own internal crash-response teardown.**
3. **`mi-core`'s own `gracefulShutdown()` always calls `process.exit(0)`** (both the success path and the 5-second forced-timeout fallback, re-confirmed directly in `server/src/index.ts`). Yet every one of the 45 `pm2.log` restart events — deploy-confirmed ones included — shows `exited with code [1]`, never `[0]`. The only other `process.exit(1)` call sites in `mi-core`'s source are exclusively the EADDRINUSE port-bind-retry path (`server/src/index.ts:436,447`), which does not apply to the ordinary (non-storm) restarts (no EADDRINUSE line appears in the app log around any of them, including the new event). **This is an unresolved discrepancy**: either the graceful-shutdown handler is not the code path actually running for these restarts, or PM2's Windows-specific stop mechanism reports a synthetic exit code/signal that does not reflect the app's own `process.exit()` argument. This discovery does not resolve which — it states the discrepancy honestly rather than picking an explanation, per the epistemic rules.

**Conclusion for Section 13's required distinctions**: process-crash/PM2-autorestart, explicit-PM2-mutation-command, daemon-resurrection, and host-reboot remain four genuinely different categories — but **PM2's own log, on this Windows/PM2 setup, cannot reliably distinguish the first two from each other for any single event using exit code/signal/the "Stopping app" line alone.** The only reliable discriminators found across this whole program remain: (a) the distinct double-code Windows-shutdown signature (`1073807364`/`3221226091`, exclusive to confirmed host shutdowns), and (b) independent external correlation (a matching predeploy-backup timestamp, a matching `self_heal_restart_log` row, or a matching Windows Event 41/1074).

## H. RECURRING QB-OPS-AGENT / MI-CORE PAIR ANALYSIS

Three known paired/near-paired occurrences exist across the full retention:

| Event | qb-ops-agent | mi-core | Gap | Exit signature (both) | SelfHeal evidence | Windows event | Deploy/backup activity |
|---|---|---|---|---|---|---|---|
| 2026-08-22 05:03:13 local | exits same second | exits same second | ~0s | code 1/SIGINT | none for either | none | none |
| 2026-08-22 09:15:17 local | — (mi-accounting paired instead, 39s earlier) | exits | — | code 1/SIGINT | mi-accounting: CONFIRMED governed SelfHeal row; mi-core: none | none | coincides with in-flight Phase 9G ingest window (documented) |
| **2026-08-22 18:54:20–25 local (NEW)** | exits first | exits 5s later | **5s** | code 1/SIGINT (both) | **none for either** (re-confirmed, full-history query for qb-ops-agent: zero rows ever) | none (`Kernel-Power`/`Kernel-General` window checked, empty) | none found in the surrounding hour |

Additional structural evidence for the new event specifically:
- `qb-ops-agent`'s restart at 18:54:20 is **not explained by its chronic `settings-cache.json` ENOENT bug** — that error is caught (`try/catch` in `local-db.ts`) and logged every ~60s continuously for hours before, during, and after this restart without ever crashing the process on its own; it is present in the log stream both before and after 18:54:20 with no change in character.
- Immediately after qb-ops-agent's restart, its first command-poll to `mi-core` at 18:54:27 failed with `"fetch failed"` — this is a downstream **symptom** of `mi-core` being mid-restart at that exact moment (mi-core's own exit was at 18:54:25, 2 seconds earlier), not a cause of anything; qb-ops-agent's own reachability audit (below) confirms it has no way to *trigger* a `mi-core` restart in the first place.
- `mi-core`'s own log shows 3 minutes of self-reported degradation immediately before its restart (18:51:54–18:54:07: repeated `[SelfHeal] CEO ALERT: Mi Core HTTP DOWN`, `5 service(s) DOWN`, and two `Alert failed: The operation was aborted due to timeout` lines) — `mi-core`'s own health self-check was already failing before the PM2-level restart occurred. This is a new, real clue unavailable for the older UNKNOWN events (no app-log retention reached that far back), but it explains *symptoms*, not a *cause* — no source of the underlying slowdown was identified.

**Structural comparison, not causation**: two of three known instances show the pairing within a ≤5-second window; the third shows a different partner (`mi-accounting`) entirely. This is a reproducible *temporal* pattern (something, on at least 3 occasions, correlates with a restart of `mi-core` alongside a restart of one specific other service), but no shared causal mechanism was found — see Section I (shared supervision) below, which returns empty.

### Trace: can `qb-ops-agent` restart `mi-core`, directly or indirectly?

Full source audit of `services/qb-ops-agent/src/`:
- **Invoke PM2**: no. Zero `pm2`-related strings anywhere in its source.
- **Invoke shell commands**: only `child_process.execSync()` in `quickbooks/detector.ts`, scoped exclusively to QuickBooks-process-detection commands (e.g. process-list queries) — no PM2, no arbitrary command construction, no caller-controlled command string.
- **Call `mi-core` administrative/restart APIs**: no. Its only outbound calls to `mi-core` (`agent-os-client.ts`) are `POST /agents/heartbeat`, `POST /agents/workflow-result`, and relaying queued items to `item.endpoint` from a locally-persisted outbound queue (all report/status-style, not restart-capable) — plus a separate dashboard client posting QuickBooks machine/workflow status. No restart or admin endpoint is ever called.
- **Spawn child processes**: only the QuickBooks-detection `execSync` above.
- **Trigger Task Scheduler, cause its own PM2 restart, or request a system restart**: no code path found for any of these.
- **Its own SIGINT/SIGTERM handlers**: call `onShutdown()` then `process.exit(0)` — self-termination only, no side effect on any other process.

**`qb-ops-agent` cannot restart `mi-core`, directly or indirectly, through any code path found in its source.** The chronic ENOENT bug is preserved as a separate, correlated-but-unproven forensic curiosity — not fixed, not attributed as a cause of anything, per instruction.

## I. Trace shared supervision

Searched for any mechanism operating on both `qb-ops-agent` and `mi-core` by name: `ecosystem.config.js` (separate, independent app blocks, no multi-target restart command), `self-healing-monitor.ts`'s `SERVICES_TO_MONITOR` (both appear as *independent* array entries in the same sequential 60s scan loop — evaluated one after another, but each with its own isolated eligibility/restart decision; no code path restarts both as a unit), `project-registry.ts`/`service-registry.ts` (both list `restart_cmd` strings for many services, including both of these, but these are static display/documentation strings read by dashboards, not executed anywhere — re-confirmed no `execSync` near either). No committed deployment/maintenance script, Scheduled Task, or startup mechanism referencing both process names together was found. **No shared supervisor was identified.**

## J. Evidence-retention gaps

- `self_heal_restart_log`: retention now spans `2026-08-20T07:56:25Z` onward (unchanged lower bound; naturally extended forward by 2 days since Phase 9H). Anything before that remains a genuine gap, not evidence of absence.
- `pm2.log`: still spans `2026-08-13` onward, now including the new event.
- Interactive shell histories: unchanged, no `pm2` references found (re-confirmed not re-queried this session, no reason to expect a change).
- No tool-execution/command-transcript log exists anywhere for prior sessions' deploy-restart commands — this is the single largest evidence gap bearing directly on the primary question.

## K. Restart attribution choke-point analysis

No candidate choke point passes the bar: there is no single script, wrapper, or gate that every normal deployment is known to pass through. The de facto mechanism (a human/agent typing the command) can restart arbitrary PM2 targets, is trivially bypassable by construction (it *is* the unconstrained baseline), leaves no durable evidence today, and instrumenting it would require either (a) wrapping the `pm2` executable (explicitly forbidden) or (b) host-level process-creation auditing (Gap-B, not authorized). No application-level ledger can observe a command that never passes through the application's own code.

## L. Gap-A comparison — reassessed, further weakened

This discovery adds two data points that lower Gap-A's expected value further beyond Phase 9J's already-narrow assessment: `qb-ops-agent`'s own restart in the new event also shows **zero** evidence across all 3 candidate internal call sites (consistent with its own reachability audit showing no PM2 capability at all), and `self_heal_restart_log` has **never once** fired for `qb-ops-agent` in its entire retained history despite it being allowlist-eligible. A generalized `restart_intent_ledger`, however well-built, would remain silent for this entire class of event (both `mi-core` and `qb-ops-agent` restarts, paired or not) because neither the actual trigger nor any of the 3 candidate call sites participate in producing them. **Gap-A's expected forensic value for the population of restarts actually in question (deploys and the 10 UNKNOWNs) remains effectively zero.**

## M. Gap-B boundary

Not enabled, not configured, not tested — per the explicit boundary. Read-only, this discovery confirms no Windows audit policy, Sysmon installation, PowerShell logging, or Group Policy change was made.

**Would host-level process-creation evidence likely have attributed the new event? `YES`.** Reasoning: the central unresolved ambiguity this session surfaced (Section G) is precisely that PM2's own log cannot distinguish "an external process invoked `pm2 restart <name>`" from "PM2's internal crash-response fired without any new external process." Windows process-creation auditing (Event ID 4688 with command-line capture, or Sysmon Event ID 1) would directly resolve this ambiguity for a *future* recurrence: either it would show a `pm2.exe`/`node.exe` child process with a `restart` argument, a parent PID, and a user/session identity at the exact timestamp (proving an external command), or it would show **no** such process launch at all (strongly implicating an internal PM2/Node mechanism instead, e.g. an as-yet-unidentified crash-response path). This is exactly the class of question application-level evidence (Gap-A) structurally cannot answer, because the events show zero footprint in any of the 3 internal call sites either.

## N. Security/privacy considerations

Consistent with the Phase 9I proposal: process-creation auditing with command-line capture would, if ever authorized, need explicit scoping (e.g., to `pm2.exe`, `node.exe`, `cmd.exe`, `powershell.exe` only) to bound log volume, and a redaction/retention policy for any command-line arguments that could carry secrets. This discovery does not propose enabling it — it only answers the counterfactual question asked.

## O. Recommendation

No new implementation is recommended. The narrow, low-risk finding worth preserving from this discovery is the **correction to the `auto-task-engine` reachability claim** (Section P) — this should be reflected the next time any document restates Phase 9H's findings, without reclassifying Phase 9H's overall conclusion, since the corrected reachability still resolves to "not currently callable by anything."

## P. Explicit non-goals / corrections

- Does not reclassify any of the 10 UNKNOWN events — all remain UNKNOWN.
- Does not attribute the `qb-ops-agent`↔`mi-core` pairing to any mechanism — correlation only, stated as such.
- **Corrects, but does not reverse, the `auto-task-engine` finding**: Phase 9H and Phase 9J both stated "zero `require()`/`import()` anywhere in the deployed dist," searched via a regex that only matched `require(...)` and `import(...)` (dynamic import call syntax). A fresh, careful trace this session found `ceo-command-center/index.ts:21` contains `import * as AutoTaskEngine from '../auto-task-engine'` — a static ES import, which the prior regex could not match, and `ceo-command-center` is itself wired into the boot sequence (`server/src/index.ts:133`). This means `auto-task-engine`'s module-level code **does** execute at boot (a real correction to "never imported"). However, tracing further: `ceo-command-center/index.ts` never calls any of the 7 functions `auto-task-engine` exports (verified: zero occurrences of `AutoTaskEngine.` anywhere in the file besides the import and an unrelated status-label string), and a codebase-wide search found **zero** callers anywhere of `assignOwner(`, `generateTaskFromSignal(`, `escalateTask(`, or `scanForDegradedSignals(` — the only 4 entry points that could reach `executeOwnerAction()` → `restartService()` → `execSync('pm2 restart mi-core')`. `ensureDirs()` does not run at module top level either. **Corrected classification: `DEAD_CODE_UNGOVERNED_CAPABILITY` — the module is loaded, but its restart-capable function chain is not currently reachable by any caller.** This is a materially more fragile "dead" than the prior "never imported" framing (a single future call to any of the 4 entry points anywhere in the codebase would make it live), and this correction should be carried forward.
- Does not enable, configure, or test any Gap-B mechanism.
- Does not implement Gap-A.
- Creates no new authority, `ActionType`, schema, or DB migration.

## Q. Exact next-step acceptance criteria

If a future phase is authorized to pursue attribution further, it should be scoped narrowly to one of: (a) explicitly deciding whether to enable a tightly-scoped Windows process-creation audit policy (Gap-B) given Section M's `YES` answer, or (b) formally correcting the `auto-task-engine` reachability language in Phase 9H's frozen record without altering its overall classification. Neither is authorized by this document.

---

## 10-EVENT UNKNOWN CORRELATION MATRIX

Candidate mechanisms tested per event: **DEPLOY** (predeploy-backup timestamp match), **SELF_HEAL** (`self_heal_restart_log` row), **PM2_CRASH_NATIVE** (max-memory/EADDRINUSE/other app-log evidence), **WINDOWS_HOST_EVENT** (Event 41/1074/12 match), **SHARED_SUPERVISOR** (a mechanism found operating on the paired target too), **AGENT_SHELL** (durable command-execution evidence, as opposed to an intent report).

| # | Event (local) | DEPLOY | SELF_HEAL | PM2_CRASH_NATIVE | WINDOWS_HOST_EVENT | SHARED_SUPERVISOR | AGENT_SHELL |
|---|---|---|---|---|---|---|---|
| 1 | 2026-08-13T15:37:22 | NO_MATCH | NO_MATCH (predates retention) | NO_MATCH | NO_MATCH | NO_MATCH | INSUFFICIENT_EVIDENCE |
| 2 | 2026-08-13T18:59:08 | NO_MATCH | NO_MATCH (predates retention) | NO_MATCH | NO_MATCH | PLAUSIBLE_BUT_UNPROVEN (`mi-node-agent` co-exited same second; no shared mechanism found) | INSUFFICIENT_EVIDENCE |
| 3 | 2026-08-17T06:33:55 | NO_MATCH | NO_MATCH (predates retention) | NO_MATCH | PLAUSIBLE_BUT_UNPROVEN (11 min after a confirmed crash-reboot, outside tolerance) | NO_MATCH | INSUFFICIENT_EVIDENCE |
| 4 | 2026-08-17T20:47:14 | NO_MATCH | NO_MATCH (predates retention) | NO_MATCH | NO_MATCH | NO_MATCH | INSUFFICIENT_EVIDENCE |
| 5 | 2026-08-20T14:08:12 | NO_MATCH (47m before nearest backup) | NO_MATCH (predates retention) | NO_MATCH | NO_MATCH | NO_MATCH | INSUFFICIENT_EVIDENCE |
| 6 | 2026-08-21T23:34:37 | NO_MATCH | NO_MATCH | NO_MATCH | NO_MATCH | NO_MATCH | INSUFFICIENT_EVIDENCE |
| 7 | 2026-08-22T00:23:19 | NO_MATCH | NO_MATCH | NO_MATCH | NO_MATCH | NO_MATCH | INSUFFICIENT_EVIDENCE |
| 8 | 2026-08-22T05:03:13 | NO_MATCH | NO_MATCH | NO_MATCH | NO_MATCH | PLAUSIBLE_BUT_UNPROVEN (`qb-ops-agent` co-exited same second; no shared mechanism found) | INSUFFICIENT_EVIDENCE |
| 9 | 2026-08-22T09:15:17 | NO_MATCH (mi-core side); DEPLOY N/A | SUPPORTED for `mi-accounting` only (governed row exists); NO_MATCH for `mi-core` itself | NO_MATCH | NO_MATCH | PLAUSIBLE_BUT_UNPROVEN (`mi-accounting` restart 39s earlier, separately explained; not a shared cause for `mi-core`) | INSUFFICIENT_EVIDENCE |
| 10 (NEW) | 2026-08-22T18:54:25 | NO_MATCH | NO_MATCH (full-history check, both targets) | NO_MATCH (no EADDRINUSE/memory line) | NO_MATCH (checked, empty) | PLAUSIBLE_BUT_UNPROVEN (`qb-ops-agent` co-exited 5s earlier; reachability-traced, no shared mechanism found) | INSUFFICIENT_EVIDENCE |

No cell was upgraded from `PLAUSIBLE_BUT_UNPROVEN`/`NO_MATCH` to `SUPPORTED` without direct evidence. The only `SUPPORTED` cell in the entire matrix is `mi-accounting`'s own restart in event 9 — already established in Phase 9H — which explains a *sibling*, not `mi-core` itself.

**All 10 events remain classified `UNKNOWN`.**

---

## FINAL CLASSIFICATION

**NO_RELIABLE_EXTERNAL_CHOKE_POINT_FOUND**

**RECOMMENDED_NEXT_STEP** = Correct the `auto-task-engine` reachability language in the permanent record (Section P) — a narrow, zero-risk documentation fix — and treat any further attribution work (Gap-A implementation, or a Gap-B authorization decision) as separately gated future decisions, not a continuation of this discovery.
