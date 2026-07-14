# SEO Control Center Staged File Review

Review date: 2026-07-13
Branch: `feature/seo-control-center-secured`

Legend: authored = human/source file, generated = lockfile only, sensitive = contains
secret/private runtime data. Unless noted otherwise, all files are authored source
and contain no sensitive data.

## A. Core SEO Source

| Path | Reason included | Direct dependency | Generated | Sensitive | Build | Runtime | Tests |
|---|---|---|---:|---:|---:|---:|---:|
| `mi-core/server/src/seo/ai-providers/ai-provider.ts` | AI provider contract | SEO AI router | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/ai-providers/ai-router.ts` | AI job routing/idempotency | SEO DB/providers | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/ai-providers/chatgpt-browser-provider.ts` | ChatGPT browser provider | Playwright/profile path | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/ai-providers/chatgpt-manual-login.ts` | Manual login helper | ChatGPT provider | No | No | Yes | Operator-only | No |
| `mi-core/server/src/seo/ai-providers/local-model-provider.ts` | Local fallback provider | AI provider contract | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/ai-providers/manual-paste-provider.ts` | Manual paste fallback | AI provider contract | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/ai-providers/prompt-loader.ts` | Prompt loading | `prompts/seo` | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/ai-providers/redact.ts` | Secret redaction | ChatGPT provider/tests | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/backlinks/backlink-scorer.ts` | Backlink risk scoring | Backlink store | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/backlinks/backlink-store.ts` | Backlink review store | SEO DB/action bridge | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/brand-config.ts` | Brand/location registry | Routes, local SEO, CTA | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/clusters/cluster-builder.ts` | Topic cluster graph | Keyword store | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/cta/cta-engine.ts` | CTA resolver | Local posts, UI | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/facts/claim-guard.ts` | Business fact hard-blocks | Article pipeline | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/facts/fact-registry.ts` | Fact registry | Claim guard/routes | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/keywords/cannibalization-detector.ts` | Cannibalization guard | Article pipeline | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/keywords/keyword-cluster-engine.ts` | Keyword clustering | Research route | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/keywords/keyword-discovery.ts` | Keyword discovery | Research route | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/keywords/keyword-normalizer.ts` | Keyword normalization | Keyword store | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/keywords/keyword-store.ts` | Keyword persistence | SEO DB | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/keywords/location-keyword-mapper.ts` | Location keyword mapping | Research route | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/keywords/search-intent-classifier.ts` | Intent classification | Keyword discovery | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/links/anchor-diversity.ts` | Anchor diversity checks | Links route | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/links/broken-link-checker.ts` | Broken link checks | Links route | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/links/link-recommender.ts` | Link recommendation | Links route | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/links/link-registry.ts` | Page/link registry | Link analyzers | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/links/orphan-detector.ts` | Orphan detection | Links route | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/local/gbp-posts.ts` | GBP draft/write refusal | Local route/write guard | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/local/local-audit.ts` | Local SEO audit | Local route | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/local/nap-consistency.ts` | NAP consistency | GBP snapshots | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/pipeline/ai-call.ts` | AI call bridge | Article pipeline | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/pipeline/article-pipeline.ts` | Article preview pipeline | Providers/facts/publishers | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/pipeline/content-brief.ts` | Content brief builder | Facts/keywords | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/pipeline/pipeline-store.ts` | Pipeline state store | SEO DB | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/publishing/bakudan-publisher.ts` | Bakudan draft/preview/no-live publish | Publish safety/write guard | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/publishing/publish-safety.ts` | Snapshot/path safety | Publishers | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/publishing/raw-sushi-publisher.ts` | Raw Sushi draft/preview/no-live publish | Publish safety/write guard | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/publishing/website-publisher.ts` | Publisher interface | Publishers | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/reporting/report-generator.ts` | SEO reports | Reports route/scheduler | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/scheduler/seo-scheduler.ts` | SEO scheduler, disabled by default | Write guard/reports | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/seo-approval-bridge.ts` | Approval bridge | Policy/action routes | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/seo-db.ts` | SQLite access/migrations | All SEO modules | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/seo-evidence.ts` | Evidence writer | Routes/pipeline | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/seo-policy-engine.ts` | Policy loader/evaluator | Approval bridge | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/seo-security.ts` | Route auth/RBAC/CSRF/scope | `index.ts`, tests | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/seo-write-guards.ts` | Disabled-write flags | Scheduler/publishers/routes | No | No | Yes | Yes | Yes |

## B. SEO Routes

| Path | Reason included | Direct dependency | Generated | Sensitive | Build | Runtime | Tests |
|---|---|---|---:|---:|---:|---:|---:|
| `mi-core/server/src/routes/seo-calendar.ts` | Content calendar API | SEO DB/security | No | No | Yes | Yes | Yes |
| `mi-core/server/src/routes/seo-evidence-route.ts` | Evidence read API | SEO evidence | No | No | Yes | Yes | Yes |
| `mi-core/server/src/routes/seo-links.ts` | Internal links/backlinks API | Link/backlink modules | No | No | Yes | Yes | Yes |
| `mi-core/server/src/routes/seo-local.ts` | Local SEO/GBP/publish preview API | Local/publisher modules | No | No | Yes | Yes | Yes |
| `mi-core/server/src/routes/seo-reports.ts` | Reports/write-flag API | Report generator/write guards | No | No | Yes | Yes | Yes |
| `mi-core/server/src/routes/seo-research.ts` | Keywords/facts/clusters API | Keyword/fact modules | No | No | Yes | Yes | Yes |

