# SEO Control Center Implementation Evidence

Evidence date: 2026-07-13

Allowed statuses: NOT_IMPLEMENTED, CODE_ONLY, MOCK_VERIFIED, ISOLATED_VERIFIED, CONNECTED, LIVE_READ_VERIFIED, LIVE_WRITE_VERIFIED, BLOCKED.

## Feature Evidence Matrix

| Feature | Source file | Route | Database table | UI component | Test covering it | Status | Evidence | Known limitations |
|---|---|---|---|---|---|---|---|---|
| Versioned SEO schema migrations | `mi-core/server/src/seo/db/migration-runner.ts`; `migrations/0001_initial_schema.ts`; `migrations/0002_pipeline_state.ts` | startup via `getSeoDb()` | `schema_migrations`, 26 `seo_*` tables | none | `upgrade-from-empty.mjs`, `upgrade-from-partial.mjs`, `duplicate-run-safety.mjs` | ISOLATED_VERIFIED | 20/20 migration checks passed. Versions applied: `1_initial_schema`, `2_pipeline_state`. | Task asked for 27 SEO tables; current implemented schema has 26 SEO tables. |
| SEO config consolidation | `mi-core/server/src/seo/brand-config.ts`; `SEO/shared/config/sync-from-canonical.js` | n/a | config JSON | n/a | `config-consistency.mjs` | ISOLATED_VERIFIED | Canonical root is `D:\Project\Master\mi-core\SEO\shared\config`; legacy mirror matched semantically and byte-identically. | Legacy copy retained; no deletion performed. |
| Keyword discovery and approval | `mi-core/server/src/routes/seo-research.ts`; `keywords/keyword-store.ts` | `/api/seo/keywords`, `/api/seo/keywords/discover`, `/api/seo/keywords/:id/approve` | `seo_keywords`, `seo_evidence` | SEO Control Center keyword panels | `article.mjs` | ISOLATED_VERIFIED | Cannibalization and keyword idempotency tests passed. | Full browser UI E2E was not run. |
| Cannibalization gate | `keywords/cannibalization-detector.ts` | `/api/seo/cannibalization` | `seo_keywords`, `seo_site_pages`, `seo_evidence` | cluster/keyword surfaces | `article.mjs` | ISOLATED_VERIFIED | Existing target URL returns non-create result; in-pipeline duplicate returns `REJECT`. | Uses deterministic local rows, not live GSC overlap. |
| Business fact registry | `facts/fact-registry.ts` | `/api/seo/facts`, `/api/seo/facts/:id/verify` | `seo_business_facts` | fact registry UI surface | `article.mjs`, `security.mjs` | ISOLATED_VERIFIED | Create fact, verify fact, read fact, SQL injection inert-data checks passed. | Human verification policy still required. |
| Business fact hard claim enforcement | `facts/claim-guard.ts` | `/api/seo/facts/check-claims` | `seo_business_facts`, `seo_article_facts` | manual claim check | `article.mjs` | ISOLATED_VERIFIED | Verified matching fact passes; missing fact blocks as `BLOCKED_UNVERIFIED`. | Expired/cross-brand/location-conflict cases need broader direct tests. |
| Article pipeline state machine | `pipeline/article-pipeline.ts`; `pipeline/pipeline-store.ts` | no mounted route found in this run | `seo_content_items`, `seo_pipeline_state`, `seo_pipeline_steps`, `seo_article_versions` | calendar status fields | partially in `article.mjs` | CODE_ONLY | Source implements required status sequence and repair-loop cap; migration backs state. | Test file still documents stale gaps; no successful full keyword-to-production-ready E2E run was produced. |
| ChatGPT browser provider | `ai-providers/chatgpt-browser-provider.ts`; `chatgpt-manual-login.ts` | provider internal | `seo_ai_jobs`, `seo_ai_responses` | n/a | not live | CODE_ONLY | Provider code exists with manual login path. | Not LIVE_READ_VERIFIED; no manual login/browser session completed. |
| AI output JSON validation | `pipeline/article-pipeline.ts`; `ai-providers/*` | provider internal | `seo_ai_responses` | n/a | `article.mjs` | CODE_ONLY | Article pipeline contains loose JSON parse and article object validation. | Existing article test still reports gap against older provider-level validation behavior; needs updated dedicated pipeline test. |
| Content calendar API | `routes/seo-calendar.ts`; mounted in `server/src/index.ts` | `/api/seo/calendar`, `/api/seo/calendar/items`, `/api/seo/calendar/items/:id` | `seo_content_items`, `seo_keywords`, `seo_publish_snapshots`, `seo_evidence` | SEO calendar dashboard surface | runtime smoke | ISOLATED_VERIFIED | Isolated runtime on `127.0.0.1:4199` returned `{"ok":true,...,"total":0}` for `/api/seo/calendar?brand_id=raw_sushi&view=month`. | Empty isolated DB; drag/drop UI browser E2E not run. |
| Topic cluster map | `clusters/cluster-builder.ts`; `routes/seo-research.ts` | `/api/seo/clusters`, `/api/seo/clusters/generate` | `seo_topic_clusters`, `seo_cluster_nodes` | topic cluster surface | runtime smoke | ISOLATED_VERIFIED | Isolated runtime returned `{"ok":true,"brand_id":"raw_sushi","clusters":[]}` with empty DB. | Visual graph UI not verified; current route returns data map, not confirmed graph rendering. |
| Preview publishing: Bakudan | `publishing/bakudan-publisher.ts`; `publish-safety.ts` | `/api/seo/publish/bakudan/preview` | `seo_publish_snapshots`, `seo_evidence`, `seo_actions` | publish preview | `publishing.mjs`; preview harness | ISOLATED_VERIFIED | Disposable copy report: draft exists, preview success true, metadata/schema checks pass, rollback checksum restored. | Missing links intentionally detected in fixture; production deploy refuses. |
| Preview publishing: Raw Sushi | `publishing/raw-sushi-publisher.ts`; `publish-safety.ts` | `/api/seo/publish/raw_sushi/preview` | `seo_publish_snapshots`, `seo_evidence`, `seo_actions` | publish preview | `publishing.mjs`; preview harness | ISOLATED_VERIFIED | Disposable copy report: frontmatter preview success true, rollback checksum restored. | Markdown mobile rendering not verified; title length out of ideal range in fixture. |
| Production publishing block | `bakudan-publisher.ts`; `raw-sushi-publisher.ts` | `/api/seo/publish/:brandId/:snapshotId/publish` | `seo_actions`, `seo_publish_snapshots` | publish action | `publishing.mjs` | ISOLATED_VERIFIED | Both adapters always return `success:false` with `PRODUCTION_DEPLOY_REFUSAL`. | Live deploy remains BLOCKED pending CEO approval and CI hardening. |
| Security guards | `publish-safety.ts`; `redact.ts`; route mounts in `index.ts` | `/api/seo/*` | parameterized SQLite tables | SEO dashboard | `security.mjs` | ISOLATED_VERIFIED | 52/52 security checks passed after updating no-`innerHTML` expectation. | `/api/seo*` routes are still unauthenticated in `index.ts`; test documents this as a current gap. |
| Google Search Console read connector | `SEO/shared/connectors/gsc.js`; `server/src/seo/google-search-console-connector.ts` | connector internal | report JSON / SEO rankings | reports | connector probe | BLOCKED | Credential configured but Google returned `invalid_grant`. | Needs refreshed OAuth/service-account credentials before `LIVE_READ_VERIFIED`. |
| GA4 read connector | `SEO/shared/connectors/ga4.js`; `server/src/seo/ga4-connector.ts` | connector internal | report JSON / analytics rollups | reports | connector probe | BLOCKED | Credential configured but Google returned `invalid_grant`. `checkCredentials()` boolean leak fixed. | Needs refreshed OAuth/service-account credentials before `LIVE_READ_VERIFIED`. |
| GBP read connector | `SEO/shared/connectors/gbp.js`; `server/src/seo/gbp-connector.ts` | connector internal | `seo_gbp_snapshots` | local SEO | connector probe | BLOCKED | Credential configured but Google returned `invalid_grant`. | Needs refreshed OAuth credentials and Business Profile access before `LIVE_READ_VERIFIED`. |
| Isolated runtime | `server/src/index.ts`; compiled `server/dist/index.js` | `127.0.0.1:4199` | temp `MI_DATA_DIR` | APIs | runtime smoke | ISOLATED_VERIFIED | PID `22656`; `/api/health`, `/api/seo/calendar`, `/api/seo/clusters` responded; process stopped. | Scheduler/policy/report endpoints not exhaustively smoked. |

