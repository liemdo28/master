# PM2 Restart Forensic Evidence Hardening — Proposal / Discovery Only

**Status: PROPOSAL ONLY. No code changed. No PM2 mutation, deploy, or config change performed.** This document does not prevent or change restart behavior. Its purpose is to make the *next* unexplained restart attributable with durable evidence — nothing here retroactively resolves Phase 9H's 9 UNKNOWN events.

## Fresh reality audit (re-verified this session, not assumed from Phase 9H)

- Current `master` = `29cbc2fed62e9e7259c0ecde8cbe928320bff1dc` (Phase 9H closure). Deployed functional SHA unchanged: `2bd6752ef132bca37318f37fe73ddad26e91fac5`.
- **Diffed current `master`'s `server/src` against the deployed source snapshot — byte-identical, zero drift.** Phase 9H's dist-based findings are re-confirmed to still describe current master.
- Re-grepped current source (not the Phase 9H write-up) for every literal `pm2 restart|reload|stop|delete|resurrect|kill` occurrence — same set of call sites found, plus additional corroborating governance evidence not previously cited: `gstack/approval-engine.ts:54` lists `'pm2_restart'` in its approval-required action list, and `gstack/role-registry.ts:67,69` independently marks `pm2_restart` as both a `can_execute` and a `requires_approval_for` entry. Three independent places in the codebase agree this action is approval-gated — no new surface, no drift, but a stronger evidence base than Phase 9H cited.
- PM2 live state re-checked: all 6 processes online, `restart_time:0` (unchanged since the Phase 9H full-fleet event), no new restart since Phase 9H closed.

## 1. Current restart-authority graph (unchanged from Phase 9H, re-verified)

| Surface | Governance | Fires? |
|---|---|---|
| `self-healing-monitor.ts` → `execAsync('pm2 restart ${svc.pm2_name}')` | `RESTART_ALLOWLIST` + eligibility + kill-switch; `mi-core-http` hardcoded to `not_pm2_type` | Never for `mi-core` (151/151 evaluations); does fire for `mi-accounting` |
| `skill-registry.ts` `pm2_restart` skill (defaults to `mi-core`) | `REQUIRES_APPROVAL`, cross-confirmed in `approval-engine.ts` and `role-registry.ts` | Never (zero `WO-*` evidence directories exist at all) |
| `release-agent.ts` restart step | Same skill/approval framework | Never (same zero-evidence result) |
| `node-controller.ts` restart | Targets remote secondary-device nodes over HTTP, not local `mi-core` | Not applicable to `mi-core` |
| `auto-task-engine.ts` `restartService()` | None — the one genuinely ungoverned capability | Dead code, zero imports anywhere in deployed dist (re-confirmed) |
| `pm2-windows-startup` (`HKCU\...\Run\PM2`) | Unconditional resurrect-all on logon | Fires only at logon (confirmed once, today) |

No new surface was found. This table exists here only so the proposal below is legible without re-opening Phase 9H's documents.

## 2. Current evidence sources and retention windows

| Source | Type | Granularity | Retention observed | Attribution content |
|---|---|---|---|---|
| `~/.pm2/pm2.log` | File, daemon-native | Second-precision, exit code + signal | 9+ days (grows unbounded; not covered by `pm2-logrotate`, which only rotates per-app logs) | App lifecycle only — records *that* PM2 restarted the app and how it exited, never *who told PM2 to* |
| `.local-agent-global/logs/mi-core-{out,error}.log` (+ rotated archives) | File, app-native (custom `ecosystem.config.js` path) | Second-precision, app's own console output | ~7 days (`pm2-logrotate` `retain:7`) | App-internal signals only (e.g. the EADDRINUSE messages that explained the 782-exit storm); no external-command visibility |
| `self_heal_restart_log` (`ops.db`, SQLite/WAL) | DB, durable | Per-evaluation-cycle | Observed 2026-08-20T07:56Z onward (growing; not necessarily capped, just young) | Full attribution, but **only** for SelfHeal's own decisions — structurally cannot represent a restart it didn't initiate |
| `.local-agent-global/evidence/WO-*/` | Files, per-work-order | Per-invocation | Unbounded (never pruned) | Full attribution (command, output, skill, work-order id) **only if** a governed skill actually fired — currently empty |
| `.local-agent-global/operations/runtime-history.json` (Dev2 ops) | File, JSON | **Hourly** poll of `pm2_env.restart_time`/uptime | 30-day rolling window (`cutoff` in `dev2-operations.ts`); 1,160 samples on disk today, spanning this entire audit's timeline | Can detect *that* a restart occurred between two polls (counter delta) and bound it to an hour; zero cause information |
| Windows Event Log (System) | OS-native | Second-precision | Observed useful ring-buffer ~10 days | Host-level events only (shutdown/boot/crash) — nothing PM2-specific |
| Predeploy-backup directory names | Files, deploy-tooling | Second-precision (embedded in dirname) | Unbounded (never pruned) | Attributes a restart to a specific deploy phase, only if a backup was actually taken for it |
| PowerShell/bash interactive history | File | Per-command | Small, unpruned window (2,513 / 24 lines observed) | Would show an interactively-typed `pm2 restart`, but **not** a command run by a non-interactive tool-call shell (confirmed structurally: Claude Code's own Bash-tool invocations do not persist here) |

## 3. Attribution gaps

Two distinct gaps, not one:

**Gap A — restarts issued by this codebase's own governed call sites.** These already have partial infrastructure (`self_heal_restart_log`, work-order evidence) but it is inconsistently applied: `self-healing-monitor.ts` writes a durable row on every decision; `skill-registry.ts` and `release-agent.ts` only write evidence *if* a work order object (`wo`) is present, and only *after* the command already ran (`execSync` is synchronous and would already have completed or thrown by the time `writeCommandOutput` executes) — a crash between the exec and the write would lose the record. Closing this gap requires no new authority: it means every existing call site logs its own already-authorized action, before firing it, to a shared durable ledger.

**Gap B — restarts issued from outside this codebase entirely** (a human typing `pm2 restart mi-core` directly in an interactive terminal, or a non-interactive tool-call shell from an unrelated session/process). This is almost certainly what the 9 Phase 9H UNKNOWN events are, given every in-repo governed path was checked and came back negative for all 9. **No passive mechanism internal to this codebase can close Gap B**, because the calling process is never inside mi-core's own runtime. Closing Gap B requires either (a) OS-level process-creation auditing (Windows' native "Audit Process Creation" + "include command line" policy, or Sysmon), which is a genuine passive-observation feature unrelated to PM2 itself, or (b) a universal interactive-shell logging hook (covers only interactively-typed commands, not tool-call shells) — see §9 for why this is flagged as a decision point rather than folded into the recommendation.

