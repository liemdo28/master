# SEO Master Architecture — Phase 6.5

**Updated:** 2026-06-24  
**Status:** Multi-Brand Production Ready

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     Mi-Core Server (port 4001)                   │
│                                                                  │
│  GET /api/seo/brands                                             │
│  GET /api/seo/brands/:brandId/dashboard                         │
│  GET /api/seo/brands/:brandId/kpis                              │
│  GET /api/seo/brands/:brandId/issues                            │
│  GET /api/seo/brands/:brandId/connectors/status                 │
│  POST /api/seo/orchestrator/run/:jobId?brand_id=all|bakudan|... │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Brand Config Loader (brand-config.ts)         │  │
│  │                                                            │  │
│  │  SEO/shared/config/brands.json  → brands map               │  │
│  │  SEO/shared/config/locations.json → locations map          │  │
│  │                                                            │  │
│  │  Brand N = insert JSON row. Zero source code change.       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                   7 SEO Agents (ports 4011-4017)           │  │
│  │                                                            │  │
│  │  Local Maps    (4011) — GBP/Apple/Bing per brand/location │  │
│  │  Website SEO   (4012) — Crawl per brand domain             │  │
│  │  Technical     (4013) — Audit per brand domain             │  │
│  │  Schema        (4014) — Schema per brand/location          │  │
│  │  Content       (4015) — Content plan per brand             │  │
│  │  Citation      (4016) — Citation scan per brand/location   │  │
│  │  Analytics     (4017) — KPI per brand/location             │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Brand Hierarchy

```
Brand Registry (brands.json)
├── bakudan (Bakudan Ramen)
│   ├── bandera
│   ├── stone-oak
│   └── the-rim
├── raw_sushi (Raw Sushi)
│   └── raw-sushi-hq (needs_location_config)
└── [Brand N] — add via JSON config
```

## Data Source Separation

All data tagged with `source` field:

| Source | Meaning | Counted as Real? |
|--------|---------|-----------------|
| `seeded` | Default/fallback data | No |
| `crawler` | Website crawler results | Yes |
| `gsc` | Google Search Console | Yes |
| `ga4` | Google Analytics 4 | Yes |
| `gbp` | Google Business Profile | Yes |
| `citation_scan` | Citation checker | Yes |
| `orchestrator` | Orchestrator job result | Yes |
| `needs_config` | Missing configuration | N/A |

## Database Schema (Phase 6.5)

### Core Brand Tables
- `brands` — Brand registry
- `brand_domains` — Domain per brand
- `brand_locations` — Location registry
- `brand_platform_accounts` — External platform accounts
- `brand_keywords` — Keyword tracking
- `brand_pages` — Page registry
- `brand_connectors` — Connector config
- `brand_permissions` — RBAC
- `brand_dashboard_snapshots` — Snapshots

### Entity Tables (brand-scoped)
Every entity includes: `brand_id`, `location_id` (nullable), `source`, `fetched_at`, `raw_payload_path`

## API Endpoints

### Brand-Level
- `GET /api/seo/brands` — List all brands
- `GET /api/seo/brands/:id` — Brand detail
- `GET /api/seo/brands/:id/dashboard` — Brand dashboard
- `GET /api/seo/brands/:id/locations` — Brand locations
- `GET /api/seo/brands/:id/kpis` — Brand KPIs
- `GET /api/seo/brands/:id/issues` — Brand issues
- `GET /api/seo/brands/:id/opportunities` — Brand opportunities
- `GET /api/seo/brands/:id/connectors/status` — Brand connectors

### Global
- `GET /api/seo/dashboard` — All brands dashboard
- `GET /api/seo/kpis` — Global KPIs
- `GET /api/seo/locations` — All locations
- `GET /api/seo/data-sources` — Data source separation

### Orchestrator
- `POST /api/seo/orchestrator/run/:jobId?brand_id=all|bakudan|raw_sushi`

### Config
- `POST /api/seo/config/reload` — Reload brand config