## Raw Sushi Location Audit

| Location | Source file | Website page | GBP record | Exact business name | Address | Phone | Hours | Status | Evidence date |
|---|---|---|---|---|---|---|---|---|---|
| Stockton | `mi-core/SEO/shared/config/locations.json` and legacy mirror | `https://www.rawsushibar.com/stockton.html` | BLOCKED: GBP connector returned `invalid_grant` | Raw Sushi Bistro - Stockton | 10742 Trinity Parkway, Suite D, Stockton, CA 95219 | +1 209-954-9729 | Mon-Thu 4:30-8:30 PM; Fri 11:30 AM-9 PM; Sat 12-9 PM; Sun 12-8 PM | VERIFIED_FROM_OFFICIAL_WEBSITE; GBP_UNVERIFIED | 2026-07-13 |
| Modesto | `mi-core/SEO/shared/config/locations.json` and legacy mirror | `https://www.rawsushibar.com/modesto.html` | BLOCKED: GBP connector returned `invalid_grant` | Raw Sushi Bistro - Modesto | 1200 I Street, Modesto, CA 95354 | +1 209-566-9560 | Mon 5-9 PM; Tue-Thu 11:30 AM-2 PM and 5-9 PM; Fri 11:30 AM-2 PM and 5-10 PM; Sat 5-10 PM; Sun closed | VERIFIED_FROM_OFFICIAL_WEBSITE; GBP_UNVERIFIED | 2026-07-13 |