## 4. Minimum proposed evidence architecture

**For Gap A (in-repo call sites) — the only piece proposed for near-term implementation:**

Extend the existing `self_heal_restart_log` durability pattern (already proven to survive every restart/reboot/daemon-recovery event observed this entire program) into a generalized `restart_intent_ledger` table in the same `ops.db`, with one new column beyond what `self_heal_restart_log` already has: `issuing_surface` (a fixed string identifying the call site, e.g. `'self_heal'`, `'skill:pm2_restart'`, `'release_agent'`) and `caller_pid` (`process.pid` of the Node process making the call — attributes *which running mi-core instance* issued the command, which matters since `mi-core` itself is one of the possible restart targets). Each of the 3 already-known, already-governed call sites (`self-healing-monitor.ts`, `skill-registry.ts`, `release-agent.ts`) gains one `INSERT` immediately **before** its existing `execSync`/`execAsync` call — not a new capability, not a new authority, purely an additional durable log line preceding an action that already happens today.

**For Gap B — proposed but explicitly not recommended for silent adoption (see §9):**
Enable Windows' native process-creation auditing with command-line logging (`Audit Process Creation` + `ProcessCreationIncludeCmdLine_Enabled`, or install Sysmon with a config scoped to `pm2.exe`/`node.exe`/`cmd.exe`/`powershell.exe` process creation only). This is passive OS-level observation — it does not touch PM2, does not add any mutation capability, and does not require a wrapper around anything. It is flagged separately because it is a host security-policy change outside mi-core's own codebase and has its own resource/log-volume/privacy considerations that deserve an explicit decision.

**Explicitly not proposed, per the hard constraints:** no PM2 monkey-patch, no replacement of the `pm2` executable, no interception of arbitrary shell commands, no new autonomous restart mechanism, no SelfHeal authority expansion, no memory-limit change, no restart-policy change, no removal of any existing recovery mechanism.

## 5. Security / authority impact

**Zero.** The Gap-A proposal adds only `INSERT` statements immediately before three pre-existing, already-authorized `execSync`/`execAsync` calls. It does not change `RESTART_ALLOWLIST`, `approval_class`, the kill-switch, or any policy. It cannot cause a restart that wasn't already going to happen, and it cannot block one either (see failure modes). The Gap-B option (OS auditing) adds observability only — it has no interaction with PM2's mutation authority at all, but does represent a broader host-level change (more auditable command-line history exists system-wide, for every process, not just mi-core's).

## 6. Failure modes

- **Ledger write fails or the DB is locked**: the write must be wrapped in try/catch and be strictly best-effort — a logging failure must never block, delay, or alter the underlying restart action. This mirrors `self_heal_restart_log`'s existing behavior (already proven not to interfere with the restart it's logging).
- **Process dies between the ledger write and the actual `execSync` call**: acceptable — a logged-but-not-executed intent is a rare, honest artifact (better than silence), not a false attribution, and should be distinguishable from an executed one (e.g., a `confirmed_executed` flag set by a follow-up write after `execSync` returns, best-effort, non-blocking).
- **Clock skew** between the calling process and reality: mitigated by using the same `new Date().toISOString()` pattern already used throughout `self_heal_restart_log`, which is proven consistent with the DB's other durable evidence.
- **Disk full / ops.db unwritable**: degrade to a console warning; do not crash the restart path.
- **Gap-B (OS auditing) log volume**: process-creation auditing with command-line capture can generate significant Event Log volume machine-wide if scoped broadly; the proposal above explicitly scopes it to a handful of process names to bound this, but this is exactly the kind of tradeoff that needs the user's sign-off before enabling, not a decision to make silently.

