# SEO Control Center — QA Report

## Build verification

`cd mi-core/server && npx tsc --noEmit` — zero errors, checked repeatedly after every phase of this build (Phase 1 foundation, all four parallel engine builds, dashboard/reporting/scheduler, path-traversal fix, index.ts mounting). Full `npx tsc` (emitting) was also run to regenerate `dist/`.

## Runtime verification (this is the part that matters — code that only type-checks isn't proven to work)

An isolated test instance was run (`MI_PORT=4091`, separate `MI_DATA_DIR`/`GLOBAL_DIR`/`DATA_ROOT` pointing at a temp directory) to avoid touching the live production mi-core process (PM2 `mi-core`, which stayed online and unaffected throughout — verified before and after). The following were exercised for real, against real code paths, not mocked:

| What | Method | Result |
|---|---|---|
| `GET /api/seo/brands` | curl | 200, real brand/location/connector data |
| `GET /api/seo/local?brand_id=raw_sushi` | curl | 200, **initially returned 0 locations** — this caught a real bug (see below) |
| `POST /api/seo/keywords/discover` (bakudan) | curl | 200, generated 25 real keyword candidates with intent classification, deterministic demand/difficulty scoring, all persisted to `seo_keywords` |
| `GET /api/seo/cannibalization?brand_id=bakudan&keyword=ramen san antonio` | curl | 200, real decision (`CREATE_NEW`, correct reason), evidence recorded |
| `POST /api/seo/gbp/posts/generate` (raw_sushi/stockton) | curl | 200, real 80-250-word draft using the actual audited Stockton address, routed through `submitSeoAction` |
| `GET /api/approval/pending` | curl | 200, showed the GBP post draft as a pending `seo_gbp_post_publish` approval — confirms the policy engine → approval-gate integration works end-to-end, not just in isolation |
| `POST /api/seo/reports/generate` (bakudan, daily) | curl | 200, real report pulling from `seo_issues`/`seo_automation_runs`/approval-gate pending count |
| `GET /seo-control-center.html` | browser (Claude Browser pane) | Loaded, sidebar nav rendered, brand/location selectors populated correctly |
| Brand selector → location dropdown cascade | browser interaction | Selecting "Bakudan Ramen" correctly populated 3 location options | 
| Policies tab | browser interaction | Rendered the real, live `seo-policy.yaml` content (all 4 tiers, correct category lists) — not a hardcoded UI mockup |
| `POST /api/seo/keywords/discover` via the dashboard's own "Discover Keywords" button | browser interaction | Returned HTTP 500 — see below |

### Bug found and fixed during QA: Raw Sushi locations missing

`GET /api/seo/local?brand_id=raw_sushi` returned 0 locations on first test. Root cause: `brand-config.ts` reads `${MI_CORE_ROOT}/SEO/shared/config/locations.json`, and production's `MI_CORE_ROOT=D:/Project/Master/mi-core` (`ecosystem.config.js`) means it reads **`mi-core/SEO/shared/config/`**, not the repo-root `SEO/shared/config/` copy this build had fixed earlier in Phase 1. The `mi-core/SEO/` copy still had the old single-vague-location Raw Sushi entry (`raw-sushi-hq`, `status: needs_location_config`, no real address). **Fixed**: updated `mi-core/SEO/shared/config/locations.json` with the real, audit-verified Stockton and Modesto locations, and corrected `mi-core/SEO/shared/config/brands.json`'s `raw_sushi` domain to `https://www.rawsushibar.com`. Re-verified after the fix: `GET /api/seo/local?brand_id=raw_sushi` correctly returns both locations. This also corrects [`INITIAL_AUDIT.md`](INITIAL_AUDIT.md)'s open question #3, which had incorrectly assumed `mi-core/SEO/` was the stale copy.

### Non-bug found during QA: dashboard "Discover Keywords" button 500

Clicking the button in the Claude Browser preview pane produced a CORS-rejected request (mi-core's CORS origin allowlist doesn't include the browser-preview-tool's proxy origin). The identical request via `curl` (same-origin equivalent to how the dashboard is actually served — same Express server serves both the HTML and the API) succeeded and returned real data. This is an artifact of the test tooling, not a defect in the shipped code; real usage (opening `http://<mi-core-host>/seo-control-center.html` directly) is same-origin and unaffected.

## What was NOT verified end-to-end

- **ChatGPT browser provider**: code reviewed and compiles, but no manual login was performed and no real ChatGPT job was submitted in this session. Status: **CONFIGURED, not CONNECTED or LIVE_VERIFIED** — see [`CHATGPT_BROWSER_CONNECTOR.md`](CHATGPT_BROWSER_CONNECTOR.md).
- **GBP post publish** (`publishApprovedGbpPost`): intentionally returns an honest failure (`GBP posts API capability not available in gbp-connector.ts`) since the underlying connector has no post-creation capability yet — verified this returns the correct honest error, not a fake success.
- **Website publish adapters' `publishApproved()`**: verified these return the intended honest refusal rather than attempting a real deploy (code-reviewed, not executed against a live site since that's the point — they're designed to refuse).
- **Backlink discovery/crawling**: no live third-party backlink index is configured — the scoring logic (`backlink-scorer.ts`) was reviewed but not exercised with real crawled data, only documented input shapes.
- **Automated test suite**: no unit/integration/e2e test files were added in this build (spec §38 calls for these); verification here was manual, interactive, and documented above rather than codified into a repeatable suite.

## Score

Per this project's own rule (never report PASS on mocked data, never claim LIVE_VERIFIED without a real successful call): this build is **functionally verified for the code paths listed in the table above**, with one real bug found and fixed during that verification (proving the verification was substantive, not rubber-stamped). It has **not** reached the spec's "≥95% QA score with an automated test suite" bar — that would require the test suite from spec §38, which was not built in this pass.
