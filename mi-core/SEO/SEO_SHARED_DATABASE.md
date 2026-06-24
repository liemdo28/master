# SEO Shared Database — Phase 6.5

**Updated:** 2026-06-24

## Overview

The SEO shared database stores all SEO operational data. Phase 6.5 adds full multi-brand support by adding `brand_id`, `location_id`, `source`, `fetched_at`, and `raw_payload_path` columns to every entity table.

## Core Brand Entities (NEW in Phase 6.5)

| Table | Purpose | Primary Key |
|-------|---------|------------|
| `brands` | Brand registry | `brand_id` |
| `brand_domains` | Domain per brand | `id` |
| `brand_locations` | Location per brand | `(brand_id, location_id)` |
| `brand_platform_accounts` | Platform accounts | `id` |
| `brand_keywords` | Keyword tracking | `id` |
| `brand_pages` | Page registry | `id` |
| `brand_connectors` | Connector config | `id` |
| `brand_permissions` | RBAC | `id` |
| `brand_dashboard_snapshots` | Dashboard snapshots | `id` |

## Entity Tables (upgraded with brand columns)

All v2 tables include these Phase 6.5 columns:

```sql
brand_id       TEXT NOT NULL
location_id    TEXT            -- nullable for brand-level records
source         TEXT DEFAULT 'seeded'
fetched_at     TEXT
raw_payload_path TEXT
```

Tables: `gbp_profiles_v2`, `apple_profiles`, `bing_profiles`, `pages_v2`, `keywords_v2`, `schema_items_v2`, `content_briefs_v2`, `reviews_v2`, `citations_v2`, `technical_issues_v2`, `ranking_snapshots_v2`, `analytics_metrics`, `utm_links_v2`, `agent_status_v2`, `agent_tasks_v2`, `mi_sync_logs_v2`, `reports_v2`, `connector_runs`, `orchestrator_jobs_v2`

## Migration

Run `SEO/shared/database/migrations/add-multibrand-support.sql` against the database.

## Seeded Data

### Brands
| brand_id | name | domain | status |
|----------|------|--------|--------|
| bakudan | Bakudan Ramen | https://bakudanramen.com | active |
| raw_sushi | Raw Sushi | https://rawsushibar.com | active |

### Locations
| location_id | brand_id | name | status |
|------------|----------|------|--------|
| bandera | bakudan | Bakudan Ramen - Bandera | active |
| stone-oak | bakudan | Bakudan Ramen - Stone Oak | active |
| the-rim | bakudan | Bakudan Ramen - The Rim | active |
| raw-sushi-hq | raw_sushi | Raw Sushi - Main | needs_location_config |

### Connectors
| id | brand_id | type | status |
|----|----------|------|--------|
| conn_bakudan_crawler | bakudan | crawler | ready |
| conn_bakudan_citation | bakudan | citation_scan | ready |
| conn_bakudan_gsc | bakudan | gsc | missing_credentials |
| conn_bakudan_ga4 | bakudan | ga4 | missing_credentials |
| conn_bakudan_gbp | bakudan | gbp | missing_credentials |
| conn_raw_sushi_crawler | raw_sushi | crawler | ready |
| conn_raw_sushi_citation | raw_sushi | citation_scan | ready |
| conn_raw_sushi_gsc | raw_sushi | gsc | missing_credentials |
| conn_raw_sushi_ga4 | raw_sushi | ga4 | missing_credentials |
| conn_raw_sushi_gbp | raw_sushi | gbp | missing_credentials |

## Adding a New Brand

1. Insert into `brands` table (or `brands.json`)
2. Insert into `brand_locations` table (or `locations.json`)
3. Insert connector config into `brand_connectors`
4. Run `POST /api/seo/config/reload` to pick up changes
5. **No source code changes required**