## 7. Persistence behavior across app / PM2 / host restarts

Identical to `self_heal_restart_log`'s already-proven behavior: `ops.db` is a WAL-mode SQLite file on disk, unaffected by the mi-core process restarting, PM2 restarting, or the host rebooting — this was directly demonstrated this session, since `self_heal_restart_log` and `runtime-history.json` both survived today's full-fleet daemon-recovery event with their prior rows intact.

## 8. Deterministic test strategy

- A permanent regression asserting each of the 3 call sites' new `INSERT` statement appears in source *before* its corresponding `execSync`/`execAsync` call (static source-order check, matching the pattern already used for Phase 9F/9G's real-fixture-based tests rather than a fabricated count).
- A fixture-DB test proving a ledger write failure (simulated locked/read-only DB) does not throw out of the calling function and does not prevent the mocked restart command from being "issued" (asserting the `execSync` mock was still called).
- A schema round-trip test (write a row with every column populated, read it back, assert equality) — same pattern as Phase 9G's evaluation harness.

## 9. Production acceptance strategy

**For Gap A**: the next real deploy-triggered restart (any future phase's `pm2 restart mi-core` step) is the natural acceptance test — after implementation, read-only verify that a corresponding `restart_intent_ledger` row exists with correct `issuing_surface`, timestamp, and `caller_pid`, cross-checked against `pm2.log`'s own timestamp for the same event. No new production risk: this is an additive logging change to already-executed, already-governed commands.

**For Gap B**: would require its own separate acceptance step (verifying an Event Log entry appears for a real `pm2 restart` command) only if and when the user authorizes enabling OS auditing — not bundled into this proposal's acceptance.

## 10. Explicit non-goals

- Does not prevent, delay, or gate any restart.
- Does not change SelfHeal's allowlist, the `pm2_restart` skill's approval requirement, or `max_memory_restart`.
- Does not attribute externally-issued/interactive commands unless Gap B is separately authorized and implemented.
- Does not replace `pm2.log`, Windows Event Log, or `self_heal_restart_log` — it supplements them.
- Does not retroactively resolve any of Phase 9H's 9 UNKNOWN historical events — those remain UNKNOWN; this proposal is forward-looking only.
- Is not, and must not be described as, enforcement. It **observes** that a restart is about to happen and, for Gap-A call sites, **attributes** it to a known in-repo surface. It does not **prevent** unauthorized mutation — nothing here is a control plane.

## Observation vs. Attribution vs. Enforcement — explicit distinction

- **Observation** (already exists, extensively): `pm2.log`, per-app logs, `runtime-history.json`, Windows Event Log all *detect that something happened*. None of them, alone, explain why.
- **Attribution** (partially exists, proposed to extend): `self_heal_restart_log` already attributes SelfHeal's own restarts. The Gap-A proposal extends the same pattern to the 2 other in-repo call sites. This is what "durably identify the issuing surface" means — naming *which known code path* did it, with a timestamp that survives everything. It is still just naming a cause, not preventing one.
- **Enforcement** (out of scope entirely): would mean something in this system could *refuse* an unauthorized `pm2 restart mi-core`. Nothing proposed here does that, and nothing in the hard constraints permits designing it (no wrapper, no interception, no new control plane). Correlating a timestamp with a deploy backup, as Phase 9H did extensively, is attribution-by-correlation, not proof — this proposal does not claim otherwise.

## 11. Recommendation

**MORE_DISCOVERY_REQUIRED** — specifically, not for the whole proposal, but scoped precisely:

- The **Gap-A** piece (generalized `restart_intent_ledger`, 3 call sites, additive-only logging before pre-existing authorized actions) is low-risk, zero-authority-delta, and could reasonably be recommended `IMPLEMENT` on its own, in a future, separately-scoped and separately-authorized phase.
- The **Gap-B** piece (OS-level process-creation auditing) is very likely the *only* thing that could ever attribute the class of restart the 9 UNKNOWN events most likely represent (a command issued outside this codebase), but it is a host security-policy decision beyond mi-core's own code, with real log-volume and scope tradeoffs, and must not be adopted as a byproduct of a docs proposal. It needs its own explicit, informed decision from the user before any implementation phase is scoped around it.

This proposal does not implement anything and creates no code PR. The two pieces above are described so a future, explicitly-authorized phase can implement whichever the user chooses without re-deriving this analysis.
