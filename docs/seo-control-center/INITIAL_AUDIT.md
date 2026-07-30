# SEO Control Center — Initial Audit

**Date:** 2026-07-13
**Scope:** Phase 0 audit per the SEO Control Center build spec. Read-only — no code changed as part of this document.
**Method:** Five parallel codebase explorations (SEO automation modules, mi-core platform infra, browser/AI connectors, Bakudan site, Raw Sushi site). Findings below are what was actually found in the repo, not what documentation claims.

---

## Executive summary

This is **not a greenfield build**. A previous engineering cycle already built a working multi-agent SEO automation system (`SEO/`) with 7 running agent processes, a scheduler/orchestrator, real Google API connectors (GSC/GA4/GBP) wired into `mi-core`, a content-generation pipeline with a QA gate and git-push publishing, and a generic approval engine. Most of it is real, working code — not documentation-only. It has been idle for ~10 days (last orchestrator run 2026-07-03) and has known gaps (placeholder page-audit text, one dead-code router, connector credentials not confirmed live).

Both production websites (Bakudan, Raw Sushi) have real, deployed SEO surface area (schema.org markup, GA4, Toast ordering) but **neither is currently safe for automated publishing**: Bakudan's CI has no build/preview/rollback step and SCPs straight to production; Raw Sushi has two parallel, non-identical copies of the site (root vs `public/`) and two conflicting redirect/deploy configs. These are blocking issues, not nice-to-haves, and should be fixed in Phase 1/5 before any publish automation touches either site.

The single biggest new-build item the spec calls for that has **zero existing code** is the ChatGPT-browser-session provider. Two partial precedents exist to build it from (a persistent Playwright profile pattern from a DoorDash automation module, and a task-runner Playwright service), but nothing logs into ChatGPT today.

---

## A. Existing architecture

### A.1 SEO automation system (`SEO/` at repo root) — real, working, idle

| Component | Status | Path |
|---|---|---|
| Orchestrator (cron scheduler, 10 jobs, retry, job-state persistence) | EXISTS_AND_WORKS | `SEO/seo-automation-orchestrator/index.js` |
| Job history (idle since 2026-07-03) | EXISTS_AND_WORKS | `SEO/seo-automation-orchestrator/job-state.json`, `logs/*.log` |
| 7 agent processes on `base-agent.js` | EXISTS_AND_WORKS | `SEO/seo-analytics-agent`, `seo-citation-agent`, `seo-content-agent`, `seo-local-maps-agent`, `seo-schema-agent`, `seo-technical-agent`, `seo-website-agent` |
| Technical audit (13 real checks) | EXISTS_AND_WORKS | `SEO/seo-technical-agent` (port 4013) |
| Content agent (Bakudan keyword briefs) | EXISTS_AND_WORKS | `SEO/seo-content-agent` (port 4015) |
| Website agent (page audit) | EXISTS_BUT_INCOMPLETE — placeholder `"[TODO] Generate title for..."` text | `SEO/seo-website-agent` (port 4012) |
| GSC/GA4/GBP/crawler/citation connectors | EXISTS_BUT_INCOMPLETE — credential-gated, not confirmed live | `SEO/shared/connectors/{gsc,ga4,gbp,crawler,citation-checker}.js` |
| Multi-brand config | EXISTS_AND_WORKS | `SEO/shared/config/{brands,keywords,locations,pages}.json` |
| Shared SQLite DB | NEAR-EMPTY (~90 bytes) | `SEO/shared/database/`, `seo-shared.db` |
| **Duplicate/forked copy** | DUPLICATED — different content than root, not a symlink | `mi-core/SEO/` |

### A.2 mi-core SEO backend — real, wired into Express

| Route | Backing code | Status |
|---|---|---|
| `/api/seo` | `routes/seo.ts` (860 lines), state at `data/seo/seo-state.json`, receives orchestrator push-back at `POST /orchestrator/run/:jobId` | EXISTS_AND_WORKS |
| `/api/seo/gsc` | `routes/gsc.ts` → `seo/google-search-console-connector.ts` (real `googleapis` client) | EXISTS_AND_WORKS (OAuth-gated) |
| `/api/analytics` | `routes/ga4-analytics.ts` → `seo/ga4-connector.ts` (583 lines) | EXISTS_AND_WORKS (OAuth-gated) |
| `/api/gbp` | `routes/gbp-analytics.ts` → `seo/gbp-connector.ts` (350 lines) | EXISTS_AND_WORKS (OAuth-gated) |
| — | `seo/brand-config.ts` (271 lines) — brand/location registry with per-brand `gsc_site_url`/`ga4_property_id`/`gbp_account_id` | EXISTS_AND_WORKS — **closest existing analog to the spec's brand/location model** |
| — | `seo/seo-monitoring-router.ts` — Playwright crawler (title/meta/H1/alt/HTTPS/load time) | EXISTS_BUT_INCOMPLETE — **never mounted in `index.ts`, dead code** |
| — | `execution/seo-pipeline.ts` (453 lines) | EXISTS_AND_WORKS |