## C. Security/Auth/RBAC

| Path | Reason included | Direct dependency | Generated | Sensitive | Build | Runtime | Tests |
|---|---|---|---:|---:|---:|---:|---:|
| `mi-core/server/src/routes/auth.ts` | Role sessions/CSRF/scopes | SEO security middleware | No | No | Yes | Yes | Yes |
| `mi-core/server/src/index.ts` | Mount secured SEO routes and scheduler | SEO routes/security | No | No | Yes | Yes | Yes |

## D. Database/Migrations

| Path | Reason included | Direct dependency | Generated | Sensitive | Build | Runtime | Tests |
|---|---|---|---:|---:|---:|---:|---:|
| `mi-core/server/src/seo/db/migration-runner.ts` | Migration runner | SEO DB | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/db/migrations/0001_initial_schema.ts` | Initial schema | Migration runner | No | No | Yes | Yes | Yes |
| `mi-core/server/src/seo/db/migrations/0002_pipeline_state.ts` | Pipeline state schema | Migration runner | No | No | Yes | Yes | Yes |

## E. Dashboard UI

| Path | Reason included | Direct dependency | Generated | Sensitive | Build | Runtime | Tests |
|---|---|---|---:|---:|---:|---:|---:|
| `mi-core/ui/seo-control-center.html` | SEO dashboard, calendar/graph/write flags | SEO APIs | No | No | No | Yes | Yes |

## F. Prompt Templates

All prompt files are authored, non-sensitive, runtime-required by prompt loader,
and test-covered through source/path checks:

`mi-core/prompts/seo/article-generation.md`, `article-refresh.md`,
`article-rewrite.md`, `content-brief.md`, `fact-check.md`, `gbp-post.md`,
`keyword-research.md`, `local-seo.md`, `seo-review.md`.

## G. Tests

All test files are authored, non-sensitive, not runtime-required, and required
for certification:

`mi-core/server/src/seo/__config_tests__/config-consistency.mjs`,
`mi-core/server/src/seo/__tests__/_harness.mjs`,
`article-pipeline-e2e-preview.mjs`, `article.mjs`,
`business-fact-hard-blocks.mjs`, `disabled-write-flags.mjs`, `policy.mjs`,
`publishing.mjs`, `qa.mjs`, `route-security.mjs`, `security.mjs`,
`seo-ui-browser-e2e.mjs`, and the three migration tests under
`mi-core/server/src/seo/db/__migration_tests__/`.

## H. Documentation

Authored, non-sensitive, not runtime-required:

`COMPILE_DEPENDENCY_AUDIT.md`, `GOOGLE_CONNECTOR_RECOVERY_PLAN.md`,
`SEO_ROUTE_SECURITY_MATRIX.md`, `STAGED_FILE_REVIEW.md`, `STAGED_SECRET_SCAN.md`.

## I. Configuration

| Path | Reason included | Direct dependency | Generated | Sensitive | Build | Runtime | Tests |
|---|---|---|---:|---:|---:|---:|---:|
| `mi-core/config/seo-policy.yaml` | Approval policy | Policy engine | No | No | No | Yes | Yes |
| `mi-core/SEO/shared/config/brands.json` | Canonical brands | Brand config | No | No | No | Yes | Yes |
| `mi-core/SEO/shared/config/locations.json` | Canonical locations | Brand config/local SEO | No | No | No | Yes | Yes |

## J. Package/Dependency Changes

| Path | Reason included | Direct dependency | Generated | Sensitive | Build | Runtime | Tests |
|---|---|---|---:|---:|---:|---:|---:|
| `mi-core/server/package.json` | Adds test/runtime packages used by SEO | TypeScript/tests | No | No | Yes | Yes | Yes |
| `mi-core/package-lock.json` | Lockfile from `npm install` | npm install/ci | Yes | No | Yes | Yes | Yes |
| `mi-core/server/tsconfig.json` | Compile coverage/settings compatibility | TypeScript | No | No | Yes | No | Yes |

## K. Compile-Support Changes

| Path | Reason included | Direct dependency | Generated | Sensitive | Build | Runtime | Tests |
|---|---|---|---:|---:|---:|---:|---:|
| `mi-core/server/src/gstack/ceo-report.ts` | Needed for current clean compile | QA certification engine | No | No | Yes | Yes | Yes |
| `mi-core/server/src/gstack/qa-certification-engine.ts` | Needed for SEO QA suite compatibility | `qa.mjs` | No | No | Yes | Yes | Yes |

## L. Files That May Not Belong In This PR

Reviewed but kept:

- `mi-core/server/src/gstack/ceo-report.ts`
- `mi-core/server/src/gstack/qa-certification-engine.ts`

Reason: they are compile/test support touched by the clean SEO suite. They are
not SEO product surface, but without them the clean TypeScript and QA run does
not represent the actual branch behavior.

Removed/excluded:

- `mi-core/reports/evidence/**`
- browser profiles/cookies/local storage
- SQLite databases/logs/temp files
- private screenshots
- untracked runtime artifacts
