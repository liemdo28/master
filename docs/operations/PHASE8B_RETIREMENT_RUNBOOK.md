# Phase 8B — Retirement Runbook

## What was retired

**`server/src/routes/jarvis.ts`** — the legacy 49-route `/api/jarvis` HTTP router — deleted. Its mount (`app.use('/api/jarvis', requireTaskRuntimeAuth, jarvisRouter)`) removed from `server/src/index.ts` and replaced with a comment recording the evidence trail and pointing at the inventory doc.

**Nothing else was removed.** The 20 backing modules the router used to call into (`jarvis/proactive-monitor.ts`, `jarvis/risk-engine.ts`, `jarvis/suggestion-engine.ts`, `jarvis/approval-conversation.ts`, `jarvis/autonomous-task-runner.ts`, `jarvis/ceo-preference-store.ts`, `jarvis/daily-briefing-scheduler.ts`, `communication/conversation-memory.ts`, and the ten `jarvis/phase21-knowledge/` through `jarvis/phase30-jarvis/` modules) are unchanged and remain fully live via their real, non-HTTP callers (WhatsApp, voice, GStack skills/QA, `natural-conversation-engine.ts`, and `bootJarvis()` at server startup).

A second, small change: a new `evidence-read` rule was added to `authority-control-plane/registry.ts` to close a pre-existing registry gap (`/api/evidence` had no rule and fell through to UNREGISTERED). This is additive-only — no route's classification or auth changed.

## Why this is safe to retire

Full proof chain in `docs/architecture/PHASE8B_LEGACY_INVENTORY.md` §1 and §12. Summary: zero live HTTP callers found across `command-center/src` (frontend), the rest of `server/src` (backend), any test file, `ecosystem.config.js`, and any `.bat`/`.ps1` script. Every backing module underneath is independently reachable through a different, real, already-existing path, so removing only the router's HTTP exposure changes nothing about what's actually running in production.

## Rollback procedure

If, after deploy, any evidence of a live caller surfaces (an error log referencing a missing `/api/jarvis/*` route that isn't `request`/`session/current`/`voice/*`, a 404 spike on those paths, or a report of broken functionality tracing to this router):

1. `git revert` the retirement commit(s) on `codex/phase8b-legacy-retirement` (or on `master` post-merge) — this is a pure code change with no data migration, so revert is a plain `git revert` + rebuild + redeploy, no DB rollback needed.
2. Rebuild (`npx tsc` in `server/`), redeploy `server/dist/` + `server/src/` to `F:\Projects\mi-core`, restart `mi-core` via PM2.
3. No backfill, no data repair — the router itself never wrote anything mutation-specific of its own; its backing modules' own data (WhatsApp state, briefing schedules, etc.) were never touched by this retirement, since those modules kept running unmodified throughout.

## Performance impact

Not meaningful, and no dedicated benchmark was built for this reason: the retired router had zero live traffic before removal (that's exactly what made it provable-safe to remove — see inventory §1), so removing it changes zero measured request latency or throughput in production. The only structural changes are (a) one fewer Express router mounted at boot (49 fewer route registrations, negligible against ~1000+ total registered surfaces) and (b) one additional entry in the authority registry's rule array (a fixed-size linear scan, negligible per-request cost). `npx tsc` compiles clean; `server/dist/index.js` builds successfully; full regression (5A-8B, `test:ci`, Agentic Coding) completes in the same order of magnitude as prior phases with no new slow paths introduced.

## Deploy / restart scope

Only `mi-core` (the server process) needs restarting — no other PM2-managed process, no database migration (schema stays v10), no config value changes beyond the code diff itself. `command-center` (the frontend) had zero references to the retired router, so no frontend rebuild is required for correctness (though it will be rebuilt as part of the normal deploy-owned-source-snapshot process per this repo's standing deploy convention).

## Post-deploy verification

1. `GET /api/health` returns HEALTHY/DEGRADED as expected (no CORE/DATABASE/AUTHORITY regression).
2. `GET /api/jarvis/*` for any of the 49 retired paths (e.g. `/api/jarvis/proactive/status`) returns 404, not 200/500 — confirms clean removal, not a broken mount.
3. `GET /api/jarvis/request`, `GET /api/jarvis/session/current`, `/api/jarvis/voice/*` (the canonical Gateway's own routes, never part of the retired router) continue to respond normally.
4. WhatsApp message round-trip still reaches Jarvis (proves the backing modules are unaffected).
5. `npm run authority:manifest -- --check` on the deployed source passes.
6. DB integrity check (`personal-os.db`/`tasks.db`/`projects.db`: `integrity_check=ok`, 0 FK violations) — expected unchanged, since this retirement touches no database code.
