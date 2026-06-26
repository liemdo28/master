# Workflow Dedup Engine

Status: READY
Source: `mi-core/server/src/workflow-fabric/workflow-dedup-engine.ts`
Test: `node tests\phase07-workflow-fabric-runtime-test.mjs`

## Contract

Workflow fingerprint:

`project + entity + action + time_window`

Duplicate behavior:

`SKIP_DUPLICATE`

## Runtime Behavior

The source module normalizes each field, joins the key as `project|entity|action|time_window`, hashes it with SHA-256, and stores the first registered run. A second run with the same fingerprint returns `SKIP_DUPLICATE`.

## Current Duplicate Risks

| duplicate_area | workflow_a | workflow_b | action |
|---|---|---|---|
| QuickBooks sync | `quickbooks-daily-sync` | `finance-qb-sync` | Keep one writer workflow and make the other summary/read-only |
| SEO reporting | `seo-weekly-executive-report` | `mkt-seo-summary` | Route both through workflow dedup before execution |
| Review monitoring | `review-monitoring` | `mkt-review-summary` | Separate monitoring from summary, shared entity lock |
| Health checks | `mi-system-health-check` | `eng-pm2-health` | One health source, multiple consumers |

## Gate

No workflow should execute until it passes Executive Coordination -> Task Registry -> Duplicate Detection -> Dependency Graph -> Owner -> Evidence.
