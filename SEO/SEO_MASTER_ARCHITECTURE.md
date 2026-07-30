# SEO Agent System — Master Architecture

## Mission
A 7-agent constellation that runs every layer of Bakudan Ramen SEO under a single shared core, with Mi-Core as command/control.

## Topology

```
                          ┌───────────────────────────┐
                          │          Mi-Core          │
                          │  (control / dashboard)    │
                          └─────────────▲─────────────┘
                                        │ register / status / reports
                                        │ tasks / config
          ┌────────────┬────────────┬─────┴──────┬────────────┬────────────┬────────────┐
          ▼            ▼            ▼            ▼            ▼            ▼            ▼
    Local Maps     Website       Technical      Schema       Content      Citation     Analytics
     :4001          :4002          :4003         :4004        :4005        :4006        :4007
          \            \            │             │           /            /            /
           \            \           │             │          /            /            /
            ▼            ▼          ▼             ▼         ▼            ▼            ▼
                  ┌──────────────────────────────────────────────────────────┐
                  │  Shared Core (SEO/shared/)                               │
                  │  • config/   • database/  • contracts/  • events/ (bus)  │
                  │  • queue/    • logs/      • reports/    • mi-client/     │
                  └──────────────────────────────────────────────────────────┘
```

## Agents
| # | Agent | Port | Responsibility |
|---|-------|------|----------------|
| 1 | seo-local-maps-agent | 4001 | GBP, Google Maps, Apple Maps, Bing Places |
| 2 | seo-website-agent | 4002 | On-page SEO, keyword mapping, title/meta |
| 3 | seo-technical-agent | 4003 | Crawl, speed, mobile, indexing |
| 4 | seo-schema-agent | 4004 | JSON-LD structured data |
| 5 | seo-content-agent | 4005 | Blog, landing pages, topical authority |
| 6 | seo-citation-agent | 4006 | NAP consistency, directory citations |
| 7 | seo-analytics-agent | 4007 | KPI reporting, ranking, attribution |

## Shared Core Structure
```
shared/
  config/       → locations.json, keywords.json, pages.json, directories.json
  database/     → JSON-backed shared DB (seo-shared.db)
  contracts/    → Inter-agent message contracts
  events/       → File-based event bus (bus.log)
  queue/        → Per-agent task queues
  logs/         → Agent log files (JSONL)
  reports/      → Agent report directories + validation/
  mi-client/    → HTTP client for Mi-Core API
  base/         → Base agent factory (shared HTTP server, endpoints)
```

## Endpoints (all agents)
- `GET /health` — OK + agent id/version
- `GET /status` — agent name, version, uptime, Mi sync status
- `POST /run/audit` — trigger domain audit
- `POST /sync/mi` — manual push to Mi-Core
- `GET /reports/latest` — latest generated report

## Startup
Each agent starts independently: `node seo-<name>-agent/index.js`

## Environment Variables
```
MI_CORE_URL=        → Mi-Core base URL
MI_API_KEY=         → API key for Mi auth
SEO_AGENT_ID=       → Agent identifier
SEO_SHARED_DB_PATH= → Path to shared DB (defaults to shared/database/seo-shared.db)
SEO_SHARED_CONFIG_PATH= → Path to shared config
PORT=               → HTTP port
```

## Failure Isolation
Each agent can fail without crashing others. All use `process.on('uncaughtException')` to log and stay alive.