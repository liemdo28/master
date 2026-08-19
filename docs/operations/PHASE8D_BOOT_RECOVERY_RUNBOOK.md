# Phase 8D — Boot / Recovery Runbook

## What changed

Added `server/src/runtime-preflight/boot-cli.ts` (`npm run runtime:boot`) and a thin wrapper (`boot-preflight-and-resurrect.cmd`, repo root). Running it does exactly two things, in order:

1. Runs the existing Phase 7A preflight validator (`runPreflight()`) plus the existing Phase 7A `recovery-cli.ts` plan-building logic, in the same safe dry-run mode `recovery-cli.ts` already defaults to — logs a full health/plan report, takes no action.
2. **Always** calls `pm2 resurrect` afterward — regardless of what the preflight reported. This is advisory-only by design; a preflight FAIL is logged loudly but never blocks the real recovery mechanism.

`pm2 resurrect`'s own behavior is completely unchanged: it still restores every process exactly as PM2's `dump.pm2` recorded it. Nothing about the actual recovery mechanics changed — only visibility was added.

## What did NOT change (deliberately, out of this PR's scope)

**The live Windows boot sequence is untouched.** `HKCU\...\Run\PM2` still points directly at `pm2-windows-startup`'s own `pm2_resurrect.cmd` (a third-party npm package, not this repo). Pointing that registry key at `boot-preflight-and-resurrect.cmd` instead is a real, live, host-level configuration change on the physical production machine — a separate, manual, explicitly-authorized production step, not something this PR performs.

**No live boot-recovery evidence was captured in this PR.** The most direct way to produce it — a `pm2 kill` + `pm2 resurrect` (or `boot-preflight-and-resurrect.cmd`) simulation against the live production processes — is itself a real, temporarily-disruptive action against all 5 production services. This PR's test suite instead proves the wrapper's *logic* deterministically with injected fake PM2 dependencies (real PM2 is never invoked by the test). Live evidence-gathering is a separate, explicitly-authorized follow-up step.

## To actually wire this in (manual, separate, future step)

1. Confirm `boot-preflight-and-resurrect.cmd` runs cleanly by hand first (`F:\Projects\mi-core\boot-preflight-and-resurrect.cmd` from an interactive shell) and inspect its log at `.local-agent-global\logs\boot-preflight-and-resurrect.log`.
2. Update the registry Run key (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run\PM2`) to point at this script instead of `pm2-windows-startup`'s own `pm2_resurrect.cmd` — e.g. via `wscript.exe "<repo>\start-silent-equivalent.vbs" "<repo>\boot-preflight-and-resurrect.cmd"`, or directly if a visible window at boot is acceptable.
3. Verify with an actual reboot or, at minimum, a controlled `pm2 kill` + run of the new script, that all 5 processes come back exactly as before, and that the preflight log is populated.

## Rollback

Purely additive — no existing file was modified except `server/package.json` (new script entries) and `test:ci`'s chain (one more suite appended). Reverting is a plain revert of this PR's commits; the live boot mechanism (registry key → third-party `pm2_resurrect.cmd`) is never touched by this PR, so there is nothing to roll back on the production machine itself unless step 2 above was separately, manually performed.

## Legacy boot-mechanism cluster (re-confirmed dead, no action taken)

`start.bat` / `autostart-install.bat` / `start-silent.vbs` at the repo root are a separate, older bootstrap approach. Re-investigated this phase: the Scheduled Task they would create (`Mi Ultimate`) does not exist on this machine (`schtasks /query` fails — not found); their Startup-folder fallback is the exact same `Mi-Ultimate.vbs` Phase 8A already found broken and neutralized (`Mi-Ultimate.vbs.disabled-phase8a-2026-08-17`). No new action required — see `docs/architecture/PHASE8D_BOOT_RECOVERY_AUDIT.md`.
