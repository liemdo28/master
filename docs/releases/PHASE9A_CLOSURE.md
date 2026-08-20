# Phase 9A — Governance / Security Prerequisites — Closure

**Status: COMPLETE AND FROZEN.**

## Summary

Closed the manifest-vs-runtime-enforcement gap found in Phase 9 discovery: `background:self-healing-monitor`'s `pm2 restart` capability was labeled `LEGACY_QUARANTINED`/`approvalRequired:true`/`governanceRequired:true`, but the quarantine mechanism (`legacyAuthorityAdapter.quarantine`, Express middleware) has no code path that can intercept a `setInterval`-based background worker. Full details in `docs/architecture/PHASE9A_SELFHEAL_AUTHORITY_AUDIT.md`.

## Review and merge

[PR #129](https://github.com/liemdo28/master/pull/129) — self-authored, self-reviewed, explicitly authorized for merge by the repo owner (scoped specifically to PR #129), after verifying exact head SHA match (`f360feb5691f1f1eba30166514a0f8a8c6dee334`), mergeability, no new commits, green CI, `unknownMutations=0`/`unresolvedLegacyMutations=0`, `ActionType` unchanged at 7 values, schema v10 unchanged. Merged as `39b12b54a060b9b17d827e27e94dfa68a26f0b31`.

## Clean-master verification

Fast-forwarded local `master` to `39b12b54a060b9b17d827e27e94dfa68a26f0b31`, rebuilt `server/dist` from clean (zero errors). Re-ran `phase9a:acceptance` (own 14-assertion test + 945-case evaluation + manifest check, all clean) and full `test:ci` (zero real failures) on the clean build.

## Background-worker audit result

8 total `BACKGROUND_WORKER` manifest surfaces; 5 shared the identical false-enforcement-claim bug.

- **`background:self-healing-monitor`**: **behavioral enforcement added**, not just relabeled. New `evaluateRestartEligibility()` excludes `runtime-preflight`'s canonical intentionally-stopped services (closing a real gap — `mi-whatsapp-gateway` and `mi-ceo-observer` were both restart-eligible despite being intentionally stopped) and consults the real, existing `GLOBAL` kill switch before any restart. Manifest reclassified to `CANONICAL_LOCAL_MUTATION`, honestly reflecting real, code-verified, narrowly-allowlisted enforcement.
- **`background:self-healing-scheduler`, `background:jarvis-proactive-monitor`, `background:daily-briefing-scheduler`, `background:qb-online-watcher`**: **metadata/runtime truth corrected only — no behavioral change.** `approvalRequired`/`quarantineHandler` no longer falsely claim HTTP-only enforcement. They remain `authorityClass: LEGACY_QUARANTINED` / `phase6bDisposition: QUARANTINE_ONLY` — correctly still flagged as unresolved, not silently closed. **These 4 are explicitly not governed by the same mechanism as self-healing-monitor** — deeper behavioral hardening for them (e.g. a kill-switch gate on the WhatsApp-sending workers, or the QB command-insert path) is undone, real, tracked follow-up work, not implemented or tested in this phase.
- The remaining 3 background workers (`background:scheduler`, `background:burn-in`, `background:leader-heartbeat`) were confirmed to already have accurate manifest classifications — no mismatch found.
- **`scanner.ts`'s `worker()` helper** — the root cause — was fixed systemically, and both consistency checkers (`legacy-adapter.ts`, `scanner.ts`'s own `assertAuthorityManifest`) gained a new permanent guardrail (`LEGACY_AUTHORITY_BACKGROUND_FALSE_ENFORCEMENT_CLAIM`) that throws if any `BACKGROUND_WORKER` surface, present or future, ever claims that enforcement again.

## Deterministic evaluation

945 cases (`npm run phase9a:evaluation`), sweeping every monitored service × restart counts 0-9 × kill-switch on/off, a restart-storm sweep, 29 adversarial spoofed/unknown service-name variants, a 100-call concurrency-determinism probe, and 4 legacy-background bypass attempts fed into the real validator. All 6 hard targets exactly 0: `unexpectedRestart`, `disabledServiceRestart`, `arbitraryTargetReachability`, `manifestRuntimeMismatch`, `shellEscalation`, `authorityExpansion`.

## Predeploy backup

