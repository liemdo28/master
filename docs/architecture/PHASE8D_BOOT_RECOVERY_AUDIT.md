# Phase 8D — Runtime Startup & Recovery Certification — Reality Audit

Per the existing Phase 8 roadmap, 8D's scope is: formalize the working `pm2 resurrect` path, add the optional preflight check, and produce real boot-recovery evidence on current F: paths (refreshing the stale, pre-drive-migration `WHATSAPP_REBOOT_SURVIVAL_FINAL_EVIDENCE.md` precedent).

## Working boot-recovery mechanism, re-confirmed unchanged

`HKCU\...\Run\PM2` (confirmed via `reg query`) → `wscript.exe invisible.vbs pm2_resurrect.cmd` → `pm2 resurrect` (confirmed: `pm2_resurrect.cmd`'s entire content is the single line `pm2 resurrect`) → replays PM2's own saved `dump.pm2`. All 5 real production processes (`mi-core`, `mi-ai-service`, `mi-accounting`, `qb-ops-agent`, `mi-node-agent`) confirmed via `pm2 jlist` to have correct, current `F:\Projects\mi-core\...` paths throughout this entire session's many restarts. This mechanism lives in a globally-installed third-party npm package (`pm2-windows-startup`, under the user's npm global `node_modules`, not this repo) — not git-tracked, not something this repo's tooling can safely modify in place (would be silently overwritten by any future `npm update -g` of that package).

## Second legacy boot-mechanism cluster found — investigated, confirmed already fully handled in Phase 8A, no new action needed

This repo also contains `start.bat`, `autostart-install.bat`, and `start-silent.vbs` at the repo root — a **separate, older** bootstrap approach (Task Scheduler + Startup-folder-fallback) predating the current PM2-based mechanism. Investigated rather than assumed dead:

- `autostart-install.bat`'s primary path creates a Scheduled Task named `Mi Ultimate`. Queried directly: **`schtasks /query /tn "Mi Ultimate"` — task does not exist on this machine.** Never active, or removed.
- Its fallback path copies `start-silent.vbs` to the Windows Startup folder as `Mi-Ultimate.vbs`. This is the **exact same file** Phase 8A already found broken (hardcoded `D:\Project\Master\mi-core\start.bat`, a directory that no longer exists anywhere) and already neutralized (renamed to `Mi-Ultimate.vbs.disabled-phase8a-2026-08-17`, not deleted — trivially recoverable; see `PHASE8A_SECURITY_OPERATIONAL_DEBT.md` §6, Priority #11).
- `start.bat` itself (the dead payload both of the above would have pointed to) uses `%~dp0`-relative paths for Docker/server startup — not itself hardcoding a stale drive, but with zero live caller now that both its installers are confirmed inactive.

**Conclusion: no new legacy-boot finding.** This is the same cluster Phase 8A already investigated and safely neutralized one layer of (the Startup-folder VBS); the Scheduled-Task layer was already inactive independently. Nothing further required here — re-confirmed, not re-litigated.

## The actual gap: no preflight check runs before `pm2 resurrect`

Confirmed unchanged from Phase 8 discovery: `pm2 resurrect` blindly replays `dump.pm2` with no validation step first. Phase 7A already built exactly the tool for this — `runtime-preflight/validator.ts`'s `runPreflight()` — but it has never been wired into the actual boot path, only ever invoked from tests/evaluation scripts.

## Stale WHATSAPP_REBOOT_SURVIVAL evidence

`WHATSAPP_REBOOT_SURVIVAL_FINAL_EVIDENCE.md` (2026-06-18/19) predates the D:→E:→F: drive migrations. The underlying `pm2 resurrect` mechanism is drive-path-agnostic (reads whatever `dump.pm2` currently says, already confirmed correct for F:), but no *fresh* recovery evidence has been captured since the migration completed.

## Planned scope for this phase (per the roadmap, no authority expansion)

1. **Formalize the boot path**: add a new, git-tracked, explicit wrapper script (not modifying the third-party `pm2-windows-startup` package) that runs the existing Phase 7A preflight validator first, logs its result, and then calls `pm2 resurrect` — advisory/logging only, never blocking the actual resurrect call, so a preflight failure surfaces loudly rather than silently changing recovery behavior.
2. **Wiring the registry `Run` key to point at the new wrapper instead of directly at `pm2_resurrect.cmd`** is a live Windows boot-configuration change on the physical production machine — out of scope for this PR to perform directly; documented as an explicit, separate, manual production step requiring its own authorization, per this repo's established convention for anything touching real machine state outside the git-tracked deploy path.
3. **Fresh boot-recovery evidence**: the safest non-disruptive proof available is a `pm2 kill` + `pm2 resurrect` simulation against the live production processes — itself a real, temporarily-disruptive action against all 5 production services, also out of scope to perform without explicit separate authorization. This PR's test coverage instead proves the new preflight-and-resurrect wrapper's *logic* deterministically (does it run preflight first, does it always still call resurrect, does a preflight failure get logged without blocking); live production evidence-gathering is flagged as a distinct follow-up step.

No new authority, no schema change, no new external action. `SelfHeal` (Phase 8C) and the canonical Health Truth Model are unaffected — this is a boot-time-only concern.