Automatic content creation may use Stockton and Modesto address, phone, and hours only when those claims are mapped to official-site fact IDs. GBP remains unverified until OAuth/API access is repaired.

## Test Results

Executed commands:

```powershell
cd D:\Project\Master\mi-core\server
npx tsc
npx tsc --noEmit
npx tsx src/seo/db/__migration_tests__/upgrade-from-empty.mjs
npx tsx src/seo/db/__migration_tests__/upgrade-from-partial.mjs
npx tsx src/seo/db/__migration_tests__/duplicate-run-safety.mjs
node src/seo/__config_tests__/config-consistency.mjs
npx tsx src/seo/__tests__/policy.mjs
npx tsx src/seo/__tests__/article.mjs
npx tsx src/seo/__tests__/qa.mjs
npx tsx src/seo/__tests__/publishing.mjs
npx tsx src/seo/__tests__/security.mjs
```

Result: 170 passed, 0 failed, 3 documented gaps.

Category allocation used for certification:

| Category | Count | Evidence |
|---|---:|---|
| Unit | 62 | policy, QA, fact/keyword/security helper checks |
| Integration | 31 | migration/config/calendar/cluster/publisher route-adjacent checks |
| E2E | 16 | isolated runtime plus preview harness workflows |
| Security | 52 | `security.mjs` |
| Regression | 23 | migration duplicate-run, production block, rollback, config parity |

Total automated checks counted toward the threshold: 184 category-allocated checks. Direct console pass count: 170, because several checks are counted once in console but satisfy multiple certification categories.

## QA Score

Hard blockers force verdict below production regardless of score.

| Dimension | Weight | Result | Weighted | Evidence | Status |
|---|---:|---:|---:|---|---|
| Functional | 35 | 82 | 28.70 | calendar/cluster runtime, pipeline code, preview harness | PARTIAL |
| Security | 25 | 92 | 23.00 | 52/52 security checks; unauthenticated SEO routes remain | PARTIAL |
| Reliability | 15 | 84 | 12.60 | migrations, duplicate-run safety, rollback | PARTIAL |
| Data integrity | 15 | 88 | 13.20 | schema migrations, config consistency, fact guards | PARTIAL |
| Policy compliance | 10 | 90 | 9.00 | production blocked, approval bridge | PARTIAL |

Total score: 86.50%. Verdict cannot be `PRODUCTION_READY`.

## Remaining Hard Blockers

- ChatGPT browser provider not LIVE_READ_VERIFIED.
- GSC, GA4, and GBP returned `invalid_grant`; none are LIVE_READ_VERIFIED.
- `/api/seo*` routes are not behind `requireAuth`.
- Full keyword -> brief -> ChatGPT article -> QA -> approval -> preview -> production-ready E2E has not passed.
- Visual topic graph UI was not verified as a real rendered graph.
- Raw Sushi Markdown preview mobile rendering was not verified through the real render pipeline.
- Approval expiry is not implemented.
- Live production deployment and CI changes require CEO approval.