`F:\Projects\mi-core-predeploy-backups\phase9a-2026-08-20T07-53-14.000Z\`: `server-dist`, `command-center-dist`, `authority-manifest.json`, `snapshot-manifest.json`, all 3 canonical production DBs + WAL/SHM sidecars, `pm2-jlist.json`, `env-keys-present.txt`.

## Deploy

Deploy-owned source snapshot built via `authority:build-snapshot --sha=39b12b54a060b9b17d827e27e94dfa68a26f0b31` at `F:\Projects\D-root-mi-snapshots\mi-core-deployed-source\39b12b54a060b9b17d827e27e94dfa68a26f0b31\` (`fileCount: 827`, `treeChecksum: 84962dd76199547fe53f606f4482e032aadc46cb1fb4be4b086f09a390a70960`). `server/dist`, `server/src`, `server/package.json`, `server/authority-manifest.json` deployed to `F:\Projects\mi-core` (previous copies preserved as `.old`). `.env` provenance markers and `server/snapshot-manifest.json` updated together (both must move in the same step — a lesson from Phase 8D's own transient mismatch). Only `mi-core` restarted; `mi-ai-service`, `mi-accounting`, `qb-ops-agent`, `mi-node-agent` untouched (confirmed 0 restarts, ~55m uptime, unchanged across the deploy).

**Restart-counter note, reported transparently**: `mi-core`'s PM2 restart counter was observed at 781 at the end of the prior Phase 8 closure work, but stood at a low baseline (this deploy's own restart brought it to 2) by the time this phase's production checks began — consistent with an intervening PM2 daemon or host event between sessions, unrelated to this deploy (all 4 other PM2 apps showed matching ~55-minute uptime with 0 restarts at the same moment, indicating a shared reset event, not an app-specific problem). No instability, error, or DB issue was found associated with it; flagged here rather than silently omitted.

## Production acceptance

- `GET /api/health` → `200 OK`, `{"server":"ok","overall":"DEGRADED"}` (Ollama remains down, untouched, health truth correctly not silently upgraded).
- Boot log clean: `[SelfHeal] Starting — monitoring 10 services every 60s` present, confirming the new code is genuinely live; zero new error classes since restart.
- **Read-only eligibility verification against live production data** (safe — `evaluateRestartEligibility` is a pure function, never invokes `pm2 restart` itself):
  - `mi-whatsapp-gateway` → `intentionally_stopped` ✓
  - `mi-ceo-observer` → `intentionally_stopped` ✓
  - Unknown/fabricated service name → `not_allowlisted` ✓
  - `mi-core` (real, healthy, under limit, no kill switch active) → `eligible` ✓ (proves the live kill-switch read against production's real governance DB succeeds without error)
- **Kill-switch-blocks and other negative-restart cases were deliberately not re-exercised against production** — per explicit instruction, no live service was deliberately failed to prove restart behavior; that invariant is already rigorously proven by the 14-assertion test and 945-case evaluation, both run against an isolated, ephemeral governance database, not production.
- Structural re-check of the deployed production bundle: no `shell: true`, no `process.kill`/`taskkill`, `pm2 restart` invocation confirmed to only ever template `svc.pm2_name` from the fixed allowlist.

## DB / log / provenance audit

All 3 canonical production databases: `integrity_check=ok`, 0 FK violations. Schema unchanged at v10. Authority manifest: `total=1066`, `unknownMutations=0`, `unresolvedLegacyMutations=0`. Deployed provenance (`snapshot-manifest.json` / `.env`) confirmed consistent at `39b12b54a060b9b17d827e27e94dfa68a26f0b31`. No new errors in `mi-core-error.log` since restart.

## Explicit statement

**NO NEW AUTHORITY.** No `ActionType` added (still exactly 7). No policy/risk/budget/kill-switch/delegation semantic changed. No production DB schema changed. No external write capability added. No Gmail SEND, no financial action, no autonomous approval, no autonomous merge/deploy.

## Freeze declaration

Phase 9A is declared **COMPLETE AND FROZEN**. `self-healing-monitor`'s restart-authority boundary is now real and code-verified; the other 4 affected background workers are honestly reclassified but their deeper behavioral hardening remains open, tracked follow-up work — not claimed as done. Continuing to **Phase 9B** only once separately authorized.