### A.3 Content generation pipeline — real, wired, has a QA gate and a publisher

`routes/content-router.ts` → `POST /api/content/seo-post` → `content-division/content-orchestrator.ts` chains:
`seo-post-writer.ts` → `image-agent.ts` → `report-assembler.ts` → `gstack/role-agents/seo-qa-agent.ts` (QA gate) → on pass, `publish-agent.ts` pushes to the live site repo.

This is EXISTS_AND_WORKS and is structurally close to spec section 12 (content generation workflow) — it's missing the fact-registry/cannibalization-guard/approval-gate steps the spec requires, but the skeleton (write → QA → publish) already exists.

`marketing-foundation/content-factory.ts` is a 37-line stub that only reads pre-existing drafts — not a generator, despite the name.

### A.4 Approval engine — real, generic, but fragmented (3+ parallel stores)

Canonical/wired: `approval/gate.ts` (SQLite `approval_queue` table in `ops.db`) mounted at `/api/approval`. Generic by `category` string — any domain (including `seo_*` categories) can enqueue through it today with no code changes. Risk levels L1 (auto)/L2 (single confirm)/L3 (double confirm) already model the spec's SAFE_AUTO/REQUIRES_APPROVAL split.

Caveat: `execution/persistent-approval-store.ts`, `execution/approval-orchestrator.ts`, `executive-coordination/approval-registry.ts`, `production-approval/durable-store.ts`, `operations/approval-source-of-truth.ts`, `routes/mi-review-approvals.ts` are parallel/overlapping approval implementations not unified with `gate.ts`. Root `AUDIT_APPROVAL_ENGINE.md`'s claim of `/escalate` and `/cancel` endpoints is stale — current code has none.

**Per CLAUDE.md's rule 2 ("DO NOT modify Dev3 Role Engine, Skill Engine, or Approval Engine"), the SEO Control Center must build on top of `approval/gate.ts` via new `category` values — not fork a fourth approval store, and not modify the existing engine.**

### A.5 QA engine — real, generic

`gstack/qa-certification-engine.ts` — domain-agnostic pass-rate math (PASS ≥100%, CONDITIONAL_PASS ≥70%, REJECTED <70%), takes `{qa_pass_count, qa_total_count, base_confidence}`. Reusable as-is for the spec's 95%-threshold QA pipeline; just needs SEO-specific check counts fed in.

### A.6 Evidence store — real, two patterns to choose from

(a) SQLite (`company-os/evidence-store.ts`, WAL, `executions`/`pipeline_runs` tables in `.local-agent-global/company-os/evidence.db`); (b) content-addressed JSON files (`mi-core/data/evidence/run-<id>/<sha256>.json`, confirmed on disk). No single unified evidence API exists. **Recommendation: extend pattern (a) with a new `seo_evidence` table** rather than invent a third mechanism.

### A.7 Schedulers — real, no cron library

No `node-cron` in mi-core (the standalone `SEO/` orchestrator does use `node-cron`, inconsistently). mi-core uses `setInterval` + manual hour checks (`cron/sync-scheduler.ts`, `jarvis/daily-briefing-scheduler.ts`), started from `index.ts`. New SEO schedules (daily/weekly/monthly per spec §29) should follow this `setInterval` convention for consistency with mi-core, while the existing `SEO/` orchestrator's `node-cron` jobs can keep running as-is or be folded in later — not urgent to reconcile in Phase 1.

### A.8 Database architecture — two `.local-agent-global` roots (drive-letter drift)

Repo root `.local-agent-global/` (visibility, evidence, qb-agent.db) and `mi-core/.local-agent-global/` (graph.db, memory.db, knowledge.db) are **separate directories**, and `mi-core/CLAUDE.md`'s documented path (`E:/Project/Master/`) doesn't match the actual `D:` drive — stale doc, not a real path split. No migration framework; every module does inline `CREATE TABLE IF NOT EXISTS` bootstrap on load. A `.local-agent-global/seo/gbp-snapshots.db` **already exists**, confirming the intended location for new `seo_*` tables.

