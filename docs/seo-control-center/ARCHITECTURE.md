# SEO Control Center — Architecture

See [`INITIAL_AUDIT.md`](INITIAL_AUDIT.md) for what existed before this build and [`MASTER_SEO_POLICY.md`](MASTER_SEO_POLICY.md) for the policy model. This document describes the system as built.

## Design principle

This is an extension of the existing mi-core Express server, not a separate application. It reuses:
- the existing generic approval gate (`approval/gate.ts`) for all `REQUIRES_APPROVAL`-tier actions,
- the existing generic QA engine (`gstack/qa-certification-engine.ts`) for pass/fail scoring,
- the existing brand/location registry (`seo/brand-config.ts`) reading `SEO/shared/config/{brands,locations}.json`,
- the existing GSC/GA4/GBP connectors (`seo/{google-search-console-connector,ga4-connector,gbp-connector}.ts`),
- the existing WhatsApp notification channel (`services/whatsapp-sender.ts`),
- the existing vanilla-HTML/JS dashboard pattern (`mi-core/ui/*.html`).

New code lives under `mi-core/server/src/seo/` (engines) and `mi-core/server/src/routes/seo-*.ts` (routers), all additive — no existing route, table, or exported function signature was changed except where explicitly noted (brand domain format fix, locations.json schema fix).

## Data flow

```
Brand/location config (SEO/shared/config/*.json)
        │
        ▼
seo-db.ts (.local-agent-global/seo/seo-control-center.db)
   ├── seo_keywords / seo_topic_clusters / seo_cluster_nodes     (keyword + cluster engines)
   ├── seo_business_facts / seo_article_facts                    (fact registry + claim guard)
   ├── seo_site_pages / seo_internal_links                       (link engine)
   ├── seo_backlinks / seo_backlink_checks                       (backlink engine)
   ├── seo_content_items / seo_article_versions                  (content pipeline)
   ├── seo_audits / seo_issues                                   (technical + local audits)
   ├── seo_actions / seo_evidence                                (policy engine + evidence, every mutating action)
   ├── seo_ai_jobs / seo_ai_responses                             (ChatGPT browser / manual / local-model jobs)
   ├── seo_gbp_snapshots / seo_rankings / seo_analytics_daily    (connector caches)
   ├── seo_publish_snapshots                                     (publish/rollback)
   └── seo_reports
        │
        ▼
seo-approval-bridge.ts ──── evaluatePolicy() (seo-policy-engine.ts + config/seo-policy.yaml)
        │                          │
        ├── BLOCKED ───────────────┴──► rejected, evidence recorded, never executes
        ├── SAFE_AUTO ─────────────────► executes immediately, evidence recorded
        ├── AUTO_WITH_NOTIFICATION ────► executes, evidence recorded, WhatsApp notification sent
        └── REQUIRES_APPROVAL ─────────► enqueue() into approval/gate.ts (existing engine, untouched)
                                                │
                                                ▼
                                        CEO approves/rejects via existing /api/approval routes
```

## Module map

| Concern | Path |
|---|---|
| Shared DB + bootstrap | `mi-core/server/src/seo/seo-db.ts` |
| Evidence | `mi-core/server/src/seo/seo-evidence.ts` |
| Policy engine | `mi-core/server/src/seo/seo-policy-engine.ts` + `mi-core/config/seo-policy.yaml` |
| Approval bridge | `mi-core/server/src/seo/seo-approval-bridge.ts` |
| Keyword research | `mi-core/server/src/seo/keywords/` |
| Topic clusters | `mi-core/server/src/seo/clusters/` |
| Business Fact Registry | `mi-core/server/src/seo/facts/` |
| Internal links / CTA / backlinks | `mi-core/server/src/seo/links/`, `seo/cta/`, `seo/backlinks/` |
| Local SEO / GBP posts | `mi-core/server/src/seo/local/` |
| Publishing adapters | `mi-core/server/src/seo/publishing/` |
| AI providers (ChatGPT browser / manual / local) | `mi-core/server/src/seo/ai-providers/` |
| Prompt templates | `mi-core/prompts/seo/*.md` |
| Routes | `mi-core/server/src/routes/seo-research.ts`, `seo-links.ts`, `seo-local.ts` (existing `routes/seo.ts`, `routes/gsc.ts`, `routes/ga4-analytics.ts`, `routes/gbp-analytics.ts` untouched) |
| Dashboard UI | `mi-core/ui/seo-control-center.html` |

## Why not a separate database / separate approval engine / separate frontend framework

Per `mi-core/CLAUDE.md` rule 2 ("DO NOT modify ... Approval Engine") and the general instruction to reuse rather than rebuild: forking a second approval store or QA engine would create exactly the kind of fragmentation the [initial audit](INITIAL_AUDIT.md) already found (5+ parallel approval implementations exist from prior work). This build adds one new SQLite database scoped to SEO data (keeping it independent of `ops.db`/`evidence.db`'s existing schemas, which are owned by other subsystems) but routes all approval decisions through the single existing gate.

## Known integration debt (see final build report for current status)

- Dashboard UI route contracts were specified before the backend engines finished — verify each `fetch()` call against the actual mounted route before treating the UI as done.
- `SEO/` (the pre-existing standalone multi-agent orchestrator) and this build's engines are not yet merged — the orchestrator's technical/citation/analytics agents remain the source for those specific audits; this build adds keyword/cluster/fact/link/backlink/local/GBP-post/publishing/AI-provider capability that didn't exist before, rather than re-implementing what already worked.
