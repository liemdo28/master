# SEO Shared Database

## Implementation
JSON file at `shared/database/seo-shared.db`. Zero native dependencies.

## Entities (18 tables)
- locations
- gbp_profiles
- apple_profiles
- bing_profiles
- pages
- keywords
- schema_items
- content_briefs
- reviews
- citations
- technical_issues
- ranking_snapshots
- analytics_metrics
- utm_links
- agent_status
- agent_tasks
- mi_sync_logs
- reports

## Concurrency
Per-process unique temp file + retry-rename pattern handles multi-agent writes.

## Access Pattern
All agents call `getDatabase(dbPath)` from `shared/database/index.js`. Singleton per process.