### A.9 Dashboard/UI — plain HTML/JS, no framework, no shared API client

`mi-core/ui/{agenview,liveboard,mobile,approval,brain,mi-chat,qb-dashboard}.html` — vanilla `fetch()` per page, no shared client module, no component framework. A new SEO Control Center UI should match this pattern (new static HTML page(s) + direct fetch calls) rather than introducing a new frontend stack, per spec §33 ("not a separate visual product unless the existing dashboard architecture requires it").

### A.10 Google connectors — real OAuth, but GSC/GA4/GBP not in the visibility registry

Real `googleapis` SDK usage confirmed (package.json has `googleapis@173`), shared OAuth tokens at `.local-agent-global/visibility/google-tokens.json`. However `connector-registry.json` (the visibility layer's source of truth for connector status) only lists `google-calendar`/`google-drive`/`google-sheets`/`gmail` — **GSC/GA4/GBP connectors exist in code but are not registered there**, so they're invisible to whatever surfaces connector health today. This should be fixed in Phase 1 (register them) so the dashboard's MOCK/CONFIGURED/CONNECTED/LIVE_VERIFIED status (spec §42) has one source of truth.

### A.11 Notifications — real, WhatsApp-based

`services/whatsapp-sender.ts` → `queueToCeo()` → WhatsApp gateway relay (`localhost:3211`), file-outbox fallback. Reusable directly for SEO daily/weekly/monthly report delivery.

### A.12 Browser automation / ChatGPT connector — the one genuinely missing piece

No ChatGPT connector, no `AIProvider` abstraction with a browser leg, exists anywhere (`grep chatgpt|ChatGPT` across the repo returns nothing). What exists that's reusable as a **template**, not a drop-in:

- `Agent/doordash-compaigns/src/executor/session-manager.ts` — the best precedent: persistent Playwright context backed by a `BROWSER_PROFILE_DIR`, headed manual-login-once → headless-reuse flow, 2FA detection/pause. This is the pattern to copy for `ChatGPTBrowserProvider`.
- `ai-video-guide-system/apps/playwright-runner/` — a working Express service (port 3002, routes `/run`, `/walkthrough`) but **no session persistence** — fresh context per job, credentials re-entered each time. Wrong pattern for a connector that must stay logged in.
- `mi-core/server/src/browser/browser-router.ts` + Python `browser_bridge.py` (`browser_use` + `ChatOllama` + Playwright, or Skyvern) — closest existing "AI browses a page" plumbing, but also no persistent profile.
- `mi-core/services/whatsapp-ai-gateway/src/whatsapp/session-manager.js` — proves persistent login-across-restarts works in this codebase (Puppeteer + `LocalAuth`, not Playwright, but same concept).
- Text-generation today runs through `providers/provider-router.ts` (`openai|anthropic|gemini|deepseek|ollama|minimax|openai-compatible`) — all HTTP-API-based, local Ollama is the operative default (`qwen3:8b` fast, `qwen3:14b` deep). No `chatgpt-browser` provider type exists in this enum yet; adding one is additive, not a rewrite.

---

## B. Current website audit

### B.1 Bakudan Ramen (`D:\Project\Master\Bakudan\bakudanramen.com-current`)

- **Stack:** Static HTML/CSS/vanilla JS (README) contradicted by `package.json` (Express/PHP deps, no `server/` dir present — dead reference). Real API layer is PHP (`api/index.php`). No real build tool (`"build": "echo No build step required"`).
- **Deploy:** `.github/workflows/deploy.yml` — SCP straight to production DreamHost host on push to `main`. **No build, no preview, no rollback step.** Two git remotes (`dev`, `origin`) pointing at different GitHub repos.
- **Pages:** Flat per-URL HTML. Location pages: `locations/{the-rim,stone-oak,bandera}.html`. Separate geo-landing pages (`ramen-stone-oak.html`, `best-ramen-san-antonio.html`, etc.) overlap in intent with the location pages — cannibalization risk already exists in production.
- **Blog:** Two inconsistent systems — manual root `blog-*.html` files (README says "copy a file, link it manually"), plus an unreferenced `blog-cms/` directory of unclear live status.
- **Schema:** `Restaurant` JSON-LD confirmed present on location pages and 15 pages total.
- **sitemap.xml / robots.txt: neither exists** at the deployable site root — concrete, fixable gap.
- **Analytics:** GA4 `G-3GZ2RYDR6M` confirmed live. No GTM. **No Search Console verification tag found** — GSC ownership status unconfirmed from source alone.
- **Ordering:** Toast links hardcoded per location, tracked via a custom `trackEvent()` GA wrapper.
- **Internal linking:** No shared nav/footer partial — duplicated inline per file.
- **Quick issues:** 28 of 38 sampled `<img>` tags have empty `alt=""` despite README claiming WCAG 2.1 AA compliance.
- **Env vars:** `.env.example` only documents `PORT=5181` — stale relative to actual PHP/GA4/Toast integrations.
- **Automation-safety verdict: NOT currently safe for automated publishing.** No build/preview/rollback in CI, 56 uncommitted/untracked files in the working tree including stray junk, and a README/package.json contradiction about the stack itself. Also relevant: root docs `SEO_ROOT_CAUSE_ANALYSIS.md`/`SEO_GOOGLE_ACCESS_REMEDIATION_PLAN.md` (dated 2026-06-24) describe an incident where the entire site was Basic-Auth-blocked from Google — resolution status not independently confirmed in this audit.

### B.2 Raw Sushi (`D:\Project\Master\RawSushi\RawWebsite`)

- **Stack:** Astro `^6.1.5` used as a thin no-op wrapper (`src/pages/` empty) over hand-authored static HTML in `public/`. Custom `build.mjs` with a documented Windows libuv-crash workaround.
- **Deploy:** Cloudflare Pages/Workers, but **two conflicting configs exist simultaneously**: `wrangler.toml` vs `wrangler.jsonc` with different output-dir settings. `.github/workflows/scheduled-publish.yml` runs every 5 min against a **hardcoded preview URL fallback**, not a real build→verify→promote pipeline.
- **Critical finding — duplicate site trees:** 30+ loose `.html` files at repo root vs. a structurally different, clean-URL copy under `public/`. `build.mjs` only deploys `public/`, so the root copy is likely stale/dead, but nothing prevents someone editing the wrong copy. **Two conflicting `_redirects` files** (root vs `public/`) with different rules, including different blog anchor targets (`#stories` vs `#blog`).
- **Locations (verified against live JSON-LD, not the stale README):** Stockton — 10742 Trinity Parkway, Suite D, Stockton, CA 95219 (matches the CEO's brief); Modesto — 1200 I Street, Modesto, CA 95354 (**a second location not mentioned in the build brief — must be included in brand/location config**). README's address for Stockton (San Joaquin Ave) is wrong/stale.
- **Domain:** `rawsushibar.com` (`www.rawsushibar.com` canonical) confirmed via config, sitemap, robots.txt, and redirect middleware — matches the brief.
- **Blog:** Three overlapping, unreconciled mechanisms (static `blog-*.html` files, a "Stories" homepage section, and a newer markdown+frontmatter pipeline at `public/content/posts/` with only 2 posts). A partial admin CMS SPA (`public/admin/`) and agent-publish API bridge (`functions/api/agent/`) already exist — this is the most promising existing hook for the spec's publishing adapter, but incomplete.
- **Schema:** `Organization`, `Restaurant` (×2), `FAQPage`, `BreadcrumbList`, `ItemList` JSON-LD confirmed — good coverage.
- **sitemap.xml / robots.txt:** both exist, static, consistent with the `public/` URL scheme (further evidence `public/` is canonical).
- **Analytics:** GA4 `G-WNHH66NT41` hardcoded, production ID with no staging property. **No GSC verification found. No GTM.**
- **Ordering:** Toast link confirmed. **No DoorDash link found** despite README claiming DoorDash integration (stale doc).
- **Env vars:** `.env.example` documents an admin/agent-coding API surface (`AGENT_CODING_API_BASE_URL`, `RAWWEBSITE_ADMIN_SECRET`) but no GA/GSC/Toast keys — those are hardcoded in HTML/JS instead of env-configured.
- **Automation-safety verdict: NOT currently safe for automated publishing** until the root-vs-`public` duplicate trees and the two conflicting `_redirects`/`wrangler` configs are reconciled into one canonical source, and the cron-only scheduler trigger is replaced with a real build→preview→verify→promote pipeline.

---

## C. Gap analysis

Classification per spec: EXISTS_AND_WORKS / EXISTS_BUT_INCOMPLETE / BROKEN / DUPLICATED / NOT_IMPLEMENTED / BLOCKED_BY_CONFIGURATION / BLOCKED_BY_CREDENTIALS

| Feature area (spec §) | Status | Notes |
|---|---|---|
| Technical SEO audit (§18) | EXISTS_AND_WORKS | `SEO/seo-technical-agent`, 13 checks; also a dead-code duplicate at `seo-monitoring-router.ts` |
| Keyword research (§9) | NOT_IMPLEMENTED | Only a hardcoded topic list exists (`seo-content-agent`); no discovery/clustering/cannibalization engine |
| Topic cluster map (§10) | NOT_IMPLEMENTED | No visual graph, no cluster data model |
| Business Fact Registry (§11) | NOT_IMPLEMENTED | No verified-fact store or claim-blocking logic anywhere |
| Content generation engine (§12) | EXISTS_BUT_INCOMPLETE | Write→QA→publish skeleton exists (`content-division/*`); missing fact-check, cannibalization guard, brief step |
| Cannibalization guard (§14) | NOT_IMPLEMENTED | Not present in code; both live sites already show real-world cannibalization (Bakudan geo-pages vs location pages) |
| Internal link engine (§15) | NOT_IMPLEMENTED | No URL registry, no orphan/broken-link detector beyond the generic technical crawler |
| CTA engine (§16) | NOT_IMPLEMENTED | No location-aware CTA/URL registry |
| Local SEO engine (§17) | EXISTS_BUT_INCOMPLETE | `brand-config.ts` models brands/locations; no NAP-consistency or local-content-plan logic |
| GBP integration (§4) | EXISTS_BUT_INCOMPLETE | Real connector code (`gbp-connector.ts`), OAuth-gated, not confirmed LIVE_VERIFIED, not in visibility registry |
| GSC/GA4 integration (§20) | EXISTS_BUT_INCOMPLETE | Real connector code, same caveat as GBP |
| Backlink management (§19) | NOT_IMPLEMENTED | No backlink tracking/scoring code found anywhere |
| Approval workflow (§23) | EXISTS_AND_WORKS but DUPLICATED | Canonical engine at `approval/gate.ts`; 5+ parallel/overlapping stores exist and should NOT be extended further |
| QA pipeline (§24) | EXISTS_AND_WORKS (generic) | `qa-certification-engine.ts` reusable as-is |
| Evidence system (§ general) | EXISTS_AND_WORKS but DUPLICATED | Two patterns (SQLite + content-addressed JSON); pick one for SEO |
| ChatGPT browser provider (§3) | NOT_IMPLEMENTED | Zero code; two partial precedents to build from (see A.12) |
| Manual paste fallback (§3) | NOT_IMPLEMENTED | — |
| Website publishing adapters (§25) | BLOCKED_BY_CONFIGURATION | Both sites' CI/deploy pipelines lack preview+rollback; must be fixed before adapters can safely auto-publish |
| Reporting (§36) | EXISTS_BUT_INCOMPLETE | Orchestrator produces run reports/logs; no daily/weekly/monthly CEO-report templates for SEO specifically (WhatsApp briefing infra is reusable) |
| Automation scheduler (§29) | EXISTS_AND_WORKS (two competing schedulers) | `SEO/` orchestrator (node-cron, idle) vs mi-core `setInterval` pattern — needs reconciliation, not a rebuild |
| Policy engine / config/seo-policy.yaml (§21) | NOT_IMPLEMENTED | No policy file or policy-precedence enforcement exists; approval risk-levels (L1/L2/L3) are the nearest analog |
| Multi-brand dashboard UI (§6-8) | NOT_IMPLEMENTED | No SEO-specific dashboard UI exists yet in `mi-core/ui/`; brand/location data model to back it already exists |
| Database migrations for `seo_*` tables (§27) | NOT_IMPLEMENTED | No migrations yet; `.local-agent-global/seo/gbp-snapshots.db` shows the intended location |

---

## D. Reuse plan

**Reuse as-is:**
- `approval/gate.ts` — enqueue new `seo_*` categories, do not fork a new store.
- `gstack/qa-certification-engine.ts` — feed it SEO QA check counts.
- `seo/brand-config.ts` + `SEO/shared/config/{brands,locations}.json` — extend with Raw Sushi's Modesto location and any missing fields, don't replace.
- `seo/google-search-console-connector.ts`, `ga4-connector.ts`, `gbp-connector.ts` — verify OAuth tokens are live, register them in `connector-registry.json`, build the dashboard on top of these rather than writing new connectors.
- `services/whatsapp-sender.ts` — for daily/weekly/monthly SEO report delivery.
- `SEO/seo-technical-agent` — as the technical-audit engine (retire the dead-code duplicate at `seo-monitoring-router.ts`).
- `company-os/evidence-store.ts` pattern — extend with `seo_evidence`, don't invent a third evidence mechanism.
- `mi-core/ui/*.html` vanilla-JS pattern — for the new SEO dashboard.
- `Agent/doordash-compaigns/src/executor/session-manager.ts` — as the structural template for `ChatGPTBrowserProvider`'s persistent-context/manual-login pattern.

**Extend:**
- `content-division/content-orchestrator.ts` pipeline — add fact-check, cannibalization-guard, and brief-generation steps ahead of the existing write→QA→publish chain.
- `providers/provider-router.ts` — add a `chatgpt-browser` provider type alongside the existing HTTP-API providers.
- `routes/seo.ts` — extend with the new `/api/seo/*` routes from spec §28 rather than building a parallel router.

**Repair before building on top of:**
- Bakudan's `deploy.yml` — add build/preview/rollback stages before any publish adapter touches it.
- Raw Sushi's duplicate root-vs-`public` trees and conflicting `_redirects`/`wrangler` configs — reconcile to one canonical source first.
- `connector-registry.json` — register GSC/GA4/GBP so connector health has one source of truth.

**Deprecate/merge (do not delete without separate confirmation — flag for CEO decision):**
- `mi-core/SEO/` — duplicate/forked copy of root `SEO/` docs and shared/ dir; needs a diff review before removal.
- Parallel approval stores (`persistent-approval-store.ts`, `approval-orchestrator.ts`, `approval-registry.ts`, `durable-store.ts`, `approval-source-of-truth.ts`) — candidates for consolidation onto `approval/gate.ts`, but this is a cross-cutting change beyond SEO scope; out of scope for this project unless explicitly requested.
- `seo/seo-monitoring-router.ts` — genuinely dead code (never mounted); safe to remove once `SEO/seo-technical-agent` is confirmed as the sole technical-audit path.
- `marketing-foundation/content-factory.ts` — 37-line stub, superseded by `content-division/*`; safe to remove once confirmed unused elsewhere.

**Not started, build new:**
- Keyword research/clustering engine, topic cluster map, Business Fact Registry, cannibalization guard, internal link engine, CTA engine, backlink management, `config/seo-policy.yaml` + policy UI, ChatGPT browser provider + manual fallback, SEO dashboard UI (calendar/clusters/local/GBP/backlinks/approvals/evidence/reports/policies screens), `seo_*` database migrations.

---

## Open questions for the CEO before Phase 1 begins

1. Bakudan's CI currently has no rollback path — do you want CI hardened (add preview + manual-approval-gated production deploy) as part of this project, or is that a separate workstream?
2. Raw Sushi has a second location (Modesto) not mentioned in the original brief — **resolved during the build**: included in the brand/location config alongside Stockton (see Phase 1 build notes below).
3. **CORRECTION (found during build, not in the original read-only audit): `mi-core/SEO/` is not a stale duplicate — it is the live one.** `brand-config.ts` resolves its config path via `${MI_CORE_ROOT}/SEO/shared/config/`, and production's `mi-core/ecosystem.config.js` explicitly sets `MI_CORE_ROOT=D:/Project/Master/mi-core`. So `mi-core/SEO/shared/config/{brands,locations}.json` is what the running server actually reads — it also has richer, real data (live GSC site URLs, GA4 property/measurement IDs, GBP quota-limited status) than the repo-root `SEO/shared/config/` copy this audit originally inspected. The root copy is used by the standalone `SEO/` orchestrator and its `validate-brand-config.js` script, not by mi-core's Express server. Both copies were fixed for the Raw Sushi location gap; treat `mi-core/SEO/` as authoritative for anything the dashboard/API reads. The root `SEO/` vs `mi-core/SEO/` split itself is still worth resolving into one canonical location in a future pass — flagging that as unresolved, not the location-data bug, which is fixed.
4. GSC/GA4/GBP connector code exists and OAuth is live for at least the GBP path (`hasBizManageScope()` — a real token/scope check, exercised during this build). Full LIVE_VERIFIED status (a real successful GSC/GA4/GBP data pull, not just token presence) was not established in this build — see [`QA_REPORT.md`](QA_REPORT.md) for exact per-connector status.
