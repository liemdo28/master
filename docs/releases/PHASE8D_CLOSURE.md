# Phase 8D — Runtime Startup & Recovery Certification — Closure

**Status: COMPLETE AND FROZEN.**

## Summary

Per `docs/architecture/PHASE8D_BOOT_RECOVERY_AUDIT.md`, formalized the working `pm2 resurrect` boot-recovery path by wrapping it in a new, git-tracked, logged script (`boot-preflight-and-resurrect.cmd` → `server/src/runtime-preflight/boot-cli.ts`) that runs the pre-existing Phase 7A preflight validator first (advisory/logging only) and then always calls `pm2 resurrect`, unchanged. No new authority, no schema change, no autonomous recovery behavior. Live registry wiring to the new wrapper was deliberately left untouched, per explicit scope boundary — see Startup-wiring classification below.

## Review and merge

[PR #122](https://github.com/liemdo28/master/pull/122) — self-authored, self-reviewed, explicitly authorized for merge by the repo owner (scoped specifically to PR #122), after verifying exact head SHA match (`8d4b05756d31a836a066823d10628b23c925b142`), mergeability, 2 commits (unchanged), green CI (GitGuardian, repository scans, server build/tests, external integration tests skipping), diff scope limited to exactly 7 files, `unknownMutations=0`, `unresolvedLegacyMutations=0`, and production schema v10. Merged as `aab506bc818c1c4cf6ac5b0c2f2e45d4b4b8624a`.

## Clean-master verification

Fast-forwarded local `master` to `aab506bc818c1c4cf6ac5b0c2f2e45d4b4b8624a`, rebuilt `server/dist` from clean (`rm -rf dist && npx tsc`, zero errors). Re-ran targeted gates on the clean build: `authority:manifest -- --check` (PASS), `test:phase8d-boot-cli` (PASS — proves `pm2 resurrect` always runs regardless of preflight outcome, and that no code path bypasses the injected dependencies to invoke real PM2), `phase7a:acceptance` (8/8 points PASS, including preflight run against the live production root itself: `overall=WARN`, WARNs limited to the 3 already-documented intentionally-stopped services), and `test:phase7g-boot-preflight` (4/4 scenarios PASS).

## Predeploy backup

`F:\Projects\mi-core-predeploy-backups\phase8d-2026-08-19T07-46-55.000Z\`: `server-dist`, `command-center-dist`, `authority-manifest.json`, `snapshot-manifest.json` (backfilled post-hoc from the immutable prior deployed-source snapshot, since the pre-deploy copy step targeted the wrong path — see Issues found below), all three canonical production DBs + WAL/SHM sidecars, `pm2-jlist.json`, `env-keys-present.txt`.

## Deploy

Deploy-owned source snapshot built via `authority:build-snapshot --sha=aab506bc818c1c4cf6ac5b0c2f2e45d4b4b8624a` at `F:\Projects\D-root-mi-snapshots\mi-core-deployed-source\aab506bc818c1c4cf6ac5b0c2f2e45d4b4b8624a\` (`fileCount: 825`, `treeChecksum: b9576fc03866040b0857533a924f7b9cab883f23fba2b974e81c0a1b46f8da5e`). `server/dist`, `server/src`, `server/package.json`, `server/authority-manifest.json`, and the new `boot-preflight-and-resurrect.cmd` deployed to `F:\Projects\mi-core` (previous `dist`/`src` preserved as `.old`). `.env` provenance markers and `server/snapshot-manifest.json` updated to the new SHA. Only `mi-core` restarted (restart count 4→5); `mi-ai-service`, `mi-accounting`, `qb-ops-agent`, `mi-node-agent` untouched throughout (confirmed 0 restarts, ~4h uptime, unchanged across the deploy).

## Issues found and corrected during this closure

1. **Stale drive-letter default in `build-snapshot-cli.ts`** — the tool's `--dest-base` falls back to a hardcoded `D:\mi-core-deployed-source` when `MI_SNAPSHOT_BASE_DIR` isn't set in `.env` (it isn't), a leftover from before this environment's D:→E:→F: drive migrations. Running the snapshot builder with just `--sha` silently wrote to `D:\mi-core-deployed-source\aab506bc...` instead of the established `F:\Projects\D-root-mi-snapshots\mi-core-deployed-source\` location. Caught before use, the stray `D:` directory was removed, and the snapshot was rebuilt correctly with an explicit `--dest-base`. Not fixed in source (out of Phase 8D's own scope — this tool's default, not anything PR #122 touched); flagged here as a documented pre-existing gap for a future phase.
2. **Predeploy backup missed `server/snapshot-manifest.json`** — the backup step copied from the production root instead of `server/`, where the file actually lives; it silently found nothing there. Backfilled after the fact from the immutable prior deployed-source snapshot (`.../415a3f49.../snapshot-manifest.json`, confirmed byte-identical, unchanged), so no data was actually lost — only the backup step itself needed correcting.
3. **Post-deploy provenance mismatch, self-caught by the very tooling this phase built** — after deploying, `.env`'s `MI_DEPLOYED_SOURCE_SHA` pointed at the new SHA but `server/snapshot-manifest.json` was never updated in the same step, so the first post-deploy run of the Phase 7A preflight validator against the live production root correctly reported `deploy-snapshot: provenance mismatch` and an overall `FAIL`. Fixed by copying the correct manifest from the newly-built deploy snapshot into `F:\Projects\mi-core\server\snapshot-manifest.json`; re-running preflight against the live root then reported `overall: WARN` (limited to the 3 pre-existing intentionally-stopped services), matching `phase7a:acceptance`'s own expected result.

None of these three issues were authority, schema, or state-machine regressions — all were deploy-tooling/bookkeeping gaps, each caught and corrected within this same closure pass before declaring acceptance.

## Production acceptance

- `GET /api/health` → `200 OK`, `{"overall":"HEALTHY"}` post-restart.
- Deployed bundle verified to contain the new code: `server/dist/runtime-preflight/boot-cli.js` present, 17 references to `resurrect`.
- Boot log clean: `[Mi] ✓ Jarvis Evolution Phase 30 booted` present at 14:50:43 post-restart; zero new `TypeError`/`ReferenceError`/`Cannot find module`/uncaught errors since restart.
- Phase 7A preflight validator run directly against the live production root (`F:\Projects\mi-core`, read-only/diagnostic, no mutation): `overall: WARN`, all checks PASS except the 3 already-documented intentionally-stopped services (`mi-ceo-observer`, `mi-whatsapp-gateway`, `mi-n8n`) and the transient `deploy-snapshot` mismatch already corrected above.
- Remaining `[SelfHeal]` alerts for WhatsApp Gateway/CEO Observer in the logs are the same pre-existing, already-documented gap (services intentionally stopped) — unrelated to and unaffected by this deploy.
- `pm2 resurrect` was **not** invoked for real against production in this closure (that remains an explicitly out-of-scope, separately-authorizable disruptive action per the Phase 8D audit doc); the "always resurrect" invariant is proven by `test:phase8d-boot-cli`'s dependency-injected unit tests instead.

## DB / log / provenance audit

All three canonical production databases (`personal-os.db`, `tasks.db`, `projects.db`): `integrity_check=ok`, 0 FK violations, checked online post-deploy via the live-root preflight run. Schema unchanged at v10. Authority manifest: `total=1065` (1064→1065, the expected increase from the one new `test:phase8d-boot-cli` top-level `test:*` script), `unknownMutations=0`, `unresolvedLegacyMutations=0`. No new errors in `mi-core-error.log` since restart.

## Startup-wiring classification: **NOT_CONFIGURED**

Confirmed via `reg query`: `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\PM2` still points directly at `wscript.exe invisible.vbs pm2_resurrect.cmd` (the third-party `pm2-windows-startup` package's own script) — unchanged by this phase. The new `boot-preflight-and-resurrect.cmd` is deployed to `F:\Projects\mi-core\boot-preflight-and-resurrect.cmd` and fully functional (proven by unit test and by the underlying preflight validator's live run above), but is **not** registered anywhere in the host boot sequence. This is deliberate, not an oversight: pointing the registry key at the new wrapper is a live Windows boot-configuration change on the physical production machine, explicitly deferred as a separate, manual, future step requiring its own authorization — this closure does not opportunistically mutate host startup configuration. Actual boot-time recovery on this machine continues to work exactly as before (`pm2 resurrect` via the existing, unmodified third-party path).

## Freeze declaration

Phase 8D is declared **COMPLETE AND FROZEN**. No further changes to this phase's scope. `runtime:boot` remains an observable, advisory-only wrapper around unchanged Phase 7A preflight + unchanged `pm2 resurrect` semantics — no autonomous recovery authority was added. Continuing to the next Phase 8 roadmap phase (**8E — Proactive Operations**) per the existing roadmap.
