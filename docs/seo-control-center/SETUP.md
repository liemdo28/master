# SEO Control Center — Setup

## Prerequisites

- The existing mi-core server already running/runnable (`cd mi-core/server && npm install && npx tsc && node dist/index.js`, or `npm run dev` via `tsx`).
- Node 18+, npm workspaces (repo root `mi-core/package.json` has `"workspaces": ["server"]` — always run `npm install <pkg> --workspace=server` from `mi-core/`, not from inside `mi-core/server/`, to keep the lockfile clean).

## What's new to install

`playwright` and `yaml` were added to `mi-core/server/package.json` as part of this build. If you're setting up a fresh checkout:

```bash
cd mi-core
npm install
cd server
npx playwright install chromium
```

## First-time configuration

1. **ChatGPT browser login** (required before any AI content job will succeed — see [`CHATGPT_BROWSER_CONNECTOR.md`](CHATGPT_BROWSER_CONNECTOR.md)):
   ```bash
   cd mi-core/server
   npx tsx src/seo/ai-providers/chatgpt-manual-login.ts
   ```
2. **Google OAuth** (GSC/GA4/GBP — reuses the existing connector, not new to this build): confirm `.local-agent-global/visibility/google-tokens.json` exists and has valid tokens. If not, use the existing `/api/auth/google/start` flow already present in mi-core.
3. **Brand/location config — IMPORTANT path note**: `brand-config.ts` reads from `${MI_CORE_ROOT}/SEO/shared/config/`, and production's `ecosystem.config.js` sets `MI_CORE_ROOT=D:/Project/Master/mi-core` — so the file that's actually live is **`mi-core/SEO/shared/config/{brands,locations}.json`**, not the repo-root `SEO/shared/config/` copy (that root copy is a separate, older fork used by the standalone `SEO/` orchestrator and its validator script — see [`INITIAL_AUDIT.md`](INITIAL_AUDIT.md)). Both copies were fixed during this build: schema mismatch corrected, Raw Sushi's real Stockton + Modesto location data added (previously a single vague placeholder location), `raw_sushi` domain corrected to `https://www.rawsushibar.com`. If you add a third brand or a new location, edit **`mi-core/SEO/shared/config/`** (the live one) and keep the root copy in sync if you still use the standalone orchestrator.
4. **Policy review**: `mi-core/config/seo-policy.yaml` defines what's SAFE_AUTO vs REQUIRES_APPROVAL vs BLOCKED. Review it before turning on the scheduler in a new environment — see [`MASTER_SEO_POLICY.md`](MASTER_SEO_POLICY.md).

## New database

A new SQLite database is created automatically on first use at `.local-agent-global/seo/seo-control-center.db` (WAL mode). No manual migration step — every table uses `CREATE TABLE IF NOT EXISTS` bootstrap on module load, matching this repo's existing convention (see `mi-core/server/src/operations/ops-db.ts` for the same pattern).

## Running — this build is NOT yet loaded into the live process

No new process is required — everything mounts into the existing mi-core Express server (port 4001, managed by PM2 as `mi-core`). The code has been compiled (`npx tsc` was run, `dist/` is current) but **the live PM2 `mi-core` process has not been restarted**, so it is still running the pre-build code. Restarting a live CEO-facing process (WhatsApp bot, daily briefing) wasn't done automatically in this session since it's a production-affecting action — restart it deliberately when ready:

```bash
pm2 restart mi-core
```

The dashboard is served as a static file at `http://localhost:4001/seo-control-center.html`, or via the shorthand redirect added at `http://localhost:4001/seo` (same pattern as the existing `/agenview` redirect).

## Verifying it's working

This was independently verified during the build using an isolated test instance (separate port, separate `MI_DATA_DIR`, never touching the live PM2 process or its database) — see [`QA_REPORT.md`](QA_REPORT.md) for what was actually exercised end-to-end (keyword discovery, cannibalization check, GBP post draft + approval-gate routing, report generation, dashboard rendering with real brand/location cascading).

To re-verify after `pm2 restart mi-core`:

```bash
curl http://localhost:4001/api/seo/brands
curl http://localhost:4001/api/seo/keywords?brand_id=bakudan
curl http://localhost:4001/api/seo/policy
curl http://localhost:4001/api/seo/local?brand_id=raw_sushi   # should show 2 locations (Stockton, Modesto)
```

All should return JSON, not errors. See [`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md) for the full acceptance checklist and current MOCK/CONFIGURED/CONNECTED/LIVE_VERIFIED status of every connector.
